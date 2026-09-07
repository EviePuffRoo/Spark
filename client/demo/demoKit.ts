import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import type { BrowserContext, Locator, Page } from "@playwright/test";

// The shooting rig: everything a segment needs to look like a person using
// the app rather than a test suite driving it.
//
// Three problems it solves, all of which come from Playwright being a test
// runner rather than a screen recorder:
//
//   1. Recorded video has no mouse cursor. Playwright drives input through
//      CDP, so the page receives real mousemove events but the compositor
//      never draws a pointer — clicks land out of nowhere and the footage is
//      unreadable. installChrome() injects one that follows those events.
//   2. locator.click() teleports the pointer to the target in a single
//      event. glide()/click() below interpolate the move instead, because a
//      cursor that slides is the difference between "a person is doing this"
//      and "a script is doing this".
//   3. Video has no timeline you can search. Every beat() writes a labelled
//      offset into showcase-out/beats/<segment>.json, which is the edit
//      decision list: assembling a cut becomes reading timestamps rather
//      than scrubbing for the moment the spell landed.
//
// The overlay is aria-hidden with its own id prefix and pointer-events:none,
// so it can never intercept a click or be picked up by a page selector.

const CLIENT_DIR = process.cwd().endsWith(`${sep}client`) ? process.cwd() : resolve(process.cwd(), "client");
export const SHOWCASE_DIR = resolve(CLIENT_DIR, "showcase-out");

const OVERLAY_SCRIPT = `
(() => {
  if (window.__sparkDemoInstalled) return;
  window.__sparkDemoInstalled = true;

  const install = () => {
    if (!document.body) return requestAnimationFrame(install);

    const style = document.createElement("style");
    style.textContent = \`
      #spark-demo-cursor {
        position: fixed; top: 0; left: 0; width: 26px; height: 26px;
        margin: -3px 0 0 -3px; z-index: 2147483647; pointer-events: none;
        transition: transform 60ms linear; will-change: transform;
      }
      #spark-demo-cursor svg { display: block; filter: drop-shadow(0 2px 3px rgba(0,0,0,.55)); }
      #spark-demo-ring {
        position: fixed; top: 0; left: 0; width: 46px; height: 46px; margin: -23px 0 0 -23px;
        border-radius: 50%; border: 2px solid rgba(255,255,255,.9);
        background: rgba(255,255,255,.14);
        z-index: 2147483646; pointer-events: none; opacity: 0; transform: scale(.3);
      }
      #spark-demo-ring.spark-demo-pulse { animation: spark-demo-pulse 460ms ease-out; }
      @keyframes spark-demo-pulse {
        0%   { opacity: .95; transform: scale(.28); }
        100% { opacity: 0;   transform: scale(1.25); }
      }
      #spark-demo-caption {
        position: fixed; left: 50%; bottom: 34px; transform: translateX(-50%);
        z-index: 2147483645; pointer-events: none;
        max-width: min(1100px, 82vw); box-sizing: border-box;
        padding: 13px 26px; border-radius: 12px;
        background: rgba(11, 12, 18, .86);
        border: 1px solid rgba(255,255,255,.13);
        box-shadow: 0 10px 40px rgba(0,0,0,.45);
        color: #f4f2ff; text-align: center;
        font: 500 21px/1.35 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        letter-spacing: .1px;
        opacity: 0; transition: opacity 260ms ease;
      }
      #spark-demo-caption.spark-demo-on { opacity: 1; }
      #spark-demo-badge {
        position: fixed; right: 26px; top: 22px; z-index: 2147483645; pointer-events: none;
        padding: 7px 15px; border-radius: 999px;
        background: rgba(11,12,18,.72); border: 1px solid rgba(255,255,255,.14);
        color: #cfc9ff; font: 600 13px/1 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: .12em; text-transform: uppercase;
        opacity: 0; transition: opacity 260ms ease;
      }
      #spark-demo-badge.spark-demo-on { opacity: 1; }
    \`;
    document.head.appendChild(style);

    const frag = document.createElement("div");
    frag.setAttribute("aria-hidden", "true");
    frag.innerHTML =
      '<div id="spark-demo-ring"></div>' +
      '<div id="spark-demo-cursor">' +
        '<svg viewBox="0 0 26 26" width="26" height="26">' +
          '<path d="M3 2 L3 20.5 L8.1 15.8 L11.3 23 L14.6 21.4 L11.5 14.6 L18.4 14.3 Z"' +
          ' fill="#ffffff" stroke="#15151c" stroke-width="1.4" stroke-linejoin="round"/>' +
        '</svg>' +
      '</div>' +
      '<div id="spark-demo-caption"></div>' +
      '<div id="spark-demo-badge"></div>';
    document.body.appendChild(frag);

    const cursor = frag.querySelector("#spark-demo-cursor");
    const ring = frag.querySelector("#spark-demo-ring");
    const caption = frag.querySelector("#spark-demo-caption");
    const badge = frag.querySelector("#spark-demo-badge");

    // Parked off-screen until the first real move, so a cursor never sits in
    // the top-left corner of the opening frame.
    let placed = false;
    cursor.style.transform = "translate(-100px, -100px)";

    const move = (x, y) => {
      placed = true;
      cursor.style.transform = \`translate(\${x}px, \${y}px)\`;
      ring.style.transform = \`translate(\${x}px, \${y}px) scale(.3)\`;
    };
    addEventListener("mousemove", (e) => move(e.clientX, e.clientY), true);
    addEventListener("mousedown", (e) => {
      if (!placed) move(e.clientX, e.clientY);
      ring.style.left = "0px";
      ring.classList.remove("spark-demo-pulse");
      void ring.offsetWidth;
      ring.style.transform = \`translate(\${e.clientX}px, \${e.clientY}px)\`;
      ring.classList.add("spark-demo-pulse");
    }, true);

    window.__sparkDemoSay = (text) => {
      if (!text) { caption.classList.remove("spark-demo-on"); return; }
      caption.textContent = text;
      caption.classList.add("spark-demo-on");
    };
    window.__sparkDemoBadge = (text) => {
      if (!text) { badge.classList.remove("spark-demo-on"); return; }
      badge.textContent = text;
      badge.classList.add("spark-demo-on");
    };
  };
  install();
})();
`;

/** Injects the cursor, click ripple, caption bar and corner badge. Call before the first navigation. */
export async function installChrome(context: BrowserContext) {
  await context.addInitScript(OVERLAY_SCRIPT);
}

export interface Beat {
  /** Milliseconds from the moment this segment's recording started. */
  t: number;
  label: string;
  /** Which recorded view this beat belongs to, for multi-camera segments. */
  view?: string;
}

// One segment's recording session: holds the shared clock, collects beats,
// and writes the sheet the edit is assembled from.
export class Segment {
  readonly name: string;
  readonly startedAt = Date.now();
  private readonly beats: Beat[] = [];
  private readonly videos: Record<string, { path: string; offsetMs: number }> = {};

  constructor(name: string) {
    this.name = name;
  }

  /** Marks a moment worth cutting on. */
  beat(label: string, view?: string) {
    const t = Date.now() - this.startedAt;
    this.beats.push({ t, label, ...(view ? { view } : {}) });
    const secs = (t / 1000).toFixed(1).padStart(6, " ");
    console.log(`  ${secs}s  ${view ? `[${view}] ` : ""}${label}`);
  }

  // offsetMs is how far into the segment this view's recording started —
  // a two-camera segment cannot open both contexts at the same instant, and
  // without it the assembly has no way to line the two files up.
  recordVideo(view: string, path: string, offsetMs: number) {
    this.videos[view] = { path, offsetMs };
  }

  write() {
    const out = resolve(SHOWCASE_DIR, "beats", `${this.name}.json`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({
      segment: this.name,
      startedAt: new Date(this.startedAt).toISOString(),
      durationMs: Date.now() - this.startedAt,
      videos: this.videos,
      beats: this.beats,
    }, null, 2));
    console.log(`\n  beat sheet -> ${out}`);
    return out;
  }
}

/** A deliberate hold, so the viewer's eye can land before the next action. */
export function hold(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Sets the caption bar. Pass null to clear it. */
export async function say(page: Page, text: string | null) {
  await page.evaluate((t) => (window as never as { __sparkDemoSay?: (s: string | null) => void }).__sparkDemoSay?.(t), text);
}

/** Sets the persistent corner badge naming the area on screen. */
export async function badge(page: Page, text: string | null) {
  await page.evaluate((t) => (window as never as { __sparkDemoBadge?: (s: string | null) => void }).__sparkDemoBadge?.(t), text);
}

/** Says a line, holds long enough to read it, then moves on. */
export async function beatSay(page: Page, segment: Segment, text: string, ms = 1900, view?: string) {
  await say(page, text);
  segment.beat(text, view);
  await hold(ms);
}

async function centreOf(target: Locator) {
  const box = await target.boundingBox();
  if (!box) throw new Error(`No bounding box for ${target}; it is not visible.`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Brings an element into the viewport by scrolling the page, if it isn't
 * already comfortably in it.
 *
 * Deliberately not locator.scrollIntoViewIfNeeded(): that goes through
 * CDP's DOM.scrollIntoViewIfNeeded, which times out on elements inside a
 * CSS-zoomed subtree — and the whole app is zoomed while shooting (see
 * SHOOT). It fails as a 20-second hang naming the right element, which
 * reads like a missing selector and is not one.
 */
async function ensureInView(page: Page, target: Locator) {
  const vp = page.viewportSize();
  if (!vp) return;
  const top = vp.height * 0.1;
  const bottom = vp.height * 0.85;
  for (let i = 0; i < 16; i++) {
    const box = await target.boundingBox();
    if (!box) return;
    const centre = box.y + box.height / 2;
    if (centre >= top && centre <= bottom) return;
    const delta = centre < top ? centre - vp.height * 0.4 : centre - vp.height * 0.6;
    // Wheel over the target's own column, not over a fixed gutter: a wheel
    // event scrolls whatever is under the cursor, and the tracker's
    // combatant rail is its own scroll container. Parked anywhere else, this
    // scrolled the page while the rail stayed put, the target never came
    // into view, and the click landed on whatever was actually there — which
    // for the attack panel meant hitting the row's Attack toggle and closing
    // the panel the next step was about to use.
    const x = Math.max(8, Math.min(vp.width - 8, box.x + box.width / 2));
    await page.mouse.move(x, Math.round(vp.height * 0.5), { steps: 4 });
    await page.mouse.wheel(0, Math.round(Math.max(-600, Math.min(600, delta))));
    await hold(70);
  }
}

/**
 * Slides the pointer to an element without clicking it.
 *
 * `noScroll` for anything inside a map canvas: both ZoneMap and GridMap
 * handle the wheel themselves to zoom, so scrolling toward a token or a zone
 * node moves it out from under the cursor instead of bringing it into view,
 * and every retry zooms further out. Frame the canvas first with frame(),
 * then click into it without scrolling.
 */
export async function glide(page: Page, target: Locator, steps = 22, noScroll = false) {
  if (!noScroll) await ensureInView(page, target);
  const { x, y } = await centreOf(target);
  await page.mouse.move(x, y, { steps });
  await hold(160);
}

/**
 * Slides the pointer onto an element and clicks it, at a pace the eye can
 * follow.
 *
 * The re-check before pressing is not paranoia: the tracker's combatant rail
 * is its own scroll container, so bringing something in view there can still
 * be settling when the press lands, and the click goes to whatever moved
 * under the cursor instead. On camera that looks like the app ignoring a
 * button.
 */
export async function click(page: Page, target: Locator, opts: { steps?: number; settle?: number; noScroll?: boolean } = {}) {
  await glide(page, target, opts.steps ?? 22, opts.noScroll);
  const before = await centre(target);
  const now = await centre(target);
  if (Math.abs(now.x - before.x) > 3 || Math.abs(now.y - before.y) > 3) {
    await page.mouse.move(now.x, now.y, { steps: 6 });
    await hold(180);
  }
  await page.mouse.down();
  await hold(70);
  await page.mouse.up();
  await hold(opts.settle ?? 340);
}

/**
 * Clicks something, and clicks it again if the thing it was supposed to
 * produce doesn't turn up.
 *
 * For controls inside the tracker's combatant rail, which is its own scroll
 * container: bringing a button into view there can still be settling when
 * the press lands, and the click goes to whatever moved under the cursor.
 * Retrying is right for a rig even though it would be wrong for a test —
 * the shot is of a person clicking a button until it works, which is also
 * what a person does.
 */
export async function clickUntil(page: Page, target: Locator, appears: Locator, tries = 4, opts: { noScroll?: boolean } = {}) {
  for (let i = 0; i < tries; i++) {
    await click(page, target, { settle: 320, noScroll: opts.noScroll });
    try {
      await appears.first().waitFor({ state: "visible", timeout: 4000 });
      return;
    } catch {
      if (i === tries - 1) {
        // Say what was actually on screen. A bare "nothing appeared" sends
        // you looking for a wrong selector when the cause is usually a click
        // that landed somewhere else.
        const seen = await target.textContent().catch(() => "<gone>");
        throw new Error(`clickUntil: nothing appeared after ${tries} attempts (target read "${seen?.trim()}")`);
      }
      await hold(420);
    }
  }
}

/** Clicks a bare viewport coordinate — grid cells, canvas painting. */
export async function clickAt(page: Page, x: number, y: number, opts: { steps?: number; settle?: number } = {}) {
  await page.mouse.move(x, y, { steps: opts.steps ?? 14 });
  await page.mouse.down();
  await hold(60);
  await page.mouse.up();
  await hold(opts.settle ?? 130);
}

/**
 * Types into a field one key at a time, the way a person would.
 *
 * Clears first: a segment that fills the same field twice (a second
 * character's downtime, a different search) would otherwise append to
 * whatever the last beat left there.
 */
export async function type(page: Page, target: Locator, text: string, delay = 42) {
  await click(page, target, { settle: 120 });
  await target.fill("");
  await target.pressSequentially(text, { delay });
  await hold(260);
}

/** Presses and drags between two viewport points, reporting each interpolated step. */
export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 26) {
  await page.mouse.move(from.x, from.y, { steps: 12 });
  await hold(180);
  await page.mouse.down();
  await hold(140);
  await page.mouse.move(to.x, to.y, { steps });
  await hold(220);
  await page.mouse.up();
  await hold(320);
}

/** The centre of an element, in viewport coordinates. */
export async function centre(target: Locator) {
  return centreOf(target);
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export interface View {
  name: string;
  page: Page;
  context: BrowserContext;
  /** Closes the context and files the finished video under showcase-out/video. */
  finish(): Promise<void>;
}

export interface OpenViewOptions {
  /** Label for this camera in the beat sheet and the output filename. */
  name: string;
  segment: Segment;
  /** Signs in over the API before the first navigation, so no login screen is ever filmed. */
  signIn?: { username: string; password: string };
  /** Where to land. Relative to baseURL. */
  url?: string;
  /**
   * Values written to localStorage before the app's first render, so a
   * segment never opens on a "pick a world" screen or on whichever tab the
   * previous take happened to leave selected. Values are JSON-encoded to
   * match useLocalStorage.
   */
  storage?: Record<string, unknown>;
  width?: number;
  height?: number;
  /**
   * CSS zoom applied to the app root. The battle grid and the builder canvas
   * are drawn at a fixed 32px per cell, so on a 1920-wide frame a 20x14 map
   * is only a third of the picture — zooming the app is the difference
   * between a map you can read and a map you can see. Applied to #root and
   * not to body, so the recorded cursor and caption stay their true size.
   */
  zoom?: number;
}

// 16:9 at a size where the battle grid still fits without the svg clipping
// (see CLAUDE.md — a clipped canvas also puts click coordinates in the wrong
// cell, which on camera looks like the app misplacing a token).
export const VIEW_WIDTH = 1920;
export const VIEW_HEIGHT = 1080;

/**
 * The house shooting format.
 *
 * The app caps its own content at 1100px (`.app-content`, App.css), so a
 * 1920-wide frame is about a quarter empty gutter and everything in it is
 * correspondingly small — measured on the live app, the battle grid draws at
 * 570x380 whether the viewport is 1366 or 1920, which is a tenth of a 1080p
 * frame.
 *
 * Zooming the app root rather than shrinking the viewport is what fixes it:
 * the page lays out at 1920/1.33 ≈ 1444 CSS px, so the content cap lands
 * near the frame edge, while the frame itself stays natively 1920x1080.
 *
 * Tried and rejected: a 1440x810 viewport recorded into a 1920x1080 file.
 * Playwright does not scale the viewport up to the recording size — it
 * composites it at natural size into the corner, so every frame came out
 * with a black band down two sides.
 */
export const SHOOT = { zoom: 1.33 } as const;

export async function openView(
  browser: { newContext: (o: Record<string, unknown>) => Promise<BrowserContext> },
  opts: OpenViewOptions,
): Promise<View> {
  const width = opts.width ?? VIEW_WIDTH;
  const height = opts.height ?? VIEW_HEIGHT;
  const dir = resolve(SHOWCASE_DIR, "video", ".raw");

  // Recording begins when the context is created, so this is the moment the
  // resulting file's timeline starts from.
  const startedAt = Date.now();
  const context = await browser.newContext({
    baseURL: "http://localhost:5200",
    viewport: { width, height },
    deviceScaleFactor: 1,
    // Always the viewport size — Playwright composites the viewport into a
    // larger recording rather than scaling it up. See SHOOT.
    recordVideo: { dir, size: { width, height } },
    // Deterministic across machines, so two takes of the same segment cut
    // together and dates on screen don't jump.
    locale: "en-GB",
    timezoneId: "UTC",
    colorScheme: "dark",
  });

  if (opts.signIn) {
    const res = await context.request.post("/api/auth/login", { data: opts.signIn });
    if (!res.ok()) throw new Error(`demo sign-in failed for ${opts.signIn.username}: ${res.status()} ${await res.text()}`);
  }

  if (opts.zoom && opts.zoom !== 1) {
    await context.addInitScript((z: number) => {
      const apply = () => {
        if (!document.head) return requestAnimationFrame(apply);
        const style = document.createElement("style");
        style.textContent = `#root { zoom: ${z}; }`;
        document.head.appendChild(style);
      };
      apply();
    }, opts.zoom);
  }

  if (opts.storage) {
    await context.addInitScript((entries: [string, string][]) => {
      for (const [k, v] of entries) {
        try { localStorage.setItem(k, v); } catch { /* private mode */ }
      }
    }, Object.entries(opts.storage).map(([k, v]) => [k, JSON.stringify(v)] as [string, string]));
  }

  await installChrome(context);
  const page = await context.newPage();
  await page.goto(opts.url ?? "/");

  return {
    name: opts.name,
    page,
    context,
    async finish() {
      const video = page.video();
      await context.close();
      if (!video) return;
      const target = resolve(SHOWCASE_DIR, "video", `${opts.segment.name}--${opts.name}.webm`);
      mkdirSync(dirname(target), { recursive: true });
      await video.saveAs(target);
      await video.delete().catch(() => {});
      opts.segment.recordVideo(opts.name, target, startedAt - opts.segment.startedAt);
      console.log(`  video     -> ${target}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Grid coordinates
// ---------------------------------------------------------------------------

/**
 * The viewport point at the centre of grid cell (cx, cy).
 *
 * Asks the browser rather than doing the arithmetic here. Both maps scroll
 * inside a panel and letterbox via preserveAspectRatio, and the battle grid
 * additionally pans and zooms its content inside a <g transform> — so the
 * mapping from cell to screen is nothing like box.x + cx * cell.
 * getScreenCTM is the transform actually in effect, all of that included.
 * A click that lands one cell out looks, on camera, exactly like the app
 * misplacing a token.
 *
 * Pass the element whose coordinate space the cells are in: the <svg> itself
 * for the map builder, the panned <g> for the battle grid.
 */
export async function cellPoint(space: Locator, cx: number, cy: number, cell = 32) {
  return space.evaluate((el, { cx, cy, cell }) => {
    const g = el as unknown as SVGGraphicsElement;
    const owner = (g as unknown as SVGSVGElement).createSVGPoint ? (g as unknown as SVGSVGElement) : g.ownerSVGElement;
    if (!owner) throw new Error("element is not inside an <svg>");
    const ctm = g.getScreenCTM();
    if (!ctm) throw new Error("element has no screen CTM — is it visible?");
    const pt = owner.createSVGPoint();
    pt.x = (cx + 0.5) * cell;
    pt.y = (cy + 0.5) * cell;
    const p = pt.matrixTransform(ctm);
    return { x: p.x, y: p.y };
  }, { cx, cy, cell });
}

/** Paints a run of cells as one held stroke, the way a person drags a brush. */
export async function paintRun(page: Page, svg: Locator, cells: [number, number][], cell = 32) {
  if (cells.length === 0) return;
  const points = [];
  for (const [cx, cy] of cells) points.push(await cellPoint(svg, cx, cy, cell));
  await page.mouse.move(points[0].x, points[0].y, { steps: 12 });
  await hold(200);
  await page.mouse.down();
  for (const p of points.slice(1)) {
    await page.mouse.move(p.x, p.y, { steps: 3 });
    await hold(55);
  }
  await hold(140);
  await page.mouse.up();
  await hold(320);
}

/**
 * Scrolls the page until `target` sits at a given height in frame.
 *
 * Wheeling rather than scrollIntoViewIfNeeded so the move is visible and
 * deliberate, and self-correcting rather than a guessed pixel delta — the
 * same page is a different height at a different zoom.
 *
 * The cursor is parked in the header strip at the top first, which belongs
 * to no scroll container: a wheel event over the battle grid zooms the map
 * (GridMap's own onWheel) instead of scrolling the page, over the map
 * builder's palette it scrolls the palette, and over the tracker's combatant
 * rail it scrolls the rail.
 */
export async function frame(page: Page, target: Locator, opts: { at?: number; gutterX?: number } = {}) {
  const want = opts.at ?? 0.46;
  const vp = page.viewportSize();
  if (!vp) return;
  await page.mouse.move(opts.gutterX ?? Math.round(vp.width * 0.5), 34, { steps: 10 });
  for (let i = 0; i < 16; i++) {
    const box = await target.boundingBox();
    if (!box) return;
    const delta = box.y + box.height / 2 - vp.height * want;
    if (Math.abs(delta) < 28) return;
    await page.mouse.wheel(0, Math.round(Math.max(-500, Math.min(500, delta))));
    await hold(80);
  }
  // Ran out of attempts: the target is in a container that will not scroll
  // any further. Better to shoot it where it is than to fail the segment.
}

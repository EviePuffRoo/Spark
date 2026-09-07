#!/usr/bin/env node
// Assembles the recorded segments into one cut.
//
// The point of the beat sheets is that this step is deterministic: every
// segment records a labelled offset for each moment worth cutting on, so
// putting the tour together is arithmetic rather than scrubbing. This script
// is the simplest useful consumer of that — straight concatenation, with the
// two-camera segment composited picture-in-picture so both screens are in
// one frame. A real edit would use the same beat sheets to do something more
// considered; this exists so there is always something watchable.
//
// ffmpeg comes from Playwright's own bundle (it ships one for video
// recording), so there is nothing extra to install. It has libvpx and not
// libx264, hence WebM out.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";

const CLIENT_DIR = process.cwd().endsWith(`${sep}client`) ? process.cwd() : resolve(process.cwd(), "client");
const OUT = resolve(CLIENT_DIR, "showcase-out");
const BEATS = resolve(OUT, "beats");
const PARTS = resolve(OUT, "parts");
const FFMPEG = process.env.FFMPEG_PATH ?? "/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux";

const W = 1920, H = 1080, FPS = 30;

// Every filter option is named rather than positional. This ffmpeg build
// refuses to mix the two forms in one filter, and the error it gives for it
// ("No option name near ...") points at the wrong end of the chain.
const FIT = `scale=w=${W}:h=${H}:force_original_aspect_ratio=decrease,pad=w=${W}:h=${H}:x=(ow-iw)/2:y=(oh-ih)/2`;

function ff(args) {
  return execFileSync(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: ["ignore", "pipe", "inherit"] });
}

// Playwright ships a deliberately minimal ffmpeg — enough to write the videos
// it records, and no more. On this machine that is scale, pad, crop, trim,
// format and the transposes: no overlay, no hstack. So the two-camera segment
// composites into one frame where a full ffmpeg is available and is laid out
// as two consecutive clips where it isn't, rather than the script failing on
// a filter that was never going to be there.
const DEMUXERS = execFileSync(FFMPEG, ["-hide_banner", "-demuxers"], { stdio: ["ignore", "pipe", "ignore"] }).toString();
const CAN_JOIN = /\bconcat\b/.test(DEMUXERS);

const FILTERS = new Set(
  execFileSync(FFMPEG, ["-hide_banner", "-filters"], { stdio: ["ignore", "pipe", "ignore"] })
    .toString().split("\n").map((l) => l.trim().split(/\s+/)[1]).filter(Boolean),
);
const CAN_COMPOSITE = FILTERS.has("overlay");

if (!existsSync(BEATS)) {
  console.error(`No beat sheets in ${BEATS}. Record something first:  npm run demo`);
  process.exit(1);
}

rmSync(PARTS, { recursive: true, force: true });
mkdirSync(PARTS, { recursive: true });

const sheets = readdirSync(BEATS)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(resolve(BEATS, f), "utf8")));

const parts = [];

for (const sheet of sheets) {
  const views = Object.entries(sheet.videos ?? {}).map(([name, v]) => [
    name,
    // Older sheets stored just the path; per-view start offsets came later.
    typeof v === "string" ? { path: v, offsetMs: 0 } : v,
  ]);
  if (views.length === 0) {
    console.warn(`  ${sheet.segment}: no video recorded, skipping`);
    continue;
  }
  const part = resolve(PARTS, `${sheet.segment}.webm`);

  if (views.length === 1) {
    const [, v] = views[0];
    console.log(`  ${sheet.segment}: single view`);
    ff(["-i", v.path, "-vf", FIT, "-r", String(FPS), "-c:v", "libvpx", "-b:v", "3M", "-an", part]);
  } else {
    // Two cameras. They cannot be opened at the same instant, so each view
    // records how far into the segment its own file starts, and trimming by
    // the difference puts both on the segment's clock. Without it the second
    // screen runs ahead by however long its context took to open — which is
    // exactly the moment a viewer is checking that the two screens agree.
    const named = Object.fromEntries(views);
    const main = named.dm ?? views[0][1];
    const inset = named.table ?? views[1][1];
    const skew = Math.max(0, (inset.offsetMs - main.offsetMs) / 1000);

    if (CAN_COMPOSITE) {
      console.log(`  ${sheet.segment}: picture-in-picture, main trimmed by ${skew.toFixed(2)}s of skew`);
      const iw = Math.round(W * 0.34), ih = Math.round(iw * H / W);
      ff([
        "-ss", skew.toFixed(3), "-i", main.path,
        "-i", inset.path,
        "-filter_complex",
        `[0:v]${FIT}[bg];` +
        `[1:v]scale=w=${iw}:h=${ih},pad=w=${iw + 8}:h=${ih + 8}:x=4:y=4:color=0x8b7bd8[pip];` +
        `[bg][pip]overlay=x=W-w-40:y=H-h-40:shortest=1[v]`,
        "-map", "[v]", "-r", String(FPS), "-c:v", "libvpx", "-b:v", "3M", "-an", part,
      ]);
      parts.push(part);
    } else {
      console.log(`  ${sheet.segment}: ${views.length} views, laid out one after another`);
      console.log("    (this ffmpeg has no overlay filter, so they cannot share a frame —");
      console.log("     the beat sheet carries the offsets to composite them elsewhere)");
      for (const [name, v] of views) {
        const viewPart = resolve(PARTS, `${sheet.segment}--${name}.webm`);
        // Trimmed to a common start so the two clips cover the same span of
        // the fight and cut against each other cleanly.
        const trim = Math.max(0, (Math.max(main.offsetMs, inset.offsetMs) - v.offsetMs) / 1000);
        ff(["-ss", trim.toFixed(3), "-i", v.path, "-vf", FIT, "-r", String(FPS), "-c:v", "libvpx", "-b:v", "3M", "-an", viewPart]);
        parts.push(viewPart);
      }
    }
    continue;
  }
  parts.push(part);
}

if (parts.length === 0) {
  console.error("Nothing to assemble.");
  process.exit(1);
}

// Every part is now the same size and frame rate, which is the bit that
// matters for an edit. Joining them is a container operation and needs the
// concat demuxer, which Playwright's ffmpeg does not carry — so it is
// attempted, not assumed.
const final = resolve(OUT, "spark-tour.webm");
let joined = false;
if (CAN_JOIN) {
  const list = resolve(PARTS, "parts.txt");
  writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
  ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", final]);
  joined = true;
}

// The cut list: every labelled beat, renumbered onto the assembled timeline.
let clock = 0;
const lines = [];
for (const sheet of sheets) {
  if (!sheet.videos || Object.keys(sheet.videos).length === 0) continue;
  lines.push(`\n${sheet.segment}`);
  for (const b of sheet.beats) {
    const t = clock + b.t / 1000;
    const mm = String(Math.floor(t / 60)).padStart(2, "0");
    const ss = (t % 60).toFixed(1).padStart(4, "0");
    lines.push(`  ${mm}:${ss}  ${b.view ? `[${b.view}] ` : ""}${b.label}`);
  }
  clock += sheet.durationMs / 1000;
}
const cutList = resolve(OUT, "cut-list.txt");
writeFileSync(cutList, lines.join("\n").trim() + "\n");

console.log("");
if (joined) {
  console.log(`  ${final}`);
} else {
  console.log("  Parts are normalised to 1920x1080 @ 30fps but not joined —");
  console.log("  this ffmpeg has no concat demuxer. In order:");
  for (const p of parts) console.log(`    ${p}`);
}
console.log(`  ${cutList}`);
console.log(lines.join("\n"));

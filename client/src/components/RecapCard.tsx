import { useEffect, useRef } from "react";
import type { SessionHighlights } from "@spark/shared";

// Fixed, always-legible palette independent of the viewer's app theme —
// this card is meant to be shared and viewed outside Spark entirely
// (Discord, texts), where "matching my current Spark theme" has no
// meaning. Deliberately not read from CSS custom properties.
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 675;
const PAD = 56;
const BG_TOP = "#150f2e";
const BG_BOTTOM = "#0b0a13";
const ACCENT_2 = "#46c6ff";
const TEXT = "#f5f3fc";
const TEXT_MUTED = "#a89fc9";
const CHIP_BG = "rgba(255, 255, 255, 0.06)";
const CHIP_BORDER = "rgba(157, 92, 255, 0.35)";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function listWithOverflow(names: string[], max: number): string {
  if (names.length === 0) return "";
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} +${names.length - max} more`;
}

function drawStatChip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, value: string) {
  ctx.fillStyle = CHIP_BG;
  ctx.strokeStyle = CHIP_BORDER;
  ctx.lineWidth = 1;
  const r = 12;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = TEXT;
  ctx.font = "700 30px 'Unbounded', system-ui, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(value, x + 18, y + 44);

  ctx.fillStyle = TEXT_MUTED;
  ctx.font = "600 14px 'Manrope', system-ui, sans-serif";
  ctx.fillText(label.toUpperCase(), x + 18, y + h - 14);
}

function drawRow(ctx: CanvasRenderingContext2D, x: number, y: number, maxWidth: number, label: string, value: string): number {
  ctx.fillStyle = ACCENT_2;
  ctx.font = "700 15px 'Manrope', system-ui, sans-serif";
  ctx.fillText(label.toUpperCase(), x, y);

  ctx.fillStyle = TEXT;
  ctx.font = "500 18px 'Manrope', system-ui, sans-serif";
  const words = value.split(" ");
  let line = "";
  let lineY = y + 26;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += 24;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, lineY);
  return lineY + 30;
}

function draw(ctx: CanvasRenderingContext2D, highlights: SessionHighlights, worldName: string) {
  ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const bgGradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bgGradient.addColorStop(0, BG_TOP);
  bgGradient.addColorStop(1, BG_BOTTOM);
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const accentBar = ctx.createLinearGradient(0, 0, CARD_WIDTH, 0);
  accentBar.addColorStop(0, "#9d5cff");
  accentBar.addColorStop(0.55, "#5b8dff");
  accentBar.addColorStop(1, "#46c6ff");
  ctx.fillStyle = accentBar;
  ctx.fillRect(0, 0, CARD_WIDTH, 8);

  ctx.fillStyle = TEXT_MUTED;
  ctx.font = "600 16px 'Manrope', system-ui, sans-serif";
  ctx.fillText("SPARK · SESSION RECAP", PAD, 62);

  ctx.fillStyle = TEXT;
  ctx.font = "800 44px 'Unbounded', system-ui, sans-serif";
  ctx.fillText(worldName, PAD, 112);

  ctx.fillStyle = TEXT_MUTED;
  ctx.font = "500 17px 'Manrope', system-ui, sans-serif";
  ctx.fillText(`Since ${formatDate(highlights.since)}`, PAD, 142);

  const chipY = 170;
  const chipH = 84;
  const chipGap = 16;
  const chipW = (CARD_WIDTH - PAD * 2 - chipGap * 2) / 3;
  drawStatChip(ctx, PAD, chipY, chipW, chipH, "Rolls Logged", String(highlights.rollCount));
  drawStatChip(ctx, PAD + chipW + chipGap, chipY, chipW, chipH, "Messages", String(highlights.messageCount));
  const goldLabel = highlights.goldDelta === 0 ? "0 gp" : `${highlights.goldDelta > 0 ? "+" : ""}${highlights.goldDelta} gp`;
  drawStatChip(ctx, PAD + (chipW + chipGap) * 2, chipY, chipW, chipH, "Gold Delta", goldLabel);

  const colGap = 40;
  const colW = (CARD_WIDTH - PAD * 2 - colGap) / 2;
  const leftX = PAD;
  const rightX = PAD + colW + colGap;
  let leftY = chipY + chipH + 56;
  let rightY = chipY + chipH + 56;

  if (highlights.naturalTwenties.length > 0) {
    const names = highlights.naturalTwenties.map((r) => r.rollerName);
    leftY = drawRow(ctx, leftX, leftY, colW, "Natural 20s", listWithOverflow(names, 5));
  }
  if (highlights.naturalOnes.length > 0) {
    const names = highlights.naturalOnes.map((r) => r.rollerName);
    leftY = drawRow(ctx, leftX, leftY, colW, "Natural 1s", listWithOverflow(names, 5));
  }
  if (highlights.topRolls.length > 0) {
    const top = highlights.topRolls[0];
    leftY = drawRow(ctx, leftX, leftY, colW, "Biggest Roll", `${top.rollerName} rolled ${top.total}`);
  }
  if (highlights.mostActiveRoller) {
    leftY = drawRow(ctx, leftX, leftY, colW, "Most Active Roller", `${highlights.mostActiveRoller.rollerName} — ${highlights.mostActiveRoller.rollCount} rolls`);
  }

  if (highlights.itemsGained.length > 0) {
    const items = highlights.itemsGained.map((i) => `${i.label} ×${i.quantity}`);
    rightY = drawRow(ctx, rightX, rightY, colW, "Loot Gained", listWithOverflow(items, 5));
  }
  if (highlights.questsCompleted.length > 0) {
    const titles = highlights.questsCompleted.map((q) => q.title);
    rightY = drawRow(ctx, rightX, rightY, colW, "Quests Completed", listWithOverflow(titles, 5));
  }

  ctx.fillStyle = TEXT_MUTED;
  ctx.font = "600 14px 'Manrope', system-ui, sans-serif";
  ctx.fillText("sparkdm.quest", PAD, CARD_HEIGHT - 28);
}

export function RecapCard({ highlights, worldName }: { highlights: SessionHighlights; worldName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CARD_WIDTH * dpr;
    canvas.height = CARD_HEIGHT * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    draw(ctx, highlights, worldName);

    // Redraw once the display fonts have actually loaded — the first
    // paint above can land before Unbounded is ready and fall back to
    // a system sans-serif for the headline.
    document.fonts.ready.then(() => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, highlights, worldName);
    });
  }, [highlights, worldName]);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `spark-recap-${worldName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  return (
    <div className="recap-card">
      <canvas ref={canvasRef} className="recap-card-canvas" style={{ width: "100%", height: "auto" }} aria-label={`Session recap card for ${worldName}`} />
      <button className="btn-secondary" onClick={handleDownload}>Download Image</button>
    </div>
  );
}

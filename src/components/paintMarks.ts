import type { ColorPreset } from '../domain/colorMixing/types';
import { mixPigments } from '../domain/colorMixing/mixPigments';

export type PaintMark = { presetId: string; x: number; y: number; seed: number };

// Distances are measured in units of the canvas's shorter side, so portrait and
// landscape canvases give the same paint splat roughly the same breathing room.
function distance(a: Pick<PaintMark, 'x' | 'y'>, b: Pick<PaintMark, 'x' | 'y'>, aspect: number) {
  const widthInUnits = Math.max(1, aspect);
  const heightInUnits = Math.max(1, 1 / aspect);
  return Math.hypot((a.x - b.x) * widthInUnits, (a.y - b.y) * heightInUnits);
}

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function randomPosition(existing: readonly PaintMark[], aspect: number, random: () => number) {
  const xMargin = .18 / Math.max(1, aspect);
  const yMargin = .18 / Math.max(1, 1 / aspect);
  let best = { x: .5, y: .5, clearance: -1 };
  // Continuous rejection sampling keeps positions genuinely random. When five
  // large splats cannot all fit, the best sampled gap is used as a fallback.
  for (let i = 0; i < 160; i++) {
    const point = { x: xMargin + random() * (1 - 2 * xMargin),
      y: yMargin + random() * (1 - 2 * yMargin) };
    const clearance = existing.length ? Math.min(...existing.map((mark) => distance(point, mark, aspect))) : 1;
    if (clearance >= .33) return point;
    if (clearance > best.clearance) best = { ...point, clearance };
  }
  return { x: best.x, y: best.y };
}

export function relayoutMarks(marks: readonly PaintMark[], aspect: number): PaintMark[] {
  const placed: PaintMark[] = [];
  for (const mark of marks) {
    placed.push({ ...mark, ...randomPosition(placed, aspect, seededRandom(mark.seed)) });
  }
  return placed;
}

/** Sample the entire usable canvas, only rejecting landings that crowd earlier splats. */
export function placeMark(presetId: string, existing: readonly PaintMark[], aspect: number,
  random: () => number = Math.random): PaintMark {
  const seed = Math.floor(random() * 0x100000000) >>> 0;
  return { presetId, seed, ...randomPosition(existing, aspect, seededRandom(seed)) };
}

function noise(seed: number, n: number) {
  const value = Math.sin(seed * 0.0001 + n * 127.1) * 43758.5453;
  return value - Math.floor(value);
}

function isPalePaint(hex: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return false;
  const value = Number.parseInt(match[1]!, 16);
  const red = value >> 16 & 255, green = value >> 8 & 255, blue = value & 255;
  return (red * .2126 + green * .7152 + blue * .0722) / 255 > .87
    && Math.min(red, green, blue) > 180;
}

const IMPACT_AT = .42;
export const SELECTION_IMPACT_DURATION_MS = 640;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const easeOut = (value: number) => 1 - (1 - value) ** 3;

function drawImpactBurst(ctx: CanvasRenderingContext2D, mark: PaintMark, hex: string,
  width: number, height: number, impact: number) {
  const unit = Math.min(width, height);
  const cx = mark.x * width, cy = mark.y * height;
  const expansion = easeOut(impact);
  const fade = 1 - clamp01((impact - .48) / .5);
  const palePaint = isPalePaint(hex);
  ctx.save();
  ctx.lineCap = 'round';

  // Broken arcs expand at different rates, so the impact never reads as a
  // perfectly regular target or halo.
  ctx.strokeStyle = palePaint ? '#8d969f' : hex;
  for (let i = 0; i < 3; i++) {
    const angle = Math.PI * 2 * noise(mark.seed, 170 + i);
    const sweep = .8 + noise(mark.seed, 180 + i) * .8;
    ctx.globalAlpha = fade * (.58 - i * .12);
    ctx.lineWidth = unit * (.019 - i * .004) * (1 - impact * .65);
    ctx.beginPath();
    ctx.arc(cx, cy, unit * (.075 + (.13 + i * .025) * expansion), angle, angle + sweep);
    ctx.stroke();
  }

  // Staggered, tapered paint jets and flying droplets provide the snap and
  // directional rhythm of motion graphics without covering the settled mark.
  for (let i = 0; i < 16; i++) {
    const delay = noise(mark.seed, 200 + i) * .16;
    const local = clamp01((impact - delay) / (1 - delay));
    if (local <= 0) continue;
    const angle = Math.PI * 2 * noise(mark.seed, 230 + i);
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const spread = easeOut(local);
    const start = unit * (.052 + noise(mark.seed, 260 + i) * .025);
    const longJet = i < 5;
    const length = unit * (longJet ? .15 + noise(mark.seed, 290 + i) * .13
      : .07 + noise(mark.seed, 290 + i) * .12);
    const tip = start + length * spread;
    const halfWidth = unit * (longJet ? .014 + noise(mark.seed, 320 + i) * .012
      : .004 + noise(mark.seed, 320 + i) * .008) * (1 - local * .58);
    const jetFade = 1 - clamp01((local - .52) / .48);
    ctx.globalAlpha = jetFade * (longJet ? .95 : .65);
    ctx.fillStyle = palePaint ? '#b5bdc6' : hex;
    ctx.beginPath();
    ctx.moveTo(cx + dx * start - dy * halfWidth, cy + dy * start + dx * halfWidth);
    ctx.quadraticCurveTo(cx + dx * (tip - length * .3) - dy * halfWidth * .6,
      cy + dy * (tip - length * .3) + dx * halfWidth * .6,
      cx + dx * tip, cy + dy * tip);
    ctx.quadraticCurveTo(cx + dx * (tip - length * .3) + dy * halfWidth * .6,
      cy + dy * (tip - length * .3) - dx * halfWidth * .6,
      cx + dx * start + dy * halfWidth, cy + dy * start - dx * halfWidth);
    ctx.closePath();
    ctx.fill();

    const dropletDistance = tip + unit * (.025 + noise(mark.seed, 380 + i) * .045) * spread;
    const dotRadius = unit * (.005 + noise(mark.seed, 410 + i) * .012) * (1 - local * .45);
    ctx.globalAlpha = jetFade * .85;
    ctx.beginPath();
    ctx.arc(cx + dx * dropletDistance, cy + dy * dropletDistance, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function shape(cx: number, cy: number, radius: number, seed: number) {
  const path = new Path2D();
  const points = Array.from({ length: 18 }, (_, i) => {
    const angle = -Math.PI / 2 + i * Math.PI * 2 / 18;
    const swell = .87 + noise(seed, i) * .27 + (i % 6 === 1 ? .19 : 0);
    return { x: cx + Math.cos(angle) * radius * swell, y: cy + Math.sin(angle) * radius * swell };
  });
  for (let i = 0; i <= points.length; i++) {
    const previous = points[(i - 1 + points.length) % points.length]!;
    const current = points[i % points.length]!;
    const middleX = (previous.x + current.x) / 2;
    const middleY = (previous.y + current.y) / 2;
    if (i === 0) path.moveTo(middleX, middleY);
    else path.quadraticCurveTo(previous.x, previous.y, middleX, middleY);
  }
  path.closePath();
  return path;
}

function markShape(mark: PaintMark, width: number, height: number, scale = 1) {
  const radius = Math.min(width, height) * .11 * scale;
  const cx = mark.x * width, cy = mark.y * height;
  const path = shape(cx, cy, radius, mark.seed);
  for (let i = 0; i < 5; i++) {
    const angle = noise(mark.seed, 31 + i) * Math.PI * 2;
    const distance = radius * (1.08 + noise(mark.seed, 41 + i) * .42);
    const dotX = cx + Math.cos(angle) * distance;
    const dotY = cy + Math.sin(angle) * distance;
    const dotRadius = radius * (.045 + noise(mark.seed, 51 + i) * .07);
    path.moveTo(dotX + dotRadius, dotY);
    path.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
  }
  return path;
}

function paintOne(ctx: CanvasRenderingContext2D, mark: PaintMark, hex: string,
  width: number, height: number, scale = 1) {
  const unit = Math.min(width, height);
  const radius = unit * .11 * scale;
  const body = markShape(mark, width, height, scale);
  ctx.fillStyle = hex;
  const palePaint = isPalePaint(hex);
  if (palePaint) {
    ctx.save();
    ctx.shadowColor = 'rgba(40, 48, 52, .22)';
    ctx.shadowBlur = radius * .26;
    ctx.shadowOffsetY = radius * .04;
  }
  ctx.fill(body);
  if (palePaint) {
    ctx.restore();
    ctx.strokeStyle = 'rgba(40, 48, 52, .16)';
    ctx.lineWidth = Math.max(1, radius * .025);
    ctx.stroke(body);
  }
  return body;
}

export function drawPaintMarks(ctx: CanvasRenderingContext2D, width: number, height: number,
  marks: readonly PaintMark[], colors: readonly { preset: ColorPreset; amount: number }[],
  incoming?: { id: string; progress: number }) {
  ctx.clearRect(0, 0, width, height);
  const lookup = new Map(colors.map((entry) => [entry.preset.id, entry]));
  const visible: PaintMark[] = [];
  for (const mark of marks) {
    const entry = lookup.get(mark.presetId);
    if (!entry) continue;
    if (incoming?.id === mark.presetId && incoming.progress < IMPACT_AT) continue;
    const impact = incoming?.id === mark.presetId ? clamp01((incoming.progress - IMPACT_AT) / (1 - IMPACT_AT)) : 1;
    const scale = incoming?.id === mark.presetId
      ? impact < .2 ? .38 + .87 * easeOut(impact / .2) : 1.25 - .25 * easeOut((impact - .2) / .8)
      : 1;
    const path = paintOne(ctx, mark, entry.preset.hex, width, height, scale);
    for (const previous of visible) {
      const distance = Math.hypot((previous.x - mark.x) * width, (previous.y - mark.y) * height);
      if (distance > Math.min(width, height) * .11 * (scale + 1) * 1.55) continue;
      const other = lookup.get(previous.presetId);
      if (!other) continue;
      // Clip to BOTH actual silhouettes. This region uses the same pigment model
      // as the main mix, rather than browser alpha compositing.
      ctx.save();
      ctx.clip(markShape(previous, width, height));
      ctx.fillStyle = mixPigments([
        { pigment: other.preset.pigment, amount: other.amount },
        { pigment: entry.preset.pigment, amount: entry.amount },
      ]).hex;
      ctx.fill(path);
      ctx.restore();
    }
    visible.push(mark);
    if (incoming?.id === mark.presetId && impact < 1) {
      drawImpactBurst(ctx, mark, entry.preset.hex, width, height, impact);
    }
  }
  if (incoming && incoming.progress < IMPACT_AT) {
    const mark = marks.find((item) => item.presetId === incoming.id);
    const entry = mark && lookup.get(mark.presetId);
    if (mark && entry) {
      const p = incoming.progress / IMPACT_AT;
      const ease = p ** 2.5;
      const x = width * .5 + (mark.x * width - width * .5) * ease;
      const y = height * 1.16 + (mark.y * height - height * 1.16) * ease;
      const r = Math.min(width, height) * (.2 - .14 * ease);
      ctx.save();
      for (let i = 3; i >= 1; i--) {
        const lag = Math.max(0, p - i * .05);
        const tail = lag ** 2.5;
        const tx = width * .5 + (mark.x * width - width * .5) * tail;
        const ty = height * 1.16 + (mark.y * height - height * 1.16) * tail;
        ctx.globalAlpha = .07 + (4 - i) * .04;
        ctx.fillStyle = entry.preset.hex;
        ctx.beginPath(); ctx.arc(tx, ty, r * (1 - i * .17), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = entry.preset.hex;
      if (isPalePaint(entry.preset.hex)) {
        ctx.shadowColor = 'rgba(40, 48, 52, .23)';
        ctx.shadowBlur = r * .35;
      }
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      ctx.beginPath(); ctx.ellipse(x + r * .2, y + r * .3, r * .28, r * .14, .5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

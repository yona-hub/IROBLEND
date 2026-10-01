import type { ColorPreset } from '../domain/colorMixing/types';
import { mixPigments } from '../domain/colorMixing/mixPigments';

import { bodyControls, noise, type PaintMark } from './paintGeometry';
export { placeMark, relayoutMarks } from './paintGeometry';
export type { PaintMark } from './paintGeometry';

type PaintColor = { preset: ColorPreset; amount: number };
const regionCache = new WeakMap<readonly PaintColor[], { ids: string[]; hex: string }[]>();

/** Paint smaller intersections first, then overwrite triple and higher intersections. */
function overlapColors(colors: readonly PaintColor[]) {
  const cached = regionCache.get(colors);
  if (cached) return cached;
  const sorted = [...colors].sort((a, b) => a.preset.id.localeCompare(b.preset.id));
  const regions: { ids: string[]; hex: string }[] = [];
  for (let mask = 1; mask < 1 << sorted.length; mask++) {
    const entries = sorted.filter((_, i) => mask & (1 << i));
    if (entries.length < 2) continue;
    regions.push({ ids: entries.map(e => e.preset.id),
      hex: mixPigments(entries.map(e => ({ pigment: e.preset.pigment, amount: e.amount }))).hex });
  }
  regions.sort((a, b) => a.ids.length - b.ids.length);
  regionCache.set(colors, regions);
  return regions;
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
  width: number, height: number, impact: number, unit: number) {
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
  const points = bodyControls(seed, radius).map(point => ({ x: cx + point.x, y: cy + point.y }));
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

function markShape(mark: PaintMark, width: number, height: number, scale: number, unit: number) {
  const radius = unit * .11 * scale;
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
  width: number, height: number, scale: number, unit: number) {
  const radius = unit * .11 * scale;
  const body = markShape(mark, width, height, scale, unit);
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
  incoming?: { id: string; progress: number }, unit = Math.min(width, height)) {
  ctx.clearRect(0, 0, width, height);
  const lookup = new Map(colors.map((entry) => [entry.preset.id, entry]));
  const visible = new Map<string, { mark: PaintMark; path: Path2D; scale: number }>();
  for (const mark of [...marks].sort((a, b) => a.presetId.localeCompare(b.presetId))) {
    const entry = lookup.get(mark.presetId);
    if (!entry) continue;
    if (incoming?.id === mark.presetId && incoming.progress < IMPACT_AT) continue;
    const impact = incoming?.id === mark.presetId ? clamp01((incoming.progress - IMPACT_AT) / (1 - IMPACT_AT)) : 1;
    const scale = incoming?.id === mark.presetId
      ? impact < .2 ? .38 + .87 * easeOut(impact / .2) : 1.25 - .25 * easeOut((impact - .2) / .8)
      : 1;
    const path = paintOne(ctx, mark, entry.preset.hex, width, height, scale, unit);
    visible.set(mark.presetId, { mark, path, scale });
  }
  // Every clip uses the actual curved body and droplets, at the current impact
  // scale. No alpha blend and no dependence on the order of the original marks.
  for (const region of overlapColors(colors)) {
    const members = region.ids.map(id => visible.get(id));
    if (members.some(member => !member)) continue;
    const shapes = members as { mark: PaintMark; path: Path2D; scale: number }[];
    if (shapes.some((a, i) => shapes.slice(i + 1).some(b =>
      Math.hypot((a.mark.x - b.mark.x) * width, (a.mark.y - b.mark.y) * height)
        > unit * .18 * (a.scale + b.scale)))) continue;
    ctx.save();
    for (const member of shapes) ctx.clip(member.path);
    ctx.fillStyle = region.hex;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  for (const { mark } of visible.values()) {
    const entry = lookup.get(mark.presetId)!;
    const impact = incoming?.id === mark.presetId ? clamp01((incoming.progress - IMPACT_AT) / (1 - IMPACT_AT)) : 1;
    if (incoming?.id === mark.presetId && impact < 1) {
      drawImpactBurst(ctx, mark, entry.preset.hex, width, height, impact, unit);
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
      const r = unit * (.2 - .14 * ease);
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

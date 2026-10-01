export type PaintMark = { presetId: string; x: number; y: number; seed: number };
export type PaintGeometry = { width: number; height: number; unit: number };
type Point = { x: number; y: number };

export function paintGeometry(width: number, height: number, phone: boolean): PaintGeometry {
  return { width, height, unit: phone ? width : Math.min(width, height) };
}

/** Preserve tablet paint size when the canvas becomes shallower. */
export function viewportPaintGeometry(width: number, height: number,
  viewportWidth: number, viewportHeight: number): PaintGeometry {
  if (viewportWidth < 600) return paintGeometry(width, height, true);
  if (viewportWidth < 1280 || viewportHeight >= viewportWidth) {
    const previousAspect = viewportWidth >= 900 && viewportWidth > viewportHeight ? 1.55 : 1.45;
    return { width, height, unit: width / previousAspect };
  }
  return paintGeometry(width, height, false);
}

export function noise(seed: number, n: number) {
  const value = Math.sin(seed * .0001 + n * 127.1) * 43758.5453;
  return value - Math.floor(value);
}

export function bodyControls(seed: number, radius: number): Point[] {
  return Array.from({ length: 18 }, (_, i) => {
    const angle = -Math.PI / 2 + i * Math.PI * 2 / 18;
    const swell = .87 + noise(seed, i) * .27 + (i % 6 === 1 ? .19 : 0);
    return { x: Math.cos(angle) * radius * swell, y: Math.sin(angle) * radius * swell };
  });
}

// Sample the same quadratic silhouette used by the renderer, rather than an
// unrelated circle. Six samples per curve suffice for landing collision checks.
export function bodyContour(mark: PaintMark, g: PaintGeometry): Point[] {
  const points = bodyControls(mark.seed, g.unit * .11);
  const cx = mark.x * g.width, cy = mark.y * g.height;
  return points.flatMap((control, i) => {
    const previous = points[(i + 17) % 18]!, next = points[(i + 1) % 18]!;
    const start = { x: (previous.x + control.x) / 2, y: (previous.y + control.y) / 2 };
    const end = { x: (control.x + next.x) / 2, y: (control.y + next.y) / 2 };
    return Array.from({ length: 6 }, (_, j) => {
      const t = j / 6, s = 1 - t;
      return { x: cx + s * s * start.x + 2 * s * t * control.x + t * t * end.x,
        y: cy + s * s * start.y + 2 * s * t * control.y + t * t * end.y };
    });
  });
}

function bounds(points: readonly Point[]) {
  return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
    top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) };
}

function area(points: readonly Point[]) {
  return Math.abs(points.reduce((sum, p, i) => {
    const next = points[(i + 1) % points.length]!;
    return sum + p.x * next.y - next.x * p.y;
  }, 0)) / 2;
}

export function containsPoint(points: readonly Point[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!, b = points[j]!;
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function bodyOverlap(a: PaintMark, b: PaintMark, g: PaintGeometry, samples = 24) {
  if (Math.hypot((a.x - b.x) * g.width, (a.y - b.y) * g.height) > g.unit * .30) return 0;
  const pa = bodyContour(a, g), pb = bodyContour(b, g), ba = bounds(pa), bb = bounds(pb);
  const left = Math.max(ba.left, bb.left), right = Math.min(ba.right, bb.right);
  const top = Math.max(ba.top, bb.top), bottom = Math.min(ba.bottom, bb.bottom);
  if (right <= left || bottom <= top) return 0;
  let hit = 0;
  for (let y = 0; y < samples; y++) for (let x = 0; x < samples; x++) {
    const px = left + (x + .5) / samples * (right - left);
    const py = top + (y + .5) / samples * (bottom - top);
    if (containsPoint(pa, px, py) && containsPoint(pb, px, py)) hit++;
  }
  return hit / (samples * samples) * (right - left) * (bottom - top) / Math.min(area(pa), area(pb));
}

export function maxBodyOverlap(marks: readonly PaintMark[], g: PaintGeometry) {
  let maximum = 0;
  for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++) {
    maximum = Math.max(maximum, bodyOverlap(marks[i]!, marks[j]!, g));
  }
  return maximum;
}

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => { value = (1664525 * value + 1013904223) >>> 0; return value / 0x100000000; };
}

function position(mark: PaintMark, existing: readonly PaintMark[], g: PaintGeometry, random: () => number) {
  // Control-point bounds conservatively contain the entire curved main body.
  const extents = bounds(bodyControls(mark.seed, g.unit * .11));
  const inset = g.unit * .005;
  let best = { ...mark, x: .5, y: .5 }, bestOverlap = Infinity;
  for (let attempt = 0; attempt < 400; attempt++) {
    const candidate = { ...mark,
      x: (-extents.left + inset + random() * (g.width - extents.right + extents.left - 2 * inset)) / g.width,
      y: (-extents.top + inset + random() * (g.height - extents.bottom + extents.top - 2 * inset)) / g.height };
    const overlap = Math.max(0, ...existing.map(other => bodyOverlap(candidate, other, g)));
    // Leave tolerance for the sampled silhouette's area approximation.
    if (overlap <= .13) return candidate;
    if (overlap < bestOverlap) { best = candidate; bestOverlap = overlap; }
  }
  return best;
}

export function placeMark(presetId: string, existing: readonly PaintMark[], g: PaintGeometry,
  random: () => number = Math.random): PaintMark {
  const seed = Math.floor(random() * 0x100000000) >>> 0;
  return position({ presetId, seed, x: .5, y: .5 }, existing, g, seededRandom(seed));
}

export function relayoutMarks(marks: readonly PaintMark[], g: PaintGeometry): PaintMark[] {
  let best: PaintMark[] = [], bestOverlap = Infinity;
  // Retry the whole arrangement instead of shrinking the paint to make room.
  for (let attempt = 0; attempt < 24; attempt++) {
    const placed: PaintMark[] = [];
    for (const mark of marks) placed.push(position(mark, placed, g, seededRandom(mark.seed ^ (attempt * 2654435761))));
    const overlap = maxBodyOverlap(placed, g);
    if (overlap <= .13) return placed;
    if (overlap < bestOverlap) { best = placed; bestOverlap = overlap; }
  }
  return best;
}

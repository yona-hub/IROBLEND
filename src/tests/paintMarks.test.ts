import { describe, expect, it, vi } from 'vitest';
import { drawPaintMarks, placeMark, relayoutMarks, type PaintMark } from '../components/paintMarks';
import { bodyContour, bodyOverlap, containsPoint, maxBodyOverlap, paintGeometry } from '../components/paintGeometry';
import { presetsById } from '../data/colorPresets';
import { mixPigments } from '../domain/colorMixing/mixPigments';

function randomWithSeed(seed: number) {
  let value = seed || 1;
  return () => { value = (1664525 * value + 1013904223) >>> 0; return value / 0x100000000; };
}

describe('paint placement', () => {
  it('fits five full-size bodies with at most 15% overlap on phones and desktop', () => {
    for (const g of [paintGeometry(360, 180, true), paintGeometry(288, 180, true),
      paintGeometry(360, 260, true), paintGeometry(640, 640 / 1.55, false)]) {
      for (let seed = 1; seed <= 24; seed++) {
        let marks: PaintMark[] = [];
        const random = randomWithSeed(seed);
        for (let i = 0; i < 5; i++) {
          marks = [...marks, placeMark(String(i), marks, g, random)];
          if (maxBodyOverlap(marks, g) > .15) marks = relayoutMarks(marks, g);
        }
        for (const mark of marks) for (const point of bodyContour(mark, g)) {
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThanOrEqual(g.width);
          expect(point.y).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeLessThanOrEqual(g.height);
        }
        for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
          expect(bodyOverlap(marks[i]!, marks[j]!, g, 64)).toBeLessThanOrEqual(.15);
        }
      }
    }
  }, 30000);

  it('keeps body dimensions unchanged when phone height decreases', () => {
    const mark = { presetId: 'red', seed: 42, x: .5, y: .5 };
    const size = (height: number) => {
      const points = bodyContour(mark, paintGeometry(360, height, true));
      return [Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)),
        Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))];
    };
    expect(size(180)).toEqual(size(450));
    expect(size(180)[0]).toBeGreaterThan(70);
  });

  it('samples continuous positions and reflows reproducibly on rotation', () => {
    const g = paintGeometry(360, 180, true);
    const positions = Array.from({ length: 100 }, (_, seed) => placeMark('red', [], g, randomWithSeed((seed + 1) * 7919)));
    expect(new Set(positions.map(({ x }) => Math.round(x * 100))).size).toBeGreaterThan(35);
    expect(new Set(positions.map(({ y }) => Math.round(y * 100))).size).toBeGreaterThan(30);
    const rotated = relayoutMarks(positions.slice(0, 5), paintGeometry(560, 386, false));
    expect(relayoutMarks(positions.slice(0, 5), paintGeometry(560, 386, false))).toEqual(rotated);
    expect(rotated.map(({ seed }) => seed)).toEqual(positions.slice(0, 5).map(({ seed }) => seed));
    expect(maxBodyOverlap(rotated, paintGeometry(560, 386, false))).toBeLessThanOrEqual(.15);
  });
});

// Point-probing Canvas double interprets real quadratic paths and clip stacks.
class ProbePath {
  polygon: { x: number; y: number }[] = [];
  circles: { x: number; y: number; radius: number }[] = [];
  current = { x: 0, y: 0 };
  moveTo(x: number, y: number) { this.current = { x, y }; }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    const start = this.current;
    for (let i = 0; i < 16; i++) {
      const t = i / 16, s = 1 - t;
      this.polygon.push({ x: s * s * start.x + 2 * s * t * cx + t * t * x,
        y: s * s * start.y + 2 * s * t * cy + t * t * y });
    }
    this.current = { x, y };
  }
  closePath() { /* Closed by the point-in-polygon query. */ }
  arc(x: number, y: number, radius: number) { this.circles.push({ x, y, radius }); }
  has(x: number, y: number) {
    return containsPoint(this.polygon, x, y) || this.circles.some(c => Math.hypot(c.x - x, c.y - y) <= c.radius);
  }
}

function probePaint(marks: PaintMark[], amounts = [1, 3, 5]) {
  vi.stubGlobal('Path2D', ProbePath);
  const colors = ['red', 'blue', 'yellow'].map((id, i) => ({ preset: presetsById.get(id)!, amount: amounts[i]! }));
  const points = Array.from({ length: 75 }, (_, i) => ({ x: 100 + i % 15 * 9, y: 55 + Math.floor(i / 15) * 11 }));
  const pixels: (string | null)[] = points.map(() => null);
  const paths = new Map<string, ProbePath>();
  let clips: ProbePath[] = [];
  const stack: ProbePath[][] = [];
  const ctx = {
    fillStyle: '', clearRect: () => {},
    save: () => stack.push([...clips]),
    restore: () => { clips = stack.pop()!; },
    clip: (path: ProbePath) => clips.push(path),
    fill(path: ProbePath) {
      paths.set(this.fillStyle, path);
      points.forEach((p, i) => { if (path.has(p.x, p.y)) pixels[i] = this.fillStyle; });
    },
    fillRect() {
      points.forEach((p, i) => { if (clips.every(path => path.has(p.x, p.y))) pixels[i] = this.fillStyle; });
    },
  };
  try { drawPaintMarks(ctx as unknown as CanvasRenderingContext2D, 360, 180, marks, colors, undefined, 360); }
  finally { vi.unstubAllGlobals(); }
  return { points, pixels, colors, paths };
}

describe('silhouette overlap painting', () => {
  const marks: PaintMark[] = ['red', 'blue', 'yellow'].map((presetId, i) => ({
    presetId, x: .40 + i * .075, y: .45 + i * .025, seed: 42 + i,
  }));
  it('keeps untouched paint and mixes only intersecting silhouettes, including triples', () => {
    const { points, pixels, colors, paths } = probePaint(marks);
    const counts = new Set<number>();
    points.forEach((point, i) => {
      const members = colors.filter(color => paths.get(color.preset.hex)!.has(point.x, point.y));
      counts.add(members.length);
      if (!members.length) { expect(pixels[i]).toBeNull(); return; }
      const expected = members.length === 1 ? members[0]!.preset.hex
        : mixPigments(members.map(c => ({ pigment: c.preset.pigment, amount: c.amount }))).hex;
      expect(pixels[i]).toBe(expected);
    });
    expect(counts).toEqual(new Set([0, 1, 2, 3]));
  });

  it('is independent of drawing order and updates intersections with eyedropper amounts', () => {
    const original = probePaint(marks);
    expect(probePaint([...marks].reverse()).pixels).toEqual(original.pixels);
    expect(probePaint(marks, [5, 1, 2]).pixels).not.toEqual(original.pixels);
    expect(marks[0]).toEqual({ presetId: 'red', x: .40, y: .45, seed: 42 });
  });
});

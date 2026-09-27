import { describe, expect, it } from 'vitest';
import { placeMark, relayoutMarks } from '../components/paintMarks';

function randomWithSeed(seed: number) {
  let value = seed || 1;
  return () => { value = (1664525 * value + 1013904223) >>> 0; return value / 0x100000000; };
}

function separation(a: ReturnType<typeof placeMark>, b: ReturnType<typeof placeMark>, aspect: number) {
  return Math.hypot((a.x - b.x) * Math.max(1, aspect),
    (a.y - b.y) * Math.max(1, 1 / aspect));
}

describe('paint placement', () => {
  it('keeps five splats apart across desktop and phone canvas shapes', () => {
    for (const aspect of [.8, 1.2, 1.55]) {
      for (let seed = 1; seed <= 200; seed++) {
        let marks: ReturnType<typeof placeMark>[] = [];
        const random = randomWithSeed(seed);
        for (let i = 0; i < 5; i++) marks = [...marks, placeMark(String(i), marks, aspect, random)];
        for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++) {
          const a = marks[i]!, b = marks[j]!;
          expect(separation(a, b, aspect)).toBeGreaterThan(.27);
        }
      }
    }
  });

  it('varies landing positions between selections', () => {
    const a = placeMark('red', [], 1.55, randomWithSeed(1));
    const b = placeMark('red', [], 1.55, randomWithSeed(2));
    expect([a.x, a.y]).not.toEqual([b.x, b.y]);
  });

  it('samples throughout the canvas rather than snapping to six landing cells', () => {
    const first: ReturnType<typeof placeMark>[] = [];
    const fifth: ReturnType<typeof placeMark>[] = [];
    for (let seed = 1; seed <= 300; seed++) {
      let marks: ReturnType<typeof placeMark>[] = [];
      const random = randomWithSeed(seed);
      for (let i = 0; i < 5; i++) marks = [...marks, placeMark(String(i), marks, .8, random)];
      first.push(marks[0]!);
      fifth.push(marks[4]!);
    }
    for (const points of [first, fifth]) {
      expect(new Set(points.map(({ x }) => Math.round(x * 100))).size).toBeGreaterThan(35);
      expect(new Set(points.map(({ y }) => Math.round(y * 100))).size).toBeGreaterThan(35);
    }
  });

  it('reflows five positions reproducibly after screen rotation without collisions', () => {
    let marks: ReturnType<typeof placeMark>[] = [];
    const random = randomWithSeed(42);
    for (let i = 0; i < 5; i++) marks = [...marks, placeMark(String(i), marks, 1.55, random)];
    const rotated = relayoutMarks(marks, .8);
    expect(relayoutMarks(marks, .8)).toEqual(rotated);
    expect(rotated.map(({ presetId }) => presetId)).toEqual(marks.map(({ presetId }) => presetId));
    for (let i = 0; i < rotated.length; i++) for (let j = i + 1; j < rotated.length; j++) {
      const a = rotated[i]!, b = rotated[j]!;
      expect(separation(a, b, .8)).toBeGreaterThan(.27);
    }
  });
});

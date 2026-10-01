import { describe, expect, it } from 'vitest';
import { Color } from 'spectral.js';

import { colorPresets } from '../data/colorPresets';
import { resultColorNames } from '../data/resultColorNames';
import { mixPigments } from '../domain/colorMixing/mixPigments';

const red = '#EA5550' as const;
const blue = '#0075C2' as const;
const white = '#FFFFFF' as const;
const black = '#000000' as const;
const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0));
const input = (hex: `#${string}`, amount: number) => ({ pigment: colorPresets.find((p) => p.hex === hex)!.pigment, amount });
const byId = (id: string, amount: number) => ({ pigment: colorPresets.find((p) => p.id === id)!.pigment, amount });
const blend = (...parts: [string, number][]) => mixPigments(parts.map(([id, amount]) => byId(id, amount)));
const hue = (lab: readonly number[]) => (Math.atan2(lab[2]!, lab[1]!) * 180 / Math.PI + 360) % 360;
const chroma = (lab: readonly number[]) => Math.hypot(lab[1]!, lab[2]!);

describe('spectral pigment mixing', () => {
  it('has 54 selectable colors and a broad result-name dictionary', () => {
    expect(colorPresets).toHaveLength(54);
    expect(new Set(colorPresets.map(({ category }) => category)).size).toBe(9);
    expect(resultColorNames.length).toBeGreaterThanOrEqual(90);
    expect(resultColorNames.length).toBeLessThanOrEqual(150);
  });

  it('does not depend on input order or a common scaling of drop amounts', () => {
    const first = mixPigments([input(red, 1), input(blue, 1)]);
    const reversed = mixPigments([input(blue, 1), input(red, 1)]);
    const scaled = mixPigments([input(red, 3), input(blue, 3)]);
    expect(distance(first.oklab, reversed.oklab)).toBeLessThan(1e-8);
    expect(distance(first.oklab, scaled.oklab)).toBeLessThan(1e-8);
  });

  it('keeps two copies of one color close to that color', () => {
    const mixed = mixPigments([input(blue, 2), input(blue, 5)]);
    expect(distance(mixed.oklab, mixPigments([input(blue, 1), input(blue, 1)]).oklab)).toBeLessThan(0.02);
  });

  it('calibrates every virtual paint to its displayed swatch', () => {
    for (const preset of colorPresets) {
      const pure = mixPigments([{ pigment: preset.pigment, amount: 1 },
        { pigment: preset.pigment, amount: 1 }]);
      expect(distance(pure.oklab, new Color(preset.hex).OKLab)).toBeLessThan(.007);
    }
  });

  it('moves continuously toward a color as more of it is added', () => {
    const redLab = mixPigments([input(red, 1), input(red, 1)]).oklab;
    const blueLab = mixPigments([input(blue, 1), input(blue, 1)]).oklab;
    const blueSteps = [1, 2, 3, 4, 5].map((amount) => mixPigments([input(red, 1), input(blue, amount)]));
    const redSteps = [1, 2, 3, 4, 5].map((amount) => mixPigments([input(red, amount), input(blue, 1)]));

    for (let index = 1; index < 5; index++) {
      expect(distance(blueSteps[index]!.oklab, blueLab)).toBeLessThan(distance(blueSteps[index - 1]!.oklab, blueLab));
      expect(distance(redSteps[index]!.oklab, redLab)).toBeLessThan(distance(redSteps[index - 1]!.oklab, redLab));
      expect(distance(blueSteps[index]!.oklab, blueSteps[index - 1]!.oklab)).toBeLessThan(0.12);
    }
  });

  it('usually gets lighter with white and darker with black', () => {
    const whiteSteps = [1, 2, 3, 4, 5].map((amount) => mixPigments([input(blue, 3), input(white, amount)]).oklab[0]);
    const blackSteps = [1, 2, 3, 4, 5].map((amount) => mixPigments([input(blue, 3), input(black, amount)]).oklab[0]);
    for (let index = 1; index < 5; index++) {
      expect(whiteSteps[index]).toBeGreaterThan(whiteSteps[index - 1]!);
      expect(blackSteps[index]).toBeLessThan(blackSteps[index - 1]!);
    }
  });

  it('computes finite colors from 2–5 inputs, including black', () => {
    const palette = [red, blue, white, black, '#A7D28D' as const];
    for (let size = 2; size <= 5; size++) {
      const result = mixPigments(palette.slice(0, size).map((hex, index) => input(hex, index + 1)));
      expect(result.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(result.oklab.every(Number.isFinite)).toBe(true);
      expect(Number.isFinite(result.nearestName.deltaE)).toBe(true);
    }
  });

  it('handles every selectable pair without invalid output', () => {
    for (let i = 0; i < colorPresets.length; i++) {
      for (let j = i + 1; j < colorPresets.length; j++) {
        const first = colorPresets[i]!;
        const second = colorPresets[j]!;
        const result = mixPigments([input(first.hex, 3), input(second.hex, 3)]);
        expect(result.hex).toMatch(/^#[0-9a-f]{6}$/i);
        expect(result.oklab.every(Number.isFinite)).toBe(true);
      }
    }
  });

  it('moves toward either paint when its share grows, across the whole palette', () => {
    for (let i = 0; i < colorPresets.length; i++) {
      for (let j = i + 1; j < colorPresets.length; j++) {
        const first = colorPresets[i]!.pigment;
        const second = colorPresets[j]!.pigment;
        const pureFirst = mixPigments([{ pigment: first, amount: 1 }, { pigment: first, amount: 1 }]);
        const pureSecond = mixPigments([{ pigment: second, amount: 1 }, { pigment: second, amount: 1 }]);
        for (const [growing, fixed, target] of [
          [first, second, pureFirst], [second, first, pureSecond],
        ] as const) {
          let previous = Infinity;
          for (let amount = 1; amount <= 5; amount++) {
            const result = mixPigments([{ pigment: growing, amount }, { pigment: fixed, amount: 1 }]);
            const current = distance(result.oklab, target.oklab);
            expect(current).toBeLessThanOrEqual(previous + .003);
            previous = current;
          }
        }
      }
    }
  });

  it('rejects invalid counts and drops', () => {
    expect(() => mixPigments([input(red, 1)])).toThrow(RangeError);
    expect(() => mixPigments([input(red, 0), input(blue, 3)])).toThrow(RangeError);
    expect(() => mixPigments([input(red, 1.5), input(blue, 3)])).toThrow(RangeError);
    expect(() => mixPigments(Array.from({ length: 6 }, () => input(red, 1)))).toThrow(RangeError);
  });

  it('changes perceptually when red3 + blue3 becomes red3 + blue1', () => {
    const a = mixPigments([input(red, 3), input(blue, 3)]);
    const b = mixPigments([input(red, 3), input(blue, 1)]);
    expect(distance(a.oklab, b.oklab)).toBeGreaterThan(.025);
  });

  it('makes equal red and blue recognizably purple, with drops shifting its hue', () => {
    const equal = blend(['red', 3], ['blue', 3]);
    const moreRed = blend(['red', 3], ['blue', 1]);
    const moreBlue = blend(['red', 1], ['blue', 3]);
    expect(hue(equal.oklab)).toBeGreaterThan(285);
    expect(hue(equal.oklab)).toBeLessThan(330);
    expect(chroma(equal.oklab)).toBeGreaterThan(.075);
    expect(hue(moreRed.oklab)).toBeGreaterThan(hue(equal.oklab));
    expect(hue(moreBlue.oklab)).toBeLessThan(hue(equal.oklab));
  });

  it('keeps three- to five-color blends intuitive without pair-specific rules', () => {
    const purple = blend(['red', 3], ['blue', 3]);
    const lavender = blend(['red', 3], ['blue', 3], ['white', 3]);
    expect(hue(lavender.oklab)).toBeGreaterThan(285);
    expect(hue(lavender.oklab)).toBeLessThan(330);
    expect(chroma(lavender.oklab)).toBeGreaterThan(.05);
    expect(lavender.oklab[0]).toBeGreaterThan(purple.oklab[0] + .15);

    const brown = blend(['red', 3], ['yellow', 3], ['blue', 3]);
    const tan = blend(['red', 3], ['yellow', 3], ['blue', 3], ['white', 3]);
    const dark = blend(['red', 3], ['yellow', 3], ['blue', 3], ['black', 3]);
    const five = blend(['red', 3], ['yellow', 3], ['blue', 3], ['white', 3], ['black', 3]);
    for (const result of [brown, tan, dark, five]) {
      expect(hue(result.oklab)).toBeGreaterThan(35);
      expect(hue(result.oklab)).toBeLessThan(100);
    }
    expect(chroma(brown.oklab)).toBeGreaterThan(.035);
    expect(tan.oklab[0]).toBeGreaterThan(brown.oklab[0] + .12);
    expect(dark.oklab[0]).toBeLessThan(brown.oklab[0] - .08);
    expect(five.oklab[0]).toBeGreaterThan(dark.oklab[0]);
    expect(five.oklab[0]).toBeLessThan(tan.oklab[0]);
    expect(chroma(five.oklab)).toBeLessThan(chroma(brown.oklab));

    const coolFive = blend(['blue', 3], ['green', 3], ['yellow', 3], ['white', 3], ['black', 3]);
    expect(hue(coolFive.oklab)).toBeGreaterThan(110);
    expect(hue(coolFive.oklab)).toBeLessThan(190);
    expect(chroma(coolFive.oklab)).toBeGreaterThan(.05);
  });

  it('changes smoothly across varied three- to five-paint recipes', () => {
    let seed = 28391;
    const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 0x100000000; };
    for (let trial = 0; trial < 240; trial++) {
      const count = 3 + Math.floor(random() * 3);
      const choices: typeof colorPresets[number][] = [];
      while (choices.length < count) {
        const candidate = colorPresets[Math.floor(random() * colorPresets.length)]!;
        if (!choices.includes(candidate)) choices.push(candidate);
      }
      const inputs = choices.map(({ pigment }) => ({ pigment, amount: 1 + Math.floor(random() * 4) }));
      const before = mixPigments(inputs);
      const after = mixPigments(inputs.map((entry, index) => index === 0
        ? { ...entry, amount: entry.amount + 1 } : entry));
      expect(distance(before.oklab, after.oklab)).toBeLessThan(.13);
    }
  });

  it('keeps a substantial white contribution in a three-pigment blend', () => {
    const steps = [1, 2, 3, 4, 5].map((n) => mixPigments([input(red, 3), input(blue, 3), input(white, n)]));
    expect(distance(steps[0]!.oklab, steps[4]!.oklab)).toBeGreaterThan(.08);
    for (let i = 1; i < steps.length; i++) expect(steps[i]!.oklab[0]).toBeGreaterThan(steps[i - 1]!.oklab[0]);
  });

  it('keeps white and black directional in varied three- to five-paint blends', () => {
    const chromatic = colorPresets.filter(({ category }) => category !== 'white' && category !== 'black');
    let seed = 62545;
    const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 0x100000000; };
    for (let trial = 0; trial < 120; trial++) {
      const count = 2 + Math.floor(random() * 3);
      const chosen = new Set<number>();
      while (chosen.size < count) chosen.add(Math.floor(random() * chromatic.length));
      const inputs = [...chosen].map((index) => ({
        pigment: chromatic[index]!.pigment, amount: 1 + Math.floor(random() * 5),
      }));
      for (const [neutral, lighter] of [[byId('white', 1).pigment, true],
        [byId('black', 1).pigment, false]] as const) {
        let previous: number | null = null;
        for (let amount = 1; amount <= 5; amount++) {
          const current = mixPigments([...inputs, { pigment: neutral, amount }]).oklab[0];
          if (previous !== null) {
            if (lighter) expect(current).toBeGreaterThan(previous);
            else expect(current).toBeLessThan(previous);
          }
          previous = current;
        }
      }
    }
  });

  it('makes red3 + white5 lighter than red3 + white1', () => {
    expect(mixPigments([input(red, 3), input(white, 5)]).oklab[0])
      .toBeGreaterThan(mixPigments([input(red, 3), input(white, 1)]).oklab[0] + .08);
  });

  it('makes blue3 + black5 perceptually darker than blue3 + black1', () => {
    expect(mixPigments([input(blue, 3), input(black, 5)]).oklab[0])
      .toBeLessThan(mixPigments([input(blue, 3), input(black, 1)]).oklab[0] - .03);
  });

  it.each([
    ['yellow', 'blue', 95, 170],
    ['red', 'yellow', 30, 85],
    ['red', 'white', 0, 40],
  ])('%s + %s has the expected perceptual hue', (first, second, min, max) => {
    const pigment = (id: string) => colorPresets.find((p) => p.id === id)!.pigment;
    const result = mixPigments([{ pigment: pigment(first), amount: 3 }, { pigment: pigment(second), amount: 3 }]);
    const [lightness, a, b] = result.oklab;
    const hue = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
    expect(Math.hypot(a, b)).toBeGreaterThan(.045);
    expect(hue).toBeGreaterThan(min);
    expect(hue).toBeLessThan(max);
    if (second === 'white') {
      expect(lightness).toBeGreaterThan(.65);
      const pure = mixPigments([{ pigment: pigment(first), amount: 3 }, { pigment: pigment(first), amount: 3 }]);
      expect(lightness).toBeGreaterThan(pure.oklab[0]);
      expect(Math.hypot(a, b)).toBeLessThan(Math.hypot(pure.oklab[1], pure.oklab[2]));
    }
  });

  it('retains independent scattering information even for equal pure reflectance', () => {
    const pigment = input(white, 1).pigment;
    const strongWhite = { ...pigment, absorption: pigment.absorption.map((k) => k * 2), scattering: pigment.scattering.map((s) => s * 2) };
    const weak = mixPigments([input(red, 3), { pigment, amount: 1 }]);
    const strong = mixPigments([input(red, 3), { pigment: strongWhite, amount: 1 }]);
    expect(strong.oklab[0]).toBeGreaterThan(weak.oklab[0] + .03);
  });

  it('rejects incomplete, sparse or invalid spectral coefficients', () => {
    const pigment = input(red, 1).pigment;
    for (const bad of [
      { ...pigment, absorption: [1] },
      { ...pigment, absorption: new Array<number>(38) },
      { ...pigment, absorption: Array(38).fill(NaN) },
      { ...pigment, absorption: Array(38).fill(-1) },
      { ...pigment, scattering: Array(38).fill(0) },
      { ...pigment, scattering: Array(38).fill(Infinity) },
    ]) expect(() => mixPigments([{ pigment: bad, amount: 1 }, input(blue, 3)])).toThrow(RangeError);
  });
});

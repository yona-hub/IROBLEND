import { describe, expect, it } from 'vitest';
import { Color } from 'spectral.js';
import { colorPresets } from '../data/colorPresets';
import { resultColorNames } from '../data/resultColorNames';
import { mixPigments } from '../domain/colorMixing/mixPigments';

const red = '#D8253E' as const;
const blue = '#3158A9' as const;
const white = '#FFFFFF' as const;
const black = '#101112' as const;
const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0));
const input = (hex: `#${string}`, amount: number) => ({ hex, amount });

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
    expect(distance(mixed.oklab, new Color(blue).OKLab)).toBeLessThan(0.02);
  });

  it('moves continuously toward a color as more of it is added', () => {
    const redLab = new Color(red).OKLab;
    const blueLab = new Color(blue).OKLab;
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
    const palette = [red, blue, white, black, '#91B849' as const];
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

  it('rejects invalid counts and drops', () => {
    expect(() => mixPigments([input(red, 1)])).toThrow(RangeError);
    expect(() => mixPigments([input(red, 0), input(blue, 3)])).toThrow(RangeError);
    expect(() => mixPigments([input(red, 1.5), input(blue, 3)])).toThrow(RangeError);
    expect(() => mixPigments(Array.from({ length: 6 }, () => input(red, 1)))).toThrow(RangeError);
  });
});

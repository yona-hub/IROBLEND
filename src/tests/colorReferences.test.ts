import { Color } from 'spectral.js';
import { describe, expect, it } from 'vitest';
import { namedColors } from '../data/namedColors';
import { colorPresets } from '../data/colorPresets';
import { virtualPigmentRecipes } from '../data/virtualPigments';
import { resultColorNames } from '../data/resultColorNames';
import { findNearestColorName } from '../domain/colorMixing/findNearestColorName';
import { mixPigments } from '../domain/colorMixing/mixPigments';
import sourceSnapshot from './fixtures/named-color-sources.json';

const lab = (hex: string): [number, number, number] => {
  const value = new Color(hex).OKLab;
  return [value[0]!, value[1]!, value[2]!];
};
const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(...a.map((value, i) => value - b[i]!));

describe('color reference consistency', () => {
  it('uses the primary dictionary first and CSS only for names it does not define', () => {
    const dictionary = new Map(sourceSnapshot.colordic.map(entry => [entry.nameEn, entry]));
    const css = sourceSnapshot.css as Record<string, string>;
    for (const color of namedColors) {
      const reference = color.reference;
      const exact = dictionary.get(color.nameEn.toLowerCase());
      if (reference.kind === 'authored') {
        expect(exact).toBeUndefined();
        expect(css[color.nameEn.toLowerCase().replaceAll(' ', '')]).toBeUndefined();
        expect(reference.note).toBeTruthy();
      } else if (reference.kind === 'colordic') {
        const source = dictionary.get(reference.name)!;
        expect(source).toBeDefined();
        expect(color.hex).toBe(source.hex);
        expect(reference.url).toBe(source.url);
        expect(reference.name).toBe(color.nameEn.toLowerCase());
      } else {
        expect(exact).toBeUndefined();
        expect(reference.name).toBe(color.nameEn.toLowerCase().replaceAll(' ', ''));
        expect(color.hex).toBe(css[reference.name]);
        expect(reference.url).toBe(`https://www.w3.org/TR/css-color-4/#valdef-color-${reference.name}`);
      }
    }
  });

  it('preserves the graphite reference and resolves canonical aliases without changing IDs', () => {
    expect(colorPresets.find(color => color.id === 'graphite')?.hex).toBe('#594E52');
    expect(colorPresets.find(color => color.id === 'charcoal')?.nameEn).toBe('Charcoal Gray');
    expect(colorPresets.find(color => color.id === 'milk-white')?.nameEn).toBe('Milky White');
    expect(colorPresets.find(color => color.id === 'dark-slate')?.nameEn).toBe('Dark Slate Gray');
    expect(resultColorNames.find(color => color.nameEn === 'Raw Umber')?.hex).toBe('#866629');
    expect(resultColorNames.find(color => color.nameEn === 'Amber')?.hex).toBe('#C2894B');
  });

  it('calibrates all selectable paints to their external references and includes them in the name dictionary', () => {
    expect(new Set(namedColors.map(color => color.id)).size).toBe(namedColors.length);
    expect(new Set(namedColors.map(color => color.nameEn)).size).toBe(namedColors.length);
    expect(Object.keys(virtualPigmentRecipes).sort()).toEqual(colorPresets.map(color => color.id).sort());
    for (const preset of colorPresets) {
      expect(resultColorNames.find(color => color.id === preset.id)?.hex).toBe(preset.hex);
      const pure = mixPigments([{ pigment: preset.pigment, amount: 1 }, { pigment: preset.pigment, amount: 5 }]);
      expect(distance(pure.oklab, lab(preset.hex))).toBeLessThan(.007);
      expect(findNearestColorName(lab(preset.hex)).nameEn).toBe(preset.nameEn);
    }
  });

  it('keeps the subtle red-purple graphite cast in both its raw pigment and its tints', () => {
    const graphite = colorPresets.find(color => color.id === 'graphite')!.pigment;
    const reflectance = graphite.absorption.map((k, i) => {
      const q = k / graphite.scattering[i]!;
      return 1 / (1 + q + Math.hypot(q, Math.sqrt(2 * q)));
    });
    expect(distance(new Color(reflectance).OKLab, lab('#594E52'))).toBeLessThan(.004);
    const white = colorPresets.find(color => color.id === 'white')!.pigment;
    for (let amount = 1; amount <= 5; amount++) {
      const tint = mixPigments([{ pigment: graphite, amount: 3 }, { pigment: white, amount }]);
      expect(tint.oklab[1]).toBeGreaterThan(0);
      expect(tint.nearestName.nameEn).not.toBe('Cool Gray');
    }
  });

  it('does not label blueish or near-neutral gray as yellowish warm gray', () => {
    for (const hex of ['#919599', '#919191']) {
      expect(['Warm Gray', 'Brown Gray', 'Greige']).not.toContain(findNearestColorName(lab(hex)).nameEn);
    }
    expect(findNearestColorName(lab('#9C9186')).nameEn).toBe('Warm Gray');
    expect(findNearestColorName(lab('#9AA7AE')).nameEn).toBe('Cool Gray');
    expect(findNearestColorName([.6, 0, 0]).nameEn).not.toBe('Cool Gray');
    expect(findNearestColorName([.6, 0, 0]).nameEn).not.toBe('Warm Gray');
  });

  it('keeps white and black amount directions throughout the updated palette', () => {
    const white = colorPresets.find(color => color.id === 'white')!.pigment;
    const black = colorPresets.find(color => color.id === 'black')!.pigment;
    for (const preset of colorPresets) {
      for (const neutral of [white, black]) {
        if (preset.pigment === neutral) continue;
        const values = [1, 2, 3, 4, 5].map(amount => mixPigments([
          { pigment: preset.pigment, amount: 3 }, { pigment: neutral, amount },
        ]).oklab[0]);
        for (let i = 1; i < values.length; i++) {
          if (neutral === white) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]! - .003);
          else expect(values[i]).toBeLessThanOrEqual(values[i - 1]! + .003);
        }
      }
    }
  });
});

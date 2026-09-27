import { Color } from 'spectral.js';
import { describe, expect, it } from 'vitest';
import { eyedropperAppearance } from '../components/eyedropperAppearance';

const lightness = (hex: `#${string}`) => new Color(hex).OKLab[0]!;

describe('eyedropper liquid appearance', () => {
  it('keeps the chosen display color while making white readable through inner shading', () => {
    const white = eyedropperAppearance('#FFFFFF');
    expect(white.base).toBe('#FFFFFF');
    expect(lightness(white.body)).toBeLessThan(lightness(white.base));
    expect(lightness(white.shade)).toBeLessThan(lightness(white.base));
  });

  it('gives black a light inner reflection without changing the chosen color', () => {
    const black = eyedropperAppearance('#101214');
    expect(black.base).toBe('#101214');
    expect(black.body).toBe(black.base);
    expect(lightness(black.reflection)).toBeGreaterThan(lightness(black.base));
    expect(lightness(black.shade)).toBeLessThan(lightness(black.base));
  });
});

import { Color } from 'spectral.js';
import type { MixResult } from './types';
import { findNearestColorName } from './findNearestColorName';

export type MixInput = { hex: `#${string}`; amount: number };

/** Mix 2–5 estimated pigment spectra with drops as relative amounts. */
export function mixPigments(inputs: readonly MixInput[]): MixResult {
  if (inputs.length < 2 || inputs.length > 5) {
    throw new RangeError('Choose between 2 and 5 colors.');
  }

  for (const { hex, amount } of inputs) {
    if (!/^#[0-9a-f]{6}$/i.test(hex) || !Number.isInteger(amount) || amount < 1 || amount > 5) {
      throw new RangeError('Each color needs a six-digit HEX value and 1–5 drops.');
    }
  }

  const colors = inputs.map(({ hex, amount }) => ({ color: new Color(hex), amount }));
  const total = colors.reduce((sum, { amount }) => sum + amount, 0);
  const size = colors[0]?.color.KS.length ?? 0;

  if (size === 0 || colors.some(({ color }) => color.KS.length !== size)) {
    throw new Error('The spectral color data is incomplete.');
  }

  const reflectance = Array.from({ length: size }, (_, wavelength) => {
    const ks = colors.reduce((sum, { color, amount }) => {
      const value = color.KS[wavelength];
      if (value === undefined || !Number.isFinite(value) || value < 0) {
        throw new Error('The spectral color data contains an invalid K/S value.');
      }
      return sum + (value * amount) / total;
    }, 0);

    // This is algebraically equal to 1 + ks - sqrt(ks² + 2ks), but avoids
    // cancellation when dark colors produce large K/S values.
    const value = 1 / (1 + ks + Math.hypot(ks, Math.sqrt(2 * ks)));
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error('Pigment mixing produced an invalid reflectance.');
    }
    return value;
  });

  const mixed = new Color(reflectance);
  const hex = mixed.toString({ format: 'hex', method: 'map' }) as `#${string}`;
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error('Pigment mixing produced an invalid display color.');
  }

  // Compare names against the color actually visible on a standard sRGB screen.
  const lab = new Color(hex).OKLab;
  const oklab: [number, number, number] = [lab[0] ?? NaN, lab[1] ?? NaN, lab[2] ?? NaN];
  if (oklab.some((component) => !Number.isFinite(component))) {
    throw new Error('Pigment mixing produced an invalid OKLab color.');
  }

  return { hex, oklab, nearestName: findNearestColorName(oklab) };
}

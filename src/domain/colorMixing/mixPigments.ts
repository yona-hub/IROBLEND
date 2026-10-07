import { Color } from 'spectral.js';
import type { MixResult, VirtualPigment } from './types';
import { findNearestColorName } from './findNearestColorName';
import { calibrateIntuitiveMix, displayHexFromOklab } from './intuitivePalette';

export type MixInput = { pigment: VirtualPigment; amount: number };
type Lab = readonly [number, number, number];
const pureLabCache = new WeakMap<VirtualPigment, Lab>();

function kmReflectance(absorption: number, scattering: number) {
  const ks = absorption / scattering;
  // Algebraically equivalent to 1 + ks - sqrt(ks² + 2ks), without cancellation.
  return 1 / (1 + ks + Math.hypot(ks, Math.sqrt(2 * ks)));
}

function pureModelLab(pigment: VirtualPigment): Lab {
  const cached = pureLabCache.get(pigment);
  if (cached) return cached;
  const pure = new Color(pigment.absorption.map((k, i) => kmReflectance(k, pigment.scattering[i]!))).OKLab;
  const lab: Lab = [pure[0]!, pure[1]!, pure[2]!];
  pureLabCache.set(pigment, lab);
  return lab;
}

/** Opaque, infinite-thickness two-constant KM approximation; drops are relative mass. */
export function mixPigmentsColor(inputs: readonly MixInput[]): Pick<MixResult, 'hex' | 'oklab'> {
  if (inputs.length < 2 || inputs.length > 5) {
    throw new RangeError('Choose between 2 and 5 colors.');
  }

  for (const { pigment, amount } of inputs) {
    if (!Number.isInteger(amount) || amount < 1 || amount > 5) {
      throw new RangeError('Each pigment needs 1–5 drops.');
    }
    if (pigment.model !== 'kubelka-munk-two-constant' ||
        pigment.absorption.length !== 38 || pigment.scattering.length !== 38 ||
        Array.from(pigment.absorption).some((k) => !Number.isFinite(k) || k < 0) ||
        Array.from(pigment.scattering).some((s) => !Number.isFinite(s) || s <= 0) ||
        !Array.isArray(pigment.displayOklab) || pigment.displayOklab.length !== 3 ||
        pigment.displayOklab.some((component) => !Number.isFinite(component)) ||
        (pigment.artistHue !== null && (!Number.isFinite(pigment.artistHue) ||
          pigment.artistHue < 0 || pigment.artistHue >= 360))) {
      throw new RangeError('Expected 38 finite K >= 0 and S > 0 samples on the 380–750 nm grid.');
    }
  }

  const total = inputs.reduce((sum, { amount }) => sum + amount, 0);
  const reflectance = Array.from({ length: 38 }, (_, wavelength) => {
    let absorption = 0;
    let scattering = 0;
    for (const { pigment, amount } of inputs) {
      const concentration = amount / total;
      absorption += pigment.absorption[wavelength]! * concentration;
      scattering += pigment.scattering[wavelength]! * concentration;
    }
    // Mix K and S separately: averaging K/S would erase white's scattering strength.
    const value = kmReflectance(absorption, scattering);
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error('Pigment mixing produced an invalid reflectance.');
    }
    return value;
  });

  const rawLab = new Color(reflectance).OKLab;
  const calibrated = calibrateIntuitiveMix([rawLab[0]!, rawLab[1]!, rawLab[2]!], inputs, pureModelLab);
  const hex = displayHexFromOklab(calibrated);
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error('Pigment mixing produced an invalid display color.');
  }

  // Compare names against the color actually visible on a standard sRGB screen.
  const lab = new Color(hex).OKLab;
  const oklab: [number, number, number] = [lab[0] ?? NaN, lab[1] ?? NaN, lab[2] ?? NaN];
  if (oklab.some((component) => !Number.isFinite(component))) {
    throw new Error('Pigment mixing produced an invalid OKLab color.');
  }

  return { hex, oklab };
}

/** Public API and reverse search share every step through the rounded display color. */
export function mixPigments(inputs: readonly MixInput[]): MixResult {
  const color = mixPigmentsColor(inputs);
  return { ...color, nearestName: findNearestColorName(color.oklab) };
}

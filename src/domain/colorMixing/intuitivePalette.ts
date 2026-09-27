import type { VirtualPigment } from './types';

type Lab = readonly [number, number, number];
type PaintInput = { pigment: VirtualPigment; amount: number };

// One shared artist's wheel for the whole virtual paint set. Red/yellow/blue
// are equally spaced here, so their pairs tend toward purple/orange/green.
// The display-hue positions are authored targets, not inferred pigment spectra.
const wheel = [
  { display: 27, artist: 0 },
  { display: 55, artist: 60 },
  { display: 100, artist: 120 },
  { display: 150, artist: 180 },
  { display: 250, artist: 240 },
  { display: 305, artist: 300 },
  { display: 350, artist: 345 },
  { display: 387, artist: 360 },
] as const;

function interpolate(value: number, from: 'display' | 'artist', to: 'display' | 'artist') {
  const wrapped = from === 'display' && value < wheel[0].display ? value + 360 : value;
  for (let i = 1; i < wheel.length; i++) {
    const left = wheel[i - 1]!, right = wheel[i]!;
    if (wrapped <= right[from]) {
      const progress = (wrapped - left[from]) / (right[from] - left[from]);
      return left[to] + (right[to] - left[to]) * progress;
    }
  }
  return wheel.at(-1)![to];
}

export function artistHueForDisplay(lab: Lab): number {
  const hue = (Math.atan2(lab[2], lab[1]) * 180 / Math.PI + 360) % 360;
  return interpolate(hue, 'display', 'artist') % 360;
}

function displayHueForArtist(hue: number): number {
  return interpolate(hue, 'artist', 'display') % 360;
}

/** Calibrate pure swatches, then steer all multi-pigment hues with one RYB wheel. */
export function calibrateIntuitiveMix(base: Lab, inputs: readonly PaintInput[],
  pureModelLab: (pigment: VirtualPigment) => Lab): [number, number, number] {
  const total = inputs.reduce((sum, entry) => sum + entry.amount, 0);
  const corrected: [number, number, number] = [...base];
  let x = 0, y = 0, coloredAmount = 0, referenceChroma = 0;
  const coloredPigments = new Set<VirtualPigment>();

  for (const { pigment, amount } of inputs) {
    const pure = pureModelLab(pigment);
    for (let i = 0; i < 3; i++) {
      corrected[i] = corrected[i]! + amount / total * (pigment.displayOklab[i]! - pure[i]!);
    }
    if (pigment.artistHue === null) continue;
    coloredPigments.add(pigment);
    const radians = pigment.artistHue * Math.PI / 180;
    x += amount * Math.cos(radians);
    y += amount * Math.sin(radians);
    coloredAmount += amount;
    referenceChroma += amount * Math.hypot(pigment.displayOklab[1], pigment.displayOklab[2]);
  }

  if (coloredPigments.size < 2 || coloredAmount === 0) return corrected;
  const coherence = Math.hypot(x, y) / coloredAmount;
  // Opposing colors cancel and keep the earth/gray color from the K/S model.
  // The transition is continuous as drops change or further paints are added.
  const t = Math.max(0, Math.min(1, (coherence - .08) / .30));
  const guidance = t * t * (3 - 2 * t);
  if (guidance === 0) return corrected;
  const artistHue = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  const displayHue = displayHueForArtist(artistHue) * Math.PI / 180;
  const existingChroma = Math.hypot(corrected[1], corrected[2]);
  const intuitiveChroma = referenceChroma / coloredAmount * coherence ** .65 * (coloredAmount / total) ** .55;
  const chroma = Math.max(existingChroma, intuitiveChroma);
  return [corrected[0],
    corrected[1] * (1 - guidance) + chroma * Math.cos(displayHue) * guidance,
    corrected[2] * (1 - guidance) + chroma * Math.sin(displayHue) * guidance];
}

function linearRgb([L, a, b]: Lab) {
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3;
  const m = (L - .1055613458 * a - .0638541728 * b) ** 3;
  const s = (L - .0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + .2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s,
    -.0041960863 * l - .7034186147 * m + 1.7076147010 * s,
  ];
}

/** Convert calibrated OKLab to a displayable sRGB hex, preserving hue if clipped. */
export function displayHexFromOklab(lab: Lab): `#${string}` {
  const L = Math.max(0, Math.min(1, lab[0]));
  let a = lab[1], b = lab[2];
  let rgb = linearRgb([L, a, b]);
  if (rgb.some((component) => component < 0 || component > 1)) {
    let low = 0, high = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      const candidate = linearRgb([L, a * mid, b * mid]);
      if (candidate.every((component) => component >= 0 && component <= 1)) low = mid;
      else high = mid;
    }
    a *= low; b *= low;
    rgb = linearRgb([L, a, b]);
  }
  const bytes = rgb.map((component) => {
    const value = Math.max(0, Math.min(1, component));
    const encoded = value > .0031308 ? 1.055 * value ** (1 / 2.4) - .055 : 12.92 * value;
    return Math.max(0, Math.min(255, Math.round(encoded * 255)));
  });
  return `#${bytes.map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

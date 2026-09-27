import { Color } from 'spectral.js';

type Appearance = {
  base: `#${string}`;
  body: `#${string}`;
  shade: `#${string}`;
  reflection: `#${string}`;
  lineOpacity: number;
  surfaceOpacity: number;
};

const cache = new Map<string, Appearance>();
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function blendHex(from: string, to: string, amount: number): `#${string}` {
  const start = Number.parseInt(from.slice(1), 16);
  const end = Number.parseInt(to.slice(1), 16);
  const channel = (shift: number) => Math.round(
    ((start >> shift) & 255) * (1 - amount) + ((end >> shift) & 255) * amount,
  );
  return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, '0')).join('')}`;
}

/** Display-only tones for the liquid; the selected pigment and mix inputs remain untouched. */
export function eyedropperAppearance(hex: `#${string}`): Appearance {
  const cached = cache.get(hex);
  if (cached) return cached;

  const lightness = new Color(hex).OKLab[0]!;
  const pale = clamp01((lightness - .72) / .26);
  const chalk = clamp01((lightness - .86) / .14);
  const dark = clamp01((.34 - lightness) / .27);
  const shadeTarget = blendHex('#070c11', '#667686', pale);
  const appearance: Appearance = {
    base: hex,
    body: blendHex(hex, '#8795a3', .22 * chalk),
    shade: blendHex(hex, shadeTarget, .1 + .27 * pale),
    reflection: blendHex(hex, '#eef3f8', .08 + .19 * dark),
    lineOpacity: .16 + .16 * dark,
    surfaceOpacity: .55 + .35 * pale,
  };
  cache.set(hex, appearance);
  return appearance;
}

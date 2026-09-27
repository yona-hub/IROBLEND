import { Color } from 'spectral.js';
import { artistHueForDisplay } from '../domain/colorMixing/intuitivePalette';
import type { ColorCategory } from '../domain/colorMixing/types';
import type { VirtualPigment } from '../domain/colorMixing/types';

export const WAVELENGTHS = Object.freeze(Array.from({ length: 38 }, (_, i) => 380 + i * 10));
const anchors = [380, 420, 460, 500, 540, 580, 620, 660, 700, 750];

// Authored absorption spectra, independent of display RGB. Broad absorption bands
// approximate colorant families; values are relative and are NOT measured pigments.
const bands = {
  red: [4, 5, 6, 7, 6, 1.1, .09, .035, .03, .03],
  rose: [.8, .65, 1.6, 5, 6, 2, .12, .04, .04, .04],
  yellow: [7, 7, 5, .45, .06, .04, .035, .035, .035, .035],
  blue: [.24, .12, .09, .22, .65, 3.5, 7, 7, 6, 5],
  ultramarine: [.16, .08, .1, .6, 3, 6, 4, 1.8, 1.2, 1],
  green: [4, 3, 1.3, .2, .12, .65, 3, 4, 4, 4],
  white: [.035, .025, .02, .02, .02, .02, .02, .02, .02, .02],
  black: [12, 12, 12, 12, 12, 12, 12, 12, 12, 12],
} as const;
type Base = keyof typeof bands;
type Recipe = Partial<Record<Base, number>>;

function sample(values: readonly number[], wavelength: number) {
  const end = anchors.findIndex((nm) => nm >= wavelength);
  if (end <= 0) return values[0]!;
  const t = (wavelength - anchors[end - 1]!) / (anchors[end]! - anchors[end - 1]!);
  return values[end - 1]! * (1 - t) + values[end]! * t;
}

const bases = Object.fromEntries(Object.entries(bands).map(([id, values]) => [id, {
  absorption: WAVELENGTHS.map((nm) => sample(values, nm)),
  // White scatters strongly throughout the spectrum; carbon-like black scatters weakly.
  scattering: WAVELENGTHS.map((nm) => id === 'white' ? 8 + (750 - nm) / 370
    : id === 'black' ? .35 : 1 + .12 * (750 - nm) / 370),
}])) as Record<Base, { absorption: number[]; scattering: number[] }>;

// Explicit pigment recipes, not RGB-derived spectra. Each recipe is normalized once
// to define one drop of that preset; UI drop amounts are applied separately at mixing.
const recipes: Record<string, Recipe> = {
  red: { red: 1 }, scarlet: { red: 8, rose: 2 }, vermilion: { red: 4, yellow: 1 },
  crimson: { rose: 7, red: 2, black: .3 }, carmine: { rose: 8, black: .7 }, 'tomato-red': { red: 6, yellow: 1, white: .4 },
  pink: { rose: 1, white: 1.3 }, 'baby-pink': { rose: 1, white: 5 }, 'rose-pink': { rose: 3, white: 1 },
  'cherry-pink': { rose: 5, red: 1, white: .6 }, 'salmon-pink': { red: 2, yellow: .3, white: 1.5 }, 'hot-pink': { rose: 5, white: .4 },
  orange: { red: 1, yellow: 3 }, 'mandarin-orange': { red: 1, yellow: 2 }, 'carrot-orange': { red: 2, yellow: 3, black: .15 },
  apricot: { red: 1, yellow: 3, white: 2 }, coral: { red: 3, rose: 1, yellow: 1, white: 1 }, 'dark-orange': { red: 2, yellow: 3, black: .5 },
  yellow: { yellow: 1 }, 'lemon-yellow': { yellow: 5, white: 1 }, 'canary-yellow': { yellow: 10, red: .2 },
  'golden-yellow': { yellow: 8, red: .5, black: .2 }, 'cream-yellow': { yellow: 1, white: 3 }, khaki: { yellow: 3, black: .4, white: .4 },
  green: { green: 1 }, 'apple-green': { green: 1, yellow: 3, white: .3 }, 'mint-green': { green: 1, blue: .2, white: 2 },
  'emerald-green': { green: 4, blue: 1 }, 'forest-green': { green: 4, black: .7 }, 'lime-green': { yellow: 8, green: 1, white: 1 },
  blue: { blue: 1 }, 'sky-blue': { blue: 1, white: 1.2 }, 'light-blue': { blue: 1, white: 4 },
  'cobalt-blue': { blue: 2, ultramarine: 1 }, ultramarine: { ultramarine: 1 }, 'royal-blue': { ultramarine: 3, blue: 1, white: .3 }, 'navy-blue': { blue: 3, ultramarine: 1, black: 1 },
  purple: { rose: 1, ultramarine: 1 }, violet: { rose: 2, ultramarine: 3, white: .3 },
  lavender: { rose: 1, ultramarine: 1, white: 3 }, lilac: { rose: 1, ultramarine: .6, white: 5 },
  mauve: { rose: 1, ultramarine: .5, black: .2, white: 1.5 }, orchid: { rose: 2, ultramarine: .5, white: 1.5 }, plum: { rose: 2, ultramarine: 1, black: .3 },
  white: { white: 1 }, 'snow-white': { white: 20, blue: .04 }, ivory: { white: 10, yellow: 1 },
  'milk-white': { white: 20, yellow: .3 }, 'white-smoke': { white: 20, black: .2 },
  black: { black: 1 }, charcoal: { black: 5, white: .3 }, graphite: { black: 2, white: .5 },
  'dark-slate': { black: 3, blue: 1, green: .5, white: .4 }, 'dim-gray': { black: 1, white: 1 },
};

export function pigmentForPreset(id: string, displayHex: `#${string}`, category: ColorCategory): VirtualPigment {
  const recipe = recipes[id];
  if (!recipe) throw new Error(`Missing virtual pigment recipe: ${id}`);
  const parts = Object.entries(recipe) as [Base, number][];
  const total = parts.reduce((sum, [, amount]) => sum + amount, 0);
  const coefficients = (key: 'absorption' | 'scattering') => Object.freeze(WAVELENGTHS.map((_, i) =>
    parts.reduce((sum, [base, amount]) => sum + bases[base][key][i]! * amount / total, 0)));
  const lab = new Color(displayHex).OKLab;
  const displayOklab: [number, number, number] = [lab[0]!, lab[1]!, lab[2]!];
  return Object.freeze({ model: 'kubelka-munk-two-constant', source: 'authored-virtual-pigment-v2',
    absorption: coefficients('absorption'), scattering: coefficients('scattering'), displayOklab,
    artistHue: category === 'white' || category === 'black' ? null : artistHueForDisplay(displayOklab) });
}

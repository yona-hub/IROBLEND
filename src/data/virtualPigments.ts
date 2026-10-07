import { Color } from 'spectral.js';
import { namedColorById } from './namedColors';
import { artistHueForDisplay } from '../domain/colorMixing/intuitivePalette';
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
// Nonnegative recipes fitted offline to the shared reference swatches. The eight
// authored base spectra remain independent of sRGB; these are not measured paints.
export const virtualPigmentRecipes: Readonly<Record<string, Recipe>> = {
  "red": {"red": 0.9443359, "white": 0.0556641},
  "scarlet": {"red": 0.6689453, "yellow": 0.3310547},
  "vermilion": {"red": 0.7423828, "yellow": 0.2439453, "white": 0.0136719},
  "crimson": {"red": 0.6826172, "rose": 0.3173828},
  "carmine": {"red": 0.6464844, "rose": 0.3535156},
  "tomato-red": {"red": 0.9455764, "yellow": 0.0003695, "white": 0.0540541},
  "pink": {"red": 0.2841797, "rose": 0.1017748, "yellow": 0.0078125, "white": 0.606233},
  "baby-pink": {"red": 0.0195313, "yellow": 0.0205078, "white": 0.9599609},
  "rose-pink": {"red": 0.2851563, "rose": 0.2724609, "white": 0.4423828},
  "cherry-pink": {"red": 0.047023, "rose": 0.7644117, "white": 0.1885653},
  "salmon-pink": {"red": 0.3915502, "rose": 0.0029297, "yellow": 0.2420333, "white": 0.3634868},
  "hot-pink": {"rose": 0.7755353, "white": 0.2244647},
  "orange": {"red": 0.3027344, "yellow": 0.6972656},
  "mandarin-orange": {"red": 0.133138, "yellow": 0.866862},
  "carrot-orange": {"red": 0.4199219, "yellow": 0.5800781},
  "apricot": {"red": 0.1510417, "yellow": 0.6152344, "white": 0.233724},
  "coral": {"red": 0.4423828, "rose": 0.000651, "yellow": 0.4527995, "white": 0.1041667},
  "dark-orange": {"red": 0.1679688, "yellow": 0.8320313},
  "yellow": {"yellow": 0.9472656, "white": 0.0527344},
  "lemon-yellow": {"yellow": 0.7854818, "white": 0.2145182},
  "canary-yellow": {"yellow": 0.7460938, "white": 0.2539063},
  "golden-yellow": {"red": 0.1199713, "yellow": 0.7945402, "white": 0.0849609, "black": 0.0005276},
  "cream-yellow": {"yellow": 0.2861328, "white": 0.7138672},
  "khaki": {"red": 0.1201172, "yellow": 0.7797081, "white": 0.0730366, "black": 0.0271382},
  "green": {"yellow": 0.5332031, "blue": 0.4667969},
  "apple-green": {"yellow": 0.5140807, "blue": 0.0800781, "ultramarine": 0.0449219, "green": 0.1075581, "white": 0.2533612},
  "mint-green": {"yellow": 0.4316406, "blue": 0.2382813, "ultramarine": 0.0546875, "green": 0.0263672, "white": 0.2490234},
  "emerald-green": {"yellow": 0.5117188, "blue": 0.4880859, "green": 0.0001953},
  "forest-green": {"yellow": 0.4072266, "blue": 0.5498047, "green": 0.0004779, "black": 0.0424909},
  "lime-green": {"red": 0.0009766, "yellow": 0.5441406, "green": 0.0433594, "white": 0.4115234},
  "blue": {"blue": 0.4433594, "ultramarine": 0.5234375, "green": 0.0244141, "black": 0.0087891},
  "sky-blue": {"blue": 0.2660689, "ultramarine": 0.0507813, "green": 0.0263672, "white": 0.6567827},
  "light-blue": {"red": 0.0039063, "rose": 0.0117188, "blue": 0.0271484, "ultramarine": 0.2226563, "green": 0.0908203, "white": 0.64375},
  "cobalt-blue": {"blue": 0.2939453, "ultramarine": 0.6826172, "black": 0.0234375},
  "ultramarine": {"rose": 0.1132813, "ultramarine": 0.8476563, "black": 0.0390625},
  "royal-blue": {"blue": 0.0859375, "ultramarine": 0.90625, "white": 0.0078125},
  "navy-blue": {"ultramarine": 0.3935547, "black": 0.6064453},
  "purple": {"rose": 0.5458984, "blue": 0.0517578, "ultramarine": 0.2705078, "green": 0.0009766, "white": 0.1308594},
  "violet": {"rose": 0.307046, "ultramarine": 0.6588112, "white": 0.0009397, "black": 0.0332031},
  "lavender": {"red": 0.0097656, "rose": 0.1990234, "yellow": 0.0068359, "blue": 0.0380859, "ultramarine": 0.1287109, "green": 0.0009766, "white": 0.6166016},
  "lilac": {"rose": 0.2149917, "blue": 0.0097656, "ultramarine": 0.1075107, "green": 0.03125, "white": 0.636482},
  "mauve": {"rose": 0.6123047, "ultramarine": 0.3398438, "white": 0.0478516},
  "orchid": {"red": 0.0009766, "rose": 0.3828125, "yellow": 0.0009766, "blue": 0.0068359, "ultramarine": 0.0498047, "green": 0.03125, "white": 0.5273438},
  "plum": {"rose": 0.7789122, "ultramarine": 0.0002959, "black": 0.2207919},
  "white": {"white": 1},
  "snow-white": {"white": 1},
  "ivory": {"red": 0.0039063, "rose": 0.0009766, "yellow": 0.0332919, "white": 0.9618253},
  "milk-white": {"yellow": 0.0029297, "white": 0.9970703},
  "white-smoke": {"rose": 0.0019531, "yellow": 0.0019531, "ultramarine": 0.0019531, "green": 0.0009766, "white": 0.9931641},
  "black": {"black": 1},
  "charcoal": {"red": 0.0810547, "rose": 0.3095703, "yellow": 0.0019531, "ultramarine": 0.015625, "green": 0.0136719, "white": 0.0566038, "black": 0.5215212},
  "graphite": {"red": 0.1455078, "rose": 0.2373047, "white": 0.1023438, "black": 0.5148438},
  "dark-slate": {"yellow": 0.0820313, "blue": 0.5790816, "green": 0.0004783, "white": 0.000578, "black": 0.3378308},
  "dim-gray": {"red": 0.0732422, "rose": 0.0126953, "yellow": 0.0644531, "blue": 0.0371094, "ultramarine": 0.046875, "green": 0.0078125, "white": 0.25, "black": 0.5078125},
};

export function pigmentForPreset(id: string): VirtualPigment {
  const reference = namedColorById(id);
  if (!reference.category) throw new Error(`No selectable paint for reference: ${id}`);
  const recipe = virtualPigmentRecipes[id];
  if (!recipe) throw new Error(`Missing virtual pigment recipe: ${id}`);
  const parts = Object.entries(recipe) as [Base, number][];
  const total = parts.reduce((sum, [, amount]) => sum + amount, 0);
  const coefficients = (key: 'absorption' | 'scattering') => Object.freeze(WAVELENGTHS.map((_, i) =>
    parts.reduce((sum, [base, amount]) => sum + bases[base][key][i]! * amount / total, 0)));
  const lab = new Color(reference.hex).OKLab;
  const displayOklab: [number, number, number] = [lab[0]!, lab[1]!, lab[2]!];
  return Object.freeze({ model: 'kubelka-munk-two-constant', source: 'authored-virtual-pigment-v3',
    absorption: coefficients('absorption'), scattering: coefficients('scattering'), displayOklab,
    artistHue: reference.category === 'white' || reference.category === 'black' ? null : artistHueForDisplay(displayOklab) });
}

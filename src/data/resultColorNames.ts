import { namedColors, type NamedColor } from './namedColors';

export type ResultColorName = NamedColor;
// Selectable swatches and result names share one reference registry.
export const resultColorNames: readonly ResultColorName[] = namedColors;

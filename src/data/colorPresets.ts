import type { ColorCategory, ColorPreset } from '../domain/colorMixing/types';
import { pigmentForPreset } from './virtualPigments';
import { namedColors, namedColorById } from './namedColors';

export const categories: ReadonlyArray<{
  id: ColorCategory;
  nameJa: string;
  nameEn: string;
  hex: `#${string}`;
}> = [
  { id: 'red', nameJa: '赤', nameEn: 'RED', hex: namedColorById('red').hex },
  { id: 'pink', nameJa: 'ピンク', nameEn: 'PINK', hex: namedColorById('pink').hex },
  { id: 'orange', nameJa: 'オレンジ', nameEn: 'ORANGE', hex: namedColorById('orange').hex },
  { id: 'yellow', nameJa: '黄', nameEn: 'YELLOW', hex: namedColorById('yellow').hex },
  { id: 'green', nameJa: '緑', nameEn: 'GREEN', hex: namedColorById('green').hex },
  { id: 'blue', nameJa: '青', nameEn: 'BLUE', hex: namedColorById('blue').hex },
  { id: 'purple', nameJa: '紫', nameEn: 'PURPLE', hex: namedColorById('purple').hex },
  { id: 'white', nameJa: '白', nameEn: 'WHITE', hex: namedColorById('white').hex },
  { id: 'black', nameJa: '黒', nameEn: 'BLACK', hex: namedColorById('black').hex },
];

const swatches: readonly Omit<ColorPreset, 'pigment'>[] = namedColors.flatMap((color) =>
  color.category ? [{ ...color, category: color.category }] : []);

export const colorPresets: readonly ColorPreset[] = swatches.map((preset) => ({
  ...preset, pigment: pigmentForPreset(preset.id),
}));
export const presetsById = new Map(colorPresets.map((preset) => [preset.id, preset]));

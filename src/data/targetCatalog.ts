import { colorPresets } from './colorPresets';
import { resultColorNames } from './resultColorNames';
import type { ColorCategory } from '../domain/colorMixing/types';

export type TargetGroupId = ColorCategory | 'brown' | 'gray';
export const targetGroups: readonly { id: TargetGroupId; name: string }[] = [
  { id: 'red', name: '赤' }, { id: 'pink', name: 'ピンク' }, { id: 'orange', name: 'オレンジ' },
  { id: 'yellow', name: '黄' }, { id: 'green', name: '緑' }, { id: 'blue', name: '青' },
  { id: 'purple', name: '紫' }, { id: 'brown', name: '茶・ベージュ' },
  { id: 'white', name: '白' }, { id: 'gray', name: 'グレー' }, { id: 'black', name: '黒' },
];
// Only target classification; material extraction and pigments stay unchanged.
const extraGroups: Record<string, TargetGroupId> = {};
for (const [group, names] of Object.entries({
  brown: 'Brown|Chocolate|Cocoa|Chestnut|Coffee|Dark Brown|Sienna|Umber|Sepia|Beige|Sand|Tan|Light Brown|Ecru|Biscuit|Camel|Oat|Taupe|Greige',
  gray: 'Gray|Ash Gray|Silver Gray|Slate Gray|Warm Gray|Brown Gray|Cool Gray|Light Gray|Dark Gray',
  green: 'Teal|Dark Teal|Blue Green|Sea Green|Turquoise|Olive|Olive Green|Moss Green|Sage|Military Green|Chartreuse|Pistachio',
  blue: 'Peacock Blue|Aqua|Cyan|Ice Blue|Lagoon|Dusty Blue|Denim',
  red: 'Burgundy|Wine|Maroon|Brick Red|Rust|Rosewood',
  pink: 'Magenta|Fuchsia|Raspberry|Berry|Blush|Dusty Pink',
  purple: 'Reddish Purple|Periwinkle|Indigo|Blue Violet|Bluish Purple|Light Purple|Lavender Gray',
  orange: 'Peach|Terracotta',
  yellow: 'Amber|Honey|Mustard',
})) for (const name of names.split('|')) extraGroups[name] = group as TargetGroupId;

export const targetCatalog = resultColorNames.map((named) => {
  const material = colorPresets.find((preset) => preset.nameEn === named.nameEn && preset.hex === named.hex);
  const targetGroupId = material?.category ?? extraGroups[named.nameEn];
  if (!targetGroupId) throw new Error(`Unclassified target: ${named.nameEn}`);
  return { ...named, id: material?.id ?? named.nameEn.toLowerCase().replaceAll(' ', '-'),
    targetGroupId, materialPresetId: material?.id };
});
export type TargetColor = (typeof targetCatalog)[number];
export const targetsById = new Map(targetCatalog.map((target) => [target.id, target]));

import { presetsById } from '../../data/colorPresets';
import type { SelectedColor } from '../colorMixing/types';
import type { ColorPreset } from '../colorMixing/types';
import type { TargetColor } from '../../data/targetCatalog';
function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }
export function recipeKey(selections: readonly SelectedColor[]) {
  const divisor = selections.reduce((n, item) => gcd(n, item.amount), 0);
  return [...selections].sort((a, b) => a.presetId.localeCompare(b.presetId))
    .map((item) => `${item.presetId}:${item.amount / divisor}`).join('|');
}
export function recipeMaterialKey(selections: readonly SelectedColor[]) {
  return selections.map(item => item.presetId).sort().join('|');
}
export function recipeCategoryKey(selections: readonly SelectedColor[]) {
  return [...new Set(selections.map(item => {
    const category = presetsById.get(item.presetId)?.category;
    if (!category) throw new Error('Unknown recipe material');
    return category;
  }))].sort().join('|');
}
export function isEligibleMaterial(preset: ColorPreset, target: TargetColor): boolean {
  return preset.category !== target.targetGroupId &&
    preset.id !== target.materialPresetId &&
    preset.hex.toUpperCase() !== target.hex.toUpperCase();
}
export function legalRecipe(selections: readonly SelectedColor[], target?: TargetColor): boolean {
  return Array.isArray(selections) && selections.length >= 2 && selections.length <= 5 &&
    new Set(selections.map((item) => item?.presetId)).size === selections.length &&
    selections.every((item) => {
      const preset = presetsById.get(item?.presetId);
      return !!preset && Number.isInteger(item.amount) && item.amount >= 1 && item.amount <= 5 &&
        (!target || isEligibleMaterial(preset, target));
    });
}
export function displayAmounts(selections: readonly SelectedColor[]): SelectedColor[] {
  const divisor = selections.reduce((n, item) => gcd(n, item.amount), 0);
  const base = selections.map((item) => ({ ...item, amount: item.amount / divisor }));
  const maxScale = Math.floor(5 / Math.max(...base.map((item) => item.amount)));
  let scale = 1, distance = Infinity;
  for (let n = 1; n <= maxScale; n++) {
    const next = base.reduce((sum, item) => sum + Math.abs(item.amount * n - 3), 0);
    if (next < distance) { scale = n; distance = next; }
  }
  return base.map((item) => ({ ...item, amount: item.amount * scale as SelectedColor['amount'] }));
}

import { Color } from 'spectral.js';
import { presetsById } from '../../data/colorPresets';
import type { TargetColor } from '../../data/targetCatalog';
import { mixPigments } from '../colorMixing/mixPigments';
import type { MixResult, SelectedColor } from '../colorMixing/types';
import { legalRecipe } from './recipeKey';

// Application policy measured in the generation audit; no perceptual guarantee.
export const RECIPE_POLICY = { veryClose: .02, close: .05, maxPublishedDeltaE: .06, simplicitySlack: .005 } as const;
export function targetOklab(target: Pick<TargetColor, 'hex'>): readonly number[] {
  return new Color(target.hex).OKLab;
}
export function targetDeltaE(result: Pick<MixResult, 'oklab'>, target: Pick<TargetColor, 'hex'>) {
  const lab = targetOklab(target);
  return Math.hypot(...result.oklab.map((component, i) => component - lab[i]!));
}
export function evaluateRecipe(selections: readonly SelectedColor[], target: TargetColor) {
  if (!legalRecipe(selections, target)) throw new Error('Invalid reverse recipe');
  const result = mixPigments(selections.map(({ presetId, amount }) => ({
    pigment: presetsById.get(presetId)!.pigment, amount,
  })));
  return { result, targetDeltaE: targetDeltaE(result, target) };
}
export function proximityLabel(predictedHex: string, target: Pick<TargetColor, 'hex'>, distance: number) {
  if (predictedHex.toUpperCase() === target.hex.toUpperCase()) return '画面上では同じ色';
  if (distance <= RECIPE_POLICY.veryClose) return 'とても近い色';
  if (distance <= RECIPE_POLICY.close) return '近い色';
  return '少し違う色';
}

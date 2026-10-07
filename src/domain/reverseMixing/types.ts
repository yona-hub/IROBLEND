import type { SelectedColor } from '../colorMixing/types';
export type SearchScope = 'exhaustive-up-to-3' | 'bounded-up-to-5';
export type RecipeCandidate = {
  id: string; targetId: string; selections: SelectedColor[];
  predictedHex: `#${string}`; targetDeltaE: number;
  ingredientCount: number; searchScope: SearchScope;
};
export type SearchEnd = 'threshold-met' | 'budget-exhausted' | 'exhaustive-complete';
export type RecipeManifest = {
  formatVersion: 1; modelFingerprint: string; catalogFingerprint: string;
  searchConfigVersion: string; generatedAt: string;
  exhaustiveComplete: boolean;
  targets: Record<string, RecipeCandidate[]>;
  search: Record<string, { end: SearchEnd; boundedEvaluations: number; bestDeltaE: number }>;
};

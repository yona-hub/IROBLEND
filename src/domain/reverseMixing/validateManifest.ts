import { targetCatalog } from '../../data/targetCatalog';
import { evaluateRecipe, RECIPE_POLICY } from './evaluateRecipe';
import { currentRecipeFingerprints } from './fingerprints';
import { recipeCategoryKey, recipeKey, recipeMaterialKey } from './recipeKey';
import type { RecipeCandidate, RecipeManifest } from './types';

export async function validateManifest(value: unknown): Promise<RecipeManifest> {
  if (!value || typeof value !== 'object') throw new Error('Missing recipe manifest');
  const manifest = value as RecipeManifest;
  const expected = await currentRecipeFingerprints();
  if (manifest.formatVersion !== 1 || manifest.exhaustiveComplete !== true ||
      manifest.searchConfigVersion !== 'reverse-v4' ||
      manifest.modelFingerprint !== expected.modelFingerprint ||
      manifest.catalogFingerprint !== expected.catalogFingerprint) throw new Error('Recipe fingerprint mismatch');
  if (!manifest.targets || Object.keys(manifest.targets).length !== targetCatalog.length) throw new Error('Invalid targets');
  const ids = new Set<string>();
  for (const target of targetCatalog) {
    const recipes = manifest.targets[target.id];
    if (!Array.isArray(recipes) || recipes.length > 3) throw new Error('Invalid candidates');
    const keys = new Set<string>();
    const materialKeys = new Set<string>();
    const categoryKeys = new Set<string>();
    for (const candidate of recipes as RecipeCandidate[]) {
      if (!candidate || typeof candidate.id !== 'string' || ids.has(candidate.id) ||
          candidate.targetId !== target.id || !Array.isArray(candidate.selections) ||
          !['exhaustive-up-to-3', 'bounded-up-to-5'].includes(candidate.searchScope)) throw new Error('Invalid recipe');
      const { result, targetDeltaE } = evaluateRecipe(candidate.selections, target);
      const key = recipeKey(candidate.selections);
      const materialKey = recipeMaterialKey(candidate.selections);
      const categoryKey = recipeCategoryKey(candidate.selections);
      if (keys.has(key) || materialKeys.has(materialKey) || categoryKeys.has(categoryKey) ||
          result.hex !== candidate.predictedHex ||
          candidate.ingredientCount !== candidate.selections.length ||
          (candidate.searchScope === 'exhaustive-up-to-3' && candidate.ingredientCount > 3) ||
          !Number.isFinite(candidate.targetDeltaE) ||
          Math.abs(candidate.targetDeltaE - targetDeltaE) > 1e-12 ||
          targetDeltaE > RECIPE_POLICY.maxPublishedDeltaE) throw new Error('Unverified recipe');
      keys.add(key); materialKeys.add(materialKey); categoryKeys.add(categoryKey); ids.add(candidate.id);
    }
  }
  return manifest;
}

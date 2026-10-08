import { Color } from 'spectral.js';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { colorPresets, presetsById } from '../data/colorPresets';
import { targetCatalog, targetsById } from '../data/targetCatalog';
import manifestData from '../data/generated/reverseRecipes.json';
import { mixPigments, mixPigmentsColor } from '../domain/colorMixing/mixPigments';
import { validateManifest } from '../domain/reverseMixing/validateManifest';
import { legalRecipe, recipeCategoryKey, recipeKey, recipeMaterialKey } from '../domain/reverseMixing/recipeKey';
import { evaluateRecipe, proximityLabel, RECIPE_POLICY, targetDeltaE } from '../domain/reverseMixing/evaluateRecipe';
import { recommendedTargetIds } from '../components/TargetColorPicker';
import { initialMixState, mixReducer } from '../domain/state/mixReducer';
import type { RecipeManifest } from '../domain/reverseMixing/types';
import type { SelectedColor } from '../domain/colorMixing/types';

beforeAll(async () => { const moduleName = 'node:crypto'; const { webcrypto } = await import(moduleName); vi.stubGlobal('crypto', webcrypto); });
describe('reverse recipes', () => {
  it('keeps 54 materials and 125 unique referenced targets with verified recommendations', () => {
    expect(colorPresets).toHaveLength(54);
    expect(targetCatalog).toHaveLength(125);
    expect(new Set(targetCatalog.map(item => item.id)).size).toBe(125);
    expect(recommendedTargetIds.length).toBeGreaterThanOrEqual(18);
    for (const id of recommendedTargetIds) expect(manifestData.targets[id]?.length).toBeGreaterThan(0);
  });
  it('independently remixes every published candidate and measures distance from the target hex', async () => {
    await expect(validateManifest(manifestData)).resolves.toBe(manifestData);
    for (const target of targetCatalog) {
      const keys = new Set<string>();
      const materialKeys = new Set<string>();
      const categoryKeys = new Set<string>();
      const recipes = (manifestData as RecipeManifest).targets[target.id]!;
      expect(recipes.length).toBeLessThanOrEqual(3);
      for (const recipe of recipes) {
        expect(legalRecipe(recipe.selections, target)).toBe(true);
        expect(recipe.selections.every(item => presetsById.get(item.presetId)!.category !== target.targetGroupId)).toBe(true);
        const inputs = recipe.selections.map(item => ({ pigment: presetsById.get(item.presetId)!.pigment, amount: item.amount }));
        const actual = mixPigments(inputs);
        expect(actual.hex).toBe(recipe.predictedHex);
        expect(mixPigmentsColor(inputs)).toEqual({ hex: actual.hex, oklab: actual.oklab });
        const lab = new Color(target.hex).OKLab;
        const independent = Math.hypot(actual.oklab[0] - lab[0]!, actual.oklab[1] - lab[1]!, actual.oklab[2] - lab[2]!);
        expect(recipe.targetDeltaE).toBeCloseTo(independent, 14);
        expect(independent).toBeLessThanOrEqual(.06);
        const key = recipeKey(recipe.selections);
        expect(keys.has(key)).toBe(false); keys.add(key);
        const materialKey = recipeMaterialKey(recipe.selections);
        const categoryKey = recipeCategoryKey(recipe.selections);
        expect(materialKeys.has(materialKey)).toBe(false); materialKeys.add(materialKey);
        expect(categoryKeys.has(categoryKey)).toBe(false); categoryKeys.add(categoryKey);
      }
    }
    expect(manifestData.targets.black).toEqual([]);
    expect(manifestData.searchConfigVersion).toBe('reverse-v4');
    expect(Object.values(manifestData.targets).filter(recipes => recipes.length === 3).length).toBeGreaterThan(100);
    expect(manifestData.targets.orange.length).toBeGreaterThan(0);
    expect(manifestData.targets.orange.some(recipe => {
      const groups = recipe.selections.map(item => presetsById.get(item.presetId)!.category);
      return groups.includes('red') && groups.includes('yellow') && !groups.includes('orange');
    })).toBe(true);
  });
  it('accepts newly available colors up to .06 without labeling them as close colors', async () => {
    expect(RECIPE_POLICY.maxPublishedDeltaE).toBe(.06);
    for (const id of ['crimson', 'carmine', 'green', 'white', 'cyan', 'magenta']) {
      const target = targetsById.get(id)!;
      const recipes = (manifestData as RecipeManifest).targets[id]!;
      expect(recipes.length).toBeGreaterThan(0);
      for (const recipe of recipes) {
        expect(recipe.targetDeltaE).toBeGreaterThan(.05);
        expect(recipe.targetDeltaE).toBeLessThanOrEqual(.06);
        expect(proximityLabel(recipe.predictedHex, target, recipe.targetDeltaE)).toBe('少し違う色');
      }
    }
    const target = targetsById.get('brown')!;
    expect(proximityLabel(target.hex, target, 0)).toBe('画面上では同じ色');
    expect(proximityLabel('#000000', target, .02)).toBe('とても近い色');
    expect(proximityLabel('#000000', target, .05)).toBe('近い色');
    expect(proximityLabel('#000000', target, .050001)).toBe('少し違う色');
    expect(proximityLabel('#000000', target, .06)).toBe('少し違う色');

    const tooFar = structuredClone(manifestData) as RecipeManifest;
    const selections: SelectedColor[] = [{ presetId: 'red', amount: 3 }, { presetId: 'blue', amount: 3 }];
    const { result, targetDeltaE: distance } = evaluateRecipe(selections, targetsById.get('black')!);
    expect(distance).toBeGreaterThan(.06);
    tooFar.targets.black = [{ id: 'black-too-far', targetId: 'black', selections,
      predictedHex: result.hex, targetDeltaE: distance, ingredientCount: 2, searchScope: 'exhaustive-up-to-3' }];
    await expect(validateManifest(tooFar)).rejects.toThrow('Unverified recipe');
  });
  it('does not substitute the nearest dictionary name distance for target distance', () => {
    const result = mixPigments([{ pigment: presetsById.get('red')!.pigment, amount: 3 },
      { pigment: presetsById.get('blue')!.pigment, amount: 3 }]);
    expect(targetDeltaE(result, targetsById.get('beige')!)).toBeGreaterThan(result.nearestName.deltaE + .1);
  });
  it('rejects target-category paint while allowing ordinary ingredients for brown and gray', () => {
    expect(legalRecipe([{ presetId: 'mandarin-orange', amount: 3 }, { presetId: 'lemon-yellow', amount: 3 }],
      targetsById.get('orange')!)).toBe(false);
    expect(legalRecipe([{ presetId: 'vermilion', amount: 3 }, { presetId: 'lemon-yellow', amount: 3 }],
      targetsById.get('orange')!)).toBe(true);
    expect(legalRecipe([{ presetId: 'white', amount: 3 }, { presetId: 'black', amount: 3 }],
      targetsById.get('gray')!)).toBe(true);
  });
  it('rejects stale fingerprints, illegal amounts, duplicate ratios and altered predictions', async () => {
    for (const field of ['modelFingerprint', 'catalogFingerprint'] as const) {
      const stale = structuredClone(manifestData);
      stale[field] = 'stale';
      await expect(validateManifest(stale)).rejects.toThrow('fingerprint');
    }
    const stalePolicy = structuredClone(manifestData);
    stalePolicy.searchConfigVersion = 'reverse-v3';
    await expect(validateManifest(stalePolicy)).rejects.toThrow('fingerprint');
    const badHex = structuredClone(manifestData);
    badHex.targets.brown[0]!.predictedHex = '#000000';
    await expect(validateManifest(badHex)).rejects.toThrow('Unverified');
    const badDistance = structuredClone(manifestData);
    badDistance.targets.brown[0]!.targetDeltaE += .01;
    await expect(validateManifest(badDistance)).rejects.toThrow('Unverified');
    const duplicate = structuredClone(manifestData);
    duplicate.targets.brown[1] = { ...duplicate.targets.brown[0]!, id: 'duplicate-ratio' };
    await expect(validateManifest(duplicate)).rejects.toThrow('Unverified');
  });
  it('rejects alternatives that only change eyedropper amounts or swap paints within the same categories', async () => {
    const target = targetsById.get('turquoise')!;
    const original = (manifestData as RecipeManifest).targets.turquoise![0]!;
    const amountOnly = structuredClone(manifestData);
    const changedAmount = Array.from({ length: original.selections.length }, (_, slot) =>
      [1, 2, 3, 4, 5].flatMap(amount => {
        if (amount === original.selections[slot]!.amount) return [];
        const selections = original.selections.map((item, i) => i === slot ? { ...item, amount: amount as 1 | 2 | 3 | 4 | 5 } : item);
        const result = mixPigments(selections.map(item => ({ pigment: presetsById.get(item.presetId)!.pigment, amount: item.amount })));
        return recipeKey(selections) !== recipeKey(original.selections) && targetDeltaE(result, target) <= .05
          ? [{ selections, result }] : [];
      })).flat()[0];
    expect(changedAmount).toBeDefined();
    amountOnly.targets.turquoise[1] = { ...amountOnly.targets.turquoise[1]!,
      selections: changedAmount!.selections, predictedHex: changedAmount!.result.hex,
      targetDeltaE: targetDeltaE(changedAmount!.result, target), ingredientCount: changedAmount!.selections.length };
    await expect(validateManifest(amountOnly)).rejects.toThrow('Unverified recipe');

    const sameCategories = structuredClone(manifestData);
    const swapped = original.selections.flatMap((entry, slot) => colorPresets
      .filter(preset => preset.category === presetsById.get(entry.presetId)!.category && preset.id !== entry.presetId)
      .flatMap(preset => ([1, 2, 3, 4, 5] as const).flatMap(amount => {
        const selections = original.selections.map((item, index) => index === slot ? { presetId: preset.id, amount } : item);
        if (!legalRecipe(selections, target)) return [];
        const result = mixPigments(selections.map(item => ({ pigment: presetsById.get(item.presetId)!.pigment, amount: item.amount })));
        return targetDeltaE(result, target) <= .05 ? [{ selections, result }] : [];
      })))[0];
    expect(swapped).toBeDefined();
    const { selections, result } = swapped!;
    expect(recipeCategoryKey(selections)).toBe(recipeCategoryKey(original.selections));
    expect(recipeMaterialKey(selections)).not.toBe(recipeMaterialKey(original.selections));
    sameCategories.targets.turquoise[1] = { ...sameCategories.targets.turquoise[1]!,
      selections: selections.map(item => ({ ...item, amount: item.amount as 1 | 2 | 3 | 4 | 5 })),
      predictedHex: result.hex, targetDeltaE: targetDeltaE(result, target), ingredientCount: selections.length };
    await expect(validateManifest(sameCategories)).rejects.toThrow('Unverified recipe');
  });
  it('loads only valid recipes into ready and clears completed and pending colors', () => {
    const recipe = (manifestData as RecipeManifest).targets.brown![0]!.selections;
    const result = mixPigments(recipe.map(item => ({ pigment: presetsById.get(item.presetId)!.pigment, amount: item.amount })));
    const completed = mixReducer(initialMixState, { type: 'restore', selectedColors: recipe, result });
    const ready = mixReducer(completed, { type: 'loadRecipe', selectedColors: recipe });
    expect(ready).toEqual({ selectedColors: recipe, status: 'ready', result: null, pendingResult: null });
    expect(ready.selectedColors).not.toBe(recipe);
    const mixing = mixReducer(ready, { type: 'start', result });
    expect(mixReducer(mixing, { type: 'loadRecipe', selectedColors: recipe })).toBe(mixing);
    const invalid: SelectedColor[][] = [
      [recipe[0]!], [{ presetId: 'unknown', amount: 3 }, recipe[0]!],
      [recipe[0]!, recipe[0]!], [{ ...recipe[0]!, amount: 6 as 5 }, recipe[1]!],
    ];
    for (const selectedColors of invalid) expect(mixReducer(completed, { type: 'loadRecipe', selectedColors })).toBe(completed);
  });
});

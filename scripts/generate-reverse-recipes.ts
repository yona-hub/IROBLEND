import { writeFileSync, mkdirSync } from 'node:fs';
import { Color } from 'spectral.js';
import { colorPresets } from '../src/data/colorPresets';
import { targetCatalog } from '../src/data/targetCatalog';
import { mixPigmentsColor } from '../src/domain/colorMixing/mixPigments';
import { currentRecipeFingerprints } from '../src/domain/reverseMixing/fingerprints';
import { displayAmounts, isEligibleMaterial, recipeCategoryKey, recipeKey, recipeMaterialKey } from '../src/domain/reverseMixing/recipeKey';
import { evaluateRecipe, RECIPE_POLICY } from '../src/domain/reverseMixing/evaluateRecipe';
import { validateManifest } from '../src/domain/reverseMixing/validateManifest';
import type { SelectedColor } from '../src/domain/colorMixing/types';
import type { RecipeCandidate, RecipeManifest, SearchScope } from '../src/domain/reverseMixing/types';

const config = { exhaustiveSeconds: 120, pool: 24, beam: 8, iterations: 4,
  evaluationsPerTarget: 20000, secondsPerTarget: 15, totalBoundedEvaluations: 1000000 };
const start = performance.now();
const directory = 'docs/reverse-recipes';
mkdirSync(directory, { recursive: true });
type Seed = { selections: SelectedColor[]; distance: number; materialKey: string; categoryKey: string; scope: SearchScope };
const labs = targetCatalog.map(target => new Color(target.hex).OKLab);
const excluded = targetCatalog.map(target => new Set(colorPresets.flatMap((preset, i) =>
  isEligibleMaterial(preset, target) ? [] : [i])));
const pools = targetCatalog.map(() => ({ 2: [] as Seed[], 3: [] as Seed[], higher: [] as Seed[],
  byCategory: new Map<string, Seed>() }));
const counts = { 2: 0, 3: 0, bounded: 0 };
function offer(pool: Seed[], selections: SelectedColor[], distance: number, scope: SearchScope) {
  if (pool.length >= config.pool && distance >= pool.at(-1)!.distance) return;
  const materialKey = recipeMaterialKey(selections);
  const same = pool.findIndex(seed => seed.materialKey === materialKey);
  if (same >= 0 && pool[same]!.distance <= distance) return;
  const seed = { selections: selections.map(item => ({ ...item })), distance, materialKey,
    categoryKey: recipeCategoryKey(selections), scope };
  if (same >= 0) pool.splice(same, 1);
  pool.push(seed); pool.sort((a, b) => a.distance - b.distance || a.materialKey.localeCompare(b.materialKey));
  if (pool.length > config.pool) pool.pop();
}
function offerCategory(pool: Map<string, Seed>, selections: SelectedColor[], distance: number, scope: SearchScope,
  categoryKey = recipeCategoryKey(selections), materialKey = recipeMaterialKey(selections)) {
  if (distance > RECIPE_POLICY.maxPublishedDeltaE) return;
  const previous = pool.get(categoryKey);
  if (previous && (previous.distance < distance ||
      previous.distance === distance && previous.materialKey <= materialKey)) return;
  pool.set(categoryKey, { selections: selections.map(item => ({ ...item })), distance, materialKey, categoryKey, scope });
}
function checkpoint(phase: string) {
  const elapsedSeconds = (performance.now() - start) / 1000;
  const data = { phase, elapsedSeconds, counts, config, targets: targetCatalog.map((target, i) => ({
    id: target.id, best2: pools[i]![2][0]?.distance, best3: pools[i]![3][0]?.distance })) };
  writeFileSync(directory + '/generation-progress.json', JSON.stringify(data, null, 2));
  console.log(JSON.stringify({ phase, elapsedSeconds: +elapsedSeconds.toFixed(1), counts }));
}
function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a; }
const amounts = [2, 3].map(n => {
  const vectors: number[][] = [];
  for (let a = 1; a <= 5; a++) for (let b = 1; b <= 5; b++) {
    if (n === 2) { if (gcd(a, b) === 1) vectors.push([a, b]); }
    else for (let c = 1; c <= 5; c++) if (gcd(gcd(a, b), c) === 1) vectors.push([a, b, c]);
  }
  return vectors;
});
let nextCheckpoint = 100000;
for (const size of [2, 3] as const) {
  for (let a = 0; a < colorPresets.length - 1; a++) {
    for (let b = a + 1; b < colorPresets.length; b++) {
      const thirds = size === 2 ? [-1] : Array.from({ length: colorPresets.length - b - 1 }, (_, i) => b + i + 1);
      for (const c of thirds) {
        const indices = size === 2 ? [a, b] : [a, b, c];
        const categoryKey = [...new Set(indices.map(index => colorPresets[index]!.category))].sort().join('|');
        const materialKey = indices.map(index => colorPresets[index]!.id).sort().join('|');
        const eligible = targetCatalog.flatMap((_, i) => indices.every(index => !excluded[i]!.has(index)) ? [i] : []);
        for (const vector of amounts[size - 2]!) {
          const selections = indices.map((index, i) => ({ presetId: colorPresets[index]!.id, amount: vector[i]! as SelectedColor['amount'] }));
          const result = mixPigmentsColor(indices.map((index, i) => ({ pigment: colorPresets[index]!.pigment, amount: vector[i]! })));
          counts[size]++;
          for (const index of eligible) {
            const lab = labs[index]!, targetPool = pools[index]!, pool = targetPool[size];
            // This runs for every eligible target in millions of recipes.
            const lightness = result.oklab[0] - lab[0]!;
            const greenRed = result.oklab[1] - lab[1]!;
            const blueYellow = result.oklab[2] - lab[2]!;
            const squared = lightness ** 2 + greenRed ** 2 + blueYellow ** 2;
            if (squared <= RECIPE_POLICY.maxPublishedDeltaE ** 2) {
              const previous = targetPool.byCategory.get(categoryKey);
              if (!previous || squared < previous.distance ** 2)
                offerCategory(targetPool.byCategory, selections, Math.sqrt(squared), 'exhaustive-up-to-3', categoryKey, materialKey);
            }
            if (pool.length >= config.pool && squared >= pool.at(-1)!.distance ** 2) continue;
            offer(pool, selections, Math.sqrt(squared), 'exhaustive-up-to-3');
          }
          if (counts[2] + counts[3] >= nextCheckpoint) {
            checkpoint('exhaustive-' + size); nextCheckpoint += 100000;
            if (performance.now() - start > config.exhaustiveSeconds * 1000) throw new Error('Exhaustive time budget exhausted; partial audit saved');
          }
        }
      }
    }
  }
  checkpoint('exhaustive-' + size + '-complete');
}
const exhaustiveSeconds = (performance.now() - start) / 1000;
const search: RecipeManifest['search'] = {};
for (let index = 0; index < targetCatalog.length; index++) {
  const target = targetCatalog[index]!, pool = pools[index]!;
  const lowBest = Math.min(pool[2][0]!.distance, pool[3][0]!.distance);
  let evaluations = 0;
  let end: RecipeManifest['search'][string]['end'] = 'exhaustive-complete';
  if (lowBest > RECIPE_POLICY.close) {
    const boundedStart = performance.now(), visited = new Set<string>();
    let beam = [...pool[2].slice(0, 4), ...pool[3].slice(0, 12)].sort((a, b) => a.distance - b.distance).slice(0, config.beam);
    let exhausted = false;
    for (let iteration = 0; iteration < config.iterations && !exhausted; iteration++) {
      const next: Seed[] = [...beam];
      const consider = (selections: SelectedColor[]) => {
        if (exhausted) return;
        if (evaluations >= config.evaluationsPerTarget || counts.bounded >= config.totalBoundedEvaluations ||
            performance.now() - boundedStart >= config.secondsPerTarget * 1000) { exhausted = true; return; }
        selections.sort((a, b) => a.presetId.localeCompare(b.presetId));
        const key = recipeKey(selections);
        if (visited.has(key)) return;
        visited.add(key);
        const { targetDeltaE } = evaluateRecipe(selections, target);
        evaluations++; counts.bounded++;
        offer(next, selections, targetDeltaE, 'bounded-up-to-5');
        if (selections.length >= 4) offer(pool.higher, selections, targetDeltaE, 'bounded-up-to-5');
        offerCategory(pool.byCategory, selections, targetDeltaE, 'bounded-up-to-5');
      };
      const legalMaterials = colorPresets.filter((_, i) => !excluded[index]!.has(i));
      for (const seed of beam) {
        const selections = seed.selections;
        for (let slot = 0; slot < selections.length; slot++) {
          const item = selections[slot]!;
          for (const shift of [-1, 1]) {
            const amount = item.amount + shift;
            if (amount >= 1 && amount <= 5) consider(selections.map((entry, i) => i === slot ? { ...entry, amount: amount as SelectedColor['amount'] } : { ...entry }));
          }
          if (selections.length > 3) consider(selections.filter((_, i) => i !== slot).map(entry => ({ ...entry })));
          for (const material of legalMaterials) {
            if (selections.some(entry => entry.presetId === material.id)) continue;
            consider(selections.map((entry, i) => i === slot ? { presetId: material.id, amount: entry.amount } : { ...entry }));
          }
        }
        if (selections.length < 5) for (const material of legalMaterials) {
          if (selections.some(entry => entry.presetId === material.id)) continue;
          for (let amount = 1; amount <= 5; amount++)
            consider([...selections.map(entry => ({ ...entry })), { presetId: material.id, amount: amount as SelectedColor['amount'] }]);
        }
      }
      beam = next.sort((a, b) => a.distance - b.distance).slice(0, config.beam);
      if (pool.higher[0] && pool.higher[0].distance <= RECIPE_POLICY.close) { end = 'threshold-met'; break; }
      end = 'budget-exhausted';
    }
    checkpoint('bounded-' + target.id);
  }
  search[target.id] = { end, boundedEvaluations: evaluations,
    bestDeltaE: Math.min(lowBest, pool.higher[0]?.distance ?? Infinity) };
}

const targets: RecipeManifest['targets'] = {};
const auditTargets = targetCatalog.map((target, i) => {
  const pool = pools[i]!;
  const seeds = [...pool[2], ...pool[3], ...pool.higher, ...pool.byCategory.values()];
  const evaluated = seeds.map(seed => {
    const selections = displayAmounts(seed.selections);
    const { result, targetDeltaE } = evaluateRecipe(selections, target);
    return { seed, selections, predictedHex: result.hex, targetDeltaE };
  }).sort((a, b) => a.targetDeltaE - b.targetDeltaE || recipeKey(a.selections).localeCompare(recipeKey(b.selections)));
  const close = evaluated.filter(item => item.targetDeltaE <= RECIPE_POLICY.maxPublishedDeltaE);
  const best = close[0];
  const chosen: typeof close = [];
  if (best) {
    const simple = close.filter(item => item.targetDeltaE <= best.targetDeltaE + RECIPE_POLICY.simplicitySlack)
      .sort((a, b) => a.selections.length - b.selections.length || a.targetDeltaE - b.targetDeltaE)[0]!;
    chosen.push(simple);
    for (const item of close) {
      if (chosen.some(other => other.seed.materialKey === item.seed.materialKey ||
          other.seed.categoryKey === item.seed.categoryKey)) continue;
      chosen.push(item);
      if (chosen.length === 3) break;
    }
  }
  const candidates = chosen.map((item, index): RecipeCandidate => ({
    id: target.id + '-' + (index + 1), targetId: target.id, selections: item.selections,
    predictedHex: item.predictedHex, targetDeltaE: item.targetDeltaE,
    ingredientCount: item.selections.length, searchScope: item.seed.scope,
  }));
  targets[target.id] = candidates;
  return { target, search: search[target.id], bestFound: evaluated[0], candidates };
});
const fingerprints = await currentRecipeFingerprints();
const manifest: RecipeManifest = { formatVersion: 1, ...fingerprints, searchConfigVersion: 'reverse-v4',
  generatedAt: new Date().toISOString(), exhaustiveComplete: true, targets, search };
await validateManifest(manifest);
mkdirSync('src/data/generated', { recursive: true });
writeFileSync('src/data/generated/reverseRecipes.json', JSON.stringify(manifest, null, 2) + '\n');
const achieved = Object.fromEntries([.01, .02, .03, .05, RECIPE_POLICY.maxPublishedDeltaE].map(threshold =>
  [threshold, auditTargets.filter(item => (item.candidates[0]?.targetDeltaE ?? Infinity) <= threshold).length]));
const summary = { materials: colorPresets.length, targets: targetCatalog.length,
  materialPolicy: 'exclude target category, exact material ID, and exact display HEX; distinct ingredient category sets and material IDs across candidates', config, fingerprints,
  policy: RECIPE_POLICY, counts, exhaustiveSeconds, totalSeconds: (performance.now() - start) / 1000, achieved,
  noCloseCandidate: auditTargets.filter(item => !item.candidates.length).map(item => item.target.id),
  nonMaterialTargets: auditTargets.filter(item => !item.target.materialPresetId).length,
  nonMaterialClose: auditTargets.filter(item => !item.target.materialPresetId && item.candidates.length).length,
  brownClose: auditTargets.filter(item => item.target.targetGroupId === 'brown' && item.candidates.length).length,
  grayClose: auditTargets.filter(item => item.target.targetGroupId === 'gray' && item.candidates.length).length };
const compactAudit = auditTargets.map(({ target, search, candidates, bestFound }) => ({
  target, search, candidates, bestFound: bestFound && { selections: bestFound.selections,
    predictedHex: bestFound.predictedHex, targetDeltaE: bestFound.targetDeltaE, searchScope: bestFound.seed.scope } }));
writeFileSync(directory + '/audit.json', JSON.stringify({ summary, targets: compactAudit }, null, 2) + '\n');
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const rows = auditTargets.map(({ target, candidates, search, bestFound }) => {
  const recipes = candidates.length ? candidates : bestFound ? [{ ...bestFound, searchScope: bestFound.seed.scope }] : [];
  return `<section><h2>${escape(target.nameJa)} <small>${target.hex}</small></h2><p>${search!.end} · bounded ${search!.boundedEvaluations}</p>${
    recipes.map((recipe, i) => `<div class="pair"><figure><span style="background:${target.hex}"></span><figcaption>目標 ${target.hex}</figcaption></figure><figure><span style="background:${recipe.predictedHex}"></span><figcaption>${candidates.length ? '候補 ' + (i + 1) : '未掲載・最良探索色'} ${recipe.predictedHex}</figcaption></figure></div><p>ΔEOK ${recipe.targetDeltaE.toFixed(6)} · ${recipe.searchScope}<br>${recipe.selections.map(item => escape(colorPresets.find(p => p.id === item.presetId)!.nameJa) + ' ' + item.amount + '本分').join(' ＋ ')}</p>`).join('')}</section>`;
}).join('');
writeFileSync(directory + '/audit.html', `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IROBLEND 配合監査</title><style>body{font:15px system-ui;margin:24px;background:#f8f8f6;color:#25282c}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:20px}section{padding:18px;background:white}h2{font-size:18px}small,p{font-size:12px}figure{margin:0;flex:1;background:#eee;padding:10px}figure span{display:block;height:80px}figcaption{margin-top:8px}.pair{display:flex;gap:12px}</style><h1>通常混色モデルによる配合監査</h1><p>目標と同じカテゴリ・同一材料・同一HEXの絵の具を除外。2・3色は全正規比率を探索。4・5色は不足目標のみ有界探索。ΔEOK ≤ ${RECIPE_POLICY.maxPublishedDeltaE}だけ掲載（0.05超は「少し違う色」）。候補どうしは材料とカテゴリ構成を変え、近くない候補で枠を埋めない。実物の絵の具への一致・全体最適を保証しない。</p><pre>${escape(JSON.stringify(summary, null, 2))}</pre><main>${rows}</main></html>`);
console.log(JSON.stringify(summary, null, 2));

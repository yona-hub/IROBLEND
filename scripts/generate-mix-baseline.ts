import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import previous from '../src/tests/fixtures/mix-core-baseline.json';
import { presetsById } from '../src/data/colorPresets';
import { mixPigments } from '../src/domain/colorMixing/mixPigments';

const cases = previous.cases.map(({ selections }) => ({
  selections,
  hex: mixPigments(selections.map(({ presetId, amount }) => ({
    pigment: presetsById.get(presetId)!.pigment, amount,
  }))).hex,
}));

writeFileSync(resolve('src/tests/fixtures/mix-core-reference-20261008.json'),
  JSON.stringify({ baselineLabel: 'post-color-reference-merge-2026-10-08', cases }) + '\n');
console.log(`Wrote ${cases.length} forward-mixing reference cases.`);

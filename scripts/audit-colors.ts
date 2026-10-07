import { writeFileSync } from 'node:fs';
import { Color } from 'spectral.js';
import { namedColors } from '../src/data/namedColors';
import { colorPresets, presetsById } from '../src/data/colorPresets';
import { virtualPigmentRecipes } from '../src/data/virtualPigments';
import { mixPigments } from '../src/domain/colorMixing/mixPigments';

const delta = (a: readonly number[], b: readonly number[]) => Math.hypot(...a.map((v, i) => v - b[i]!));
const mix = (first: string, second: string, a = 3, b = 3) => mixPigments([
  { pigment: presetsById.get(first)!.pigment, amount: a },
  { pigment: presetsById.get(second)!.pigment, amount: b },
]);
const paints = colorPresets.map(preset => {
  const q = preset.pigment.absorption.map((k, i) => k / preset.pigment.scattering[i]!);
  const raw = new Color(q.map(value => 1 / (1 + value + Math.hypot(value, Math.sqrt(2 * value)))));
  const target = new Color(preset.hex).OKLab;
  const pure = mix(preset.id, preset.id, 1, 5);
  return {
    id: preset.id, referenceHex: preset.hex, recipe: virtualPigmentRecipes[preset.id],
    rawHex: raw.toString({ format: 'hex' }), rawDelta: delta(raw.OKLab, target),
    calibratedHex: pure.hex, calibratedDelta: delta(pure.oklab, target),
    whiteSteps: preset.id === 'white' ? [] : [1, 2, 3, 4, 5].map(amount => mix(preset.id, 'white', 3, amount)),
    blackSteps: preset.id === 'black' ? [] : [1, 2, 3, 4, 5].map(amount => mix(preset.id, 'black', 3, amount)),
  };
});
const pairs = colorPresets.flatMap((first, i) => colorPresets.slice(i + 1).map(second => {
  const result = mix(first.id, second.id);
  return { first: first.id, second: second.id, ...result,
    orderDelta: delta(result.oklab, mix(second.id, first.id).oklab),
    scaleDelta: delta(mix(first.id, second.id, 1, 1).oklab, result.oklab),
  };
}));
const summary = {
  colors: namedColors.length, selectablePaints: paints.length, pairs: pairs.length,
  sources: Object.fromEntries(['colordic', 'css', 'authored'].map(kind => [kind, namedColors.filter(c => c.reference.kind === kind).length])),
  invalidPairs: pairs.filter(p => !/^#[0-9A-F]{6}$/i.test(p.hex) || !p.oklab.every(Number.isFinite)).length,
  maximumOrderDelta: Math.max(...pairs.map(p => p.orderDelta)),
  maximumScaleDelta: Math.max(...pairs.map(p => p.scaleDelta)),
  maximumCalibratedDelta: Math.max(...paints.map(p => p.calibratedDelta)),
  rawResidualsAbove005: paints.filter(p => p.rawDelta > .05).map(p => ({ id: p.id, delta: p.rawDelta })),
};
writeFileSync('reports/color-consistency-audit.json', JSON.stringify({
  date: '2026-10-01', summary, references: namedColors, paints, pairs,
  interpretation: 'OKLab Euclidean distance (0–1 scale), not CIEDE2000. Raw K/S coefficients are virtual; calibrated sRGB is the displayed result.',
}, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (summary.invalidPairs || summary.maximumOrderDelta > 1e-8 || summary.maximumScaleDelta > 1e-8 || summary.maximumCalibratedDelta > .007) process.exitCode = 1;

import { describe, expect, it } from 'vitest';
import baseline from './fixtures/mix-core-reference-20261008.json';
import { presetsById } from '../data/colorPresets';
import { mixPigments } from '../domain/colorMixing/mixPigments';
describe('forward color model after reference synchronization', () => {
  it('keeps all equal-amount material pairs and 240 seeded multicolor reference hex values', () => {
    expect(baseline.cases).toHaveLength(1671);
    for (const fixture of baseline.cases) {
      const result = mixPigments(fixture.selections.map(({ presetId, amount }) => ({
        pigment: presetsById.get(presetId)!.pigment, amount,
      })));
      expect(result.hex, JSON.stringify(fixture.selections)).toBe(fixture.hex);
    }
  });
});

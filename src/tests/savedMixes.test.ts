import { describe, expect, it } from 'vitest';
import { loadSavedMixes, mergeSavedMixes, parseSavedMixes, persistSavedMixes, serializeSavedMixes, type SavedMix } from '../domain/savedMixes';
import { presetsById } from '../data/colorPresets';
import { mixPigments } from '../domain/colorMixing/mixPigments';

const selections: SavedMix['selections'] = [{ presetId: 'red', amount: 3 }, { presetId: 'blue', amount: 2 }];
const result = mixPigments(selections.map(({ presetId, amount }) => ({
  pigment: presetsById.get(presetId)!.pigment, amount,
})));

const item: SavedMix = {
  id: 'sample-1', savedAt: '2026-09-26T12:00:00.000Z',
  selections, result,
};

describe('saved mixes', () => {
  it('round-trips a mix through browser storage and an export file', () => {
    persistSavedMixes([item]);
    expect(loadSavedMixes()).toEqual([item]);
    expect(parseSavedMixes(serializeSavedMixes(loadSavedMixes()))).toEqual([item]);
  });

  it('rejects malformed or unknown palette entries', () => {
    expect(() => parseSavedMixes('{"version":3,"mixes":[]}')).toThrow();
    expect(() => parseSavedMixes(serializeSavedMixes([{ ...item,
      selections: [{ presetId: 'removed-color', amount: 3 }, item.selections[1]!] }])))
      .toThrow();
    expect(() => parseSavedMixes(serializeSavedMixes([{ ...item,
      selections: [{ presetId: 'red', amount: 3 }, { presetId: 'red', amount: 2 }] }])))
      .toThrow();
  });

  it('updates a legacy saved recipe to the current paint model', () => {
    const old = { ...item, result: { ...item.result, hex: '#686568' as const } };
    const restored = parseSavedMixes(JSON.stringify({ version: 1, mixes: [old] }));
    expect(restored[0]?.result.hex).toBe(result.hex);
    expect(restored[0]?.result.nearestName.nameJa).toBe(result.nearestName.nameJa);
    expect(JSON.parse(serializeSavedMixes(restored)).version).toBe(2);
  });

  it('deduplicates imports and refuses to discard snapshots at the storage limit', () => {
    const newer = { ...item, savedAt: '2026-09-27T12:00:00.000Z' };
    const merged = mergeSavedMixes([item], [newer]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.savedAt).toBe(newer.savedAt);
    const many = mergeSavedMixes([], Array.from({ length: 501 }, (_, i) => ({ ...item,
      id: String(i), savedAt: new Date(2026, 8, 1 + i).toISOString(),
    })));
    expect(many).toHaveLength(501);
    expect(() => persistSavedMixes(many)).toThrow(RangeError);
  });
});

import { describe, expect, it } from 'vitest';
import { initialMixState, mixReducer } from '../domain/state/mixReducer';
import type { MixResult } from '../domain/colorMixing/types';

const result: MixResult = {
  hex: '#7B7B7B',
  oklab: [0.6, 0, 0],
  nearestName: { nameJa: 'グレー', nameEn: 'Gray', deltaE: 0 },
};

describe('mix state', () => {
  it('keeps selections unique, limited to five, and starts at three drops', () => {
    let state = initialMixState;
    for (const presetId of ['a', 'b', 'c', 'd', 'e', 'f', 'a']) {
      state = mixReducer(state, { type: 'add', presetId });
    }
    expect(state.selectedColors).toHaveLength(5);
    expect(state.selectedColors.map(({ amount }) => amount)).toEqual([3, 3, 3, 3, 3]);
    expect(state.status).toBe('ready');
  });

  it('bounds drop changes, holds the old result after an edit, then replaces it on remix', () => {
    let state = mixReducer(initialMixState, { type: 'add', presetId: 'a' });
    expect(state.status).toBe('idle');
    state = mixReducer(state, { type: 'add', presetId: 'b' });
    expect(state.status).toBe('ready');
    state = mixReducer(state, { type: 'setAmount', presetId: 'a', amount: 0 });
    expect(state.selectedColors[0]?.amount).toBe(3);
    state = mixReducer(state, { type: 'setAmount', presetId: 'a', amount: 5 });
    state = mixReducer(state, { type: 'setAmount', presetId: 'a', amount: 6 });
    expect(state.selectedColors[0]?.amount).toBe(5);

    state = mixReducer(state, { type: 'start', result });
    expect(state.status).toBe('mixing');
    expect(mixReducer(state, { type: 'remove', presetId: 'a' })).toEqual(state);
    state = mixReducer(state, { type: 'finish' });
    expect(state.status).toBe('mixed');
    state = mixReducer(state, { type: 'setAmount', presetId: 'a', amount: 4 });
    expect(state.status).toBe('dirty');
    expect(state.result).toBe(result);
    const next = { ...result, hex: '#888888' as const };
    state = mixReducer(mixReducer(state, { type: 'start', result: next }), { type: 'finish' });
    expect(state.result?.hex).toBe('#888888');
    expect(state.status).toBe('mixed');
    state = mixReducer(state, { type: 'remove', presetId: 'b' });
    expect(state.status).toBe('idle');
    expect(state.result).toBeNull();
  });
});

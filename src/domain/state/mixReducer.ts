import type { DropAmount, MixResult, SelectedColor } from '../colorMixing/types';

export type MixStatus = 'idle' | 'ready' | 'mixing' | 'mixed' | 'dirty' | 'amount-dirty';

export type MixState = {
  selectedColors: SelectedColor[];
  status: MixStatus;
  result: MixResult | null;
  pendingResult: MixResult | null;
};

export type MixAction =
  | { type: 'add'; presetId: string }
  | { type: 'remove'; presetId: string }
  | { type: 'setAmount'; presetId: string; amount: number }
  | { type: 'clear' }
  | { type: 'restore'; selectedColors: SelectedColor[]; result: MixResult }
  | { type: 'start'; result: MixResult }
  | { type: 'finish' };

export const initialMixState: MixState = {
  selectedColors: [],
  status: 'idle',
  result: null,
  pendingResult: null,
};

function afterEdit(state: MixState, selectedColors: SelectedColor[], amountOnly = false): MixState {
  if (selectedColors.length < 2) {
    return { selectedColors, status: 'idle', result: null, pendingResult: null };
  }
  const keepPreviousColor = amountOnly && !!state.result &&
    (state.status === 'mixed' || state.status === 'amount-dirty');
  const hasMixed = state.status === 'mixed' || state.status === 'dirty' || state.status === 'amount-dirty';
  const status: MixStatus = keepPreviousColor ? 'amount-dirty' : hasMixed ? 'dirty' : 'ready';
  return { ...state, selectedColors, status };
}

export function mixReducer(state: MixState, action: MixAction): MixState {
  if (state.status === 'mixing' && action.type !== 'finish') return state;

  switch (action.type) {
    case 'add':
      if (
        state.selectedColors.length >= 5 ||
        state.selectedColors.some(({ presetId }) => presetId === action.presetId)
      ) return state;
      return afterEdit(state, [...state.selectedColors, { presetId: action.presetId, amount: 3 }]);
    case 'remove': {
      const selectedColors = state.selectedColors.filter(({ presetId }) => presetId !== action.presetId);
      return selectedColors.length === state.selectedColors.length ? state : afterEdit(state, selectedColors);
    }
    case 'setAmount': {
      if (!Number.isInteger(action.amount) || action.amount < 1 || action.amount > 5) return state;
      const selectedColors = state.selectedColors.map((item) =>
        item.presetId === action.presetId
          ? { ...item, amount: action.amount as DropAmount }
          : item,
      );
      const old = state.selectedColors.find(({ presetId }) => presetId === action.presetId);
      return !old || old.amount === action.amount ? state : afterEdit(state, selectedColors, true);
    }
    case 'clear':
      return initialMixState;
    case 'restore':
      if (action.selectedColors.length < 2 || action.selectedColors.length > 5) return state;
      return { selectedColors: action.selectedColors.map((item) => ({ ...item })),
        status: 'mixed', result: action.result, pendingResult: null };
    case 'start':
      if (state.selectedColors.length < 2 || state.selectedColors.length > 5) return state;
      return { ...state, status: 'mixing', pendingResult: action.result };
    case 'finish':
      if (state.status !== 'mixing' || !state.pendingResult) return state;
      return { ...state, status: 'mixed', result: state.pendingResult, pendingResult: null };
  }
}

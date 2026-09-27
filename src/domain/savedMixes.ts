import { presetsById } from '../data/colorPresets';
import { mixPigments } from './colorMixing/mixPigments';
import type { MixResult, SelectedColor } from './colorMixing/types';

export type SavedMix = {
  id: string;
  savedAt: string;
  selections: SelectedColor[];
  result: MixResult;
};
const storageKey = 'iroblend:saved-mixes:v1';
const formatVersion = 2;
export const MAX_SAVED = 500;

function validMix(value: unknown): value is SavedMix {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<SavedMix>;
  const selections = item.selections;
  return typeof item.id === 'string' && item.id.length <= 100 &&
    typeof item.savedAt === 'string' && Number.isFinite(Date.parse(item.savedAt)) &&
    Array.isArray(selections) && selections.length >= 2 && selections.length <= 5 &&
    new Set(selections.map((s) => s?.presetId)).size === selections.length &&
    selections.every((s) => !!s && presetsById.has(s.presetId) && Number.isInteger(s.amount) && s.amount >= 1 && s.amount <= 5) &&
    !!item.result && /^#[0-9a-f]{6}$/i.test(item.result.hex) &&
    Array.isArray(item.result.oklab) && item.result.oklab.length === 3 && item.result.oklab.every(Number.isFinite) &&
    typeof item.result.nearestName?.nameJa === 'string' && item.result.nearestName.nameJa.length <= 50 &&
    typeof item.result.nearestName.nameEn === 'string' && item.result.nearestName.nameEn.length <= 50 &&
    Number.isFinite(item.result.nearestName.deltaE);
}

export function parseSavedMixes(raw: string): SavedMix[] {
  const payload: unknown = JSON.parse(raw);
  if (!payload || typeof payload !== 'object' || ![1, formatVersion].includes((payload as { version?: number }).version ?? -1) ||
      !Array.isArray((payload as { mixes?: unknown }).mixes)) throw new Error('Unsupported saved mixes file.');
  const mixes = (payload as { mixes: unknown[] }).mixes;
  if (mixes.length > MAX_SAVED || !mixes.every(validMix)) throw new Error('Saved mixes contain invalid entries.');
  // Saved recipes survive changes to the virtual paint set. Refresh old result
  // snapshots as well, so the list and a restored recipe show the same color.
  return (mixes as SavedMix[]).map((item) => ({ ...item,
    result: mixPigments(item.selections.map(({ presetId, amount }) => ({
      pigment: presetsById.get(presetId)!.pigment, amount,
    }))),
  }));
}

export function serializeSavedMixes(mixes: readonly SavedMix[]) {
  return JSON.stringify({ version: formatVersion, mixes }, null, 2);
}

export function loadSavedMixes(): SavedMix[] {
  try { return parseSavedMixes(localStorage.getItem(storageKey) ?? '{"version":2,"mixes":[]}'); }
  catch { return []; }
}

export function persistSavedMixes(mixes: readonly SavedMix[]) {
  if (mixes.length > MAX_SAVED) throw new RangeError('Saved mix limit reached.');
  localStorage.setItem(storageKey, serializeSavedMixes(mixes));
}

export function mergeSavedMixes(current: readonly SavedMix[], imported: readonly SavedMix[]) {
  const byId = new Map([...current, ...imported].map((item) => [item.id, item]));
  return [...byId.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

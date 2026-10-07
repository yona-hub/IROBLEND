import { Color } from 'spectral.js';
import type { ResultColorName } from '../../data/resultColorNames';
import { resultColorNames } from '../../data/resultColorNames';
import type { NearestColorName } from './types';

let dictionary: Array<{
  nameJa: string;
  nameEn: string;
  lab: [number, number, number];
  neutralTemperature?: ResultColorName['neutralTemperature'];
}> | null = null;

function getDictionary() {
  if (!dictionary) {
    dictionary = resultColorNames.map(({ nameJa, nameEn, hex, neutralTemperature }) => {
      const lab = new Color(hex).OKLab;
      return {
        nameJa,
        nameEn,
        neutralTemperature,
        lab: [lab[0] ?? 0, lab[1] ?? 0, lab[2] ?? 0],
      };
    });
  }
  return dictionary;
}

export function findNearestColorName(lab: readonly [number, number, number]): NearestColorName {
  let nearest: NearestColorName | null = null;

  for (const entry of getDictionary()) {
    // These authored gray names describe yellowish/bluish casts. Near-neutral
    // colors should not acquire a temperature label from lightness alone.
    const neutralBand = .003;
    if (entry.neutralTemperature === 'warm' && lab[2] <= neutralBand) continue;
    if (entry.neutralTemperature === 'cool' && lab[2] >= -neutralBand) continue;
    const deltaE = Math.hypot(
      lab[0] - entry.lab[0],
      lab[1] - entry.lab[1],
      lab[2] - entry.lab[2],
    );
    if (!nearest || deltaE < nearest.deltaE) {
      nearest = { nameJa: entry.nameJa, nameEn: entry.nameEn, deltaE };
    }
  }

  if (!nearest) throw new Error('The color name dictionary is empty.');
  return nearest;
}

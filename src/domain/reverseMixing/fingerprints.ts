import modelSource from '../colorMixing/mixPigments.ts?raw';
import paletteSource from '../colorMixing/intuitivePalette.ts?raw';
import pigmentSource from '../../data/virtualPigments.ts?raw';
import { colorPresets } from '../../data/colorPresets';
import { targetCatalog } from '../../data/targetCatalog';
import packageInfo from '../../../package.json';

async function fingerprint(value: string) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value.replaceAll('\r\n', '\n')));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function currentRecipeFingerprints() {
  const normalizeSource = (source: string) => source.replaceAll('\r\n', '\n');
  const model = JSON.stringify({ modelSource: normalizeSource(modelSource),
    paletteSource: normalizeSource(paletteSource), pigmentSource: normalizeSource(pigmentSource),
    spectralVersion: packageInfo.dependencies['spectral.js'],
    pigments: colorPresets.map(({ id, pigment }) => ({ id, pigment })) },
    // Math.atan2/cbrt may differ by an ulp between JS engines. Authored source is
    // hashed exactly; canonicalize derived coefficients only, never the mixer.
    (_key, value: unknown) => typeof value === 'number' ? Number(value.toPrecision(12)) : value);
  const catalog = JSON.stringify({ materials: colorPresets.map(({ id, hex }) => ({ id, hex })), targets: targetCatalog });
  const [modelFingerprint, catalogFingerprint] = await Promise.all([fingerprint(model), fingerprint(catalog)]);
  return { modelFingerprint, catalogFingerprint };
}

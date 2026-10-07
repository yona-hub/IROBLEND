import { useEffect, useState } from 'react';
import type { RecipeManifest } from '../domain/reverseMixing/types';
import { validateManifest } from '../domain/reverseMixing/validateManifest';
let validated: Promise<RecipeManifest> | undefined;
export function useRecipeManifest(enabled: boolean) {
  const [manifest, setManifest] = useState<RecipeManifest | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!enabled || manifest || error) return;
    let cancelled = false;
    validated ??= import('../data/generated/reverseRecipes.json').then(module => validateManifest(module.default));
    validated.then(value => { if (!cancelled) setManifest(value); },
      () => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [enabled, manifest, error]);
  return { manifest, error };
}

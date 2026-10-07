import manifest from '../src/data/generated/reverseRecipes.json';
import { validateManifest } from '../src/domain/reverseMixing/validateManifest';
const validated = await validateManifest(manifest);
console.log('Verified ' + Object.keys(validated.targets).length + ' targets / ' +
  Object.values(validated.targets).reduce((sum, recipes) => sum + recipes.length, 0) + ' published recipes.');

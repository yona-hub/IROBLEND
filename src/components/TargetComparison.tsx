import type { TargetColor } from '../data/targetCatalog';
import { proximityLabel } from '../domain/reverseMixing/evaluateRecipe';
export function TargetComparison({ target, hex, distance, label }: {
  target: TargetColor; hex?: string; distance?: number; label: string;
}) {
  return <div className="target-comparison">
    <div className="target-comparison__pair">
      <figure><div role="img" aria-label={'目標の色、' + target.nameJa} style={{ backgroundColor: target.hex }} />
        <figcaption>つくりたい色<span>{target.nameJa}</span></figcaption></figure>
      {hex && <figure><div role="img" aria-label={label} style={{ backgroundColor: hex }} />
        <figcaption>{label}</figcaption></figure>}
    </div>
    {hex && distance !== undefined && <p>{proximityLabel(hex, target, distance)}</p>}
  </div>;
}

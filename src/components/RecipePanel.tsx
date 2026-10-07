import { presetsById } from '../data/colorPresets';
import type { RecipeCandidate } from '../domain/reverseMixing/types';
import type { TargetColor } from '../data/targetCatalog';
export function RecipePanel({ target, candidates, selected, disabled, onSelect }: {
  target: TargetColor | null; candidates: readonly RecipeCandidate[]; selected?: RecipeCandidate;
  disabled: boolean; onSelect: (id: string) => void;
}) {
  return <section className="recipe-panel" aria-label="つくり方の候補">
    <h2>つくり方</h2>
    {!target ? <p>つくりたい色をえらんでね</p> : candidates.length === 0 ?
      <p role="status">この条件では、十分に近いまぜ方が見つかりませんでした。</p> :
      <div className="recipe-options" role="group" aria-label="配合をえらぶ">
        {candidates.map((candidate, i) => {
          const title = i === 0 ? 'かんたん・' + candidate.ingredientCount + '色'
            : candidate.targetDeltaE < candidates[0]!.targetDeltaE - .001 ? 'さらに近い・' + candidate.ingredientCount + '色'
              : '別のまぜ方・' + candidate.ingredientCount + '色';
          return <div key={candidate.id}>
            <button className="recipe-option" type="button" disabled={disabled} onClick={() => onSelect(candidate.id)}
              aria-pressed={candidate.id === selected?.id}>
              <span className="swatch" style={{ backgroundColor: candidate.predictedHex }} aria-hidden="true" />
              <strong>{title}</strong>{candidate.id === selected?.id && <span aria-hidden="true">✓</span>}
            </button>
            {candidate.id === selected?.id && <ul className="recipe-ingredients">
              {candidate.selections.map(item => {
                const preset = presetsById.get(item.presetId)!;
                return <li key={item.presetId}><span className="swatch" style={{ backgroundColor: preset.hex }} aria-hidden="true" />
                  <span>{preset.nameJa}</span><strong>スポイト{item.amount}本分</strong></li>;
              })}
            </ul>}
          </div>;
        })}
      </div>}
  </section>;
}

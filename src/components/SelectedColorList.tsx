import type { ColorPreset, DropAmount, SelectedColor } from '../domain/colorMixing/types';

export type ResolvedSelection = SelectedColor & { preset: ColorPreset };

type Props = {
  colors: readonly ResolvedSelection[];
  pulseId: string | null;
  disabled: boolean;
  onAmount: (presetId: string, amount: DropAmount) => void;
  onRemove: (presetId: string) => void;
  onChoose: () => void;
};

export function SelectedColorList({ colors, pulseId, disabled, onAmount, onRemove, onChoose }: Props) {
  return (
    <section className="selection" aria-labelledby="selection-title">
      <div className="selection__heading">
        <div>
          <span className="eyebrow">YOUR COLORS / 02</span>
          <h2 id="selection-title">えらんだ色</h2>
        </div>
        <span className="selection__count" aria-label={`${colors.length}色えらんでいます`}>{colors.length} / 5</span>
      </div>

      {colors.length === 0 ? (
        <div className="selection__empty">
          <p>まだ色がありません</p>
          <button className="text-action mobile-only" type="button" onClick={onChoose}>色をえらぶ <span aria-hidden="true">→</span></button>
          <span className="desktop-only">左のパレットから色をえらんでね</span>
        </div>
      ) : (
        <div className="selection__list">
          {colors.map(({ preset, amount }) => (
            <div className={`selected-row${pulseId === preset.id ? ' selected-row--pulse' : ''}`} key={preset.id}>
              <span className="swatch selected-row__swatch" style={{ backgroundColor: preset.hex }} aria-hidden="true" />
              <div className="selected-row__name">
                <strong>{preset.nameJa}</strong>
                <span>{preset.nameEn}</span>
              </div>
              <div className="drop-control" aria-label={`${preset.nameJa}の滴数`}>
                <button type="button" disabled={disabled || amount === 1} onClick={() => onAmount(preset.id, (amount - 1) as DropAmount)} aria-label={`${preset.nameJa}を1滴減らす`}>−</button>
                <span aria-live="off">{amount}<small>滴</small></span>
                <button type="button" disabled={disabled || amount === 5} onClick={() => onAmount(preset.id, (amount + 1) as DropAmount)} aria-label={`${preset.nameJa}を1滴増やす`}>＋</button>
              </div>
              <button className="remove-button" type="button" disabled={disabled} onClick={() => onRemove(preset.id)} aria-label={`${preset.nameJa}を削除`}>×</button>
            </div>
          ))}
        </div>
      )}
      <p className="drop-note">※ 1滴は混ぜる割合の目安です。実際の絵の具の1滴の量とは異なります。</p>
    </section>
  );
}

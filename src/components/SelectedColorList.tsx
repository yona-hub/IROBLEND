import type { ColorPreset, DropAmount, SelectedColor } from '../domain/colorMixing/types';
import { EyedropperIcon } from './EyedropperIcon';

export type ResolvedSelection = SelectedColor & { preset: ColorPreset };

type Props = {
  colors: readonly ResolvedSelection[];
  pulseId: string | null;
  disabled: boolean;
  onAmount: (presetId: string, amount: DropAmount) => void;
  onRemove: (presetId: string) => void;
  onChoose: (trigger: HTMLButtonElement) => void;
};

export function SelectedColorList({ colors, pulseId, disabled, onAmount, onRemove, onChoose }: Props) {
  return (
    <section className="selection" aria-label="えらんだ色">
      {colors.length === 0 ? (
        <div className="selection__empty">
          <p>まだ色がありません</p>
          <button className="text-action mobile-only tablet-only" type="button" onClick={(event) => onChoose(event.currentTarget)}>色をえらぶ <span aria-hidden="true">→</span></button>
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
              <div className="amount-picker">
                <div className="eyedropper-rating" role="group" aria-label={`${preset.nameJa}の色の量を選ぶ`}>
                  {([1, 2, 3, 4, 5] as const).map((value) => (
                    <button className={`eyedropper-button${value <= amount ? ' eyedropper-button--filled' : ''}`}
                      type="button" key={value} disabled={disabled} aria-pressed={value === amount}
                      aria-label={`${preset.nameJa}の量をスポイト${value}本分にする`}
                      onClick={() => onAmount(preset.id, value)}>
                      <EyedropperIcon color={preset.hex} filled={value <= amount} />
                    </button>
                  ))}
                </div>
              </div>
              <button className="remove-button" type="button" disabled={disabled} onClick={() => onRemove(preset.id)} aria-label={`${preset.nameJa}を削除`}>×</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

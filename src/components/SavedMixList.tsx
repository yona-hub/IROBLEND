import { useRef } from 'react';
import { presetsById } from '../data/colorPresets';
import type { SavedMix } from '../domain/savedMixes';

type Props = {
  mixes: readonly SavedMix[];
  onRestore: (mix: SavedMix) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
};

export function SavedMixList({ mixes, onRestore, onDelete, onExport, onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <section className="saved-mixes" aria-labelledby="saved-mixes-title">
      <div className="saved-mixes__head">
        <h2 id="saved-mixes-title">保存した色 <span>{mixes.length}</span></h2>
        <div className="saved-mixes__tools">
          {mixes.length > 0 && <button type="button" onClick={onExport}>書き出す</button>}
          <button type="button" onClick={() => inputRef.current?.click()}>読み込む</button>
          <input ref={inputRef} type="file" accept="application/json,.json" className="visually-hidden"
            aria-label="保存した色のJSONを読み込む" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImport(file);
              event.target.value = '';
            }} />
        </div>
      </div>
      {mixes.length === 0 ? <p className="saved-mixes__empty">気に入った混色を保存できます。</p> :
        <div className="saved-mixes__list">
          {mixes.map((mix) => (
            <div className="saved-mix" key={mix.id}>
              <span className="saved-mix__swatch" style={{ background: mix.result.hex }} aria-hidden="true" />
              <div className="saved-mix__info">
                <strong>{mix.result.nearestName.nameJa}に近い色</strong>
                <span>{mix.selections.map(({ presetId, amount }) =>
                  `${presetsById.get(presetId)?.nameJa ?? presetId} ${amount}本`).join(' ＋ ')}</span>
                <time dateTime={mix.savedAt}>{new Date(mix.savedAt).toLocaleDateString('ja-JP')}</time>
              </div>
              <button type="button" onClick={() => onRestore(mix)} aria-label={`${mix.result.nearestName.nameJa}の配合を呼び出す`}>呼び出す</button>
              <button type="button" onClick={() => onDelete(mix.id)} aria-label={`${mix.result.nearestName.nameJa}の保存を削除`}>×</button>
            </div>
          ))}
        </div>}
    </section>
  );
}

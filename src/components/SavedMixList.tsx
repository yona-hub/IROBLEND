import { useEffect, useRef, useState } from 'react';
import type { SavedMix } from '../domain/savedMixes';

const PAGE_SIZE = 10;

type Props = {
  mixes: readonly SavedMix[];
  onRestore: (mix: SavedMix) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
};

export function SavedMixList({ mixes, onRestore, onDelete, onExport, onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [requestedPage, setRequestedPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(mixes.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const pageMixes = mixes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => setRequestedPage((current) => Math.min(current, pageCount)), [pageCount]);
  return (
    <section className={`saved-mixes${mixes.length === 0 ? ' saved-mixes--empty' : ''}`} aria-label="保存した色">
      <div className="saved-mixes__head">
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
          {pageMixes.map((mix) => (
            <div className="saved-mix" key={mix.id}>
              <span className="saved-mix__swatch" style={{ background: mix.result.hex }} aria-hidden="true" />
              <div className="saved-mix__info">
                <strong>{mix.result.nearestName.nameJa}に近い色</strong>
                <time dateTime={mix.savedAt}>{new Date(mix.savedAt).toLocaleDateString('ja-JP')}</time>
              </div>
              <button type="button" onClick={() => onRestore(mix)} aria-label={`${mix.result.nearestName.nameJa}の配合を呼び出す`}>呼び出す</button>
              <button type="button" onClick={() => onDelete(mix.id)} aria-label={`${mix.result.nearestName.nameJa}の保存を削除`}>×</button>
            </div>
          ))}
        </div>}
      {pageCount > 1 && (
        <nav className="saved-mixes__pages" aria-label="保存した色のページ">
          <button type="button" onClick={() => setRequestedPage(page - 1)} disabled={page === 1}>前へ</button>
          <span aria-live="polite">{page} / {pageCount}</span>
          <button type="button" onClick={() => setRequestedPage(page + 1)} disabled={page === pageCount}>次へ</button>
        </nav>
      )}
    </section>
  );
}

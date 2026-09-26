import { categories, colorPresets } from '../data/colorPresets';
import type { ColorCategory } from '../domain/colorMixing/types';

type Props = {
  activeCategory: ColorCategory | null;
  selectedIds: ReadonlySet<string>;
  onCategory: (category: ColorCategory) => void;
  onBack: () => void;
  onAdd: (presetId: string) => void;
  disabled: boolean;
};

export function ColorNavigation({ activeCategory, selectedIds, onCategory, onBack, onAdd, disabled }: Props) {
  const category = categories.find(({ id }) => id === activeCategory);
  const presets = colorPresets.filter(({ category: id }) => id === activeCategory);

  return (
    <div className="color-nav">
      <div className="nav-heading">
        <span className="eyebrow">PALETTE / 01</span>
        <h2>色をえらぶ</h2>
        <p>まずは、好きな色を見つけよう。</p>
      </div>
      <div className="nav-window">
        <div className={`nav-track${activeCategory ? ' nav-track--detail' : ''}`}>
          <div className="nav-page" aria-hidden={Boolean(activeCategory)} inert={Boolean(activeCategory)}>
            <p className="nav-page-label">基本の色</p>
            <div className="nav-list">
              {categories.map((item) => (
                <button
                  className="nav-row"
                  type="button"
                  key={item.id}
                  onClick={() => onCategory(item.id)}
                  aria-label={`${item.nameJa}の色を見る`}
                >
                  <span className="swatch swatch--category" style={{ backgroundColor: item.hex }} aria-hidden="true" />
                  <span className="nav-row__name">{item.nameJa}</span>
                  <span className="nav-row__en">{item.nameEn}</span>
                  <span className="nav-row__arrow" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </div>
          <div className="nav-page" aria-hidden={!activeCategory} inert={!activeCategory}>
            <button className="nav-back" type="button" onClick={onBack}>
              <span aria-hidden="true">←</span> 基本の色へ
            </button>
            <div className="nav-detail-heading">
              <span className="swatch swatch--category" style={{ backgroundColor: category?.hex }} aria-hidden="true" />
              <div>
                <h3>{category?.nameJa}</h3>
                <span>{category?.nameEn}</span>
              </div>
            </div>
            <p className="nav-page-label">好きな色をタップして追加</p>
            <div className="nav-list">
              {presets.map((preset) => {
                const selected = selectedIds.has(preset.id);
                return (
                  <button
                    className={`nav-row nav-row--preset${selected ? ' nav-row--selected' : ''}`}
                    type="button"
                    key={preset.id}
                    onClick={() => onAdd(preset.id)}
                    disabled={disabled}
                    aria-label={`${preset.nameJa}${selected ? '、選択済み' : 'を追加'}`}
                  >
                    <span className="swatch" style={{ backgroundColor: preset.hex }} aria-hidden="true" />
                    <span className="nav-row__names">
                      <span className="nav-row__name">{preset.nameJa}</span>
                      <span className="nav-row__sub">{preset.nameEn}</span>
                    </span>
                    <span className="nav-row__add" aria-hidden="true">{selected ? '✓' : '+'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

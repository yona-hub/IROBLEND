import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { categories } from '../data/colorPresets';
import { targetCatalog, targetGroups, type TargetGroupId } from '../data/targetCatalog';

export const recommendedTargetIds = [
  'brown', 'beige', 'gray', 'chocolate', 'sand', 'teal', 'turquoise', 'olive',
  'wine', 'maroon', 'peach', 'dusty-pink', 'lavender-gray', 'pistachio',
  'denim', 'amber', 'terracotta', 'mustard', 'mauve', 'mint-green', 'periwinkle', 'blue-green',
] as const;
export type TargetPickerGroup = TargetGroupId | 'recommended' | 'all';
const groupOptions: readonly { id: TargetPickerGroup; name: string; hex: string }[] = [
  { id: 'recommended', name: 'おすすめ', hex: '#9875BA' },
  { id: 'all', name: 'すべての色', hex: '#7F9CB5' },
  ...targetGroups.map(group => ({ id: group.id, name: group.name,
    hex: categories.find(category => category.id === group.id)?.hex ?? (group.id === 'brown' ? '#A67959' : '#8C949B') })),
];
type Props = { group: TargetPickerGroup; query: string; selectedId: string | null; disabled: boolean;
  scrollPosition: number; onScroll: (position: number) => void;
  onGroup: (group: TargetPickerGroup) => void; onQuery: (query: string) => void; onSelect: (id: string) => void };
function normalize(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[\sー\-・]/g, '');
}
const aliases: Record<string, string> = { brown: '茶色 ちゃいろ', beige: '薄茶 うすちゃ', gray: '灰色 はいいろ',
  red: 'あか 赤色', blue: 'あお 青色', green: 'みどり 緑色', yellow: 'きいろ 黄色', white: 'しろ 白色', black: 'くろ 黒色',
  purple: 'むらさき 紫色', peach: '桃色 ももいろ' };

export function TargetColorPicker(props: Props) {
  const inputId = useId(), scrollRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(0, groupOptions.findIndex(option => option.id === props.group));
  const selectedGroup = groupOptions[selectedIndex]!;
  useEffect(() => {
    if (!menuOpen) return;
    optionRefs.current[activeIndex]?.focus();
  }, [menuOpen, activeIndex]);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [menuOpen]);
  useEffect(() => { if (props.disabled) setMenuOpen(false); }, [props.disabled]);
  const closeMenu = (restoreFocus = false) => {
    setMenuOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };
  const chooseGroup = (index: number) => {
    props.onGroup(groupOptions[index]!.id);
    closeMenu(true);
  };
  const onMenuKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(true); return; }
    if (event.key === 'Tab') { closeMenu(); return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseGroup(activeIndex); return; }
    const next = event.key === 'ArrowDown' ? (activeIndex + 1) % groupOptions.length
      : event.key === 'ArrowUp' ? (activeIndex - 1 + groupOptions.length) % groupOptions.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? groupOptions.length - 1 : null;
    if (next !== null) { event.preventDefault(); setActiveIndex(next); }
  };
  useEffect(() => {
    const restorePosition = () => {
      if (scrollRef.current && scrollRef.current.clientHeight > 0) scrollRef.current.scrollTop = props.scrollPosition;
    };
    restorePosition();
    window.addEventListener('resize', restorePosition);
    return () => window.removeEventListener('resize', restorePosition);
  }, [props.scrollPosition]);
  const query = normalize(props.query);
  const targets = targetCatalog.filter(target => {
    const matches = normalize(target.nameJa + target.nameEn + (aliases[target.id] ?? '')).includes(query);
    return matches && (query || props.group === 'all' || props.group === target.targetGroupId ||
      props.group === 'recommended' && recommendedTargetIds.some(id => id === target.id));
  });
  return <div className="color-nav target-picker">
    <div className="nav-heading"><h2>つくりたい色</h2></div>
    <div className="target-picker__filters">
      <label htmlFor={inputId} className="visually-hidden">色の名前でさがす</label>
      <div className="target-picker__search">
        <svg className="target-picker__search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.7" cy="10.7" r="6.2" stroke="currentColor" strokeWidth="1.8"/><path d="m15.5 15.5 4.2 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
        <input id={inputId} value={props.query} type="search" placeholder="色の名前でさがす"
          disabled={props.disabled} onChange={event => props.onQuery(event.target.value)} />
        {props.query && <button className="target-picker__clear" type="button" disabled={props.disabled}
          aria-label="検索語を消す" onClick={() => props.onQuery('')}>×</button>}
      </div>
      <div className="target-picker__group" ref={menuRef}>
        <button ref={triggerRef} className="target-picker__group-trigger" type="button" disabled={props.disabled}
          aria-label={`目標の色グループ: ${selectedGroup.name}`} aria-haspopup="listbox"
          aria-expanded={menuOpen} aria-controls={inputId + '-groups'}
          onClick={() => { setActiveIndex(selectedIndex); setMenuOpen(!menuOpen); }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault(); setActiveIndex(selectedIndex); setMenuOpen(true);
            } else if (event.key === 'Escape' && menuOpen) { event.preventDefault(); closeMenu(true); }
          }}>
          <span className="target-picker__group-swatch" style={{ backgroundColor: selectedGroup.hex }} aria-hidden="true" />
          <span>{selectedGroup.name}</span>
          <svg className="target-picker__chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        {menuOpen && <div className="target-picker__group-list" id={inputId + '-groups'} role="listbox" aria-label="目標の色グループ">
          {groupOptions.map((option, index) => <button key={option.id} ref={node => { optionRefs.current[index] = node; }}
            className="target-picker__group-option" role="option" type="button" tabIndex={index === activeIndex ? 0 : -1}
            aria-selected={option.id === props.group} onClick={() => chooseGroup(index)} onKeyDown={onMenuKeyDown}>
            <span className="target-picker__group-swatch" style={{ backgroundColor: option.hex }} aria-hidden="true" />
            <span>{option.name}</span>{option.id === props.group && <span className="target-picker__check" aria-hidden="true">✓</span>}
          </button>)}
        </div>}
      </div>
    </div>
    <div className="target-picker__list" ref={scrollRef} onScroll={event => props.onScroll(event.currentTarget.scrollTop)}>
      {targets.map(target => <button className="nav-row" key={target.id} type="button"
        disabled={props.disabled} aria-label={target.nameJa + 'を目標にする'} aria-pressed={target.id === props.selectedId}
        onClick={() => props.onSelect(target.id)}>
        <span className="swatch" style={{ backgroundColor: target.hex }} aria-hidden="true" />
        <span className="nav-row__names"><span className="nav-row__name">{target.nameJa}</span>
          <span className="nav-row__sub">{target.nameEn}</span></span>
        {target.id === props.selectedId && <span aria-hidden="true">✓</span>}
      </button>)}
      {targets.length === 0 && <p className="target-picker__empty">この名前の色は見つかりませんでした</p>}
    </div>
  </div>;
}

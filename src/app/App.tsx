import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AboutColorModal } from '../components/AboutColorModal';
import { ColorNavigation } from '../components/ColorNavigation';
import { MixingCanvas } from '../components/MixingCanvas';
import { SelectedColorList } from '../components/SelectedColorList';
import type { ResolvedSelection } from '../components/SelectedColorList';
import { presetsById } from '../data/colorPresets';
import { mixPigments } from '../domain/colorMixing/mixPigments';
import type { ColorCategory, DropAmount } from '../domain/colorMixing/types';
import { initialMixState, mixReducer } from '../domain/state/mixReducer';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { useReducedMotion } from '../hooks/useReducedMotion';

function instruction(status: string, count: number) {
  if (status === 'mixing') return '色がまざっているよ。';
  if (status === 'dirty') return '色や滴の数を変えたね。もう一度まぜてみよう。';
  if (status === 'mixed') return '滴の数を変えて、くらべてみよう。';
  if (count === 0) return '好きな色を2〜5色えらんでね。';
  if (count === 1) return 'あと1色えらんでね。';
  return 'どんな色になるか、予想してみよう。';
}

export default function App() {
  const [state, dispatch] = useReducer(mixReducer, initialMixState);
  const [activeCategory, setActiveCategory] = useState<ColorCategory | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [pulseId, setPulseId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const drawerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const aboutButtonRef = useRef<HTMLButtonElement>(null);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const closeAbout = useCallback(() => setAboutOpen(false), []);
  useDialogFocus(drawerOpen, drawerRef, menuButtonRef, closeDrawer);
  useDialogFocus(aboutOpen, aboutRef, aboutButtonRef, closeAbout);

  useEffect(() => {
    if (state.status !== 'mixing') return;
    const timer = window.setTimeout(() => dispatch({ type: 'finish' }), reducedMotion ? 130 : 700);
    return () => window.clearTimeout(timer);
  }, [state.status, reducedMotion]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!pulseId) return;
    const timer = window.setTimeout(() => setPulseId(null), 650);
    return () => window.clearTimeout(timer);
  }, [pulseId]);

  useEffect(() => {
    const query = window.matchMedia?.('(orientation: landscape) and (min-width: 900px)');
    if (!query) return;
    const onChange = () => { if (query.matches) closeDrawer(); };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [closeDrawer]);

  const colors = useMemo(
    () => state.selectedColors.flatMap((item): ResolvedSelection[] => {
      const preset = presetsById.get(item.presetId);
      return preset ? [{ ...item, preset }] : [];
    }),
    [state.selectedColors],
  );
  const selectedIds = useMemo(() => new Set(colors.map(({ presetId }) => presetId)), [colors]);

  const onAdd = (presetId: string) => {
    if (state.status === 'mixing') return;
    if (selectedIds.has(presetId)) {
      setPulseId(null);
      window.setTimeout(() => setPulseId(presetId), 0);
      return;
    }
    if (colors.length >= 5) {
      setToast('まぜられるのは5色までだよ');
      return;
    }
    dispatch({ type: 'add', presetId });
  };

  const onMix = () => {
    if (state.status === 'mixing' || colors.length < 2) return;
    try {
      const result = mixPigments(colors.map(({ preset, amount }) => ({ hex: preset.hex, amount })));
      dispatch({ type: 'start', result });
    } catch {
      setToast('色をまぜられませんでした。もう一度ためしてね');
    }
  };

  const buttonLabel = state.status === 'mixing'
    ? 'まぜています…'
    : state.status === 'dirty'
      ? 'もういちど まぜる！'
      : state.status === 'mixed'
        ? 'もういちど まぜる'
        : 'まぜる！';
  const showResult = (state.status === 'mixed' || state.status === 'dirty') && state.result;
  const navProps = {
    activeCategory,
    selectedIds,
    onCategory: setActiveCategory,
    onBack: () => setActiveCategory(null),
    onAdd,
    disabled: state.status === 'mixing',
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <button
            className="menu-button mobile-only"
            type="button"
            ref={menuButtonRef}
            onClick={() => setDrawerOpen(true)}
            aria-label="色をえらぶメニューを開く"
            aria-expanded={drawerOpen}
            aria-controls="color-drawer"
          >
            <span /><span /><span />
          </button>
          <div className="brand" aria-label="IROBLEND いろを、まぜてみよう。">
            <span className="brand__mark" aria-hidden="true"><i /><i /></span>
            <span className="brand__word">IROBLEND</span>
          </div>
          <span className="app-header__tagline desktop-only">いろを、まぜてみよう。</span>
          <button className="about-link" type="button" ref={aboutButtonRef} onClick={() => setAboutOpen(true)}>
            <span className="about-link__icon" aria-hidden="true">i</span>
            <span className="about-link__full">このアプリの色について</span>
            <span className="about-link__short">色について</span>
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar" aria-label="色のパレット">
          <ColorNavigation {...navProps} />
          <div className="sidebar__foot">9つの色のグループ · 54色</div>
        </aside>

        <main className="main-content">
          <div className="main-content__inner">
            <div className="hero-copy">
              <span className="eyebrow">A LITTLE COLOR EXPERIMENT</span>
              <h1>いろを、<br className="hero-copy__break" />まぜてみよう。</h1>
              <p aria-live="polite">{instruction(state.status, colors.length)}</p>
            </div>

            <div className="workspace">
              <div className="stage-column">
                <MixingCanvas colors={colors} result={state.result} status={state.status} />
                <div className="stage-actions">
                  {colors.length === 0 && (
                    <button className="choose-button mobile-only" type="button" onClick={() => setDrawerOpen(true)}>
                      色をえらぶ <span aria-hidden="true">→</span>
                    </button>
                  )}
                  <button
                    className={`mix-button${state.status === 'dirty' ? ' mix-button--dirty' : ''}`}
                    type="button"
                    onClick={onMix}
                    disabled={colors.length < 2 || state.status === 'mixing'}
                  >
                    {buttonLabel}<span className="mix-button__arrow" aria-hidden="true">↗</span>
                  </button>
                  <span className="stage-actions__hint">2〜5色でまぜられるよ</span>
                </div>
                <div className="result-copy" aria-live="polite">
                  {showResult && (
                    <div className="result-copy__inner" key={state.result?.hex}>
                      <span className="eyebrow">できた色</span>
                      <strong>{state.result?.nearestName.nameJa}に近い色</strong>
                      <span>{state.result?.nearestName.nameEn}</span>
                    </div>
                  )}
                </div>
              </div>

              <SelectedColorList
                colors={colors}
                pulseId={pulseId}
                disabled={state.status === 'mixing'}
                onAmount={(presetId: string, amount: DropAmount) => dispatch({ type: 'setAmount', presetId, amount })}
                onRemove={(presetId: string) => dispatch({ type: 'remove', presetId })}
                onChoose={() => setDrawerOpen(true)}
              />
            </div>
          </div>
        </main>
      </div>

      <div className={`drawer-shell${drawerOpen ? ' drawer-shell--open' : ''}`} aria-hidden={!drawerOpen}>
        <button className="drawer-scrim" type="button" onClick={closeDrawer} tabIndex={-1} aria-label="色のメニューを閉じる" />
        <aside id="color-drawer" className="drawer" role="dialog" aria-modal="true" aria-label="色をえらぶ" ref={drawerRef} inert={!drawerOpen}>
          <div className="drawer__top">
            <span className="drawer__brand">IROBLEND</span>
            <button className="icon-button" type="button" onClick={closeDrawer} aria-label="色のメニューを閉じる">×</button>
          </div>
          <ColorNavigation {...navProps} />
          <button className="drawer__done" type="button" onClick={closeDrawer}>えらんだ色を見る <span aria-hidden="true">→</span></button>
        </aside>
      </div>

      <AboutColorModal open={aboutOpen} dialogRef={aboutRef} onClose={closeAbout} />
      <div className="toast" aria-live="polite" aria-atomic="true">{toast && <span>{toast}</span>}</div>
    </div>
  );
}

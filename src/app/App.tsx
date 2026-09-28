import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent } from 'react';
import { AboutColorModal } from '../components/AboutColorModal';
import { ColorNavigation } from '../components/ColorNavigation';
import { MixingCanvas } from '../components/MixingCanvas';
import { SelectedColorList } from '../components/SelectedColorList';
import { SavedMixList } from '../components/SavedMixList';
import { placeMark, relayoutMarks, type PaintMark } from '../components/paintMarks';
import type { SelectionImpact } from '../components/MixingCanvas';
import type { ResolvedSelection } from '../components/SelectedColorList';
import { presetsById } from '../data/colorPresets';
import { mixPigments } from '../domain/colorMixing/mixPigments';
import type { ColorCategory, DropAmount } from '../domain/colorMixing/types';
import { initialMixState, mixReducer } from '../domain/state/mixReducer';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { MIX_DURATION_MS } from '../components/mixAnimation';
import { loadSavedMixes, mergeSavedMixes, parseSavedMixes, persistSavedMixes, serializeSavedMixes, MAX_SAVED, type SavedMix } from '../domain/savedMixes';

function canvasAspect() {
  if (window.matchMedia('(max-width: 599px) and (max-height: 700px)').matches) return 1.2;
  return window.matchMedia('(orientation: landscape) and (min-width: 900px)').matches ? 1.55
    : window.innerWidth >= 600 ? 1.45 : .8;
}

export default function App() {
  const [state, dispatch] = useReducer(mixReducer, initialMixState);
  const [activeCategory, setActiveCategory] = useState<ColorCategory | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [marks, setMarks] = useState<PaintMark[]>([]);
  const [incoming, setIncoming] = useState<SelectionImpact | null>(null);
  const [savedMixes, setSavedMixes] = useState<SavedMix[]>(loadSavedMixes);
  const [activePanel, setActivePanel] = useState<'selected' | 'saved'>('selected');
  const marksRef = useRef<PaintMark[]>([]);
  const impactSerial = useRef(0);
  const reducedMotion = useReducedMotion();
  const drawerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const aboutButtonRef = useRef<HTMLButtonElement>(null);
  const selectedTabRef = useRef<HTMLButtonElement>(null);
  const savedTabRef = useRef<HTMLButtonElement>(null);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const closeAbout = useCallback(() => setAboutOpen(false), []);
  useDialogFocus(drawerOpen, drawerRef, menuButtonRef, closeDrawer);
  useDialogFocus(aboutOpen, aboutRef, aboutButtonRef, closeAbout);

  useEffect(() => {
    if (state.status !== 'mixing') return;
    const timer = window.setTimeout(() => dispatch({ type: 'finish' }), reducedMotion ? 130 : MIX_DURATION_MS);
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

  useEffect(() => {
    let aspect = canvasAspect();
    const onResize = () => {
      const nextAspect = canvasAspect();
      if (aspect === nextAspect) return;
      aspect = nextAspect;
      if (marksRef.current.length === 0) return;
      const next = relayoutMarks(marksRef.current, aspect);
      marksRef.current = next;
      setMarks(next);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
    const next = [...marksRef.current, placeMark(presetId, marksRef.current, canvasAspect())];
    marksRef.current = next;
    setMarks(next);
    setIncoming({ id: presetId, key: ++impactSerial.current, delayMs: drawerOpen ? 200 : 0 });
    dispatch({ type: 'add', presetId });
    if (drawerOpen) closeDrawer();
  };

  const onRemove = (presetId: string) => {
    const next = marksRef.current.filter((mark) => mark.presetId !== presetId);
    marksRef.current = next;
    setMarks(next);
    setIncoming(null);
    dispatch({ type: 'remove', presetId });
  };

  const onClear = () => {
    marksRef.current = [];
    setMarks([]);
    setIncoming(null);
    dispatch({ type: 'clear' });
  };

  const onSave = () => {
    if (state.status !== 'mixed' || !state.result) return;
    if (savedMixes.length >= MAX_SAVED) {
      setToast('保存は500件までです。書き出すか不要な色を消してください');
      return;
    }
    const item: SavedMix = {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, savedAt: new Date().toISOString(),
      selections: state.selectedColors.map((entry) => ({ ...entry })), result: state.result,
    };
    const next = mergeSavedMixes([item], savedMixes);
    try { persistSavedMixes(next); setSavedMixes(next); setToast('混ぜた色を保存しました'); }
    catch { setToast('保存できませんでした。空き容量を確認してください'); }
  };

  const onDeleteSaved = (id: string) => {
    const next = savedMixes.filter((item) => item.id !== id);
    try { persistSavedMixes(next); setSavedMixes(next); }
    catch { setToast('保存データを更新できませんでした'); }
  };

  const onRestore = (mix: SavedMix) => {
    if (state.status === 'mixing') return;
    const aspect = canvasAspect();
    let next: PaintMark[] = [];
    for (const item of mix.selections) next = [...next, placeMark(item.presetId, next, aspect)];
    marksRef.current = next;
    setMarks(next);
    setIncoming(null);
    dispatch({ type: 'restore', selectedColors: mix.selections, result: mix.result });
    setActivePanel('selected');
    selectedTabRef.current?.focus();
  };

  const onPanelKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'selected' : event.key === 'End' ? 'saved'
      : activePanel === 'selected' ? 'saved' : 'selected';
    setActivePanel(next);
    (next === 'selected' ? selectedTabRef : savedTabRef).current?.focus();
  };

  const onExport = () => {
    const blob = new Blob([serializeSavedMixes(savedMixes)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `iroblend-colors-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const onImport = async (file: File) => {
    if (file.size > 1_000_000) { setToast('読み込めるファイルは1MB以下です'); return; }
    try {
      const imported = parseSavedMixes(await file.text());
      const next = mergeSavedMixes(savedMixes, imported);
      if (next.length > MAX_SAVED) throw new RangeError('Saved mix limit reached.');
      persistSavedMixes(next);
      setSavedMixes(next);
      setToast(`${imported.length}件の色を読み込みました`);
    } catch { setToast('保存ファイルを読み込めませんでした'); }
  };

  const onMix = () => {
    if (state.status === 'mixing' || colors.length < 2) return;
    try {
      const result = mixPigments(colors.map(({ preset, amount }) => ({ pigment: preset.pigment, amount })));
      dispatch({ type: 'start', result });
    } catch {
      setToast('色をまぜられませんでした。もう一度ためしてね');
    }
  };

  const buttonLabel = state.status === 'mixing'
    ? 'まぜています…'
    : state.status === 'dirty' || state.status === 'amount-dirty'
      ? 'もういちど まぜる！'
      : state.status === 'mixed'
        ? 'もういちど まぜる'
        : 'まぜる！';
  const showResult = (state.status === 'mixed' || state.status === 'amount-dirty') && state.result;
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
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar" aria-label="色のパレット">
          <ColorNavigation {...navProps} />
        </aside>

        <main className="main-content">
          <div className="main-content__inner">
            <div className="workspace">
              <div className="stage-column">
                <div className="hero-copy">
                  <div className="hero-copy__title">
                    <img className="hero-copy__mark" src="./favicon.svg?v=2" alt="" />
                    <h1>Let's いろ BLEND!</h1>
                  </div>
                  <button className="about-link" type="button" ref={aboutButtonRef} onClick={() => setAboutOpen(true)}>
                    <span className="about-link__icon" aria-hidden="true">!</span>
                    <span className="about-link__full">このアプリの色について</span>
                    <span className="about-link__short">色について</span>
                  </button>
                  <p className="mix-guidance">2〜5色を選んで、色をまぜよう</p>
                </div>
                <MixingCanvas colors={colors} marks={marks} incoming={incoming} result={state.result}
                  pendingResult={state.pendingResult} status={state.status} reducedMotion={!!reducedMotion} />
                <div className="stage-actions">
                  {colors.length < 5 && (
                    <button className="choose-button mobile-only" type="button" onClick={() => setDrawerOpen(true)}>
                      {colors.length === 0 ? '色をえらぶ' : '色をたす'}
                    </button>
                  )}
                  <div className="stage-actions__primary">
                    <button
                      className={`mix-button${state.status === 'dirty' || state.status === 'amount-dirty' ? ' mix-button--dirty' : ''}`}
                      type="button"
                      onClick={onMix}
                      disabled={colors.length < 2 || state.status === 'mixing'}
                    >
                      {buttonLabel}
                    </button>
                    <button className="reset-button" type="button" onClick={onClear}
                      disabled={colors.length === 0 || state.status === 'mixing'}
                      aria-label="さいしょから（えらんだ色をすべて消す）">
                      さいしょから
                    </button>
                  </div>
                </div>
                <div className="result-copy" aria-live="polite">
                  {showResult && (
                    <div className="result-copy__inner" key={state.result?.hex}>
                      {state.status === 'amount-dirty' && <span className="result-copy__stale">前にまぜた色</span>}
                      <strong>{state.result?.nearestName.nameJa}に近い色</strong>
                      {state.status === 'mixed' && <button className="save-button" type="button" onClick={onSave}>この色を保存する</button>}
                    </div>
                  )}
                </div>
              </div>

              <aside className="mix-side-panel" aria-label="色の管理">
                <div className="mix-side-panel__tabs" role="tablist" aria-label="色の管理">
                  <button id="mix-tab-selected" ref={selectedTabRef} role="tab" type="button"
                    aria-controls="mix-panel-selected" aria-selected={activePanel === 'selected'}
                    tabIndex={activePanel === 'selected' ? 0 : -1}
                    onClick={() => setActivePanel('selected')} onKeyDown={onPanelKeyDown}>
                    えらんだ色 <span>{colors.length} / 5</span>
                  </button>
                  <button id="mix-tab-saved" ref={savedTabRef} role="tab" type="button"
                    aria-controls="mix-panel-saved" aria-selected={activePanel === 'saved'}
                    tabIndex={activePanel === 'saved' ? 0 : -1}
                    onClick={() => setActivePanel('saved')} onKeyDown={onPanelKeyDown}>
                    保存した色 <span>{savedMixes.length}</span>
                  </button>
                </div>
                <div id="mix-panel-selected" className="mix-side-panel__view" role="tabpanel"
                  aria-labelledby="mix-tab-selected" hidden={activePanel !== 'selected'} tabIndex={0}>
                  <SelectedColorList colors={colors} pulseId={pulseId} disabled={state.status === 'mixing'}
                    onAmount={(presetId: string, amount: DropAmount) => dispatch({ type: 'setAmount', presetId, amount })}
                    onRemove={onRemove} onChoose={() => setDrawerOpen(true)} />
                </div>
                <div id="mix-panel-saved" className="mix-side-panel__view mix-side-panel__view--saved" role="tabpanel"
                  aria-labelledby="mix-tab-saved" hidden={activePanel !== 'saved'} tabIndex={0}>
                  <SavedMixList mixes={savedMixes} onRestore={onRestore} onDelete={onDeleteSaved}
                    onExport={onExport} onImport={onImport} />
                </div>
              </aside>
            </div>
          </div>
        </main>
      </div>

      <div className={`drawer-shell${drawerOpen ? ' drawer-shell--open' : ''}`} aria-hidden={!drawerOpen}>
        <button className="drawer-scrim" type="button" onClick={closeDrawer} tabIndex={-1} aria-label="色のメニューを閉じる" />
        <aside id="color-drawer" className="drawer" role="dialog" aria-modal="true" aria-label="色をえらぶ" ref={drawerRef} inert={!drawerOpen}>
          <div className="drawer__top">
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

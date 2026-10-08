import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent } from 'react';
import { ActionIcon } from '../components/ActionIcon';
import { maxBodyOverlap, paintGeometry, type PaintGeometry } from '../components/paintGeometry';
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
import { ModeSwitch, type AppMode } from '../components/ModeSwitch';
import { TargetColorPicker, type TargetPickerGroup } from '../components/TargetColorPicker';
import { RecipePanel } from '../components/RecipePanel';
import { TargetComparison } from '../components/TargetComparison';
import { targetCatalog, targetsById } from '../data/targetCatalog';
import { useRecipeManifest } from '../hooks/useRecipeManifest';
import { targetDeltaE } from '../domain/reverseMixing/evaluateRecipe';
import type { SelectedColor } from '../domain/colorMixing/types';

export default function App() {
  const [mode, setMode] = useState<AppMode>('free');
  const [freeState, freeDispatch] = useReducer(mixReducer, initialMixState);
  const [recipeState, recipeDispatch] = useReducer(mixReducer, initialMixState);
  const state = mode === 'free' ? freeState : recipeState;
  const dispatch = mode === 'free' ? freeDispatch : recipeDispatch;
  const [targetId, setTargetId] = useState<string | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [experiment, setExperiment] = useState(false);
  const [targetGroup, setTargetGroup] = useState<TargetPickerGroup>('recommended');
  const [targetQuery, setTargetQuery] = useState('');
  const [targetScroll, setTargetScroll] = useState(0);
  const { manifest, error: manifestError } = useRecipeManifest(mode === 'recipe');
  const availableTargets = useMemo(() => targetCatalog.filter(item => (manifest?.targets[item.id]?.length ?? 0) > 0), [manifest]);
  const target = targetId ? targetsById.get(targetId) ?? null : null;
  const candidates = targetId ? manifest?.targets[targetId] ?? [] : [];
  const candidate = candidates.find(item => item.id === candidateId) ?? candidates[0];
  const [activeCategory, setActiveCategory] = useState<ColorCategory | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [freeMarks, setFreeMarks] = useState<PaintMark[]>([]);
  const [recipeMarks, setRecipeMarks] = useState<PaintMark[]>([]);
  const marks = mode === 'free' ? freeMarks : recipeMarks;
  const setMarks = mode === 'free' ? setFreeMarks : setRecipeMarks;
  const [incoming, setIncoming] = useState<SelectionImpact | null>(null);
  const [savedMixes, setSavedMixes] = useState<SavedMix[]>(loadSavedMixes);
  const [activePanel, setActivePanel] = useState<'selected' | 'saved'>('selected');
  const freeMarksRef = useRef<PaintMark[]>([]);
  const recipeMarksRef = useRef<PaintMark[]>([]);
  const marksRef = mode === 'free' ? freeMarksRef : recipeMarksRef;
  const impactSerial = useRef(0);
  const geometryRef = useRef(paintGeometry(360, 240, true));
  const reducedMotion = useReducedMotion();
  const drawerRef = useRef<HTMLElement>(null);
  const drawerTriggerRef = useRef<HTMLElement>(null);
  const chooseButtonRef = useRef<HTMLButtonElement>(null);
  const mixButtonRef = useRef<HTMLButtonElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const aboutButtonRef = useRef<HTMLButtonElement>(null);
  const selectedTabRef = useRef<HTMLButtonElement>(null);
  const savedTabRef = useRef<HTMLButtonElement>(null);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const closeAbout = useCallback(() => setAboutOpen(false), []);
  useDialogFocus(drawerOpen, drawerRef, drawerTriggerRef, closeDrawer, selectedTabRef);
  useDialogFocus(aboutOpen, aboutRef, aboutButtonRef, closeAbout);

  useEffect(() => {
    if (state.status !== 'mixing') return;
    const timer = window.setTimeout(() => dispatch({ type: 'finish' }), reducedMotion ? 130 : MIX_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [state.status, reducedMotion, dispatch, mode]);

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
    const query = window.matchMedia?.('(orientation: landscape) and (min-width: 1280px)');
    if (!query) return;
    const onChange = () => { if (query.matches) closeDrawer(); };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [closeDrawer]);

  const onGeometry = useCallback((nextGeometry: PaintGeometry) => {
    const previous = geometryRef.current;
    if (previous.width === nextGeometry.width && previous.height === nextGeometry.height
      && previous.unit === nextGeometry.unit) return;
    geometryRef.current = nextGeometry;
    if (!marksRef.current.length) return;
    const next = relayoutMarks(marksRef.current, nextGeometry);
    marksRef.current = next;
    setMarks(next);
    setIncoming(null);
  }, [marksRef, setMarks]);

  const colors = useMemo(
    () => state.selectedColors.flatMap((item): ResolvedSelection[] => {
      const preset = presetsById.get(item.presetId);
      return preset ? [{ ...item, preset }] : [];
    }),
    [state.selectedColors],
  );
  const selectedIds = useMemo(() => new Set(colors.map(({ presetId }) => presetId)), [colors]);

  const openDrawer = (trigger: HTMLElement) => {
    drawerTriggerRef.current = trigger;
    setActivePanel('selected');
    setDrawerOpen(true);
  };

  const onMode = (next: AppMode) => {
    if (state.status === 'mixing') return;
    closeDrawer();
    setIncoming(null);
    setPulseId(null);
    setMode(next);
  };
  const onTarget = (id: string) => {
    if (state.status === 'mixing' || !manifest?.targets[id]?.length || !targetsById.has(id)) return;
    if (id !== targetId) { setTargetId(id); setCandidateId(null); setExperiment(false); }
    closeDrawer();
  };
  const replaceMarks = (selections: readonly SelectedColor[]) => {
    const geometry = geometryRef.current;
    let next: PaintMark[] = [];
    for (const item of selections) next = [...next, placeMark(item.presetId, next, geometry)];
    next = relayoutMarks(next, geometry);
    marksRef.current = next;
    setMarks(next);
    setIncoming(null);
  };
  const onLoadRecipe = () => {
    if (state.status === 'mixing' || !candidate) return;
    replaceMarks(candidate.selections);
    recipeDispatch({ type: 'loadRecipe', selectedColors: candidate.selections });
    setCandidateId(candidate.id);
    setExperiment(true);
  };
  const pickerProps = {
    targets: availableTargets, loading: !manifest && !manifestError, error: manifestError,
    group: targetGroup, query: targetQuery, selectedId: targetId, disabled: state.status === 'mixing' || !manifest,
    scrollPosition: targetScroll, onScroll: setTargetScroll,
    onGroup: (group: TargetPickerGroup) => { setTargetGroup(group); setTargetQuery(''); setTargetScroll(0); },
    onQuery: (query: string) => { setTargetQuery(query); if (query) setTargetGroup('all'); setTargetScroll(0); },
    onSelect: onTarget,
  };

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
    let next = [...marksRef.current, placeMark(presetId, marksRef.current, geometryRef.current)];
    if (maxBodyOverlap(next, geometryRef.current) > .15) next = relayoutMarks(next, geometryRef.current);
    marksRef.current = next;
    setMarks(next);
    setIncoming({ id: presetId, key: ++impactSerial.current, delayMs: drawerOpen ? 200 : 0 });
    dispatch({ type: 'add', presetId });
    if (drawerOpen) closeDrawer();
  };

  const onRemove = (presetId: string) => {
    if (state.status === 'mixing') return;
    const next = marksRef.current.filter((mark) => mark.presetId !== presetId);
    marksRef.current = next;
    setMarks(next);
    setIncoming(null);
    dispatch({ type: 'remove', presetId });
  };

  const onClear = () => {
    if (state.status === 'mixing') return;
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
    replaceMarks(mix.selections);
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
  const showChooseButton = mode === 'recipe';
  const navProps = {
    activeCategory,
    selectedIds,
    onCategory: setActiveCategory,
    onBack: () => setActiveCategory(null),
    onAdd,
    disabled: state.status === 'mixing',
  };

  return (
    <div className={['app-shell', mode === 'recipe' ? 'app-shell--recipe' : '', mode === 'recipe' && showResult ? 'app-shell--compared' : ''].join(' ')}>
      <div className="app-body">
        <aside className="sidebar" aria-label="色のパレット">
          {mode === 'free' ? <ColorNavigation {...navProps} /> : <TargetColorPicker {...pickerProps} />}
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
                  <ModeSwitch mode={mode} disabled={state.status === 'mixing'} onChange={onMode} />
                  <p className="mix-guidance">{mode === 'free' ? '2〜5色を選んで、色をまぜよう' : 'つくりたい色をえらぶと、まぜ方がわかる'}</p>
                </div>
                {mode === 'recipe' && target && <TargetComparison target={target}
                  hex={experiment ? (showResult ? state.result?.hex : undefined) : candidate?.predictedHex}
                  distance={experiment ? (state.status === 'mixed' && state.result ? targetDeltaE(state.result, target) : undefined) : candidate?.targetDeltaE}
                  label={experiment ? (state.status === 'amount-dirty' ? '前にまぜた色' : 'まぜた色') : 'この配合の色'} />}
                {mode === 'recipe' && !target && <p className="recipe-empty">つくりたい色をえらんでね</p>}
                {mode === 'recipe' && !manifest && <p role="status" className="recipe-note">
                  {manifestError ? '配合データを確認できませんでした。自由にまぜるモードは使えます。' : '配合を確認しています…'}</p>}
                {(mode === 'free' || experiment) && <MixingCanvas colors={colors} marks={marks} incoming={incoming} result={state.result}
                  pendingResult={state.pendingResult} status={state.status} reducedMotion={!!reducedMotion} onGeometry={onGeometry} />
                }
                <div className={`stage-actions${showChooseButton ? ' stage-actions--with-choose' : ''}`}>
                  {showChooseButton && (
                    <button className="choose-button mobile-only" type="button" disabled={state.status === 'mixing'}
                      ref={chooseButtonRef} aria-expanded={drawerOpen} aria-controls="color-drawer"
                      onClick={event => openDrawer(event.currentTarget)}>
                      つくりたい色をえらぶ
                    </button>
                  )}
                  <div className="stage-actions__primary">
                    <button
                      className={`mix-button${state.status === 'dirty' || state.status === 'amount-dirty' ? ' mix-button--dirty' : ''}`}
                      type="button"
                      ref={mixButtonRef}
                      onClick={mode === 'recipe' && !experiment ? onLoadRecipe : onMix}
                      disabled={state.status === 'mixing' || (mode === 'recipe' && !experiment ? !candidate : colors.length < 2)}
                    >
                      <img className={`mix-button__logo${state.status === 'mixing' && !reducedMotion ? ' mix-button__logo--spinning' : ''}`}
                        src="./favicon.svg?v=2" alt="" />{mode === 'recipe' && !experiment ? 'この配合でためす' : buttonLabel}
                    </button>
                    {(mode === 'free' || experiment) && <button className="reset-button" type="button" onClick={onClear}
                      disabled={colors.length === 0 || state.status === 'mixing'}
                      aria-label="色をけす（えらんだ色をすべて消す）">
                      <ActionIcon kind="eraser" />色をけす
                    </button>}
                  </div>
                </div>
                <div className={`result-copy${(mode === 'free' || experiment) && showResult ? ' result-copy--visible' : ''}`} aria-live="polite">
                  {(mode === 'free' || experiment) && showResult && (
                    <div className="result-copy__inner" key={state.result?.hex}>
                      {state.status === 'amount-dirty' && <span className="result-copy__stale">前にまぜた色</span>}
                      <strong>{state.result?.nearestName.nameJa}に近い色</strong>
                      {state.status === 'mixed' && <button className="save-button" type="button" onClick={onSave}>この色を保存する</button>}
                    </div>
                  )}
                </div>
              </div>

              <aside className="mix-side-panel" aria-label={mode === 'free' ? '色の管理' : '配合の管理'}>
                {mode === 'free' ? <>
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
                  {colors.length < 5 && <button className="choose-button selection-choose compact-only" type="button"
                    disabled={state.status === 'mixing'} onClick={(event) => openDrawer(event.currentTarget)}
                    aria-controls="color-drawer" aria-expanded={drawerOpen}>
                    <ActionIcon kind="palette" />{colors.length === 0 ? '色をえらぶ' : '色をたす'}
                  </button>}
                  <SelectedColorList colors={colors} pulseId={pulseId} disabled={state.status === 'mixing'}
                    onAmount={(presetId: string, amount: DropAmount) => {
                      setIncoming(null);
                      dispatch({ type: 'setAmount', presetId, amount });
                    }}
                    onRemove={onRemove} />
                </div>
                <div id="mix-panel-saved" className="mix-side-panel__view mix-side-panel__view--saved" role="tabpanel"
                  aria-labelledby="mix-tab-saved" hidden={activePanel !== 'saved'} tabIndex={0}>
                  <SavedMixList mixes={savedMixes} onRestore={onRestore} onDelete={onDeleteSaved}
                    onExport={onExport} onImport={onImport} />
                </div>
                </> : experiment ? <div className="recipe-experiment">
                  <div className="recipe-experiment__actions">
                    <button className="recipe-experiment__action recipe-experiment__action--back" type="button" disabled={state.status === 'mixing'} onClick={() => { setExperiment(false); mixButtonRef.current?.focus(); }}>
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m10 5-7 7 7 7M3 12h18" /></svg>
                      ほかのつくり方
                    </button>
                    <button className="recipe-experiment__action recipe-experiment__action--restore" type="button" disabled={state.status === 'mixing' || !candidate} onClick={onLoadRecipe}>
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 11a8 8 0 1 1 1.3 5.5M4 5v6h6" /></svg>
                      この配合にもどす
                    </button>
                  </div>
                  <h2>ためす配合</h2>
                  <SelectedColorList colors={colors} pulseId={pulseId} disabled={state.status === 'mixing'}
                    onAmount={(presetId, amount) => { setIncoming(null); recipeDispatch({ type: 'setAmount', presetId, amount }); }}
                    onRemove={onRemove} />
                </div> : <RecipePanel target={manifest ? target : null} candidates={candidates} selected={candidate}
                  disabled={state.status === 'mixing'} onSelect={setCandidateId} />}
              </aside>
            </div>
          </div>
        </main>
      </div>

      <div className={`drawer-shell${drawerOpen ? ' drawer-shell--open' : ''}`} aria-hidden={!drawerOpen}>
        <button className="drawer-scrim" type="button" onClick={closeDrawer} tabIndex={-1} aria-label="色のメニューを閉じる" />
        <aside id="color-drawer" className="drawer" role="dialog" aria-modal="true" aria-label={mode === 'free' ? '色をえらぶ' : 'つくりたい色をえらぶ'} ref={drawerRef} inert={!drawerOpen}>
          <div className="drawer__top">
            <button className="icon-button" type="button" onClick={closeDrawer} aria-label="色のメニューを閉じる">×</button>
          </div>
          {mode === 'free' ? <ColorNavigation {...navProps} /> : <TargetColorPicker {...pickerProps} />}
          <button className="drawer__done" type="button" onClick={closeDrawer}>{mode === 'free' ? 'えらんだ色を見る' : 'つくり方を見る'} <span aria-hidden="true">→</span></button>
        </aside>
      </div>

      <AboutColorModal open={aboutOpen} dialogRef={aboutRef} onClose={closeAbout} />
      <div className="toast" aria-live="polite" aria-atomic="true">{toast && <span>{toast}</span>}</div>
    </div>
  );
}

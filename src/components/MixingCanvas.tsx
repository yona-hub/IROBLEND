import { useEffect, useRef } from 'react';
import type { MixResult } from '../domain/colorMixing/types';
import type { MixStatus } from '../domain/state/mixReducer';
import type { ResolvedSelection } from './SelectedColorList';
import { drawMixFrame, MIX_DURATION_MS } from './mixAnimation';
import { drawPaintMarks, SELECTION_IMPACT_DURATION_MS, type PaintMark } from './paintMarks';

export type SelectionImpact = { id: string; key: number; delayMs?: number };
type Props = {
  colors: readonly ResolvedSelection[];
  marks: readonly PaintMark[];
  incoming: SelectionImpact | null;
  result: MixResult | null;
  pendingResult: MixResult | null;
  status: MixStatus;
  reducedMotion: boolean;
};

export function MixingCanvas({ colors, marks, incoming, result, pendingResult, status, reducedMotion }: Props) {
  const selectionRef = useRef<HTMLCanvasElement>(null);
  const mixingRef = useRef<HTMLCanvasElement>(null);
  const lastImpactKey = useRef<number | null>(null);
  const showResult = (status === 'mixed' || status === 'amount-dirty') && result;
  const mixing = status === 'mixing';

  useEffect(() => {
    const canvas = selectionRef.current;
    if (!canvas || mixing || showResult) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let width = 0, height = 0;
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width; height = bounds.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const render = (progress?: number) => drawPaintMarks(ctx, width, height, marks, colors,
      incoming && progress !== undefined ? { id: incoming.id, progress } : undefined);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { resize(); render(); });
    observer?.observe(canvas);
    const animate = !!incoming && !reducedMotion && incoming.key !== lastImpactKey.current;
    if (!animate) { render(); return () => observer?.disconnect(); }
    const start = performance.now() + (incoming.delayMs ?? 0);
    let frame = 0;
    const draw = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - start) / SELECTION_IMPACT_DURATION_MS));
      render(progress);
      if (progress < 1) frame = requestAnimationFrame(draw);
      else lastImpactKey.current = incoming.key;
    };
    draw(start);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [colors, marks, incoming, mixing, showResult, reducedMotion]);

  useEffect(() => {
    const canvas = mixingRef.current;
    if (!mixing || reducedMotion || !canvas || !pendingResult) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const palette = colors.map(({ preset, amount }) => {
      const mark = marks.find((item) => item.presetId === preset.id);
      return { hex: preset.hex, amount, x: mark?.x, y: mark?.y };
    });
    let width = 0, height = 0;
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width; height = bounds.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(canvas);
    const started = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const elapsed = Math.min(now - started, MIX_DURATION_MS);
      drawMixFrame(ctx, width, height, elapsed, palette, pendingResult.hex,
        () => drawPaintMarks(ctx, width, height, marks, colors));
      if (elapsed < MIX_DURATION_MS) frame = requestAnimationFrame(draw);
    };
    draw(started);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [mixing, colors, marks, pendingResult, reducedMotion]);

  return (
    <div className="canvas-wrap">
      <div className={`mix-canvas mix-canvas--${status}`}
        aria-label={showResult ? `${status === 'amount-dirty' ? '前にまぜた色' : 'できた色'}は${result.nearestName.nameJa}に近い色` : `${colors.length}色を載せたキャンバス`} role="img">
        {showResult && <div className="result-surface" style={{ backgroundColor: result.hex }} />}
        {!showResult && !mixing && <canvas className="paint-canvas" ref={selectionRef} aria-hidden="true" />}
        {mixing && pendingResult && (reducedMotion
          ? <div className="reduced-mix-surface" style={{ backgroundColor: pendingResult.hex }} aria-hidden="true" />
          : <canvas className="mix-animation" ref={mixingRef} aria-hidden="true" />)}
      </div>
    </div>
  );
}

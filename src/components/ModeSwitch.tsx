import { useRef, type KeyboardEvent } from 'react';
export type AppMode = 'free' | 'recipe';
export function ModeSwitch({ mode, disabled, onChange }: {
  mode: AppMode; disabled: boolean; onChange: (mode: AppMode) => void;
}) {
  const refs = { free: useRef<HTMLButtonElement>(null), recipe: useRef<HTMLButtonElement>(null) };
  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'free' : event.key === 'End' ? 'recipe' : mode === 'free' ? 'recipe' : 'free';
    onChange(next); refs[next].current?.focus();
  };
  return <div className="mode-switch" role="group" aria-label="まぜ方のモード">
    {(['free', 'recipe'] as const).map(value => <button key={value} ref={refs[value]} type="button"
      disabled={disabled} aria-pressed={mode === value} onClick={() => onChange(value)} onKeyDown={onKey}>
      {value === 'free' ? '自由にまぜる' : 'つくり方をさがす'}
    </button>)}
  </div>;
}

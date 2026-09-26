import type { CSSProperties } from 'react';
import type { MixResult } from '../domain/colorMixing/types';
import type { MixStatus } from '../domain/state/mixReducer';
import type { ResolvedSelection } from './SelectedColorList';

type Props = {
  colors: readonly ResolvedSelection[];
  result: MixResult | null;
  status: MixStatus;
};

function position(index: number, count: number) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
  return {
    x: `${(Math.cos(angle) * 27).toFixed(1)}cqw`,
    y: `${(Math.sin(angle) * 27).toFixed(1)}cqw`,
  };
}

export function MixingCanvas({ colors, result, status }: Props) {
  const showResult = (status === 'mixed' || status === 'dirty') && result;
  const mixing = status === 'mixing';
  const visibleBlobs = !showResult && colors.length > 0;
  const marble = colors.map(({ preset }) => preset.hex).join(', ');

  return (
    <div className="canvas-wrap">
      <div className={`mix-canvas mix-canvas--${status}`} aria-label={showResult ? `できた色は${result.nearestName.nameJa}に近い色` : `${colors.length}色を混ぜる場所`} role="img">
        {showResult && <div className="result-surface" style={{ backgroundColor: result.hex }} />}
        {visibleBlobs && colors.map(({ preset, amount }, index) => {
          const point = position(index, colors.length);
          const style = {
            '--dx': point.x,
            '--dy': point.y,
            '--blob-color': preset.hex,
            '--blob-size': `${52 + amount * 10}px`,
            '--order': index,
          } as CSSProperties;
          return <span className="color-blob" style={style} key={preset.id} aria-hidden="true" />;
        })}
        {mixing && (
          <>
            <span className="mix-marble" style={{ '--marble': `conic-gradient(${marble})` } as CSSProperties} aria-hidden="true" />
            {colors.flatMap(({ preset }, index) => {
              const point = position(index, colors.length);
              return Array.from({ length: 3 }, (_, particleIndex) => (
                <span
                  className="mix-particle"
                  key={`${preset.id}-${particleIndex}`}
                  style={{
                    '--dx': point.x,
                    '--dy': point.y,
                    '--particle-color': preset.hex,
                    '--particle-order': particleIndex,
                  } as CSSProperties}
                  aria-hidden="true"
                />
              ));
            })}
            {[0, 1, 2, 3].map((index) => (
              <span className="speed-streak" style={{ '--streak': index } as CSSProperties} key={index} aria-hidden="true" />
            ))}
          </>
        )}
        {colors.length === 0 && <span className="canvas-empty" aria-hidden="true"><span /><span /><span /></span>}
      </div>
      <span className="canvas-caption">{mixing ? 'COLORS IN MOTION' : showResult ? 'YOUR BLEND' : 'MIXING CANVAS'}</span>
    </div>
  );
}

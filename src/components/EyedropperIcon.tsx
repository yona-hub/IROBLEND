import { useId } from 'react';
import emptyEyedropper from '../assets/eyedropper-empty.png';
import { eyedropperAppearance } from './eyedropperAppearance';

type Props = { color: `#${string}`; filled: boolean };

// The inner silhouette follows the existing transparent outline image. The
// liquid starts at y≈170, filling about 80% of the chamber below its collar.
const chamber = 'M33 125 H92 V282 C92 292 89 299 83 304 C76 310 73 315 71 321 C69 329 69 342 66 347 C64 350 60 350 58 347 C55 342 55 329 53 321 C51 315 48 310 41 304 C35 299 33 292 33 282 Z';
const liquid = 'M25 170 C36 174 45 165 55 166 C66 167 73 175 83 171 C91 168 97 169 100 171 L100 360 H25 Z';
const surface = 'M25 170 C36 174 45 165 55 166 C66 167 73 175 83 171 C91 168 97 169 100 171';

export function EyedropperIcon({ color, filled }: Props) {
  const id = useId().replace(/:/g, '');
  const tones = filled ? eyedropperAppearance(color) : null;
  const clipId = `${id}-chamber`;
  const depthId = `${id}-depth`;
  const sideId = `${id}-side`;

  return (
    <svg className="eyedropper-icon" viewBox="0 0 125 360" aria-hidden="true" focusable="false">
      {tones && (
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse"><path d={chamber} /></clipPath>
          <linearGradient id={depthId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tones.body} />
            <stop offset="30%" stopColor={tones.body} />
            <stop offset="100%" stopColor={tones.shade} />
          </linearGradient>
          <linearGradient id={sideId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={tones.shade} stopOpacity=".2" />
            <stop offset="55%" stopColor={tones.body} stopOpacity="0" />
            <stop offset="100%" stopColor={tones.reflection} stopOpacity=".22" />
          </linearGradient>
        </defs>
      )}
      {tones && (
        <g className="eyedropper-icon__paint" clipPath={`url(#${clipId})`}>
          <path className="eyedropper-icon__liquid" d={liquid} fill={`url(#${depthId})`} />
          <path d={liquid} fill={`url(#${sideId})`} />
          <path d={surface} fill="none" stroke={tones.shade} strokeOpacity={tones.surfaceOpacity}
            strokeWidth="4" strokeLinecap="round" />
          <path className="eyedropper-icon__highlight" d="M82 187 C83 213 83 250 82 282"
            fill="none" stroke="#fff" strokeOpacity={tones.lineOpacity} strokeWidth="4"
            strokeLinecap="round" />
        </g>
      )}
      <image href={emptyEyedropper} x="0" y="0" width="125" height="360" />
    </svg>
  );
}

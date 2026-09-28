import { useId } from 'react';
import { eyedropperAppearance } from './eyedropperAppearance';

type Props = { color: `#${string}`; filled: boolean };

// A compact vector interpretation of the supplied glass pipette references.
// The liquid starts high enough to fill about 80% of the inner chamber.
const outerTube = 'M34 141 H91 V271 C91 289 85 299 76 307 C69 314 68 328 67 339 C66 350 64 354 62 354 C60 354 58 350 57 339 C56 328 55 314 48 307 C39 299 34 289 34 271 Z';
const chamber = 'M39 148 H86 V269 C86 286 82 295 72 303 C65 310 64 325 63 338 C63 344 63 348 62 348 C61 348 61 344 61 338 C60 325 59 310 52 303 C42 295 39 286 39 269 Z';
const wave = 'M34 179 C44 178 47 169 57 168 C68 165 72 180 84 178 C89 177 92 172 94 174';
const liquid = `${wave} L94 360 H34 Z`;

export function EyedropperIcon({ color, filled }: Props) {
  const id = useId().replace(/:/g, '');
  const tones = filled ? eyedropperAppearance(color) : null;
  const chamberId = `${id}-chamber`;
  const glassId = `${id}-glass`;
  const capId = `${id}-cap`;
  const liquidId = `${id}-liquid`;
  const liquidSideId = `${id}-liquid-side`;

  return (
    <svg className="eyedropper-icon" viewBox="0 0 125 360" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={chamberId} clipPathUnits="userSpaceOnUse"><path d={chamber} /></clipPath>
        <linearGradient id={glassId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#caeafa" />
          <stop offset="32%" stopColor="#f7fcff" />
          <stop offset="74%" stopColor="#e8f7ff" />
          <stop offset="100%" stopColor="#95c9e3" />
        </linearGradient>
        <linearGradient id={capId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fffefc" />
          <stop offset="66%" stopColor="#f4f1ee" />
          <stop offset="100%" stopColor="#d9d7d8" />
        </linearGradient>
        {tones && (
          <>
            <linearGradient id={liquidId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tones.body} />
              <stop offset="35%" stopColor={tones.body} />
              <stop offset="100%" stopColor={tones.shade} />
            </linearGradient>
            <linearGradient id={liquidSideId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={tones.reflection} stopOpacity=".18" />
              <stop offset="70%" stopColor={tones.body} stopOpacity="0" />
              <stop offset="100%" stopColor={tones.shade} stopOpacity=".25" />
            </linearGradient>
          </>
        )}
      </defs>

      <path d={outerTube} fill={`url(#${glassId})`} stroke="#9ac9df" strokeWidth="2" />
      <path d={chamber} fill="#eaf8ff" fillOpacity=".75" />
      {tones && (
        <g className="eyedropper-icon__paint" clipPath={`url(#${chamberId})`}>
          <path className="eyedropper-icon__liquid" d={liquid} fill={`url(#${liquidId})`} />
          <path d={liquid} fill={`url(#${liquidSideId})`} />
          <path d={wave} fill="none" stroke={tones.reflection}
            strokeOpacity={Math.min(tones.surfaceOpacity, .7)} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M76 188 C78 212 78 255 76 278" fill="none" stroke="#fff"
            strokeOpacity={tones.lineOpacity} strokeWidth="5" strokeLinecap="round" />
          <circle cx="73" cy="220" r="4.5" fill="#fff" opacity=".24" />
          <circle cx="67" cy="243" r="2.4" fill="#fff" opacity=".18" />
          <path d="M77 300 Q83 294 83 288" fill="none" stroke="#fff"
            strokeOpacity={tones.lineOpacity * 1.3} strokeWidth="5" strokeLinecap="round" />
        </g>
      )}
      <path d={chamber} fill="none" stroke="#a9d3e6" strokeWidth="2" strokeOpacity=".68" />
      <path d="M42 156 V268 C42 287 47 295 52 299" fill="none" stroke="#fff"
        strokeOpacity=".78" strokeWidth="5" strokeLinecap="round" />

      <path d="M42 103 C45 98 45 94 45 84 V41 C45 22 52 9 62 9 C72 9 80 22 80 41 V84 C80 95 80 99 83 103 Z"
        fill={`url(#${capId})`} stroke="#d5d8da" strokeWidth="2.5" />
      <path d="M52 42 Q55 30 61 29" fill="none" stroke="#fff" strokeWidth="7"
        strokeLinecap="round" strokeOpacity=".92" />
      <circle cx="52" cy="62" r="3" fill="#fff" opacity=".85" />
      <path d="M32 107 H93 C103 107 108 113 108 121 C108 130 102 136 93 136 H32 C23 136 17 130 17 121 C17 113 23 107 32 107 Z"
        fill={`url(#${capId})`} stroke="#d3d8dc" strokeWidth="2.5" />
      <path d="M30 115 H69" fill="none" stroke="#fff" strokeWidth="6"
        strokeLinecap="round" strokeOpacity=".88" />
      <path d="M24 130 Q62 136 100 130" fill="none" stroke="#c7ced2"
        strokeWidth="2" strokeOpacity=".55" />
    </svg>
  );
}

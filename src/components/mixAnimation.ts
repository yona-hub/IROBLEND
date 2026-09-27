export const MIX_DURATION_MS = 840;
export type AnimationColor = { hex: string; amount: number; x?: number; y?: number };
const tau = Math.PI * 2;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };

/** A fast initial velocity followed by increasing inward acceleration. */
export function inwardProgress(t: number) {
  const p = clamp(t);
  return .55 * p + .45 * p * p * p;
}

/** Stateless drawing keeps timing independent of frame rate and permits frame QA. */
export function drawMixFrame(ctx: CanvasRenderingContext2D, width: number, height: number, elapsed: number,
  colors: readonly AnimationColor[], result: string, drawSource?: () => void) {
  ctx.clearRect(0, 0, width, height);
  if (drawSource && elapsed < 210) {
    ctx.save(); ctx.globalAlpha = 1 - smooth(elapsed / 210);
    drawSource(); ctx.restore();
  }
  ctx.save();
  ctx.translate(width / 2, height / 2);
  const scale = Math.min(width, height) / 360;
  ctx.scale(scale, scale);
  const circle = (x: number, y: number, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, tau); ctx.fill();
  };
  colors.forEach((color, index) => {
    const angle = -Math.PI / 2 + index * tau / colors.length;
    const shrink = 1 - smooth(elapsed / 150);
    if (color.x === undefined && shrink > 0) circle(Math.cos(angle) * 97, Math.sin(angle) * 97,
      (24 + color.amount * 4) * shrink, color.hex);
  });
  // Tails sample the SAME curved trajectory at earlier times, following travel.
  colors.forEach((color, index) => {
    const count = 8 + color.amount * 3;
    for (let j = 0; j < count; j++) {
      const t = (elapsed - (j % 5) * 15) / (265 + (j % 4) * 17);
      if (t < 0 || t > 1) continue;
      const sourceX = color.x === undefined ? Math.cos(-Math.PI / 2 + index * tau / colors.length) * 97
        : (color.x - .5) * width / scale;
      const sourceY = color.y === undefined ? Math.sin(-Math.PI / 2 + index * tau / colors.length) * 97
        : (color.y - .5) * height / scale;
      const angle = Math.atan2(sourceY, sourceX) + ((j % 7) - 3) * .14;
      const origin = Math.hypot(sourceX, sourceY) + (j % 4) * 14;
      const point = (p: number) => {
        const progress = inwardProgress(p);
        const radius = origin * (1 - progress);
        const turn = angle + .65 * progress;
        return [Math.cos(turn) * radius, Math.sin(turn) * radius] as const;
      };
      ctx.strokeStyle = color.hex;
      ctx.lineWidth = 1 + (j % 3) * .35;
      ctx.lineCap = 'round';
      ctx.globalAlpha = .6;
      ctx.beginPath();
      for (let k = 0; k <= 8; k++) {
        const [x, y] = point(Math.max(0, t - .2 + k * .025));
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      const [x, y] = point(t);
      circle(x, y, 3 + (j % 4) * 1.6, color.hex);
    }
  });
  if (elapsed >= 230) {
    const impact = smooth((elapsed - 230) / 160);
    const spread = smooth((elapsed - 450) / (MIX_DURATION_MS - 450));
    const targetRadius = Math.hypot(width, height) / (2 * scale) + 2;
    const radius = 60 * impact + (targetRadius - 60) * spread;
    circle(0, 0, radius, result);
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, tau); ctx.clip();
    // Interleaved ribbons shear and swirl before dissolving into the computed color.
    ctx.globalAlpha = 1 - smooth((elapsed - 500) / 310);
    const twist = (elapsed - 230) / 170;
    const total = colors.reduce((sum, c) => sum + c.amount, 0);
    colors.forEach((color, index) => {
      for (let band = 0; band < 3; band++) {
        ctx.strokeStyle = color.hex;
        ctx.lineWidth = radius * (.12 + color.amount / total * .44) / (1 + band * .5);
        ctx.beginPath();
        for (let k = 0; k <= 45; k++) {
          const p = k / 45;
          const a = index * tau / colors.length + band * 1.7 + p * 4.4 + twist;
          const r = radius * p * 1.15;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    });
    ctx.restore();
    // Collision droplets recoil and are pulled back into the marble pool.
    const splash = clamp((elapsed - 290) / 210);
    if (splash > 0 && splash < 1) {
      ctx.globalAlpha = Math.sin(Math.PI * splash);
      colors.forEach((color, index) => {
        for (let j = 0; j < 4; j++) {
          const a = index * tau / colors.length + j * .28 + .4;
          const r = 52 + Math.sin(Math.PI * splash) * (21 + j * 7);
          circle(Math.cos(a) * r, Math.sin(a) * r, 2 + j, color.hex);
        }
      });
    }
  }
  ctx.restore();
}

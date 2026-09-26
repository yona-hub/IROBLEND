import type { RefObject } from 'react';

type Props = {
  open: boolean;
  dialogRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
};

export function AboutColorModal({ open, dialogRef, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="modal-layer">
      <button className="modal-scrim" type="button" onClick={onClose} aria-label="説明を閉じる" tabIndex={-1} />
      <div className="about-modal" role="dialog" aria-modal="true" aria-labelledby="about-title" ref={dialogRef}>
        <div className="about-modal__heading">
          <span className="eyebrow">ABOUT THE COLORS</span>
          <button className="icon-button" type="button" onClick={onClose} aria-label="説明を閉じる">×</button>
        </div>
        <h2 id="about-title">このアプリの色について</h2>
        <p>このアプリは、画面に表示される色から光の反射のしかたを推定し、絵の具に使われる考え方に近い方法で色を混ぜています。</p>
        <p>本物の絵の具は、同じ「青」でも使われている顔料によって混ざり方が違います。紙、絵の具の量、厚さ、乾き方、照明などでも見え方は変わります。</p>
        <p>そのため、表示される色は「実際の絵の具に近づけたシミュレーション」です。</p>
        <div className="about-modal__detail">
          <strong>もう少しくわしく</strong>
          <p>画面の色から推定した分光反射率をもとに、Kubelka–Munk法で混色を計算しています。特定の絵の具や顔料を実測した結果ではありません。</p>
        </div>
        <p className="about-modal__license">IROBLEND · © 2026 YONA WORKS · <a href="https://github.com/rvanwijnen/spectral.js" target="_blank" rel="noopener noreferrer">Spectral.js</a> (MIT)</p>
      </div>
    </div>
  );
}

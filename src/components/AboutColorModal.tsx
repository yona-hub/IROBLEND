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
          <span></span>
          <button className="icon-button" type="button" onClick={onClose} aria-label="説明を閉じる">×</button>
        </div>
        <h2 id="about-title">このアプリの色について</h2>
        <p>このアプリは、色の組み合わせを予想しながら遊べるように調整した「仮想絵の具セット」を使っています。色のついたスポイトの本数で、混ぜる量を選べます。</p>
        <p>本物の絵の具は、同じ「青」でも使われている顔料によって混ざり方が違います。紙、絵の具の量、厚さ、乾き方、照明などでも見え方は変わります。</p>
        <p>実物の絵の具の性質を参考にした、色遊びのための近似結果です。実際の絵の具は顔料やメーカーなどによって結果が異なります。</p>
        <p>「○○に近い色」という名前は、計算した表示色に近い既知の色名を選んだ目安です。名前の色と完全に同じという意味ではありません。</p>
        <p>スポイト1本分は混ぜる割合の目安で、実際のスポイト1本の容量ではありません。保存した色はこのブラウザーに残りますが、ブラウザーのデータを消すと失われます。長く残したいときは保存欄からJSONを書き出してください。</p>
        <div className="about-modal__detail">
          <strong>もう少しくわしく</strong>
          <p>波長ごとの吸収（K）と散乱（S）を個別に配合し、白の散乱や黒の吸収を計算します。その後、単色の見本と赤・黄・青を基準にした色の方向を、全色共通のルールで表示へ反映します。特定の絵の具や顔料を実測した結果ではありません。</p>
        </div>
        <p className="about-modal__license">IROBLEND · © 2026 YONA WORKS · <a href="https://github.com/rvanwijnen/spectral.js" target="_blank" rel="noopener noreferrer">Spectral.js</a> (MIT)</p>
      </div>
    </div>
  );
}

import type { ColorCategory, ColorPreset } from '../domain/colorMixing/types';
import { pigmentForPreset } from './virtualPigments';

export const categories: ReadonlyArray<{
  id: ColorCategory;
  nameJa: string;
  nameEn: string;
  hex: `#${string}`;
}> = [
  { id: 'red', nameJa: '赤', nameEn: 'RED', hex: '#D9484E' },
  { id: 'pink', nameJa: 'ピンク', nameEn: 'PINK', hex: '#E980A4' },
  { id: 'orange', nameJa: 'オレンジ', nameEn: 'ORANGE', hex: '#EC892D' },
  { id: 'yellow', nameJa: '黄', nameEn: 'YELLOW', hex: '#E8CA39' },
  { id: 'green', nameJa: '緑', nameEn: 'GREEN', hex: '#5B9C69' },
  { id: 'blue', nameJa: '青', nameEn: 'BLUE', hex: '#4773B5' },
  { id: 'purple', nameJa: '紫', nameEn: 'PURPLE', hex: '#8B69AE' },
  { id: 'white', nameJa: '白', nameEn: 'WHITE', hex: '#F2F1EC' },
  { id: 'black', nameJa: '黒', nameEn: 'BLACK', hex: '#34383D' },
];

const swatches: readonly Omit<ColorPreset, 'pigment'>[] = [
  { id: 'red', category: 'red', nameJa: 'レッド', nameEn: 'Red', hex: '#E53935' },
  { id: 'scarlet', category: 'red', nameJa: 'スカーレット', nameEn: 'Scarlet', hex: '#D8253E' },
  { id: 'vermilion', category: 'red', nameJa: 'バーミリオン', nameEn: 'Vermilion', hex: '#E85C40' },
  { id: 'crimson', category: 'red', nameJa: 'クリムゾン', nameEn: 'Crimson', hex: '#A42343' },
  { id: 'carmine', category: 'red', nameJa: 'カーマイン', nameEn: 'Carmine', hex: '#8F1D46' },
  { id: 'tomato-red', category: 'red', nameJa: 'トマトレッド', nameEn: 'Tomato Red', hex: '#E96B52' },

  { id: 'pink', category: 'pink', nameJa: 'ピンク', nameEn: 'Pink', hex: '#F08BAA' },
  { id: 'baby-pink', category: 'pink', nameJa: 'ベビーピンク', nameEn: 'Baby Pink', hex: '#F4C1D1' },
  { id: 'rose-pink', category: 'pink', nameJa: 'ローズピンク', nameEn: 'Rose Pink', hex: '#D95A8A' },
  { id: 'cherry-pink', category: 'pink', nameJa: 'チェリーピンク', nameEn: 'Cherry Pink', hex: '#C94370' },
  { id: 'salmon-pink', category: 'pink', nameJa: 'サーモンピンク', nameEn: 'Salmon Pink', hex: '#EF9285' },
  { id: 'hot-pink', category: 'pink', nameJa: 'ホットピンク', nameEn: 'Hot Pink', hex: '#E94A9E' },

  { id: 'orange', category: 'orange', nameJa: 'オレンジ', nameEn: 'Orange', hex: '#F38C29' },
  { id: 'mandarin-orange', category: 'orange', nameJa: 'マンダリンオレンジ', nameEn: 'Mandarin Orange', hex: '#E96D22' },
  { id: 'carrot-orange', category: 'orange', nameJa: 'キャロットオレンジ', nameEn: 'Carrot Orange', hex: '#CE5828' },
  { id: 'apricot', category: 'orange', nameJa: 'アプリコット', nameEn: 'Apricot', hex: '#F4B179' },
  { id: 'coral', category: 'orange', nameJa: 'コーラル', nameEn: 'Coral', hex: '#ED7968' },
  { id: 'dark-orange', category: 'orange', nameJa: 'ダークオレンジ', nameEn: 'Dark Orange', hex: '#AB4F1D' },

  { id: 'yellow', category: 'yellow', nameJa: 'イエロー', nameEn: 'Yellow', hex: '#F4D929' },
  { id: 'lemon-yellow', category: 'yellow', nameJa: 'レモンイエロー', nameEn: 'Lemon Yellow', hex: '#F5ED55' },
  { id: 'canary-yellow', category: 'yellow', nameJa: 'カナリアイエロー', nameEn: 'Canary Yellow', hex: '#F6C83F' },
  { id: 'golden-yellow', category: 'yellow', nameJa: 'ゴールデンイエロー', nameEn: 'Golden Yellow', hex: '#D7A226' },
  { id: 'cream-yellow', category: 'yellow', nameJa: 'クリームイエロー', nameEn: 'Cream Yellow', hex: '#F0E3A0' },
  { id: 'khaki', category: 'yellow', nameJa: 'カーキ', nameEn: 'Khaki', hex: '#B7A467' },

  { id: 'green', category: 'green', nameJa: 'グリーン', nameEn: 'Green', hex: '#4C9A5A' },
  { id: 'apple-green', category: 'green', nameJa: 'アップルグリーン', nameEn: 'Apple Green', hex: '#91B849' },
  { id: 'mint-green', category: 'green', nameJa: 'ミントグリーン', nameEn: 'Mint Green', hex: '#8BCDB2' },
  { id: 'emerald-green', category: 'green', nameJa: 'エメラルドグリーン', nameEn: 'Emerald Green', hex: '#248466' },
  { id: 'forest-green', category: 'green', nameJa: 'フォレストグリーン', nameEn: 'Forest Green', hex: '#2F6345' },
  { id: 'lime-green', category: 'green', nameJa: 'ライムグリーン', nameEn: 'Lime Green', hex: '#C0D947' },

  { id: 'blue', category: 'blue', nameJa: 'ブルー', nameEn: 'Blue', hex: '#326DAF' },
  { id: 'sky-blue', category: 'blue', nameJa: 'スカイブルー', nameEn: 'Sky Blue', hex: '#80BCE5' },
  { id: 'light-blue', category: 'blue', nameJa: 'ライトブルー', nameEn: 'Light Blue', hex: '#B4D9EB' },
  { id: 'cobalt-blue', category: 'blue', nameJa: 'コバルトブルー', nameEn: 'Cobalt Blue', hex: '#3158A9' },
  { id: 'ultramarine', category: 'blue', nameJa: 'ウルトラマリン', nameEn: 'Ultramarine', hex: '#464B9C' },
  { id: 'royal-blue', category: 'blue', nameJa: 'ロイヤルブルー', nameEn: 'Royal Blue', hex: '#546FCC' },
  { id: 'navy-blue', category: 'blue', nameJa: 'ネイビーブルー', nameEn: 'Navy Blue', hex: '#243458' },

  { id: 'purple', category: 'purple', nameJa: 'パープル', nameEn: 'Purple', hex: '#704891' },
  { id: 'violet', category: 'purple', nameJa: 'バイオレット', nameEn: 'Violet', hex: '#875BC5' },
  { id: 'lavender', category: 'purple', nameJa: 'ラベンダー', nameEn: 'Lavender', hex: '#B9A6D7' },
  { id: 'lilac', category: 'purple', nameJa: 'ライラック', nameEn: 'Lilac', hex: '#D3BAE4' },
  { id: 'mauve', category: 'purple', nameJa: 'モーブ', nameEn: 'Mauve', hex: '#947897' },
  { id: 'orchid', category: 'purple', nameJa: 'オーキッド', nameEn: 'Orchid', hex: '#BC77B7' },
  { id: 'plum', category: 'purple', nameJa: 'プラム', nameEn: 'Plum', hex: '#71375F' },

  { id: 'white', category: 'white', nameJa: 'ホワイト', nameEn: 'White', hex: '#FFFFFF' },
  { id: 'snow-white', category: 'white', nameJa: 'スノーホワイト', nameEn: 'Snow White', hex: '#F0F5FA' },
  { id: 'ivory', category: 'white', nameJa: 'アイボリー', nameEn: 'Ivory', hex: '#F4EBCB' },
  { id: 'milk-white', category: 'white', nameJa: 'ミルクホワイト', nameEn: 'Milk White', hex: '#F6F3E9' },
  { id: 'white-smoke', category: 'white', nameJa: 'ホワイトスモーク', nameEn: 'White Smoke', hex: '#E7E8E6' },

  { id: 'black', category: 'black', nameJa: 'ブラック', nameEn: 'Black', hex: '#101112' },
  { id: 'charcoal', category: 'black', nameJa: 'チャコール', nameEn: 'Charcoal', hex: '#30343B' },
  { id: 'graphite', category: 'black', nameJa: 'グラファイト', nameEn: 'Graphite', hex: '#4F545B' },
  { id: 'dark-slate', category: 'black', nameJa: 'ダークスレート', nameEn: 'Dark Slate', hex: '#435054' },
  { id: 'dim-gray', category: 'black', nameJa: 'ディムグレー', nameEn: 'Dim Gray', hex: '#70747A' },
];

export const colorPresets: readonly ColorPreset[] = swatches.map((preset) => ({
  ...preset, pigment: pigmentForPreset(preset.id, preset.hex, preset.category),
}));
export const presetsById = new Map(colorPresets.map((preset) => [preset.id, preset]));

export type ColorCategory =
  | 'red'
  | 'pink'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'white'
  | 'black';

export type ColorPreset = {
  id: string;
  category: ColorCategory;
  nameJa: string;
  nameEn: string;
  hex: `#${string}`;
  pigment: VirtualPigment;
};

/** Relative coefficients on a common 380–750 nm / 10 nm grid, not measured paint data. */
export type VirtualPigment = {
  model: 'kubelka-munk-two-constant';
  source: 'authored-virtual-pigment-v3';
  absorption: readonly number[];
  scattering: readonly number[];
  /** Appearance of one unmixed paint, used to calibrate the on-screen swatch. */
  displayOklab: readonly [number, number, number];
  /** Position on the shared artist's RYB wheel; null for white/black groups, including subtly tinted neutrals. */
  artistHue: number | null;
};

export type DropAmount = 1 | 2 | 3 | 4 | 5;

export type SelectedColor = {
  presetId: string;
  amount: DropAmount;
};

export type NearestColorName = {
  nameJa: string;
  nameEn: string;
  deltaE: number;
};

export type MixResult = {
  hex: `#${string}`;
  oklab: [number, number, number];
  nearestName: NearestColorName;
};

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

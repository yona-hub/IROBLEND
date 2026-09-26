declare module 'spectral.js' {
  export class Color {
    constructor(value: string | number[]);
    readonly R: number[];
    readonly KS: number[];
    readonly OKLab: number[];
    toString(options?: { format?: 'hex' | 'rgb'; method?: 'map' | 'clip' }): string;
  }
}

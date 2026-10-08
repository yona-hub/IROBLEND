import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../app/App';
import manifestData from '../data/generated/reverseRecipes.json';
import type { RecipeManifest } from '../domain/reverseMixing/types';

const availability = vi.hoisted(() => ({ manifest: null as RecipeManifest | null, error: false }));
vi.mock('../hooks/useRecipeManifest', () => ({ useRecipeManifest: () => availability }));
beforeEach(() => { availability.manifest = null; availability.error = false; });

describe('recipe availability', () => {
  it('disables selection during validation and shows only available colors once validation completes', () => {
    const { container, rerender } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'つくり方をさがす' }));
    const sidebar = container.querySelector('.sidebar') as HTMLElement;
    expect(within(sidebar).getByRole('searchbox')).toBeDisabled();
    expect(within(sidebar).getByRole('button', { name: '目標の色グループ: おすすめ' })).toBeDisabled();
    expect(within(sidebar).getByText('配合を確認しています…')).toBeInTheDocument();
    expect(sidebar.querySelectorAll('.nav-row')).toHaveLength(0);
    expect(within(sidebar).queryByText('この名前の色は見つかりませんでした')).not.toBeInTheDocument();

    availability.manifest = manifestData as RecipeManifest;
    rerender(<App />);
    expect(within(sidebar).getByRole('searchbox')).toBeEnabled();
    expect(within(sidebar).getByRole('button', { name: 'ブラウンを目標にする' })).toBeEnabled();
    expect(within(sidebar).queryByText('配合を確認しています…')).not.toBeInTheDocument();
    fireEvent.change(within(sidebar).getByRole('searchbox'), { target: { value: 'black' } });
    expect(within(sidebar).queryByRole('button', { name: 'ブラックを目標にする' })).not.toBeInTheDocument();
  });

  it('keeps selection unavailable after validation fails and preserves the free mixing mode', () => {
    availability.error = true;
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'つくり方をさがす' }));
    const sidebar = container.querySelector('.sidebar') as HTMLElement;
    expect(within(sidebar).getByRole('searchbox')).toBeDisabled();
    expect(sidebar.querySelectorAll('.nav-row')).toHaveLength(0);
    expect(within(sidebar).getByText('配合データを確認できませんでした。')).toBeInTheDocument();
    expect(screen.getByText('配合データを確認できませんでした。自由にまぜるモードは使えます。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '自由にまぜる' }));
    expect(within(sidebar).getByRole('button', { name: '赤の色を見る' })).toBeEnabled();
  });

  it('also removes recommended colors when their validated recipes are unavailable', () => {
    availability.manifest = structuredClone(manifestData) as RecipeManifest;
    availability.manifest.targets.brown = [];
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'つくり方をさがす' }));
    const sidebar = container.querySelector('.sidebar') as HTMLElement;
    expect(within(sidebar).getByRole('button', { name: '目標の色グループ: おすすめ' })).toBeInTheDocument();
    expect(within(sidebar).queryByRole('button', { name: 'ブラウンを目標にする' })).not.toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: 'ベージュを目標にする' })).toBeEnabled();
  });
});

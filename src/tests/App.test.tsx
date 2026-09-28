import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../app/App';
import { presetsById } from '../data/colorPresets';
import { mixPigments } from '../domain/colorMixing/mixPigments';

function selectTwoColors(container: HTMLElement) {
  const sidebar = container.querySelector('.sidebar') as HTMLElement;
  fireEvent.click(within(sidebar).getByRole('button', { name: '青の色を見る' }));
  fireEvent.click(within(sidebar).getByRole('button', { name: 'スカイブルーを追加' }));
  fireEvent.click(within(sidebar).getByRole('button', { name: '色のグループに戻る' }));
  fireEvent.click(within(sidebar).getByRole('button', { name: '赤の色を見る' }));
  fireEvent.click(within(sidebar).getByRole('button', { name: 'スカーレットを追加' }));
}

describe('IROBLEND interface', () => {
  it('selects colors, mixes, and waits for a deliberate remix after changing eyedroppers', () => {
    vi.useFakeTimers();
    const { container } = render(<App />);
    expect(screen.getByRole('button', { name: 'まぜる！' })).toBeDisabled();
    selectTwoColors(container);
    expect(screen.getByRole('button', { name: 'まぜる！' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'まぜる！' }));
    expect(screen.getByRole('button', { name: 'まぜています…' })).toBeDisabled();
    expect(screen.queryByText(/に近い色/)).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(840));
    const previousName = screen.getByText(/に近い色/).textContent;
    const previousSurface = container.querySelector('.result-surface');
    const scarletAmount = screen.getByRole('group', { name: 'スカーレットの色の量を選ぶ' });
    expect(within(scarletAmount).getAllByRole('button')).toHaveLength(5);
    expect(scarletAmount.querySelectorAll('.eyedropper-icon__paint')).toHaveLength(3);
    fireEvent.click(within(scarletAmount).getByRole('button', { name: 'スカーレットの量をスポイト2本分にする' }));
    expect(scarletAmount.querySelectorAll('.eyedropper-icon__paint')).toHaveLength(2);
    expect(within(scarletAmount).getByRole('button', { name: 'スカーレットの量をスポイト2本分にする' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'もういちど まぜる！' })).toBeEnabled();
    expect(container.querySelector('.result-surface')).toBe(previousSurface);
    expect(screen.getByRole('img', { name: /前にまぜた色/ })).toBeInTheDocument();
    expect(screen.getByText(previousName ?? '')).toBeInTheDocument();
    expect(screen.getByText('前にまぜた色')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'この色を保存する' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'もういちど まぜる！' }));
    expect(container.querySelector('.result-surface')).toBeNull();
    act(() => vi.advanceTimersByTime(840));
    expect(screen.getByText(/に近い色/)).toBeInTheDocument();
  });

  it('opens and closes the color drawer with keyboard focus restored', () => {
    render(<App />);
    const menu = screen.getByRole('button', { name: '色をえらぶメニューを開く' });
    fireEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    const dialog = screen.getByRole('dialog', { name: '色をえらぶ' });
    expect(dialog).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(within(dialog).getByRole('button', { name: 'えらんだ色を見る' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveFocus();
  });

  it('returns to the canvas after selecting a color from the mobile drawer', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '色をえらぶメニューを開く' }));
    const dialog = screen.getByRole('dialog', { name: '色をえらぶ' });
    fireEvent.click(within(dialog).getByRole('button', { name: '赤の色を見る' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'レッドを追加' }));
    expect(screen.getByRole('button', { name: '色をえらぶメニューを開く' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /色をたす/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '1色を載せたキャンバス' })).toBeInTheDocument();
  });

  it('passes the latest white eyedropper amount to the model and repaints after remixing', () => {
    vi.useFakeTimers();
    const { container } = render(<App />);
    const sidebar = container.querySelector('.sidebar') as HTMLElement;
    for (const [category, name] of [['赤', 'レッド'], ['青', 'ブルー'], ['白', 'ホワイト']]) {
      fireEvent.click(within(sidebar).getByRole('button', { name: `${category}の色を見る` }));
      fireEvent.click(within(sidebar).getByRole('button', { name: `${name}を追加` }));
      fireEvent.click(within(sidebar).getByRole('button', { name: '色のグループに戻る' }));
    }
    const expected = (amount: number) => mixPigments(['red', 'blue', 'white'].map((id) => ({
      pigment: presetsById.get(id)!.pigment, amount: id === 'white' ? amount : 3,
    })));
    const whiteAmount = screen.getByRole('group', { name: 'ホワイトの色の量を選ぶ' });
    fireEvent.click(within(whiteAmount).getByRole('button', { name: 'ホワイトの量をスポイト1本分にする' }));
    expect(whiteAmount.querySelectorAll('.eyedropper-icon__paint')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'まぜる！' }));
    act(() => vi.advanceTimersByTime(840));
    expect(container.querySelector('.result-surface')).toHaveStyle({ backgroundColor: expected(1).hex });
    fireEvent.click(within(whiteAmount).getByRole('button', { name: 'ホワイトの量をスポイト5本分にする' }));
    expect(whiteAmount.querySelectorAll('.eyedropper-icon__paint')).toHaveLength(5);
    expect(container.querySelector('.result-surface')).toHaveStyle({ backgroundColor: expected(1).hex });
    fireEvent.click(screen.getByRole('button', { name: 'もういちど まぜる！' }));
    act(() => vi.advanceTimersByTime(839));
    expect(container.querySelector('.result-surface')).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector('.result-surface')).toHaveStyle({ backgroundColor: expected(5).hex });
    expect(expected(5).oklab[0] - expected(1).oklab[0]).toBeGreaterThan(.08);
  });

  it('shortens the wait when reduced motion is requested', () => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const { container } = render(<App />);
    selectTwoColors(container);
    fireEvent.click(screen.getByRole('button', { name: 'まぜる！' }));
    act(() => vi.advanceTimersByTime(129));
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('.reduced-mix-surface')).not.toBeNull();
    expect(screen.queryByText(/に近い色/)).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText(/に近い色/)).toBeInTheDocument();
  });

  it('clears selected colors and keeps saved blends available to restore', () => {
    vi.useFakeTimers();
    const { container } = render(<App />);
    const actions = container.querySelector('.stage-actions') as HTMLElement;
    expect(within(actions).getByRole('button', { name: /さいしょから/ })).toBeDisabled();
    selectTwoColors(container);
    expect(within(actions).getByRole('button', { name: /さいしょから/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'まぜる！' }));
    act(() => vi.advanceTimersByTime(840));
    fireEvent.click(screen.getByRole('button', { name: 'この色を保存する' }));
    expect(screen.getByRole('heading', { name: /保存した色 1/ })).toBeInTheDocument();
    expect(screen.queryByText(/スカーレット 3本/)).not.toBeInTheDocument();
    fireEvent.click(within(actions).getByRole('button', { name: /さいしょから/ }));
    expect(screen.getByRole('button', { name: 'まぜる！' })).toBeDisabled();
    expect(within(actions).getByRole('button', { name: /さいしょから/ })).toBeDisabled();
    expect(container.querySelector('.result-surface')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /の配合を呼び出す/ }));
    expect(screen.getByRole('button', { name: 'もういちど まぜる' })).toBeEnabled();
    expect(container.querySelector('.result-surface')).not.toBeNull();
  });
});

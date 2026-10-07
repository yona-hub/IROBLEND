import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../app/App';
import { presetsById } from '../data/colorPresets';
import { mixPigments } from '../domain/colorMixing/mixPigments';
import { persistSavedMixes, type SavedMix } from '../domain/savedMixes';
import * as paintDrawing from '../components/paintMarks';

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
    expect(container.querySelector('.mix-button__logo')).toHaveClass('mix-button__logo--spinning');
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
    const { container } = render(<App />);
    const menu = container.querySelector('.selection-choose') as HTMLButtonElement;
    expect(container.querySelector('.menu-button')).toBeNull();
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
    const { container } = render(<App />);
    fireEvent.click(container.querySelector('.selection-choose')!);
    const dialog = screen.getByRole('dialog', { name: '色をえらぶ' });
    fireEvent.click(within(dialog).getByRole('button', { name: '赤の色を見る' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'レッドを追加' }));
    const add = container.querySelector('.selection-choose');
    expect(add).toHaveAttribute('aria-expanded', 'false');
    expect(add).toHaveTextContent('色をたす');
    expect(add).toHaveFocus();
    expect(screen.getByRole('button', { name: 'まぜる！' })).toBeDisabled();
    expect(screen.getByRole('img', { name: '1色を載せたキャンバス' })).toBeInTheDocument();
  });

  it('hides color addition at five colors and returns focus to the selected tab', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.selection-choose')).toHaveTextContent('色をえらぶ');
    const names = ['レッド', 'スカーレット', 'バーミリオン', 'クリムゾン', 'カーマイン'];
    for (let i = 0; i < names.length; i++) {
      fireEvent.click(container.querySelector('.selection-choose')!);
      const dialog = screen.getByRole('dialog', { name: '色をえらぶ' });
      if (i === 0) fireEvent.click(within(dialog).getByRole('button', { name: '赤の色を見る' }));
      fireEvent.click(within(dialog).getByRole('button', { name: `${names[i]}を追加` }));
    }
    expect(container.querySelector('.selection-choose')).toBeNull();
    expect(screen.getByRole('tab', { name: 'えらんだ色 5 / 5' })).toHaveFocus();
    expect(screen.getByRole('img', { name: '5色を載せたキャンバス' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'レッドを削除' }));
    expect(container.querySelector('.selection-choose')).toHaveTextContent('色をたす');
  });

  it.each([
    { label: 'phone', viewportWidth: 390, viewportHeight: 844, width: 360, initialHeight: 180, resizedHeight: 260, unit: 360 },
    { label: 'tablet portrait', viewportWidth: 768, viewportHeight: 1024, width: 560, initialHeight: 220, resizedHeight: 307.2, unit: 560 / 1.45 },
    { label: 'tablet landscape', viewportWidth: 1024, viewportHeight: 768, width: 500, initialHeight: 220, resizedHeight: 260, unit: 500 / 1.55 },
    { label: 'large tablet portrait', viewportWidth: 1032, viewportHeight: 1376, width: 949.44, initialHeight: 522.88, resizedHeight: 440, unit: 949.44 / 1.45 },
  ])('preserves paint size and amount changes on measured $label canvases', ({ viewportWidth, viewportHeight, width, initialHeight, resizedHeight, unit }) => {
    const previousWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth')!;
    const previousHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight')!;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: viewportWidth });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: viewportHeight });
    let height = initialHeight;
    const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      width, height, x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, toJSON: () => ({}),
    }));
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue({ setTransform: vi.fn() } as unknown as CanvasRenderingContext2D);
    const drawing = vi.spyOn(paintDrawing, 'drawPaintMarks').mockImplementation(() => {});
    const { container, unmount } = render(<App />);
    try {
      expect(screen.queryByRole('button', { name: '色をえらぶメニューを開く' })).not.toBeInTheDocument();
      expect(container.querySelectorAll('.choose-button')).toHaveLength(1);
      selectTwoColors(container);
      const before = drawing.mock.calls.at(-1)!;
      expect(before[1]).toBe(width);
      expect(before[2]).toBe(initialHeight);
      expect(before[6]).toBeCloseTo(unit);
      const marks = before[3];
      fireEvent.click(screen.getByRole('button', { name: 'スカーレットの量をスポイト1本分にする' }));
      const changed = drawing.mock.calls.at(-1)!;
      expect(changed[3]).toBe(marks);
      expect(changed[4].find(color => color.preset.id === 'scarlet')?.amount).toBe(1);
      expect(changed[5]).toBeUndefined();
      height = resizedHeight;
      fireEvent(window, new Event('resize'));
      const resized = drawing.mock.calls.at(-1)!;
      expect(resized[2]).toBe(resizedHeight);
      expect(resized[6]).toBeCloseTo(unit);
      expect(resized[3]).not.toBe(marks);
      expect(resized[3].map(mark => mark.seed)).toEqual(marks.map(mark => mark.seed));
    } finally {
      unmount();
      drawing.mockRestore();
      bounds.mockRestore();
      Object.defineProperty(window, 'innerWidth', previousWidth);
      Object.defineProperty(window, 'innerHeight', previousHeight);
    }
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
    expect(container.querySelector('.mix-button__logo')).not.toHaveClass('mix-button__logo--spinning');
    expect(screen.queryByText(/に近い色/)).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText(/に近い色/)).toBeInTheDocument();
  });

  it('moves the mobile canvas into view before mixing only when less than half is visible', () => {
    vi.useFakeTimers();
    const matchMedia = window.matchMedia;
    const scrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 599px)', media: query,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }));
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 700 });
    try {
      const { container } = render(<App />);
      selectTwoColors(container);
      const canvas = container.querySelector('.mix-canvas') as HTMLElement;
      const actions = container.querySelector('.stage-actions') as HTMLElement;
      let canvasTop = -100;
      vi.spyOn(canvas, 'getBoundingClientRect').mockImplementation(() => ({
        top: canvasTop, bottom: canvasTop + 200, height: 200,
      }) as DOMRect);
      vi.spyOn(actions, 'getBoundingClientRect').mockReturnValue({ top: 470, bottom: 568 } as DOMRect);

      fireEvent.click(screen.getByRole('button', { name: 'まぜる！' }));
      expect(scrollTo).not.toHaveBeenCalled(); // Exactly 50% remains visible.
      act(() => vi.advanceTimersByTime(840));
      const amount = screen.getByRole('group', { name: 'スカーレットの色の量を選ぶ' });
      fireEvent.click(within(amount).getByRole('button', { name: 'スカーレットの量をスポイト2本分にする' }));
      canvasTop = -120;
      fireEvent.click(screen.getByRole('button', { name: 'もういちど まぜる！' }));
      expect(scrollTo).toHaveBeenCalledWith({ top: 445, behavior: 'instant' });
      expect(screen.getByRole('button', { name: 'まぜています…' })).toBeDisabled();
    } finally {
      window.matchMedia = matchMedia;
      if (scrollY) Object.defineProperty(window, 'scrollY', scrollY);
      scrollTo.mockRestore();
    }
  });

  it('clears selected colors and keeps saved blends available to restore', () => {
    vi.useFakeTimers();
    const { container } = render(<App />);
    const actions = container.querySelector('.stage-actions') as HTMLElement;
    expect(within(actions).getByRole('button', { name: /色をけす/ })).toBeDisabled();
    selectTwoColors(container);
    expect(within(actions).getByRole('button', { name: /色をけす/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'まぜる！' }));
    act(() => vi.advanceTimersByTime(840));
    fireEvent.click(screen.getByRole('button', { name: 'この色を保存する' }));
    expect(screen.getByRole('tab', { name: '保存した色 1' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByText(/スカーレット 3本/)).not.toBeInTheDocument();
    fireEvent.click(within(actions).getByRole('button', { name: /色をけす/ }));
    expect(screen.getByRole('button', { name: 'まぜる！' })).toBeDisabled();
    expect(within(actions).getByRole('button', { name: /色をけす/ })).toBeDisabled();
    expect(container.querySelector('.result-surface')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: '保存した色 1' }));
    expect(screen.getByRole('tab', { name: '保存した色 1' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: /の配合を呼び出す/ }));
    expect(screen.getByRole('tab', { name: 'えらんだ色 2 / 5' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'もういちど まぜる' })).toBeEnabled();
    expect(container.querySelector('.result-surface')).not.toBeNull();
  });

  it('shows ten saved colors per page and keeps the logo with the title', () => {
    const selections: SavedMix['selections'] = [{ presetId: 'red', amount: 3 }, { presetId: 'blue', amount: 2 }];
    const result = mixPigments(selections.map(({ presetId, amount }) => ({
      pigment: presetsById.get(presetId)!.pigment, amount,
    })));
    persistSavedMixes(Array.from({ length: 12 }, (_, i): SavedMix => ({
      id: `saved-${i}`, savedAt: `2026-09-${String(i + 1).padStart(2, '0')}T12:00:00.000Z`,
      selections, result,
    })));
    const { container } = render(<App />);
    expect(container.querySelector('.hero-copy__title img')).toBeInTheDocument();
    expect(container.querySelector('.app-header img')).toBeNull();
    expect(container.querySelector('.nav-heading img')).toBeNull();
    const savedTab = screen.getByRole('tab', { name: '保存した色 12' });
    fireEvent.click(savedTab);
    expect(screen.getAllByRole('button', { name: /の配合を呼び出す/ })).toHaveLength(10);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '次へ' }));
    expect(screen.getAllByRole('button', { name: /の配合を呼び出す/ })).toHaveLength(2);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    fireEvent.keyDown(savedTab, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'えらんだ色 0 / 5' })).toHaveAttribute('aria-selected', 'true');
  });
});

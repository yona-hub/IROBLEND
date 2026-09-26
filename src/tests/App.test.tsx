import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../app/App';

function selectTwoColors(container: HTMLElement) {
  const sidebar = container.querySelector('.sidebar') as HTMLElement;
  fireEvent.click(within(sidebar).getByRole('button', { name: '青の色を見る' }));
  fireEvent.click(within(sidebar).getByRole('button', { name: 'スカイブルーを追加' }));
  fireEvent.click(within(sidebar).getByRole('button', { name: '基本の色へ' }));
  fireEvent.click(within(sidebar).getByRole('button', { name: '赤の色を見る' }));
  fireEvent.click(within(sidebar).getByRole('button', { name: 'スカーレットを追加' }));
}

describe('IROBLEND interface', () => {
  it('selects colors, mixes, and waits for a deliberate remix after a drop change', () => {
    vi.useFakeTimers();
    const { container } = render(<App />);
    expect(screen.getByRole('button', { name: 'まぜる！' })).toBeDisabled();
    selectTwoColors(container);
    expect(screen.getByRole('button', { name: 'まぜる！' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'まぜる！' }));
    expect(screen.getByRole('button', { name: 'まぜています…' })).toBeDisabled();
    expect(screen.queryByText(/に近い色/)).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(700));
    const previousName = screen.getByText(/に近い色/).textContent;
    fireEvent.click(screen.getByRole('button', { name: 'スカーレットを1滴減らす' }));
    expect(screen.getByRole('button', { name: 'もういちど まぜる！' })).toBeEnabled();
    expect(screen.getByText(/に近い色/)).toHaveTextContent(previousName ?? '');
    fireEvent.click(screen.getByRole('button', { name: 'もういちど まぜる！' }));
    act(() => vi.advanceTimersByTime(700));
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
    expect(screen.queryByText(/に近い色/)).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText(/に近い色/)).toBeInTheDocument();
  });
});

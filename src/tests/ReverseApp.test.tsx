import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import App from '../app/App';
import manifestData from '../data/generated/reverseRecipes.json';
import { presetsById } from '../data/colorPresets';
import { mixPigments } from '../domain/colorMixing/mixPigments';
import { targetCatalog, targetGroups } from '../data/targetCatalog';
import type { RecipeManifest } from '../domain/reverseMixing/types';
beforeAll(async () => { const moduleName = 'node:crypto'; const { webcrypto } = await import(moduleName); vi.stubGlobal('crypto', webcrypto); });

async function chooseBrown(container: HTMLElement) {
  fireEvent.click(screen.getByRole('button', { name: 'つくり方をさがす' }));
  fireEvent.click(await within(container.querySelector('.sidebar') as HTMLElement).findByRole('button', { name: 'ブラウンを目標にする' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'この配合でためす' })).toBeEnabled());
}
describe('recipe interface', () => {
  it('keeps free and recipe experiments independent and saves the actual mixed result', async () => {
    const { container } = render(<App />);
    const sidebar = container.querySelector('.sidebar') as HTMLElement;
    fireEvent.click(within(sidebar).getByRole('button', { name: '赤の色を見る' }));
    fireEvent.click(within(sidebar).getByRole('button', { name: 'レッドを追加' }));
    fireEvent.click(within(sidebar).getByRole('button', { name: '色のグループに戻る' }));
    fireEvent.click(within(sidebar).getByRole('button', { name: '青の色を見る' }));
    fireEvent.click(within(sidebar).getByRole('button', { name: 'ブルーを追加' }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'まぜる！' }));
    expect(screen.getByRole('button', { name: 'つくり方をさがす' })).toBeDisabled();
    act(() => vi.advanceTimersByTime(840));
    const original = container.querySelector('.result-surface')!.getAttribute('style');
    vi.useRealTimers();
    await chooseBrown(container);
    expect(container.querySelector('.result-surface')).toBeNull();
    expect(localStorage.getItem('iroblend:saved-mixes:v1')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'この配合でためす' }));
    expect(screen.getByRole('button', { name: 'まぜる！' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'この色を保存する' })).not.toBeInTheDocument();
    expect(container.querySelector('.result-surface')).toBeNull();
    const recipe = manifestData.targets.brown[0]!;
    expect(screen.getAllByRole('group', { name: /の色の量を選ぶ/ })).toHaveLength(recipe.selections.length);
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'まぜる！' }));
    expect(screen.getByRole('button', { name: '自由にまぜる' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'ほかのつくり方' })).toBeDisabled();
    act(() => vi.advanceTimersByTime(840));
    expect(container.querySelector('.result-surface')).toHaveStyle({ backgroundColor: recipe.predictedHex });
    fireEvent.click(screen.getByRole('button', { name: 'この色を保存する' }));
    const saved = JSON.parse(localStorage.getItem('iroblend:saved-mixes:v1')!);
    expect(saved.version).toBe(2);
    expect(saved.mixes[0].result.hex).toBe(recipe.predictedHex);
    expect(saved.mixes[0].selections).toEqual(recipe.selections);
    fireEvent.click(screen.getByRole('button', { name: '自由にまぜる' }));
    expect(container.querySelector('.result-surface')!.getAttribute('style')).toBe(original);
    expect(screen.getByRole('tab', { name: '保存した色 1' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'つくり方をさがす' }));
    expect(container.querySelector('.result-surface')).toHaveStyle({ backgroundColor: recipe.predictedHex });
  });
  it('retains the prior color when amount changes and resets only on deliberate recipe reload', async () => {
    const { container } = render(<App />);
    await chooseBrown(container);
    fireEvent.click(screen.getByRole('button', { name: 'この配合でためす' }));
    const recipe = manifestData.targets.brown[0]!;
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'まぜる！' }));
    act(() => vi.advanceTimersByTime(840));
    const first = recipe.selections[0]!, preset = presetsById.get(first.presetId)!;
    const amount = first.amount === 5 ? 4 : 5;
    fireEvent.click(screen.getByRole('button', { name: preset.nameJa + 'の量をスポイト' + amount + '本分にする' }));
    expect(container.querySelector('.result-surface')).toHaveStyle({ backgroundColor: recipe.predictedHex });
    expect(screen.queryByRole('button', { name: 'この色を保存する' })).not.toBeInTheDocument();
    expect(screen.getByText('前にまぜた色', { selector: '.result-copy__stale' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'もういちど まぜる！' }));
    act(() => vi.advanceTimersByTime(840));
    const actual = mixPigments(recipe.selections.map(item => ({ pigment: presetsById.get(item.presetId)!.pigment,
      amount: item.presetId === first.presetId ? amount : item.amount })));
    expect(container.querySelector('.result-surface')).toHaveStyle({ backgroundColor: actual.hex });
    fireEvent.click(screen.getByRole('button', { name: 'この配合にもどす' }));
    expect(container.querySelector('.result-surface')).toBeNull();
    expect(screen.getByRole('button', { name: 'まぜる！' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'ほかのつくり方' }));
    expect(screen.getByRole('button', { name: 'この配合でためす' })).toHaveFocus();
    expect(screen.getAllByRole('button', { name: /かんたん・|別のまぜ方・|さらに近い・/ })).toHaveLength(3);
  });
  it('keeps aliases and hides unavailable colors from Japanese and English search without changing materials', async () => {
    const { container } = render(<App />);
    await chooseBrown(container);
    const sidebar = container.querySelector('.sidebar') as HTMLElement;
    fireEvent.change(within(sidebar).getByRole('searchbox', { name: '色の名前でさがす' }), { target: { value: 'はいいろ' } });
    expect(within(sidebar).getByRole('button', { name: 'グレーを目標にする' })).toBeInTheDocument();
    const unavailable = targetCatalog.filter(target => !(manifestData as RecipeManifest).targets[target.id]!.length);
    expect(unavailable.length).toBeGreaterThan(0);
    for (const target of unavailable) for (const query of [target.nameJa, target.nameEn]) {
      fireEvent.change(within(sidebar).getByRole('searchbox'), { target: { value: query } });
      expect(within(sidebar).queryByRole('button', { name: target.nameJa + 'を目標にする' })).not.toBeInTheDocument();
    }
    fireEvent.change(within(sidebar).getByRole('searchbox'), { target: { value: 'black' } });
    fireEvent.click(screen.getByRole('button', { name: '自由にまぜる' }));
    expect(screen.getByRole('tab', { name: 'えらんだ色 0 / 5' })).toBeInTheDocument();
    fireEvent.click(within(sidebar).getByRole('button', { name: '黒の色を見る' }));
    expect(within(sidebar).getByRole('button', { name: 'ブラックを追加' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'つくり方をさがす' }));
    expect(within(container.querySelector('.sidebar') as HTMLElement).getByRole('searchbox')).toHaveValue('black');
  });
  it('lists only targets with recipes in all groups and the drawer and tries newly available colors', async () => {
    const { container } = render(<App />);
    await chooseBrown(container);
    const sidebar = container.querySelector('.sidebar') as HTMLElement;
    const available = targetCatalog.filter(target => (manifestData as RecipeManifest).targets[target.id]!.length);
    const chooseGroup = (name: string) => {
      fireEvent.click(within(sidebar).getByRole('button', { name: /目標の色グループ:/ }));
      fireEvent.click(within(sidebar).getByRole('option', { name }));
    };
    const listedLabels = () => Array.from(sidebar.querySelectorAll('.target-picker__list .nav-row'), row => row.getAttribute('aria-label'));
    chooseGroup('すべての色');
    expect(listedLabels()).toEqual(available.map(target => target.nameJa + 'を目標にする'));
    for (const group of targetGroups) {
      chooseGroup(group.name);
      expect(listedLabels()).toEqual(available.filter(target => target.targetGroupId === group.id)
        .map(target => target.nameJa + 'を目標にする'));
    }
    expect(within(sidebar).queryByRole('button', { name: 'ブラックを目標にする' })).not.toBeInTheDocument();
    for (const id of ['crimson', 'carmine', 'green', 'white', 'cyan', 'magenta']) {
      const target = targetCatalog.find(item => item.id === id)!;
      fireEvent.change(within(sidebar).getByRole('searchbox'), { target: { value: target.nameEn } });
      fireEvent.click(within(sidebar).getByRole('button', { name: target.nameJa + 'を目標にする' }));
      expect(screen.getByRole('button', { name: 'この配合でためす' })).toBeEnabled();
      expect(container.querySelector('.target-comparison')).toHaveTextContent('少し違う色');
    }
    fireEvent.click(within(sidebar).getByRole('button', { name: '検索語を消す' }));
    fireEvent.click(screen.getByRole('button', { name: 'つくりたい色をえらぶ' }));
    const dialog = screen.getByRole('dialog', { name: 'つくりたい色をえらぶ' });
    expect(dialog.querySelectorAll('.target-picker__list .nav-row')).toHaveLength(available.length);
    expect(within(dialog).queryByRole('button', { name: 'ブラックを目標にする' })).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole('searchbox'), { target: { value: 'ブラック' } });
    expect(within(dialog).queryByRole('button', { name: 'ブラックを目標にする' })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'この配合でためす' }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'まぜる！' }));
    act(() => vi.advanceTimersByTime(840));
    expect(container.querySelector('.result-surface')).toHaveStyle({ backgroundColor: manifestData.targets.magenta[0]!.predictedHex });
  });
  it('searches all groups and operates the color group menu with keyboard and clear controls', async () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'つくり方をさがす' }));
    const sidebar = container.querySelector('.sidebar') as HTMLElement;
    const search = within(sidebar).getByRole('searchbox', { name: '色の名前でさがす' });
    await waitFor(() => expect(search).toBeEnabled());
    const group = within(sidebar).getByRole('button', { name: '目標の色グループ: おすすめ' });
    fireEvent.keyDown(group, { key: 'ArrowDown' });
    const options = within(sidebar).getAllByRole('option');
    expect(options).toHaveLength(13);
    fireEvent.keyDown(options[0]!, { key: 'End' });
    expect(options[12]).toHaveFocus();
    fireEvent.keyDown(options[12]!, { key: 'Escape' });
    expect(group).toHaveFocus();
    expect(group).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(group);
    fireEvent.pointerDown(document.body);
    expect(group).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(group);
    const orangeOption = within(sidebar).getByRole('option', { name: 'オレンジ' });
    fireEvent.pointerDown(orangeOption, { pointerType: 'touch' });
    fireEvent.click(orangeOption);
    expect(within(sidebar).getByRole('button', { name: '目標の色グループ: オレンジ' })).toHaveFocus();
    fireEvent.change(search, { target: { value: 'はいいろ' } });
    expect(within(sidebar).getByRole('button', { name: 'グレーを目標にする' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: '目標の色グループ: すべての色' })).toBeInTheDocument();
    fireEvent.click(within(sidebar).getByRole('button', { name: '検索語を消す' }));
    expect(search).toHaveValue('');
    fireEvent.click(within(sidebar).getByRole('button', { name: '目標の色グループ: すべての色' }));
    fireEvent.keyDown(within(sidebar).getByRole('option', { name: 'すべての色' }), { key: 'ArrowDown' });
    fireEvent.keyDown(within(sidebar).getByRole('option', { name: '赤' }), { key: 'Enter' });
    expect(search).toHaveValue('');
    expect(within(sidebar).queryByRole('button', { name: 'オレンジを目標にする' })).not.toBeInTheDocument();
  });
  it('opens the target drawer without focusing search and restores the actual trigger', async () => {
    const { container } = render(<App />);
    await chooseBrown(container);
    const trigger = screen.getByRole('button', { name: 'つくりたい色をえらぶ' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'つくりたい色をえらぶ' });
    expect(within(dialog).getByRole('button', { name: '色のメニューを閉じる' })).toHaveFocus();
    expect(within(dialog).getByRole('searchbox')).not.toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveFocus();
  });
});

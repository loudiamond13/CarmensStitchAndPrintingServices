import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { expectNoAxeViolations } from '@/test/axe';
import { scenarios } from './media';

// The media showcase cases (plan 09-08, Task 3): the new photo list with demo data. Every case is parity false, because
// the photo list changed by owner rulings D-25, D-13 and D-14 (Phase 9), and the frozen App. D.3 uploader is no longer the
// look to match. They still run axe and the CSP listener in the showcase.

const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));

function renderCase(id: string) {
  const scenario = byId.get(id);
  if (scenario === undefined) {
    throw new Error(`No media scenario "${id}".`);
  }
  return render(renderNode(kit, scenario.node, scenario.handlers ?? []));
}

function tiles(): HTMLElement[] {
  return within(screen.getByRole('list', { name: 'Order photos' })).getAllByRole('listitem');
}

function tile(n: number): HTMLElement {
  const item = tiles()[n - 1];
  if (item === undefined) {
    throw new Error(`No tile ${String(n)}.`);
  }
  return item;
}

describe('the media scenarios', () => {
  it('lists the five photo list cases, in both themes, all in the media group', () => {
    expect(scenarios.map((scenario) => [scenario.id, scenario.themes.join('+')])).toEqual([
      ['uploader-empty', 'light+dark'],
      ['uploader-with-images', 'light+dark'],
      ['uploader-readonly', 'light+dark'],
      ['uploader-draft', 'light+dark'],
      ['uploader-limit', 'light+dark'],
    ]);
    expect(scenarios.every((scenario) => scenario.group === 'media')).toBe(true);
  });

  it('is parity false for every case (owner rulings D-25, D-13, D-14)', () => {
    expect(scenarios.every((scenario) => !scenario.parity)).toBe(true);
  });

  it('keeps the case id the sweep lists and the D-05 browser check find', () => {
    expect(byId.has('uploader-with-images')).toBe(true);
    expect(byId.get('uploader-with-images')?.passes).toEqual(['touch']);
  });

  it('shows an empty live card as the add area alone, with 0/5', () => {
    renderCase('uploader-empty');
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getAllByText('JPG, PNG, WEBP or HEIC · up to 10 MB each · 0/5')).toHaveLength(2);
  });

  it('shows three photos with the cover first, its tag, and every control visible (UIC-24)', () => {
    renderCase('uploader-with-images');
    expect(tiles()).toHaveLength(3);
    expect(within(tile(1)).getByText('Cover')).toBeDefined();
    expect(within(tile(2)).getByRole('button', { name: 'Make cover, photo 2' })).toBeDefined();
    for (const n of [1, 2, 3]) {
      for (const name of [
        `Move photo ${String(n)} left`,
        `Move photo ${String(n)} right`,
        `Edit description of photo ${String(n)}`,
        `Delete photo ${String(n)}`,
      ]) {
        expect(within(tile(n)).getByRole('button', { name })).toBeDefined();
      }
    }
  });

  it('shows the read-only list with row 1 only and no add area', () => {
    renderCase('uploader-readonly');
    expect(tiles()).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'browse' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Move photo/ })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('shows a draft photo with a waiting file and a failed file', () => {
    renderCase('uploader-draft');
    expect(tiles()).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Remove photo 1' })).toBeDefined();
    expect(screen.getByText('Waiting to upload')).toBeDefined();
    expect(screen.getByText(/^Didn't upload\./)).toBeDefined();
    expect(screen.getByRole('button', { name: /^Try again, / })).toBeDefined();
  });

  it('shows the limit note in place of the add area at 5 photos', () => {
    renderCase('uploader-limit');
    expect(tiles()).toHaveLength(5);
    expect(screen.getByText('This order has 5 photos, the most it can have. Delete one to add another.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'browse' })).toBeNull();
  });

  it('has no axe violations in any case', async () => {
    for (const scenario of scenarios) {
      const { container, unmount } = renderCase(scenario.id);
      await expectNoAxeViolations(container);
      unmount();
    }
  });
});

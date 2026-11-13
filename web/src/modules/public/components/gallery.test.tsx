// The Gallery parts (UI-SPEC G1, App. E.3; GAL-01, D-03, D-30, D-31, D-32): the filter bar and the masonry.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { demoGallery, galleryPhoto, makeGalleryItem } from '@/test/publicFixtures';
import { GalleryFilterBar } from './GalleryFilterBar';
import { GalleryMasonry } from './GalleryMasonry';

/** A photo tile's --ratio, or a drawn tile's sizer viewBox read as "W / H". */
function ratioOf(tile: HTMLElement): string {
  const holder = [...tile.querySelectorAll<HTMLElement>('*')].find(
    (element) => element.style.getPropertyValue('--ratio') !== '',
  );
  if (holder !== undefined) {
    return holder.style.getPropertyValue('--ratio');
  }
  const box = tile.querySelector('[data-tile-sizer]')?.getAttribute('viewBox') ?? '';
  return box.replace(/^0 0 (\S+) (\S+)$/, '$1 / $2');
}

function tileFor(team: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^Open ${team.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `) });
}

describe('GalleryMasonry (GAL-01, D-30, D-31)', () => {
  it('shows one button per item, named "Open {team}, {short}", in gallery order', () => {
    render(<GalleryMasonry items={demoGallery.items} shown={24} />);

    const tiles = screen.getAllByRole('button');
    expect(tiles).toHaveLength(16);
    expect(tiles[0]).toHaveAccessibleName('Open Brgy. Sample Ballers, Basketball');
    expect(tiles[4]).toHaveAccessibleName('Open Sample City Spikers, Volleyball');
    expect(tiles[15]).toHaveAccessibleName('Open Barkada Custom Two, Custom');
  });

  it('shows only the first `shown` tiles', () => {
    render(<GalleryMasonry items={demoGallery.items} shown={5} />);

    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it("gives each tile the photo's own ratio, clamped between 3 / 4 and 4 / 3, and 4 / 5 when the size is unknown", () => {
    render(<GalleryMasonry items={demoGallery.items} shown={24} />);

    expect(ratioOf(tileFor('Brgy. Sample Ballers'))).toBe('800 / 1000');
    expect(ratioOf(tileFor('Sample City Hoops'))).toBe('900 / 900');
    expect(ratioOf(tileFor('Poblacion Fastbreak'))).toBe('1200 / 900');
    expect(ratioOf(tileFor('Riverside Rim Rockers'))).toBe('4 / 3');
    expect(ratioOf(tileFor('Sample City Spikers'))).toBe('3 / 4');
    expect(ratioOf(tileFor('Beach Dig Squad'))).toBe('4 / 5');
  });

  it('draws the cover photo as a decorative lazy image with the server srcset', () => {
    render(<GalleryMasonry items={demoGallery.items} shown={24} />);

    const image = tileFor('Brgy. Sample Ballers').querySelector('img');
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('srcset', expect.stringContaining('280w'));
    expect(image).toHaveAttribute(
      'sizes',
      '(max-width: 767px) calc(50vw - 22px), (max-width: 1279px) calc(33.3333vw - 27px), min(276px, calc(25vw - 28px))',
    );
  });

  it('writes the caption as the team over "{short} · {17} pcs", leaving the pieces out when unknown', () => {
    render(<GalleryMasonry items={demoGallery.items} shown={24} />);

    expect(within(tileFor('Brgy. Sample Ballers')).getByText('Brgy. Sample Ballers')).toBeInTheDocument();
    expect(within(tileFor('Brgy. Sample Ballers')).getByText('Basketball · 10 pcs')).toBeInTheDocument();
    expect(within(tileFor('Net Ninjas')).getByText('Volleyball · 1 pc')).toBeInTheDocument();
    expect(within(tileFor('Beach Dig Squad')).getByText('Volleyball')).toBeInTheDocument();
  });

  it('puts the caption on a solid band that grows with long team names, which wrap and are never cut off', () => {
    const long = 'Barangay San Roque Interbarangay Basketball League Champions of the Whole Province';
    render(<GalleryMasonry items={[makeGalleryItem({ team: long, lineKey: 'basketball' })]} shown={24} />);

    const band = within(tileFor(long)).getByText(long).parentElement;
    expect(band).toHaveAttribute('data-gallery-caption', '');
    expect(band?.className).toMatch(/bg-/);
    expect(within(tileFor(long)).getByText(long).className).toContain('wrap-anywhere');
  });

  it('draws the jersey in the line art when an item has no photo, or no photo address', () => {
    const bare = makeGalleryItem({ team: 'No Photo FC', lineKey: 'moto', photos: [] });
    const blank = makeGalleryItem({
      team: 'Blank Address FC',
      lineKey: 'polo',
      photos: [{ ...galleryPhoto('blank'), src: '', srcSet: '' }],
    });
    render(<GalleryMasonry items={[bare, blank]} shown={24} />);

    for (const team of ['No Photo FC', 'Blank Address FC']) {
      const tile = tileFor(team);
      expect(tile.querySelector('svg')).toBeInTheDocument();
      expect(tile.querySelector('img')).toBeNull();
    }
  });

  it('sizes a drawn tile with a hidden sizer and no style attribute, 4 / 5 when the size is unknown', () => {
    const bare = makeGalleryItem({ team: 'No Photo FC', lineKey: 'moto', photos: [] });
    const { container } = render(<GalleryMasonry items={[bare]} shown={24} />);

    const sizer = tileFor('No Photo FC').querySelector('[data-tile-sizer]');
    expect(sizer).toHaveAttribute('aria-hidden', 'true');
    expect(sizer).toHaveAttribute('viewBox', '0 0 4 5');
    expect(container.querySelector('[style]')).toBeNull();
  });

  it("gives a drawn tile from a blank photo address the photo's ratio, clamped between 3 / 4 and 4 / 3", () => {
    const blank = (team: string, width: number, height: number) =>
      makeGalleryItem({
        id: `blank-${team}`,
        team,
        lineKey: 'polo',
        photos: [{ ...galleryPhoto(team, width, height), src: '', srcSet: '' }],
      });
    render(
      <GalleryMasonry
        items={[blank('Wide FC', 1200, 900), blank('Panorama FC', 2000, 1000), blank('Tall FC', 300, 1000)]}
        shown={24}
      />,
    );

    expect(tileFor('Wide FC').querySelector('[data-tile-sizer]')).toHaveAttribute('viewBox', '0 0 1200 900');
    expect(tileFor('Panorama FC').querySelector('[data-tile-sizer]')).toHaveAttribute('viewBox', '0 0 4 3');
    expect(tileFor('Tall FC').querySelector('[data-tile-sizer]')).toHaveAttribute('viewBox', '0 0 3 4');
  });

  it('tells the page which item was pressed', async () => {
    const onOpen = vi.fn();
    render(<GalleryMasonry items={demoGallery.items} shown={24} onOpen={onOpen} />);

    await userEvent.click(tileFor('Beach Dig Squad'));

    expect(onOpen).toHaveBeenCalledExactlyOnceWith(5);
  });

  it('sets only custom properties inline (the ratio and the skeleton size), never a plain style', () => {
    const { container } = render(<GalleryMasonry items={demoGallery.items} shown={24} />);

    const styled = container.querySelectorAll<HTMLElement>('[style]');
    expect(styled.length).toBeGreaterThan(0);
    for (const element of styled) {
      for (const name of Array.from(element.style)) {
        expect(name.startsWith('--')).toBe(true);
      }
    }
  });

  it('has no axe violations', async () => {
    const { container } = render(<GalleryMasonry items={demoGallery.items} shown={24} />);

    await expectNoAxeViolations(container);
  });
});

describe('GalleryFilterBar (GAL-01, D-03, D-32)', () => {
  const total = 16;

  it('is a toolbar named "Filter by category" with All first, then one pill per line with its count', () => {
    render(<GalleryFilterBar pills={demoGallery.pills} total={total} selected={null} onSelect={vi.fn()} />);

    const toolbar = screen.getByRole('toolbar', { name: 'Filter by category' });
    const names = within(toolbar)
      .getAllByRole('button')
      .map((pill) => pill.textContent);
    expect(names).toEqual([
      'All 16 items',
      'Basketball 4 items',
      'Volleyball 3 items',
      'Moto 3 items',
      'Long Sleeves 2 items',
      'Polo 2 items',
      'Custom 2 items',
    ]);
  });

  it('shows the count visibly without the hidden " items"', () => {
    render(<GalleryFilterBar pills={demoGallery.pills} total={total} selected={null} onSelect={vi.fn()} />);

    const pill = screen.getByRole('button', { name: 'Basketball 4 items' });
    expect(within(pill).getByText('4')).toBeVisible();
    expect(within(pill).getByText('items')).toHaveClass('h-px', 'w-px');
  });

  it('marks the selected pill pressed, and All when nothing is selected', () => {
    const { rerender } = render(
      <GalleryFilterBar pills={demoGallery.pills} total={total} selected={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'All 16 items' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Moto 3 items' })).toHaveAttribute('aria-pressed', 'false');

    rerender(<GalleryFilterBar pills={demoGallery.pills} total={total} selected="moto" onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'All 16 items' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Moto 3 items' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('makes every pill 44px tall and the selected one maroon', () => {
    render(<GalleryFilterBar pills={demoGallery.pills} total={total} selected="moto" onSelect={vi.fn()} />);

    for (const pill of within(screen.getByRole('toolbar')).getAllByRole('button')) {
      expect(pill).toHaveClass('min-h-11');
      // The hidden " items" is absolutely placed: the pill holds it, so it never widens the scrolling bar or the page.
      expect(pill).toHaveClass('relative');
    }
    expect(screen.getByRole('button', { name: 'Moto 3 items' })).toHaveClass('bg-primary');
    expect(screen.getByRole('button', { name: 'Polo 2 items' })).not.toHaveClass('bg-primary');
  });

  it('reports the chosen line key, and null for All', async () => {
    const onSelect = vi.fn();
    render(<GalleryFilterBar pills={demoGallery.pills} total={total} selected="moto" onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: 'Volleyball 3 items' }));
    await userEvent.click(screen.getByRole('button', { name: 'All 16 items' }));

    expect(onSelect.mock.calls).toEqual([['volleyball'], [null]]);
  });

  it('leaves out a pill whose key could not be a safe address', () => {
    const pills = [...demoGallery.pills, { key: 'bad key/../x', shortName: 'Bad', count: 1 }];
    render(<GalleryFilterBar pills={pills} total={total} selected={null} onSelect={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /^Bad/ })).toBeNull();
  });

  it('shows no bar at all when there are no pills', () => {
    render(<GalleryFilterBar pills={[]} total={0} selected={null} onSelect={vi.fn()} />);

    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <GalleryFilterBar pills={demoGallery.pills} total={total} selected="moto" onSelect={vi.fn()} />,
    );

    await expectNoAxeViolations(container);
  });
});

describe('GalleryFilterBar keyboard (UI-SPEC G1 item 2; roving focus)', () => {
  const total = 16;

  /** The bar between two plain buttons, so a Tab can enter and leave it. */
  function renderBar(selected: string | null = null, onSelect = vi.fn()) {
    const view = render(
      <>
        <button type="button">Before</button>
        <GalleryFilterBar pills={demoGallery.pills} total={total} selected={selected} onSelect={onSelect} />
        <button type="button">After</button>
      </>,
    );
    return { ...view, onSelect };
  }

  const pill = (name: string) => screen.getByRole('button', { name });

  it('has one tab stop: Tab enters on the selected pill and the next Tab leaves the bar', async () => {
    renderBar('moto');
    const user = userEvent.setup();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
    await user.tab();
    expect(pill('Moto 3 items')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('makes only the selected pill tabbable, and All when nothing is selected', () => {
    const { unmount } = renderBar(null);
    expect(pill('All 16 items')).toHaveAttribute('tabindex', '0');
    expect(pill('Basketball 4 items')).toHaveAttribute('tabindex', '-1');
    unmount();

    renderBar('polo');
    expect(pill('All 16 items')).toHaveAttribute('tabindex', '-1');
    expect(pill('Polo 2 items')).toHaveAttribute('tabindex', '0');
  });

  it('moves focus with the arrow keys, wrapping at both ends, and selects nothing', async () => {
    const { onSelect } = renderBar(null);
    const user = userEvent.setup();
    pill('All 16 items').focus();

    await user.keyboard('{ArrowRight}');
    expect(pill('Basketball 4 items')).toHaveFocus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(pill('Custom 2 items')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(pill('All 16 items')).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('jumps to the first pill with Home and to the last with End', async () => {
    renderBar(null);
    const user = userEvent.setup();
    pill('All 16 items').focus();

    await user.keyboard('{End}');
    expect(pill('Custom 2 items')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(pill('All 16 items')).toHaveFocus();
  });

  it('moves the one tab stop with the focus, so Tab out and back returns to the last pill', async () => {
    renderBar(null);
    const user = userEvent.setup();
    pill('All 16 items').focus();

    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(pill('Volleyball 3 items')).toHaveAttribute('tabindex', '0');
    expect(pill('All 16 items')).toHaveAttribute('tabindex', '-1');
  });

  it('selects with Enter and with Space, and keeps focus on the pill', async () => {
    const { onSelect } = renderBar(null);
    const user = userEvent.setup();
    pill('All 16 items').focus();

    await user.keyboard('{ArrowRight}{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith('basketball');
    expect(pill('Basketball 4 items')).toHaveFocus();
    await user.keyboard('{ArrowRight} ');
    expect(onSelect).toHaveBeenLastCalledWith('volleyball');
    expect(pill('Volleyball 3 items')).toHaveFocus();
  });

  it('says "Showing 4 items" in a polite region after a pill is chosen, and "Showing 1 item" for one', async () => {
    const one = [{ key: 'polo', shortName: 'Polo', count: 1 }];
    const { rerender } = render(
      <GalleryFilterBar pills={demoGallery.pills} total={total} selected={null} onSelect={vi.fn()} />,
    );
    const user = userEvent.setup();
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status.textContent).toBe('');

    await user.click(pill('Basketball 4 items'));
    expect(status).toHaveTextContent('Showing 4 items');
    await user.click(pill('All 16 items'));
    expect(status).toHaveTextContent('Showing 16 items');

    rerender(<GalleryFilterBar pills={one} total={1} selected={null} onSelect={vi.fn()} />);
    await user.click(pill('Polo 1 items'));
    expect(status).toHaveTextContent('Showing 1 item');
  });

  it('has no axe violations with the status region', async () => {
    const { container } = renderBar('moto');

    await expectNoAxeViolations(container);
  });
});

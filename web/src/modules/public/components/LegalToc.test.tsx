// SPEC-GAP: LEGAL-05, UI-SPEC L1 item 2. LegalToc on its own: one link per section in both markup copies, and the list following
// the sections it is given.
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { inStrictMode } from '@/test/strictMode';
import type { LegalSectionData } from '../legalContent';
import { LegalToc } from './LegalToc';

const THREE: readonly LegalSectionData[] = [
  { id: 'one', heading: 'One', blocks: [] },
  { id: 'two', heading: 'Two', blocks: [] },
  { id: 'three', heading: 'Three', blocks: [] },
];

function wrap(sections: readonly LegalSectionData[]) {
  return (
    <MemoryRouter>
      <LegalToc sections={sections} />
    </MemoryRouter>
  );
}

function linkTexts(nav: HTMLElement): string[] {
  return within(nav)
    .queryAllByRole('link')
    .map((link) => link.textContent);
}

describe('LegalToc', () => {
  it('lists one link per section, in order, in the wide column and in the phone box', () => {
    render(wrap(THREE));
    const navs = screen.getAllByRole('navigation', { name: 'On this page' });
    expect(navs).toHaveLength(2);
    for (const nav of navs) {
      expect(linkTexts(nav)).toEqual(['One', 'Two', 'Three']);
      expect(
        within(nav)
          .getAllByRole('link')
          .map((link) => link.getAttribute('href')),
      ).toEqual(['#one', '#two', '#three']);
    }
  });

  it('keeps the phone box closed until it is opened, with its summary naming the list', () => {
    const { container } = render(wrap(THREE));
    const box = container.querySelector('details');
    expect(box).not.toHaveAttribute('open');
    expect(box?.querySelector('summary')).toHaveTextContent('On this page');
  });

  it('follows the sections on a rerender: the same ones change nothing, new ones replace the links', () => {
    const { rerender } = render(wrap(THREE));
    rerender(wrap(THREE));
    for (const nav of screen.getAllByRole('navigation', { name: 'On this page' })) {
      expect(linkTexts(nav)).toEqual(['One', 'Two', 'Three']);
    }

    rerender(wrap([{ id: 'four', heading: 'Four', blocks: [] }]));
    for (const nav of screen.getAllByRole('navigation', { name: 'On this page' })) {
      expect(linkTexts(nav)).toEqual(['Four']);
      expect(within(nav).getByRole('link')).toHaveAttribute('href', '#four');
    }
  });

  it('shows empty lists for no sections', () => {
    render(wrap([]));
    for (const nav of screen.getAllByRole('navigation', { name: 'On this page' })) {
      expect(within(nav).queryAllByRole('link')).toHaveLength(0);
    }
  });

  it('has zero axe violations', async () => {
    const { container } = render(wrap(THREE));
    await expectNoAxeViolations(container);
  });
});

describe('LegalToc under StrictMode', () => {
  it('draws every link in both copies, whether the render is cached or fresh', async () => {
    await inStrictMode(() => {
      render(wrap(THREE));
      for (const nav of screen.getAllByRole('navigation', { name: 'On this page' })) {
        expect(linkTexts(nav)).toEqual(['One', 'Two', 'Three']);
      }
    });
  });
});

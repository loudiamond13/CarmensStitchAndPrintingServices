// SPEC-GAP: LEGAL-05, D-10, UI-SPEC L1 item 2. The article area of a legal page: the table of contents, the sections and every
// block kind. The TOC shows twice in the markup (a sticky column and a closed details box); the stylesheet shows one of them.
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { inStrictMode } from '@/test/strictMode';
import type { LegalSectionData } from '../legalContent';
import { LEGAL_PAGES, type LegalPageMeta } from '../legalPages';
import { LegalPage } from './LegalPage';

const SECTIONS: readonly LegalSectionData[] = [
  { id: 'first-part', heading: 'First part', blocks: [{ kind: 'p', parts: ['Plain text.'] }] },
  {
    id: 'lists',
    heading: 'Lists and terms',
    blocks: [
      { kind: 'h3', text: 'A group' },
      { kind: 'ul', items: [['One item.'], ['Two items with a ', { text: 'link', href: '/privacy' }, '.']] },
      { kind: 'dl', items: [{ term: 'A term', parts: ['Its meaning.'] }] },
    ],
  },
  {
    id: 'links',
    heading: 'Links',
    blocks: [
      {
        kind: 'p',
        parts: [
          { text: 'Mail us', href: 'mailto:someone@example.test' },
          ' or read ',
          { text: 'their policy', href: 'https://example.test/policy', external: true },
          '.',
        ],
      },
    ],
  },
];

function renderPage(sections: readonly LegalSectionData[] | undefined = SECTIONS) {
  return render(
    <MemoryRouter>
      <LegalPage page={LEGAL_PAGES.terms} sections={sections} />
    </MemoryRouter>,
  );
}

describe('LegalPage article (UI-SPEC L1 item 2)', () => {
  it('gives each section aria-labelledby its h2, in section order', () => {
    renderPage();
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual(['First part', 'Lists and terms', 'Links']);
    for (const section of SECTIONS) {
      const region = document.getElementById(section.id);
      expect(region?.tagName).toBe('SECTION');
      const labelId = region?.getAttribute('aria-labelledby') ?? '';
      expect(document.getElementById(labelId)).toHaveTextContent(section.heading);
    }
  });

  it('lists the h2s in the table of contents in section order, and every link targets an existing section', () => {
    renderPage();
    const navs = screen.getAllByRole('navigation', { name: 'On this page' });
    expect(navs).toHaveLength(2);
    for (const nav of navs) {
      const links = within(nav).getAllByRole('link');
      expect(links.map((link) => link.textContent)).toEqual(SECTIONS.map((section) => section.heading));
      expect(links.map((link) => link.getAttribute('href'))).toEqual(SECTIONS.map((section) => `#${section.id}`));
      for (const link of links) {
        const id = (link.getAttribute('href') ?? '').slice(1);
        expect(document.getElementById(id)).not.toBeNull();
      }
    }
  });

  it('keeps every h2 in the table of contents', () => {
    renderPage();
    const [nav] = screen.getAllByRole('navigation', { name: 'On this page' });
    const names = within(nav ?? document.body)
      .getAllByRole('link')
      .map((link) => link.textContent);
    for (const heading of screen.getAllByRole('heading', { level: 2 })) {
      expect(names).toContain(heading.textContent);
    }
  });

  it('closes the phone details box by default, with the summary "On this page" and a hidden chevron', () => {
    const { container } = renderPage();
    const box = container.querySelector('details');
    expect(box).not.toBeNull();
    expect(box).not.toHaveAttribute('open');
    const summary = box?.querySelector('summary');
    expect(summary).toHaveTextContent('On this page');
    expect(summary?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(within(box as HTMLElement).getByRole('navigation', { name: 'On this page' })).toBeInTheDocument();
  });

  it('turns the chevron only while open, and not under reduced motion', () => {
    const { container } = renderPage();
    const chevron = container.querySelector('summary svg');
    const classes = chevron?.getAttribute('class') ?? '';
    expect(classes).toContain('group-open:rotate-180');
    expect(classes).toContain('motion-reduce:transition-none');
  });

  it('makes every table of contents link at least 44px tall and the summary too', () => {
    const { container } = renderPage();
    for (const link of container.querySelectorAll('nav[aria-label="On this page"] a')) {
      expect(link.className).toContain('min-h-11');
    }
    expect(container.querySelector('summary')?.className).toContain('min-h-11');
  });

  it('renders the h3, the bulleted list, the term list and the links', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 3, name: 'A group' })).toBeInTheDocument();
    expect(within(within(screen.getByRole('article')).getByRole('list')).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('A term').tagName).toBe('DT');
    expect(screen.getByText('Its meaning.').tagName).toBe('DD');
    expect(screen.getByRole('link', { name: 'Mail us' })).toHaveAttribute('href', 'mailto:someone@example.test');
    const external = screen.getByRole('link', { name: /^their policy\s*\(opens in a new tab\)$/ });
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noopener noreferrer');
    const internal = within(screen.getByRole('article')).getByRole('link', { name: 'link' });
    expect(internal).toHaveAttribute('href', '/privacy');
    expect(internal).not.toHaveAttribute('target');
  });

  it('wraps long words and pasted URLs in the article', () => {
    renderPage();
    expect(screen.getByRole('article').className).toContain('wrap-anywhere');
  });

  it('shows the two columns at 1024px and above: a 240px TOC beside a 640px article, 64px apart', () => {
    const { container } = renderPage();
    const grid = screen.getByRole('article').parentElement;
    const classes = grid?.className ?? '';
    expect(classes).toContain('grid-cols-[240px_minmax(0,640px)]');
    expect(classes).toContain('gap-16');
    expect(classes).toContain('pg-lt-lg:grid-cols-[minmax(0,1fr)]');
    const wide = container.querySelector('nav[class*="sticky"]');
    expect(wide?.className).toContain('pg-lt-lg:hidden');
  });

  it('shows no table of contents and no article for a page without sections', () => {
    renderPage([]);
    expect(screen.queryByRole('navigation', { name: 'On this page' })).not.toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('shows no article and no table of contents when the page has no sections prop at all', () => {
    render(
      <MemoryRouter>
        <LegalPage page={LEGAL_PAGES.terms} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'On this page' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Terms of use.');
  });

  it('has zero axe violations', async () => {
    const { container } = renderPage();
    await expectNoAxeViolations(container);
  });
});

describe('LegalPage head (D-14)', () => {
  const DRAFT = LEGAL_PAGES.terms;
  const APPROVED = { ...LEGAL_PAGES.privacy, approved: true };

  function wrap(page: LegalPageMeta, sections?: readonly LegalSectionData[]) {
    return (
      <MemoryRouter>
        {sections === undefined ? <LegalPage page={page} /> : <LegalPage page={page} sections={sections} />}
      </MemoryRouter>
    );
  }

  it('shows the DRAFT notice while the page is not approved', () => {
    render(wrap(DRAFT));
    expect(screen.getByText('Draft: this text is not final yet.')).toBeInTheDocument();
    expect(screen.getByText("It may change before it's approved.")).toBeInTheDocument();
  });

  it('shows no DRAFT notice once the page is approved', () => {
    render(wrap(APPROVED));
    expect(screen.queryByText('Draft: this text is not final yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Privacy policy.');
  });

  it('shows the breadcrumb, eyebrow, version line and lead of the page it is given', () => {
    render(wrap(DRAFT));
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByText('Terms of Use')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Using this site')).toBeInTheDocument();
    expect(screen.getByText('Version 0.1 · Last updated Nov 15, 2026')).toBeInTheDocument();
    expect(screen.getByText(DRAFT.lead)).toBeInTheDocument();
  });

  it('leaves out the date when the date cannot be read', () => {
    render(wrap({ ...DRAFT, lastUpdated: 'not a date' }));
    expect(screen.getByText('Version 0.1')).toBeInTheDocument();
  });

  it('follows the page and its sections on a rerender', () => {
    const { rerender } = render(wrap(DRAFT, SECTIONS));
    rerender(wrap(DRAFT, SECTIONS));
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);

    rerender(wrap(APPROVED, SECTIONS.slice(0, 1)));
    expect(screen.queryByText('Draft: this text is not final yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Privacy policy.');
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);

    rerender(wrap(DRAFT));
    expect(screen.getByText('Draft: this text is not final yet.')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});

describe('LegalPage under StrictMode', () => {
  it('draws the DRAFT notice, the head, the table of contents and the sections, whether the render is cached or fresh', async () => {
    await inStrictMode(() => {
      renderPage();
      expect(screen.getByText('Draft: this text is not final yet.')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Terms of use.');
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
      expect(screen.getAllByRole('navigation', { name: 'On this page' })).toHaveLength(2);
    });
  });
});

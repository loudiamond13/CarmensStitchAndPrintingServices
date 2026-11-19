// SPEC-GAP: LEGAL-05, D-10, T-12-16, T-12-17. LegalSection on its own: every block kind, every inline kind (text, internal link,
// external link), the facts block, and a section that changes between renders.
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { inStrictMode } from '@/test/strictMode';
import type { LegalSectionData } from '../legalContent';
import { LegalSection, sectionHeadingId } from './LegalSection';

function wrap(section: LegalSectionData) {
  return (
    <MemoryRouter>
      <LegalSection section={section} />
    </MemoryRouter>
  );
}

const EVERY_BLOCK: LegalSectionData = {
  id: 'every-block',
  heading: 'Every block',
  blocks: [
    { kind: 'h3', text: 'A group' },
    {
      kind: 'p',
      parts: [
        'Read the ',
        { text: 'privacy policy', href: '/privacy' },
        ' or the ',
        { text: 'official site', href: 'https://example.test/official', external: true },
        '.',
      ],
    },
    {
      kind: 'ul',
      items: [
        ['A plain item.'],
        [{ text: 'A link first', href: '/terms' }, ' then text.'],
        [{ text: 'External first', href: 'https://example.test/x', external: true }],
      ],
    },
    {
      kind: 'dl',
      items: [
        { term: 'Term one', parts: ['Plain meaning.'] },
        { term: 'Term two', parts: ['See ', { text: 'privacy', href: '/privacy' }, '.'] },
      ],
    },
  ],
};

describe('LegalSection blocks and inline parts', () => {
  it('names the section by its h2 and keeps the blocks in the order given', () => {
    const { container } = render(wrap(EVERY_BLOCK));
    const section = container.querySelector('section');
    expect(section).toHaveAttribute('id', 'every-block');
    expect(section).toHaveAttribute('aria-labelledby', sectionHeadingId('every-block'));
    expect(screen.getByRole('heading', { level: 2, name: 'Every block' })).toHaveAttribute('id', 'every-block-heading');
    const kinds = Array.from(container.querySelectorAll('section > div > *')).map((node) => node.tagName);
    expect(kinds).toEqual(['H3', 'P', 'UL', 'DL']);
  });

  it('renders text, an internal link and an external link inside a paragraph', () => {
    render(wrap(EVERY_BLOCK));
    const paragraph = screen.getByText(/^Read the/);
    expect(paragraph.tagName).toBe('P');
    const internal = within(paragraph).getByRole('link', { name: 'privacy policy' });
    expect(internal).toHaveAttribute('href', '/privacy');
    expect(internal).not.toHaveAttribute('target');
    expect(internal).not.toHaveAttribute('rel');
    const external = within(paragraph).getByRole('link', { name: /^official site\s*\(opens in a new tab\)$/ });
    expect(external).toHaveAttribute('href', 'https://example.test/official');
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders list items that start with text, with an internal link and with an external link', () => {
    render(wrap(EVERY_BLOCK));
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent.replace(/\s+/g, ' ').trim())).toEqual([
      'A plain item.',
      'A link first then text.',
      'External first (opens in a new tab)',
    ]);
    expect(screen.getByRole('link', { name: 'A link first' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'A link first' }).closest('li')).toBe(items[1]);
    const external = screen.getByRole('link', { name: /^External first/ });
    expect(external).toHaveAttribute('target', '_blank');
    expect(external.closest('li')).toBe(items[2]);
  });

  it('renders a term list with the terms in dt and the meanings, links included, in dd', () => {
    render(wrap(EVERY_BLOCK));
    expect(screen.getByText('Term one').tagName).toBe('DT');
    expect(screen.getByText('Plain meaning.').tagName).toBe('DD');
    const link = screen.getByRole('link', { name: 'privacy' });
    expect(link).toHaveAttribute('href', '/privacy');
    expect(link.closest('dd')).toBe(screen.getByText('Term two').nextElementSibling);
  });

  it('shows text as text, never as markup', () => {
    render(
      wrap({ id: 'safe', heading: 'Safe', blocks: [{ kind: 'p', parts: ['<b>not bold</b> <script>x()</script>'] }] }),
    );
    expect(screen.getByText('<b>not bold</b> <script>x()</script>')).toBeInTheDocument();
    expect(document.querySelector('b')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
  });

  it('has zero axe violations with every block kind', async () => {
    const { container } = render(wrap(EVERY_BLOCK));
    await expectNoAxeViolations(container);
  });
});

describe('LegalSection facts block', () => {
  it('shows the Data Protection Officer line for a dpo-only facts block', () => {
    render(wrap({ id: 'who', heading: 'Who', blocks: [{ kind: 'facts', show: ['dpo'] }] }));
    expect(screen.getByText('Data Protection Officer: The owner, Data Protection Officer')).toBeInTheDocument();
  });

  it('shows the shop facts from the site read for a business and contact facts block', async () => {
    render(wrap({ id: 'who', heading: 'Who', blocks: [{ kind: 'facts', show: ['business', 'contact'] }] }));
    expect(await screen.findByText('Sample Shop')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '0917 123 4567' })).toBeInTheDocument();
  });
});

describe('LegalSection when the section changes', () => {
  it('shows the new heading, id and blocks on a rerender and keeps the old ones out', () => {
    const { rerender } = render(wrap(EVERY_BLOCK));
    rerender(wrap(EVERY_BLOCK));
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);

    rerender(
      wrap({
        id: 'another',
        heading: 'Another section',
        blocks: [{ kind: 'p', parts: ['Only this paragraph.'] }],
      }),
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Another section' })).toHaveAttribute('id', 'another-heading');
    expect(screen.getByText('Only this paragraph.')).toBeInTheDocument();
    expect(screen.queryByText('A group')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders a section with no blocks as its heading alone', () => {
    const { container } = render(wrap({ id: 'empty', heading: 'Empty', blocks: [] }));
    expect(screen.getByRole('heading', { level: 2, name: 'Empty' })).toBeInTheDocument();
    expect(container.querySelector('section > div')?.children).toHaveLength(0);
  });
});

describe('LegalSection under StrictMode', () => {
  it('draws every block kind, whether the render is cached or fresh', async () => {
    await inStrictMode(() => {
      const { container } = render(wrap(EVERY_BLOCK));
      const kinds = Array.from(container.querySelectorAll('section > div > *')).map((node) => node.tagName);
      expect(kinds).toEqual(['H3', 'P', 'UL', 'DL']);
      expect(screen.getAllByRole('link')).toHaveLength(5);
    });
  });

  it('draws a facts block, whether the render is cached or fresh', async () => {
    await inStrictMode(async () => {
      render(wrap({ id: 'who', heading: 'Who', blocks: [{ kind: 'facts', show: ['business', 'dpo'] }] }));
      expect(await screen.findByText('Sample Shop')).toBeInTheDocument();
      expect(screen.getByText('Data Protection Officer: The owner, Data Protection Officer')).toBeInTheDocument();
    });
  });
});

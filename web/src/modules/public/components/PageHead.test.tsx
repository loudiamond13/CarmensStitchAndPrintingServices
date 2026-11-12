import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { PageHead } from './PageHead';

const HEADLINE = { plain: 'Every kit,', accent: 'your way.' } as const;

function renderHead(props: Partial<Parameters<typeof PageHead>[0]> = {}) {
  return render(
    <MemoryRouter>
      <PageHead eyebrow="Products & services" headline={HEADLINE} {...props} />
    </MemoryRouter>,
  );
}

describe('PageHead (UI-SPEC Component Inventory, App. E.2)', () => {
  it('renders one h1 with the emphasised word in an em', () => {
    renderHead();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAccessibleName('Every kit, your way.');
    expect(headings[0]?.querySelector('em')).toHaveTextContent('your way.');
  });

  it('shows the eyebrow and the lead when given', () => {
    renderHead({ lead: 'Pick a base, then make every detail yours.' });
    expect(screen.getByText('Products & services')).toBeInTheDocument();
    expect(screen.getByText('Pick a base, then make every detail yours.')).toBeInTheDocument();
  });

  it('leaves the lead out when none is given', () => {
    const { container } = renderHead();
    expect(container.querySelector('p')).toBeNull();
  });

  it('shows a breadcrumb nav with a Home link and the current page when a crumb is given', () => {
    renderHead({ crumb: 'Products' });
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(nav).getByText('Products')).toHaveAttribute('aria-current', 'page');
  });

  it('shows no breadcrumb when no crumb is given', () => {
    renderHead();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
  });

  it('shows the buttons it is given in a row', () => {
    renderHead({ actions: <a href="/">Go to Home</a> });
    expect(screen.getByRole('link', { name: 'Go to Home' })).toBeInTheDocument();
  });

  it('is the dot-mesh page head, with the 48 px bottom padding variant on request', () => {
    const { container, rerender } = renderHead();
    const section = container.querySelector('section');
    expect(section).not.toBeNull();
    expect(section?.className).toContain('pb-[calc(var(--space-12)+var(--cut-angle))]');
    rerender(
      <MemoryRouter>
        <PageHead eyebrow="Our work" headline={HEADLINE} flat />
      </MemoryRouter>,
    );
    expect(container.querySelector('section')?.className.split(' ')).toContain('pb-12');
  });

  it('has no style attribute (strict CSP) and no axe violations', async () => {
    const { container } = renderHead({ crumb: 'Products', lead: 'A lead.', actions: <a href="/">Home</a> });
    expect(container.querySelector('[style]')).toBeNull();
    await expectNoAxeViolations(container);
  });
});

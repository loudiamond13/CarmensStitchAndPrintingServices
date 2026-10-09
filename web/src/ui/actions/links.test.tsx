import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as actionScenarios } from '@/dev/scenarios/groups/actions';
import { expectNoAxeViolations } from '@/test/axe';
import { ButtonLink, buttonClasses, LinkProvider, UiLink } from '@/ui/actions';

// The App. D.3 links (plan 02-17): UiLink and ButtonLink render react-router's Link (a real <a href>) for in-app paths
// and a plain <a href> for external, mail, phone and in-page targets, as App. D.3 does; LinkProvider is kept for API
// compatibility and renders its children unchanged.

function inRouter(ui: ReactNode, initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={ui} />
        <Route path="/products" element={<h1>Products page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

function onlyLink(): HTMLAnchorElement {
  return screen.getByRole<HTMLAnchorElement>('link');
}

describe('UiLink', () => {
  it('renders an in-app path as a real anchor with that href', () => {
    inRouter(<UiLink to="/products">Products</UiLink>);

    expect(onlyLink().tagName).toBe('A');
    expect(onlyLink()).toHaveAttribute('href', '/products');
    expect(onlyLink()).toHaveTextContent('Products');
  });

  it('navigates in-app through the router, without a page load', async () => {
    const user = userEvent.setup();
    inRouter(<UiLink to="/products">Products</UiLink>);

    await user.click(onlyLink());

    expect(screen.getByRole('heading', { name: 'Products page' })).toBeInTheDocument();
  });

  it.each(['https://example.com/', 'mailto:hello@example.com', 'tel:+639171234567', '#top'])(
    'renders %s as a plain anchor, even outside a router (App. D.3 external targets)',
    (to) => {
      render(<UiLink to={to}>Elsewhere</UiLink>);

      expect(onlyLink()).toHaveAttribute('href', to);
    },
  );

  it('keeps the same external anchor on an equal-props re-render and updates on new props', () => {
    const { rerender } = render(
      <UiLink to="https://example.com/" title="Example">
        Example
      </UiLink>,
    );
    const first = onlyLink();
    rerender(
      <UiLink to="https://example.com/" title="Example">
        Example
      </UiLink>,
    );
    expect(onlyLink()).toBe(first);

    rerender(
      <UiLink to="mailto:hello@example.com" title="Write to us" className="mt-2">
        Email
      </UiLink>,
    );
    expect(onlyLink()).toHaveAttribute('href', 'mailto:hello@example.com');
    expect(onlyLink()).toHaveAttribute('title', 'Write to us');
    expect(onlyLink()).toHaveClass('mt-2');
  });

  it('keeps the same router link on an equal-props re-render and updates on new props', () => {
    const { rerender } = render(
      <MemoryRouter>
        <UiLink to="/products" title="Products">
          Products
        </UiLink>
      </MemoryRouter>,
    );
    const first = onlyLink();
    rerender(
      <MemoryRouter>
        <UiLink to="/products" title="Products">
          Products
        </UiLink>
      </MemoryRouter>,
    );
    expect(onlyLink()).toBe(first);

    rerender(
      <MemoryRouter>
        <UiLink to="/gallery" title="Gallery">
          Gallery
        </UiLink>
      </MemoryRouter>,
    );
    expect(onlyLink()).toHaveAttribute('href', '/gallery');
    expect(onlyLink()).toHaveAttribute('title', 'Gallery');
  });

  it('passes its explicit props to an external anchor too', () => {
    const onClick = vi.fn();
    render(
      <UiLink
        to="https://example.com/"
        id="ext"
        title="Example site"
        aria-label="Example site (opens a new tab)"
        aria-current="page"
        aria-describedby="hint"
        aria-labelledby="ext-name"
        target="_blank"
        rel="noopener"
        onClick={onClick}
      >
        Example
      </UiLink>,
    );
    const link = screen.getByRole('link', { name: 'Example site (opens a new tab)' });

    expect(link).toHaveAttribute('id', 'ext');
    expect(link).toHaveAttribute('title', 'Example site');
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).toHaveAttribute('aria-describedby', 'hint');
    expect(link).toHaveAttribute('aria-labelledby', 'ext-name');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
  });

  it('passes its explicit props to the anchor', () => {
    const onClick = vi.fn();
    inRouter(
      <UiLink
        to="/products"
        id="nav-products"
        className="mt-2"
        title="All products"
        aria-label="Products list"
        aria-current="page"
        aria-describedby="hint"
        aria-labelledby="nav-products-name"
        target="_self"
        rel="nofollow"
        onClick={onClick}
      >
        Products
      </UiLink>,
    );
    const link = screen.getByRole('link', { name: 'Products list' });

    expect(link).toHaveAttribute('id', 'nav-products');
    expect(link).toHaveClass('mt-2');
    expect(link).toHaveAttribute('title', 'All products');
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).toHaveAttribute('aria-describedby', 'hint');
    expect(link).toHaveAttribute('aria-labelledby', 'nav-products-name');
    expect(link).toHaveAttribute('target', '_self');
    expect(link).toHaveAttribute('rel', 'nofollow');
  });

  it('takes a menuitem role and a roving tabIndex, in-app and external (the UserMenu items)', () => {
    inRouter(
      <>
        <UiLink to="/admin/profile" role="menuitem" tabIndex={-1}>
          My Profile
        </UiLink>
        <UiLink to="https://example.com/" role="menuitem" tabIndex={-1}>
          Example
        </UiLink>
      </>,
    );

    for (const name of ['My Profile', 'Example']) {
      expect(screen.getByRole('menuitem', { name })).toHaveAttribute('tabindex', '-1');
    }
  });
});

describe('LinkProvider (kept for API compatibility)', () => {
  it('renders its children unchanged', () => {
    const children = (
      <>
        <p>Inside</p>
        <UiLink to="/products">Products</UiLink>
      </>
    );
    const without = inRouter(children).container.innerHTML;
    const { container } = inRouter(<LinkProvider>{children}</LinkProvider>);

    expect(container.innerHTML).toBe(without);
    expect(container.querySelector('p + a[href="/products"]')).toHaveTextContent('Products');
  });
});

describe('ButtonLink', () => {
  it('renders an anchor with the button look for its variant and size, and its icons around the label', () => {
    inRouter(
      <ButtonLink to="/products" variant="primary" size="md" icon="plus" iconRight="arrow-right">
        View Products
      </ButtonLink>,
    );
    const link = onlyLink();

    expect(link).toHaveAttribute('href', '/products');
    expect(link.className).toBe(buttonClasses({ variant: 'primary', size: 'md' }));
    expect(link.className).not.toBe('');
    expect([...link.childNodes].map((node) => node.nodeName.toLowerCase())).toEqual(['svg', '#text', 'svg']);
    expect(link.querySelector('svg')).toHaveClass('lucide-plus');
    expect(link.querySelector('svg')).toHaveAttribute('width', '18');
    expect(link.lastElementChild).toHaveClass('lucide-arrow-right');
  });

  it('defaults to secondary md, uses 16px icons at sm, and adds the caller layout class', () => {
    const { rerender } = inRouter(<ButtonLink to="/products">Products</ButtonLink>);
    expect(onlyLink().className).toBe(buttonClasses({ variant: 'secondary', size: 'md' }));

    rerender(
      <MemoryRouter>
        <ButtonLink to="/products" variant="ghost" size="sm" icon="image" className="mt-4">
          Gallery
        </ButtonLink>
      </MemoryRouter>,
    );
    expect(onlyLink().className).toBe(buttonClasses({ variant: 'ghost', size: 'sm', className: 'mt-4' }));
    expect(onlyLink().querySelector('svg')).toHaveAttribute('width', '16');
  });

  it('navigates in-app through the router', async () => {
    const user = userEvent.setup();
    inRouter(<ButtonLink to="/products">Products</ButtonLink>);

    await user.click(onlyLink());

    expect(screen.getByRole('heading', { name: 'Products page' })).toBeInTheDocument();
  });

  it('keeps the same DOM node on an equal-props re-render and updates on new props', () => {
    const { rerender } = render(
      <MemoryRouter>
        <ButtonLink to="/products" variant="primary">
          Products
        </ButtonLink>
      </MemoryRouter>,
    );
    const first = onlyLink();
    rerender(
      <MemoryRouter>
        <ButtonLink to="/products" variant="primary">
          Products
        </ButtonLink>
      </MemoryRouter>,
    );
    expect(onlyLink()).toBe(first);

    rerender(
      <MemoryRouter>
        <ButtonLink to="/gallery" variant="danger" size="lg">
          Gallery
        </ButtonLink>
      </MemoryRouter>,
    );
    expect(onlyLink()).toHaveAttribute('href', '/gallery');
    expect(onlyLink().className).toBe(buttonClasses({ variant: 'danger', size: 'lg' }));
  });

  it('has no axe violations next to a UiLink and an external link (A11Y-01)', async () => {
    const { container } = inRouter(
      <div>
        <ButtonLink to="/products" variant="primary" iconRight="arrow-right">
          View Products
        </ButtonLink>
        <UiLink to="/products">Products</UiLink>
        <UiLink to="https://example.com/">Example</UiLink>
      </div>,
    );

    await expectNoAxeViolations(container);
  });
});

describe('ButtonLink scenarios (the actions parity group)', () => {
  const linkScenarios = actionScenarios.filter((scenario) => scenario.node.component === 'ButtonLink');

  it('declares buttonlink-primary-md and buttonlink-ghost-sm at rest, hover and focus-visible in both themes', () => {
    expect(linkScenarios.map((scenario) => scenario.id)).toEqual(['buttonlink-primary-md', 'buttonlink-ghost-sm']);
    for (const scenario of linkScenarios) {
      expect(scenario.themes, scenario.id).toEqual(['light', 'dark']);
      expect(scenario.states, scenario.id).toEqual(['rest', 'hover', 'focus-visible']);
      expect(scenario.parity, scenario.id).toBe(true);
      expect(scenario.node.props, scenario.id).toHaveProperty('to');
    }
  });

  it('renders every ButtonLink scenario through the implementation kit as one link with no axe violations', async () => {
    const { container } = render(
      <MemoryRouter>
        {linkScenarios.map((scenario) => (
          <div key={scenario.id} data-case={scenario.id}>
            {renderNode(kit, scenario.node, scenario.handlers ?? [])}
          </div>
        ))}
      </MemoryRouter>,
    );

    for (const scenario of linkScenarios) {
      expect(container.querySelectorAll(`[data-case="${scenario.id}"] a[href]`), scenario.id).toHaveLength(1);
    }
    await expectNoAxeViolations(container);
  });
});

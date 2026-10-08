// A11Y-02 (02-UI-SPEC SPEC-GAP "SkipLink"): the first focusable element of each layout. It reuses the primary md
// button classes, stays visually hidden until :focus-visible (spec-gaps.css, checked in overrides.test.ts) and moves
// focus to <main id="main" tabIndex={-1}> without putting #main in the URL.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { SKIP_LINK_COPY } from './copy';
import { SkipLink } from './SkipLink';

function Layout() {
  return (
    <>
      <SkipLink />
      <header>
        <a href="/products">Products</a>
      </header>
      <main id="main" tabIndex={-1}>
        <h1>Orders</h1>
      </main>
    </>
  );
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('SkipLink (A11Y-02)', () => {
  it('is an anchor to #main with the primary md button classes and the approved text', async () => {
    const { container } = render(<Layout />);
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '#main');
    expect(link).toHaveClass('csp-btn', 'csp-btn-primary', 'csp-btn-md', 'csp-skip-link');
    expect(link.textContent).toBe(SKIP_LINK_COPY.label);
    await expectNoAxeViolations(container);
  });

  it('is the first focusable element when rendered first', async () => {
    const user = userEvent.setup();
    render(<Layout />);
    await user.tab();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus();
  });

  it('moves focus to main on Enter and keeps #main out of the URL', async () => {
    const user = userEvent.setup();
    render(<Layout />);
    await user.tab();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
    expect(window.location.hash).toBe('');
  });

  it('moves focus to main on click and keeps #main out of the URL', async () => {
    const user = userEvent.setup();
    render(<Layout />);
    await user.click(screen.getByRole('link', { name: 'Skip to main content' }));
    expect(screen.getByRole('main')).toHaveFocus();
    expect(window.location.hash).toBe('');
  });

  it('focuses a caller target id', async () => {
    const user = userEvent.setup();
    render(
      <>
        <SkipLink targetId="content" />
        <div id="content" tabIndex={-1}>
          Content
        </div>
      </>,
    );
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link).toHaveAttribute('href', '#content');
    await user.click(link);
    expect(screen.getByText('Content')).toHaveFocus();
  });

  it('does nothing and keeps the URL when the target is missing', async () => {
    const user = userEvent.setup();
    render(<SkipLink />);
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    await user.click(link);
    expect(window.location.hash).toBe('');
    expect(link).toHaveFocus();
  });

  it('keeps its markup when re-rendered with equal props (compiler cache path)', () => {
    const { container, rerender } = render(<SkipLink />);
    const before = container.innerHTML;
    rerender(<SkipLink />);
    expect(container.innerHTML).toBe(before);
    rerender(<SkipLink targetId="content" />);
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#content');
  });
});

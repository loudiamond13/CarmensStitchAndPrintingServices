import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import AuthLayout from '@/layouts/AuthLayout';

// AuthLayout (App. E.5 frame, plan 04-26; UI-SPEC "AuthLayout"): Blush page root, skip link first, the brand panel with
// no landmark, and one `main#main` around the outlet.

function renderLayout() {
  const router = createMemoryRouter(
    [
      {
        Component: AuthLayout,
        children: [{ path: '/admin/login', element: <p>Inside the card</p> }],
      },
    ],
    { initialEntries: ['/admin/login'] },
  );
  return render(<RouterProvider router={router} />);
}

describe('AuthLayout (App. E.5)', () => {
  it('is a Blush page root', async () => {
    const { container } = renderLayout();
    await screen.findByText('Inside the card');

    const root = container.querySelector('[data-theme]');
    expect(root).toHaveAttribute('data-theme', 'light');
  });

  it('has the skip link as the first focusable element, and it lands on the main', async () => {
    const user = userEvent.setup();
    renderLayout();
    await screen.findByText('Inside the card');

    await user.tab();

    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('has exactly one main (id main, focusable by script) holding the outlet', async () => {
    renderLayout();
    const inside = await screen.findByText('Inside the card');

    const mains = screen.getAllByRole('main');
    expect(mains).toHaveLength(1);
    expect(mains[0]).toHaveAttribute('id', 'main');
    expect(mains[0]).toHaveAttribute('tabindex', '-1');
    expect(mains[0]).toContainElement(inside);
  });

  it('shows the brand panel without a landmark: the logo, the eyebrow, the quote and a hidden numeral', async () => {
    const { container } = renderLayout();
    await screen.findByText('Inside the card');

    expect(screen.getByRole('img', { name: "CSPS: Carmen's Stitch & Printing Services" })).toBeInTheDocument();
    expect(screen.getByText('Staff area')).toBeInTheDocument();
    expect(screen.getByText('Orders, payments and expenses, all in one place.')).toBeInTheDocument();
    const numeral = screen.getByText('C', { selector: 'span[aria-hidden="true"]' });
    expect(numeral).toBeInTheDocument();
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(container.querySelectorAll('main')).toHaveLength(1);
  });

  it('has zero axe violations', async () => {
    const { container } = renderLayout();
    await screen.findByText('Inside the card');

    await expectNoAxeViolations(container);
  });
});

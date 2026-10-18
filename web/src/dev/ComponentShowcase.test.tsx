// The D-22 Component Showcase (/dev/components; dev and e2e builds only, D-20): the `.s-ph` page head, one `.s-card`
// section per group in the UI-SPEC order, every scenario of the shared list in its own `[data-case]` frame, the 56
// icon names, and the live demos (toasts, dialogs, the phone drawer) with real handlers. Nothing is deleted or saved.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { devRoutes } from '@/modules/admin/routes';
import { queryBranch, routes } from '@/core/routes/router';
import { expectNoAxeViolations } from '@/test/axe';
import { ToastProvider } from '@/components';
import { ICONS } from '@/components/brand/icons';
import ComponentShowcase, { ShowcaseSection } from './ComponentShowcase';
import { scenarios } from './scenarios';

/** The UI-SPEC group order, then the two groups the UI-SPEC list predates (Navigation, Marketing). */
const SECTION_TITLES = [
  'Brand & icons',
  'Buttons',
  'Status',
  'Forms',
  'Data',
  'Feedback',
  'Media',
  'Navigation',
  'Marketing',
  'Sign-in and devices',
];

/** Whole-page layouts are shown by their own routes (/, /admin/…), never inside the showcase page. */
const LAYOUT_GROUPS = new Set([
  'auth-brand',
  'layouts-admin',
  'layouts-admin-boundaries',
  'layouts-auth',
  'layouts-public',
]);

function renderShowcase() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ComponentShowcase />
      </ToastProvider>
    </MemoryRouter>,
  );
}

function section(title: string): HTMLElement {
  return screen.getByRole('region', { name: title });
}

/** The shell toast layer (ToastProvider renders it always). */
function toastLayer(): HTMLElement {
  const layer = document.querySelector('[data-ui="s-toast-layer"]');
  if (!(layer instanceof HTMLElement)) {
    throw new Error('No toast layer.');
  }
  return layer;
}

function caseFrame(id: string): HTMLElement {
  const frame = document.querySelector(`[data-case="${id}"]`);
  if (!(frame instanceof HTMLElement)) {
    throw new Error(`No [data-case="${id}"] frame.`);
  }
  return frame;
}

// Each test renders the whole page (about 190 cases); under a full parallel run that can pass the 5 s default.
const FULL_PAGE = { timeout: 20_000 };

describe('ComponentShowcase page (D-22)', FULL_PAGE, () => {
  it('shows one h1 "Component Showcase" with the UI-SPEC subline and sets the document title', async () => {
    renderShowcase();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Component Showcase');
    expect(
      screen.getByText('Every shared building block, in the current theme. Use the moon/sun button to switch themes.'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe('Component Showcase · CSPS (dev)');
    });
  });

  it('has one section with an h2 per group, in the UI-SPEC order', () => {
    renderShowcase();

    const titles = screen
      .getAllByRole('heading', { level: 2 })
      .filter((heading) => heading.closest('[data-case]') === null)
      .map((heading) => heading.textContent);
    expect(titles).toEqual(SECTION_TITLES);
    for (const title of SECTION_TITLES) {
      expect(section(title).tagName).toBe('SECTION');
    }
  });

  it('renders every scenario except the whole-page layouts once, in a [data-case] frame with its overline label', () => {
    renderShowcase();

    const frames = [...document.querySelectorAll<HTMLElement>('[data-case]')];
    const counts = new Map<string, number>();
    for (const frame of frames) {
      const id = frame.dataset.case ?? '';
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const scenario of scenarios) {
      expect({ id: scenario.id, frames: counts.get(scenario.id) ?? 0 }).toEqual({
        id: scenario.id,
        frames: LAYOUT_GROUPS.has(scenario.group) ? 0 : 1,
      });
    }
    // The overline label names the case: its text is the id (the frame's accessible name where it is a region).
    const button = caseFrame('button-primary-md');
    expect(document.getElementById(button.getAttribute('aria-labelledby') ?? '')).toHaveTextContent(
      'button-primary-md',
    );
    expect(document.body.textContent).not.toContain('Missing component');
  });

  it('places the scenario groups in their UI-SPEC sections', () => {
    renderShowcase();

    expect(section('Buttons')).toContainElement(caseFrame('button-primary-md'));
    expect(section('Status')).toContainElement(caseFrame('status-badge-production'));
    expect(section('Forms')).toContainElement(caseFrame('otp-empty'));
    expect(section('Forms')).toContainElement(caseFrame('tabs-orders'));
    expect(section('Data')).toContainElement(caseFrame('rt-users-populated'));
    expect(section('Data')).toContainElement(caseFrame('filterbar-chips-4'));
    expect(section('Feedback')).toContainElement(caseFrame('error-state-orders'));
    expect(section('Feedback')).toContainElement(caseFrame('confirm-delete-order'));
    expect(section('Media')).toContainElement(caseFrame('lazy-image-error'));
    expect(section('Media')).toContainElement(caseFrame('media-placeholder-4x3'));
    expect(section('Navigation')).toContainElement(caseFrame('drawer-open'));
    expect(section('Marketing')).toContainElement(caseFrame('process-steps'));
    expect(section('Sign-in and devices')).toContainElement(caseFrame('verify-default'));
    expect(section('Sign-in and devices')).toContainElement(caseFrame('devices-populated'));
    expect(section('Sign-in and devices')).toContainElement(caseFrame('signout-others-open'));
  });

  it('gives a one-theme scenario its theme and lets two-theme scenarios take the shell theme', () => {
    renderShowcase();

    expect(caseFrame('site-header-home')).toHaveAttribute('data-theme', 'light');
    expect(caseFrame('topbar-dark')).toHaveAttribute('data-theme', 'dark');
    expect(caseFrame('button-primary-md')).not.toHaveAttribute('data-theme');
  });

  it('shows all 63 icons in a grid with their names', () => {
    renderShowcase();

    const names = Object.keys(ICONS);
    expect(names).toHaveLength(63);
    const grid = within(caseFrame('showcase-icon-names'));
    for (const name of names) {
      expect(grid.getByText(name)).toBeInTheDocument();
    }
  });

  it('shows formatted dates in the Data section', () => {
    renderShowcase();

    const dates = within(caseFrame('showcase-dates'));
    expect(dates.getByText('Oct 14, 2026')).toBeInTheDocument();
    expect(dates.getByText('Sep 28, 2026')).toBeInTheDocument();
  });

  it('renders the same page again for the same and for new props (React Compiler memo branches)', () => {
    const { rerender } = renderShowcase();
    rerender(
      <MemoryRouter>
        <ToastProvider>
          <ComponentShowcase />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});

describe('ComponentShowcase live demos (real handlers; nothing is saved or deleted)', FULL_PAGE, () => {
  it.each([
    ['Show success toast', 'Payment added'],
    ['Show info toast', 'Not available yet'],
    ['Show warning toast', 'Someone else changed this'],
    ['Show danger toast', "Couldn't save order"],
    ['Show long toast', 'Order ORD-2026-0148 deleted'],
  ])('"%s" raises the toast "%s"', async (trigger, title) => {
    const user = userEvent.setup();
    renderShowcase();

    await user.click(screen.getByRole('button', { name: trigger }));

    expect(await within(toastLayer()).findByText(title)).toBeInTheDocument();
  });

  it('opens the Add Payment modal; Cancel closes it and focus returns to the trigger', async () => {
    const user = userEvent.setup();
    renderShowcase();
    const trigger = screen.getByRole('button', { name: 'Open Add Payment' });

    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Add Payment' });
    expect(within(dialog).getByRole('textbox', { name: /Amount/ })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('opens the Add User slide-over and closes it on Esc', async () => {
    const user = userEvent.setup();
    renderShowcase();

    await user.click(screen.getByRole('button', { name: 'Open Add User' }));
    expect(await screen.findByRole('dialog', { name: 'Add User' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('deletes nothing: typing the order number enables Delete Order, which closes the dialog with the success toast', async () => {
    const user = userEvent.setup();
    renderShowcase();

    await user.click(within(caseFrame('confirm-delete-order')).getByRole('button', { name: 'Open Delete Order' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete order ORD-2026-0148?' });
    expect(dialog).toHaveTextContent(
      'This will also delete 5 items, 2 payments, 1 discount, 3 expenses, and 4 images.',
    );
    const confirm = within(dialog).getByRole('button', { name: 'Delete Order' });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByRole('textbox'), 'ORD-2026-0148');
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    const layer = toastLayer();
    expect(within(layer).getByText('Order ORD-2026-0148 deleted')).toBeInTheDocument();
    expect(within(layer).getByText('Its items, payments, discounts, expenses and images were removed.')).toBeVisible();
  });

  it('opens the typed Delete Order dialog with the order number already typed', async () => {
    const user = userEvent.setup();
    renderShowcase();

    await user.click(
      within(caseFrame('confirm-delete-order-typed')).getByRole('button', { name: 'Open Delete Order' }),
    );
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => {
      expect(within(dialog).getByRole('textbox')).toHaveValue('ORD-2026-0148');
    });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the failed Delete Order dialog, which stays open with the error and its reference', async () => {
    const user = userEvent.setup();
    renderShowcase();

    await user.click(
      within(caseFrame('confirm-delete-order-error')).getByRole('button', { name: 'Open Delete Order' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(/00-4bf92f3577b34da6a3ce929d0e0e4736-01/)).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox')).toHaveValue('ORD-2026-0148');

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the Delete Payment confirm (no type-to-confirm field) with focus on Cancel; it deletes nothing', async () => {
    const user = userEvent.setup();
    renderShowcase();
    const frame = caseFrame('showcase-confirm-delete-payment');
    // A demo frame is no page root, so the fixed layer the dialog opens covers the page (like the viewport demos).
    expect(frame).not.toHaveAttribute('role');
    const trigger = within(frame).getByRole('button', { name: 'Open Delete Payment' });

    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Delete payment of ₱2,000.00?' });
    expect(dialog).toHaveTextContent('This removes it from ORD-2026-0148 and updates the totals right away.');
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete Payment' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('opens the phone navigation drawer and closes it on Esc', async () => {
    const user = userEvent.setup();
    renderShowcase();
    const trigger = screen.getByRole('button', { name: 'Open navigation drawer' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(trigger.getAttribute('aria-controls') ?? '')).not.toBeNull();

    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the four-item session menu only on request', async () => {
    const user = userEvent.setup();
    renderShowcase();
    const frame = within(caseFrame('session-menu-open'));
    expect(frame.queryByRole('menu')).toBeNull();

    await user.click(frame.getByRole('button', { name: 'Show this example' }));
    const menu = await frame.findByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['My Profile', 'Signed-in Devices', 'Sign Out Other Devices', 'Logout']);
  });

  it.each([
    ['signout-others-open', 'Open Sign Out Others', 'Sign out of other devices?', 'Keep Others Signed In'],
    ['signout-others-failed', 'Open Sign Out Others (fails)', 'Sign out of other devices?', 'Keep Others Signed In'],
    ['signout-device-open', 'Open Sign Out Device', 'Sign out Safari on iPhone?', 'Keep Signed In'],
    ['signout-device-failed', 'Open Sign Out Device (fails)', 'Sign out Safari on iPhone?', 'Keep Signed In'],
  ] as const)('opens the %s demo with focus on its dismiss button, and closes it', async (id, trigger, title, keep) => {
    const user = userEvent.setup();
    renderShowcase();

    await user.click(within(caseFrame(id)).getByRole('button', { name: trigger }));
    const dialog = await screen.findByRole('dialog', { name: title });
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: keep })).toHaveFocus();
    });

    await user.click(within(dialog).getByRole('button', { name: keep }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the failed sign-out demos with the error line and its reference', async () => {
    const user = userEvent.setup();
    renderShowcase();

    await user.click(
      within(caseFrame('signout-device-failed')).getByRole('button', { name: 'Open Sign Out Device (fails)' }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Sign Out Device' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/00-4bf92f3577b34da6a3ce929d0e0e4736-01/);
  });

  it('raises the session toasts from their triggers, each with its own copy', async () => {
    const user = userEvent.setup();
    renderShowcase();
    const frame = within(caseFrame('showcase-session-toasts'));

    await user.click(frame.getByRole('button', { name: 'Show session ending toast' }));
    expect(toastLayer()).toHaveTextContent('Your session ends soon');
    expect(toastLayer()).toHaveTextContent("You'll be signed out at 3:42 PM. Save your work, then sign in again.");

    await user.click(frame.getByRole('button', { name: 'Show device signed out toast' }));
    expect(toastLayer()).toHaveTextContent('Device signed out');
    expect(toastLayer()).toHaveTextContent(
      'Samsung Internet on Galaxy Tab S9 Ultra at the front counter will have to sign in again.',
    );
  });

  it('shows the open user menu only on request, so the page never moves focus by itself', async () => {
    const user = userEvent.setup();
    renderShowcase();
    const frame = within(caseFrame('user-menu-open'));
    expect(frame.queryByRole('menu')).toBeNull();

    await user.click(frame.getByRole('button', { name: 'Show this example' }));
    expect(await frame.findByRole('menu')).toBeInTheDocument();
  });
});

describe('ComponentShowcase accessibility (A11Y-01)', () => {
  it.each([
    ['buttons', 'Buttons'],
    ['forms', 'Forms'],
  ] as const)(
    'has no axe violations in the representative %s section',
    async (id, title) => {
      render(
        <MemoryRouter>
          <ShowcaseSection id={id} title={title} />
        </MemoryRouter>,
      );

      await expectNoAxeViolations(section(title));
    },
    30_000,
  );
});

/** The app's route tree as a dev build has it (tests run with the production `__DEV_ROUTES__` value, false). */
function devTree(): RouteObject[] {
  const [root, ...rest] = routes;
  if (root === undefined) {
    throw new Error('The app has no root route.');
  }
  return [{ ...root, children: [queryBranch(devRoutes), ...(root.children ?? [])] } as RouteObject, ...rest];
}

describe('/dev/components route (D-20, D-22)', () => {
  it('shows the showcase inside the admin shell, with no sidebar item current', async () => {
    const router = createMemoryRouter(devTree(), { initialEntries: ['/dev/components'] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { level: 1 }, { timeout: 10_000 })).toHaveTextContent(
      'Component Showcase',
    );
    expect(screen.getAllByRole('main')).toHaveLength(1);
    const sidebar = document.querySelector('aside nav[aria-label="Admin"]');
    expect(sidebar).not.toBeNull();
    expect(sidebar?.querySelector('[aria-current="page"]')).toBeNull();
    // The shell Topbar comes before main; the Topbar cases inside the page have toggles of their own.
    const [shellToggle] = screen.getAllByRole('button', { name: 'Switch to dark mode' });
    expect(shellToggle?.compareDocumentPosition(screen.getByRole('main'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  }, 20_000);
});

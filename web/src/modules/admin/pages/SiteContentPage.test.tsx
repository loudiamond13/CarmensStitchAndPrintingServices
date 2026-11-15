import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { createMemoryRouter, Link, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { BusinessInfoTab } from '@/modules/admin/components/BusinessInfoTab';
import { SiteContentPage, SiteContentRoute, type SiteContentPanels } from '@/modules/admin/pages/SiteContentPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { sessionResponse } from '@/test/sessionFixtures';
import {
  demoSiteSettings,
  galleryItemsBackend,
  openingHoursBackend,
  productLinesBackend,
  shopClosuresBackend,
  siteSettingsBackend,
  testimonialsBackend,
} from '@/test/siteContentFixtures';

// S0 Site Content, /admin/site-content (D-27, WEB-10; plan 11-12): the Manager's header and tabs.

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  siteSettingsBackend();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

function renderPage(search = '') {
  const router = createMemoryRouter(
    [
      { path: '/admin', element: <p>The dashboard</p> },
      { path: '/admin/site-content', element: <SiteContentRoute /> },
      { path: '/admin/login', element: <p>Sign-in page</p> },
    ],
    { initialEntries: ['/admin/site-content'] },
  );
  const view = render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
        defaultOptions={URL_STATE_DEFAULTS}
        processUrlSearchParams={orderSearchParams}
        hasMemory
      >
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
  return { ...view, router };
}

async function openPage(search = '') {
  const view = renderPage(search);
  await screen.findByLabelText(/^Tagline/);
  return view;
}

describe('the header (D-27)', () => {
  it('shows the h1, the Manager only badge beside it and the subline', async () => {
    await openPage();

    const heading = screen.getByRole('heading', { level: 1, name: 'Site Content' });
    expect(heading).toBeVisible();
    expect(within(heading.parentElement ?? document.body).getByText('Manager only')).toBeVisible();
    expect(screen.getByText('What visitors see on the public website. Changes show there right away.')).toBeVisible();
    expect(document.title).toBe('Site Content · CSPS Admin');
  });

  it('has View Website, a link to the home page in a new tab with the hidden warning', async () => {
    await openPage();

    const link = screen.getByRole('link', { name: /^View Website\s*\(opens in a new tab\)$/ });
    expect(link).toHaveAttribute('href', '/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.getAttribute('rel')).toContain('noreferrer');
  });
});

describe('the tabs (WEB-10)', () => {
  it('lists the tabs that exist so far and selects Business Info by default', async () => {
    await openPage();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Business Info',
      'Hours & Closures',
      'Products',
      'Testimonials',
      'Gallery',
    ]);
    expect(screen.getByRole('tab', { name: 'Business Info' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Business Info' })).toBeVisible();
  });

  it('shows Business Info for a tab name that does not exist', async () => {
    await openPage('?tab=bogus');

    expect(screen.getByRole('tab', { name: 'Business Info' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText(/^Tagline/)).toBeVisible();
  });

  it('opens the Testimonials tab from ?tab=testimonials and shows the Testimonials card in its panel', async () => {
    testimonialsBackend();
    renderPage('?tab=testimonials');

    const panel = await screen.findByRole('tabpanel', { name: 'Testimonials' });
    expect(screen.getByRole('tab', { name: 'Testimonials' })).toHaveAttribute('aria-selected', 'true');
    await within(panel).findByRole('table', { name: 'Testimonials' });
    expect(within(panel).getByRole('heading', { level: 2, name: 'Testimonials' })).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Add Testimonial' })).toBeVisible();
  });

  it('opens the Gallery tab from ?tab=gallery and shows the Gallery card in its panel', async () => {
    galleryItemsBackend();
    productLinesBackend();
    renderPage('?tab=gallery');

    const panel = await screen.findByRole('tabpanel', { name: 'Gallery' });
    expect(screen.getByRole('tab', { name: 'Gallery' })).toHaveAttribute('aria-selected', 'true');
    await within(panel).findByRole('table', { name: 'Gallery items' });
    expect(within(panel).getByRole('heading', { level: 2, name: 'Gallery' })).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Add Photo' })).toBeVisible();
  });

  it('changes to the Testimonials tab at once from another tab, with nothing to discard', async () => {
    testimonialsBackend();
    await openPage();

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Testimonials' }));

    expect(await screen.findByRole('table', { name: 'Testimonials' })).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the Products tab from ?tab=products and shows the Product lines card in its panel', async () => {
    productLinesBackend();
    renderPage('?tab=products');

    const panel = await screen.findByRole('tabpanel', { name: 'Products' });
    expect(screen.getByRole('tab', { name: 'Products' })).toHaveAttribute('aria-selected', 'true');
    await within(panel).findByRole('table', { name: 'Product lines' });
    expect(within(panel).getByRole('heading', { level: 2, name: 'Product lines' })).toBeVisible();
    expect(within(panel).getByRole('link', { name: 'Add Product Line' })).toBeVisible();
  });

  it('changes to the Products tab at once from another tab, with nothing to discard', async () => {
    productLinesBackend();
    await openPage();

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Products' }));

    expect(await screen.findByRole('table', { name: 'Product lines' })).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the Hours & Closures tab from ?tab=hours and shows the Opening hours card in its panel', async () => {
    openingHoursBackend();
    shopClosuresBackend();
    renderPage('?tab=hours');

    const panel = await screen.findByRole('tabpanel', { name: 'Hours & Closures' });
    expect(screen.getByRole('tab', { name: 'Hours & Closures' })).toHaveAttribute('aria-selected', 'true');
    await within(panel).findByRole('checkbox', { name: 'Monday' });
    expect(within(panel).getByRole('heading', { level: 2, name: 'Opening hours' })).toBeVisible();
  });

  it('has the Business Info card inside the tab panel', async () => {
    await openPage();

    const panel = screen.getByRole('tabpanel', { name: 'Business Info' });
    expect(within(panel).getByRole('heading', { level: 2, name: 'Business' })).toBeVisible();
  });
});

describe('accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = await openPage();

    await expectNoAxeViolations(container);
  });
});

// A tab with unsaved changes asks before the page lets it go (08 D-58): a tab change, a move inside the app and a reload.

const TWO_TABS: SiteContentPanels = {
  business: (onDirtyChange) => <BusinessInfoTab onDirtyChange={onDirtyChange} />,
  hours: () => <p>The hours panel</p>,
};

function renderTwoTabs(search = '') {
  const router = createMemoryRouter(
    [
      { path: '/admin', element: <p>The dashboard</p> },
      {
        path: '/admin/site-content',
        element: (
          <>
            <Link to="/admin">Back to the dashboard</Link>
            <SiteContentPage panels={TWO_TABS} />
          </>
        ),
      },
      { path: '/admin/login', element: <p>Sign-in page</p> },
    ],
    { initialEntries: ['/admin/site-content'] },
  );
  const view = render(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter
        searchParams={search}
        defaultOptions={URL_STATE_DEFAULTS}
        processUrlSearchParams={orderSearchParams}
        hasMemory
      >
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
  return { ...view, router, user: userEvent.setup() };
}

async function openTwoTabs() {
  const view = renderTwoTabs();
  await screen.findByLabelText(/^Tagline/);
  return view;
}

async function typeTagline(user: ReturnType<typeof userEvent.setup>, text: string): Promise<void> {
  await user.clear(screen.getByLabelText(/^Tagline/));
  await user.type(screen.getByLabelText(/^Tagline/), text);
}

describe('leaving a tab with unsaved changes (S0, 08 D-58)', () => {
  it('lists both tabs and changes tab at once when nothing is unsaved', async () => {
    const { user } = await openTwoTabs();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Business Info', 'Hours & Closures']);

    await user.click(screen.getByRole('tab', { name: 'Hours & Closures' }));

    expect(screen.getByText('The hours panel')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks Discard changes? when a tab is chosen while Business Info has unsaved changes', async () => {
    const { user } = await openTwoTabs();
    await typeTagline(user, 'Unsaved words.');

    await user.click(screen.getByRole('tab', { name: 'Hours & Closures' }));

    const dialog = await screen.findByRole('dialog', { name: 'Discard changes?' });
    expect(within(dialog).getByRole('button', { name: 'Keep Editing' })).toHaveFocus();
    expect(screen.queryByText('The hours panel')).toBeNull();
  });

  it('keeps the tab and the typed values on Keep Editing', async () => {
    const { user } = await openTwoTabs();
    await typeTagline(user, 'Unsaved words.');
    await user.click(screen.getByRole('tab', { name: 'Hours & Closures' }));

    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Keep Editing' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByRole('tab', { name: 'Business Info' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText(/^Tagline/)).toHaveValue('Unsaved words.');
  });

  it('changes the tab on Discard Changes and shows the saved values when the tab comes back', async () => {
    const { user } = await openTwoTabs();
    await typeTagline(user, 'Unsaved words.');
    await user.click(screen.getByRole('tab', { name: 'Hours & Closures' }));

    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard Changes' }));

    expect(await screen.findByText('The hours panel')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Hours & Closures' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: 'Business Info' }));
    expect(await screen.findByLabelText(/^Tagline/)).toHaveValue(demoSiteSettings.tagline);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not ask again once the changes are saved', async () => {
    const { user } = await openTwoTabs();
    await typeTagline(user, 'Saved words.');
    await user.click(screen.getByRole('button', { name: 'Save Business Info' }));
    await screen.findByText('Business info saved');

    await user.click(screen.getByRole('tab', { name: 'Hours & Closures' }));

    expect(screen.getByText('The hours panel')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sets beforeunload while there are unsaved changes and not otherwise', async () => {
    const { user } = await openTwoTabs();
    const clean = new Event('beforeunload', { cancelable: true });
    act(() => {
      window.dispatchEvent(clean);
    });
    expect(clean.defaultPrevented).toBe(false);

    await typeTagline(user, 'Unsaved words.');
    const dirty = new Event('beforeunload', { cancelable: true });
    act(() => {
      window.dispatchEvent(dirty);
    });

    expect(dirty.defaultPrevented).toBe(true);
  });

  it('asks before a move to another page inside the app, and Keep Editing stays', async () => {
    const { user, router } = await openTwoTabs();
    await typeTagline(user, 'Unsaved words.');

    await user.click(screen.getByRole('link', { name: 'Back to the dashboard' }));

    const dialog = await screen.findByRole('dialog', { name: 'Discard changes?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep Editing' }));
    expect(router.state.location.pathname).toBe('/admin/site-content');
    expect(screen.getByLabelText(/^Tagline/)).toHaveValue('Unsaved words.');
  });

  it('leaves for the other page on Discard Changes', async () => {
    const { user, router } = await openTwoTabs();
    await typeTagline(user, 'Unsaved words.');
    await user.click(screen.getByRole('link', { name: 'Back to the dashboard' }));

    await user.click(
      within(await screen.findByRole('dialog', { name: 'Discard changes?' })).getByRole('button', {
        name: 'Discard Changes',
      }),
    );

    expect(await screen.findByText('The dashboard')).toBeVisible();
    expect(router.state.location.pathname).toBe('/admin');
  });

  it('has no axe violations while the question shows', async () => {
    const { user, container } = await openTwoTabs();
    await typeTagline(user, 'Unsaved words.');
    await user.click(screen.getByRole('tab', { name: 'Hours & Closures' }));
    await screen.findByRole('dialog', { name: 'Discard changes?' });

    await expectNoAxeViolations(container);
  });
});

// The Hours & Closures tab holds unsaved hours (plan 11-16): the same questions, through the real route.
describe('leaving the Hours & Closures tab with unsaved hours (S0, 08 D-58)', () => {
  async function openHours() {
    openingHoursBackend();
    shopClosuresBackend();
    const view = renderPage('?tab=hours');
    await screen.findByRole('checkbox', { name: 'Sunday' });
    return { ...view, user: userEvent.setup() };
  }

  it('asks Discard changes? when another tab is chosen after a day was ticked', async () => {
    const { user } = await openHours();
    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));

    await user.click(screen.getByRole('tab', { name: 'Business Info' }));

    const dialog = await screen.findByRole('dialog', { name: 'Discard changes?' });
    expect(within(dialog).getByRole('button', { name: 'Keep Editing' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Hours & Closures' })).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps the ticked day on Keep Editing, and changes the tab on Discard Changes', async () => {
    const { user } = await openHours();
    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));
    await user.click(screen.getByRole('tab', { name: 'Business Info' }));

    await user.click(
      within(await screen.findByRole('dialog', { name: 'Discard changes?' })).getByRole('button', {
        name: 'Keep Editing',
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByRole('checkbox', { name: 'Sunday' })).toBeChecked();

    await user.click(screen.getByRole('tab', { name: 'Business Info' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Discard changes?' })).getByRole('button', {
        name: 'Discard Changes',
      }),
    );
    expect(await screen.findByLabelText(/^Tagline/)).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Business Info' })).toHaveAttribute('aria-selected', 'true');
  });

  it('changes the tab at once when the hours are as saved, and sets beforeunload only while they are not', async () => {
    const { user } = await openHours();
    const clean = new Event('beforeunload', { cancelable: true });
    act(() => {
      window.dispatchEvent(clean);
    });
    expect(clean.defaultPrevented).toBe(false);

    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));
    const dirty = new Event('beforeunload', { cancelable: true });
    act(() => {
      window.dispatchEvent(dirty);
    });
    expect(dirty.defaultPrevented).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Undo Changes' }));
    await user.click(screen.getByRole('tab', { name: 'Business Info' }));

    expect(await screen.findByLabelText(/^Tagline/)).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

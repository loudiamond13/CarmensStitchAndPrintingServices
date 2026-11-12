import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { SiteContentRoute } from '@/modules/admin/pages/SiteContentPage';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { sessionResponse } from '@/test/sessionFixtures';
import { siteSettingsBackend } from '@/test/siteContentFixtures';

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

    const link = screen.getByRole('link', { name: 'View Website (opens in a new tab)' });
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
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Business Info']);
    expect(screen.getByRole('tab', { name: 'Business Info' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Business Info' })).toBeVisible();
  });

  it('shows Business Info for a tab that does not exist yet', async () => {
    await openPage('?tab=hours');

    expect(screen.getByRole('tab', { name: 'Business Info' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText(/^Tagline/)).toBeVisible();
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

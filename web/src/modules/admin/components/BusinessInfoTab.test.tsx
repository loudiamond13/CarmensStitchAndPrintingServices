import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { createQueryClient } from '@/lib/query/queryClient';
import { BusinessInfoTab } from '@/modules/admin/components/BusinessInfoTab';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { sessionResponse } from '@/test/sessionFixtures';
import { demoSiteSettings, problemAnswer, siteSettingsBackend, versionAfter } from '@/test/siteContentFixtures';

vi.mock('@/lib/public-data/publicResource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/public-data/publicResource')>()),
  invalidatePublicContent: vi.fn(),
}));

// S1 Business Info tab (CONT-01, PUB-03, OR-3; plan 11-12): the saved values, one save that sends the version, and what a save does
// for the public site in this browser.

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
  vi.mocked(invalidatePublicContent).mockClear();
});

function renderTab(onDirtyChange?: (dirty: boolean) => void) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BusinessInfoTab {...(onDirtyChange === undefined ? {} : { onDirtyChange })} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, user: userEvent.setup() };
}

/** Opens the tab and waits until the saved values are in the form. */
async function openTab(onDirtyChange?: (dirty: boolean) => void) {
  const view = renderTab(onDirtyChange);
  await screen.findByLabelText(/^Tagline/);
  return view;
}

async function typeInto(user: ReturnType<typeof userEvent.setup>, label: RegExp, text: string): Promise<void> {
  const field = screen.getByLabelText(label);
  await user.clear(field);
  await user.type(field, text);
}

describe('the saved values (CONT-01)', () => {
  it('shows the Business card with the saved name, tagline, about text and turnaround line', async () => {
    siteSettingsBackend();
    await openTab();

    expect(screen.getByRole('heading', { level: 2, name: 'Business' })).toBeVisible();
    expect(screen.getByText('The name and words visitors see.')).toBeVisible();
    expect(screen.getByLabelText(/^Business name/)).toHaveValue('Sample Shop');
    expect(screen.getByLabelText(/^Tagline/)).toHaveValue(demoSiteSettings.tagline);
    expect(screen.getByLabelText(/^About the shop/)).toHaveValue('A demo shop for tests.');
    expect(screen.getByLabelText(/^Turnaround line/)).toHaveValue('');
  });

  it('has the Save Business Info button', async () => {
    siteSettingsBackend();
    await openTab();

    expect(screen.getByRole('button', { name: 'Save Business Info' })).toBeVisible();
  });
});

describe('saving the tagline (CONT-01, PUB-03)', () => {
  it('sends PUT /api/v1/site-settings with the version it opened with and the new tagline, every other value unchanged', async () => {
    const backend = siteSettingsBackend();
    const { user } = await openTab();

    await typeInto(user, /^Tagline/, 'Made for the whole team.');
    await user.click(screen.getByRole('button', { name: 'Save Business Info' }));

    await waitFor(() => {
      expect(backend.puts).toHaveLength(1);
    });
    expect(backend.puts[0]).toEqual({
      version: demoSiteSettings.version,
      businessName: 'Sample Shop',
      tagline: 'Made for the whole team.',
      aboutText: 'A demo shop for tests.',
      turnaroundLine: null,
      street: '12 Sample St., Poblacion',
      townOrCity: 'Sample City',
      province: 'Sample Province',
      postalCode: '1000',
      directionsUrl: 'https://maps.app.goo.gl/cspsdemo',
      mapEmbedUrl: 'https://www.google.com/maps/embed?pb=cspsdemo',
      messengerUrl: 'https://m.me/cspsdemo',
      facebookUrl: 'https://www.facebook.com/cspsdemo',
      instagramUrl: 'https://www.instagram.com/cspsdemo',
      tiktokUrl: null,
      contactEmail: 'shop@example.test',
      phones: [
        { number: '0917 123 4567', label: 'Globe', isMain: true },
        { number: '02 8123 4567', label: null, isMain: false },
      ],
    });
  });

  it('shows the success toast, clears the public data in this browser and keeps focus on Save', async () => {
    siteSettingsBackend();
    const { user } = await openTab();
    await typeInto(user, /^Tagline/, 'Made for the whole team.');
    const save = screen.getByRole('button', { name: 'Save Business Info' });

    await user.click(save);

    expect(await screen.findByText('Business info saved')).toBeVisible();
    expect(screen.getByText('The website shows the new details now.')).toBeVisible();
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
    expect(save).toHaveFocus();
  });

  it('keeps the saved text in the field and sends the next save with the new version', async () => {
    const backend = siteSettingsBackend();
    const { user } = await openTab();
    await typeInto(user, /^Tagline/, 'First tagline.');
    await user.click(screen.getByRole('button', { name: 'Save Business Info' }));
    await screen.findByText('Business info saved');

    await typeInto(user, /^Tagline/, 'Second tagline.');
    await user.click(screen.getByRole('button', { name: 'Save Business Info' }));

    await waitFor(() => {
      expect(backend.puts).toHaveLength(2);
    });
    expect(screen.getByLabelText(/^Tagline/)).toHaveValue('Second tagline.');
    expect(backend.puts[1]?.version).toBe(versionAfter(1));
  });

  it('shows Saving on the pressed button while the request runs and sends one request however often it is pressed', async () => {
    const gate = Promise.withResolvers<undefined>();
    const backend = siteSettingsBackend(demoSiteSettings, {
      onPut: async () => {
        await gate.promise;
        return undefined;
      },
    });
    const { user } = await openTab();
    await typeInto(user, /^Tagline/, 'Made for the whole team.');
    const save = screen.getByRole('button', { name: 'Save Business Info' });

    await user.click(save);
    await user.click(save);

    expect(await screen.findByRole('button', { name: 'Saving' })).toHaveAttribute('aria-busy', 'true');
    gate.resolve(undefined);
    await screen.findByText('Business info saved');
    expect(backend.puts).toHaveLength(1);
  });

  it('tells the page whether anything is unsaved', async () => {
    siteSettingsBackend();
    const onDirtyChange = vi.fn<(dirty: boolean) => void>();
    const { user } = await openTab(onDirtyChange);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    await user.type(screen.getByLabelText(/^Tagline/), '!');
    await waitFor(() => {
      expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    });

    await user.click(screen.getByRole('button', { name: 'Save Business Info' }));
    await screen.findByText('Business info saved');
    await waitFor(() => {
      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    });
  });

  it('does not clear the public data when the server refuses the save', async () => {
    siteSettingsBackend(demoSiteSettings, { onPut: () => problemAnswer(500) });
    const { user } = await openTab();
    await typeInto(user, /^Tagline/, 'Made for the whole team.');

    await user.click(screen.getByRole('button', { name: 'Save Business Info' }));

    expect(await screen.findByText(/Something went wrong/)).toBeVisible();
    expect(invalidatePublicContent).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^Tagline/)).toHaveValue('Made for the whole team.');
  });
});

describe('accessibility', () => {
  it('has no axe violations once the values have loaded', async () => {
    siteSettingsBackend();
    const { container } = await openTab();

    await expectNoAxeViolations(container);
  });

  it('reads the settings once on open', async () => {
    const backend = siteSettingsBackend();
    await openTab();

    expect(backend.gets).toBe(1);
  });
});

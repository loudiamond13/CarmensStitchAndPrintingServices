import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { createQueryClient } from '@/lib/query/queryClient';
import { BusinessInfoTab } from '@/modules/admin/components/BusinessInfoTab';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { createDeferred } from '@/test/fakeFetch';
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

/** The nth element of a query result; a missing one fails the test with a clear line. */
function nth(list: readonly HTMLElement[], index: number): HTMLElement {
  const element = list[index];
  if (element === undefined) {
    throw new Error(`No element at ${String(index)}.`);
  }
  return element;
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
    const gate = createDeferred<undefined>();
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

describe('the cards (S1)', () => {
  it('shows the six cards in order, each with its hint', async () => {
    siteSettingsBackend();
    await openTab();

    const titles = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(titles).toEqual([
      'Business',
      'Address and map',
      'Phone numbers',
      'Messenger and social links',
      'Email',
      'Time zone and money',
    ]);
    for (const hint of [
      'Where to find the shop.',
      'The main number is the one the Call buttons dial.',
      'Leave a link empty to hide it on the website.',
      "For staff use only. It's not shown on the website.",
      'These stay fixed so every date, status and total lines up.',
    ]) {
      expect(screen.getAllByText(hint).length).toBeGreaterThan(0);
    }
  });

  it('fills every field with the saved value and leaves an unset one empty', async () => {
    siteSettingsBackend();
    await openTab();

    expect(screen.getByLabelText(/^Street and barangay/)).toHaveValue('12 Sample St., Poblacion');
    expect(screen.getByLabelText(/^Town or city/)).toHaveValue('Sample City');
    expect(screen.getByLabelText(/^Province/)).toHaveValue('Sample Province');
    expect(screen.getByLabelText(/^Postal code/)).toHaveValue('1000');
    expect(screen.getByLabelText(/^Directions link/)).toHaveValue('https://maps.app.goo.gl/cspsdemo');
    expect(screen.getByLabelText(/^Map embed link/)).toHaveValue('https://www.google.com/maps/embed?pb=cspsdemo');
    expect(screen.getByLabelText(/^Messenger link/)).toHaveValue('https://m.me/cspsdemo');
    expect(screen.getByLabelText(/^Facebook page/)).toHaveValue('https://www.facebook.com/cspsdemo');
    expect(screen.getByLabelText(/^Instagram/)).toHaveValue('https://www.instagram.com/cspsdemo');
    expect(screen.getByLabelText(/^TikTok/)).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /^Email/ })).toHaveValue('shop@example.test');
  });

  it('shows both saved phone numbers with their labels and the main number chosen', async () => {
    siteSettingsBackend();
    await openTab();

    expect(screen.getAllByLabelText(/^Number/).map((field) => (field as HTMLInputElement).value)).toEqual([
      '0917 123 4567',
      '02 8123 4567',
    ]);
    expect(screen.getAllByRole('radio').map((radio) => (radio as HTMLInputElement).checked)).toEqual([true, false]);
  });

  it('shows the time zone and the money format as read-only text, not as fields', async () => {
    siteSettingsBackend();
    await openTab();

    const card = screen.getByRole('region', { name: 'Time zone and money' });
    expect(within(card).getByText('Time zone')).toBeVisible();
    expect(within(card).getByText('Asia/Manila (Philippine time)')).toBeVisible();
    expect(within(card).getByText('Money and dates')).toBeVisible();
    expect(within(card).getByText('Philippine peso (₱), en-PH')).toBeVisible();
    expect(within(card).queryByRole('textbox')).toBeNull();
  });

  it('shows who last changed the settings and when', async () => {
    siteSettingsBackend();
    await openTab();

    const meta = screen.getByText('Last changed by').closest('div');
    expect(meta).not.toBeNull();
    expect(within(meta as HTMLElement).getByText(/Carmen Reyes/)).toBeVisible();
  });

  it('sends every field a Manager did not touch exactly as it was, including the main number', async () => {
    const backend = siteSettingsBackend();
    const { user } = await openTab();

    await typeInto(user, /^Street and barangay/, '99 New St., Poblacion');
    await user.click(screen.getByRole('button', { name: 'Save Business Info' }));

    await waitFor(() => {
      expect(backend.puts).toHaveLength(1);
    });
    expect(backend.puts[0]).toMatchObject({
      street: '99 New St., Poblacion',
      tagline: demoSiteSettings.tagline,
      phones: [
        { number: '0917 123 4567', label: 'Globe', isMain: true },
        { number: '02 8123 4567', label: null, isMain: false },
      ],
    });
  });
});

describe('the phone numbers inside the form (D-23)', () => {
  it('saves an added number and a changed main number', async () => {
    const backend = siteSettingsBackend();
    const { user } = await openTab();

    await user.click(screen.getByRole('button', { name: 'Add Number' }));
    const fields = screen.getAllByLabelText(/^Number/);
    await user.type(nth(fields, 2), '0918 765 4321');
    await user.click(nth(screen.getAllByRole('radio'), 2));
    await user.click(screen.getByRole('button', { name: 'Save Business Info' }));

    await waitFor(() => {
      expect(backend.puts).toHaveLength(1);
    });
    expect(backend.puts[0]?.phones).toEqual([
      { number: '0917 123 4567', label: 'Globe', isMain: false },
      { number: '02 8123 4567', label: null, isMain: false },
      { number: '0918 765 4321', label: null, isMain: true },
    ]);
  });

  it('shows the message of a refused number under its own row, before any request', async () => {
    const backend = siteSettingsBackend();
    const { user } = await openTab();

    const first = nth(screen.getAllByLabelText(/^Number/), 0);
    await user.clear(first);
    await user.type(first, '0917 123 456');
    await user.tab();

    expect(await screen.findByText('Enter a phone number, like 0917 123 4567 or 02 8123 4567.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save Business Info' }));
    expect(backend.puts).toHaveLength(0);
  });

  it('shows This number is already listed under the later row', async () => {
    siteSettingsBackend();
    const { user } = await openTab();

    const second = nth(screen.getAllByLabelText(/^Number/), 1);
    await user.clear(second);
    await user.type(second, '+63 917 123 4567');
    await user.click(screen.getByRole('button', { name: 'Save Business Info' }));

    expect(await screen.findByText('This number is already listed.')).toBeVisible();
  });
});

describe('every rule runs in the browser first (OR-3)', () => {
  it('shows the message of an empty required field when the person leaves it, with no request', async () => {
    const backend = siteSettingsBackend();
    const { user } = await openTab();

    await user.clear(screen.getByLabelText(/^Business name/));
    await user.tab();

    expect(await screen.findByText('Enter the business name.')).toBeVisible();
    expect(screen.getByLabelText(/^Business name/)).toHaveAttribute('aria-invalid', 'true');
    expect(backend.puts).toHaveLength(0);
  });

  it('sends nothing on submit while a rule is broken, and puts focus on the first invalid field', async () => {
    const backend = siteSettingsBackend();
    const { user } = await openTab();

    await user.clear(screen.getByLabelText(/^Province/));
    await user.clear(screen.getByLabelText(/^Street and barangay/));
    await user.click(screen.getByRole('button', { name: 'Save Business Info' }));

    expect(await screen.findByText('Enter the street and barangay.')).toBeVisible();
    expect(screen.getByText('Enter the province.')).toBeVisible();
    expect(screen.getByLabelText(/^Street and barangay/)).toHaveFocus();
    expect(backend.puts).toHaveLength(0);
  });

  it('checks a field again as it is typed in once a submit has failed', async () => {
    siteSettingsBackend();
    const { user } = await openTab();
    await user.clear(screen.getByLabelText(/^Tagline/));
    await user.click(screen.getByRole('button', { name: 'Save Business Info' }));
    await screen.findByText('Enter a tagline.');

    await user.type(screen.getByLabelText(/^Tagline/), 'A');

    await waitFor(() => {
      expect(screen.queryByText('Enter a tagline.')).toBeNull();
    });
  });

  it('shows the link message under a refused Facebook link', async () => {
    siteSettingsBackend();
    const { user } = await openTab();

    await typeInto(user, /^Facebook page/, 'https://l.facebook.com/x');
    await user.tab();

    expect(
      await screen.findByText('Paste your Facebook page link, like https://www.facebook.com/yourpage.'),
    ).toBeVisible();
  });

  it('keeps only the src link when the whole Google embed code is pasted into Map embed link and the field is left', async () => {
    const backend = siteSettingsBackend();
    const { user } = await openTab();
    const field = screen.getByLabelText(/^Map embed link/);
    await user.clear(field);

    fireEvent.change(field, {
      target: {
        value:
          '<iframe src="https://www.google.com/maps/embed?pb=newmap" width="600" height="450" loading="lazy"></iframe>',
      },
    });
    fireEvent.blur(field);

    await waitFor(() => {
      expect(field).toHaveValue('https://www.google.com/maps/embed?pb=newmap');
    });
    await user.click(screen.getByRole('button', { name: 'Save Business Info' }));
    await waitFor(() => {
      expect(backend.puts).toHaveLength(1);
    });
    expect(backend.puts[0]?.mapEmbedUrl).toBe('https://www.google.com/maps/embed?pb=newmap');
  });

  it('refuses pasted code whose src is not a Google embed link, and leaves the text as pasted', async () => {
    siteSettingsBackend();
    const { user } = await openTab();
    const field = screen.getByLabelText(/^Map embed link/);
    await user.clear(field);

    fireEvent.change(field, { target: { value: '<iframe src="https://evil.example/x"></iframe>' } });
    fireEvent.blur(field);

    expect(
      await screen.findByText(
        'Paste the embed code or link from Google Maps. It starts with https://www.google.com/maps/embed.',
      ),
    ).toBeVisible();
    expect(field).toHaveValue('<iframe src="https://evil.example/x"></iframe>');
  });
});

describe('what the server says wins (400)', () => {
  it('puts the message of a field the server refused under that field and focuses it, with no failure toast', async () => {
    siteSettingsBackend(demoSiteSettings, {
      onPut: () => problemAnswer(400, { errors: { tagline: ['The server did not like this tagline.'] } }),
    });
    const { user } = await openTab();

    await user.click(screen.getByRole('button', { name: 'Save Business Info' }));

    expect(await screen.findByText('The server did not like this tagline.')).toBeVisible();
    expect(screen.getByLabelText(/^Tagline/)).toHaveFocus();
    expect(screen.queryByText('Business info saved')).toBeNull();
  });

  it('puts the message of a phone row the server refused under that row', async () => {
    siteSettingsBackend(demoSiteSettings, {
      onPut: () => problemAnswer(400, { errors: { 'phones[1].number': ['The server refused this number.'] } }),
    });
    const { user } = await openTab();

    await user.click(screen.getByRole('button', { name: 'Save Business Info' }));

    expect(await screen.findByText('The server refused this number.')).toBeVisible();
    expect(screen.getAllByLabelText(/^Number/)[1]).toHaveFocus();
  });

  it('shows a message for a field this form does not draw as a danger toast', async () => {
    siteSettingsBackend(demoSiteSettings, {
      onPut: () => problemAnswer(400, { errors: { version: ['The version is not valid.'] } }),
    });
    const { user } = await openTab();

    await user.click(screen.getByRole('button', { name: 'Save Business Info' }));

    expect(await screen.findByText('The version is not valid.')).toBeVisible();
  });
});

describe('accessibility of the whole form', () => {
  it('has no axe violations while errors are showing', async () => {
    siteSettingsBackend();
    const { container, user } = await openTab();
    await user.clear(screen.getByLabelText(/^Business name/));
    await user.clear(nth(screen.getAllByLabelText(/^Number/), 0));
    await user.click(screen.getByRole('button', { name: 'Save Business Info' }));
    await screen.findByText('Enter the business name.');

    await expectNoAxeViolations(container);
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

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { createQueryClient } from '@/lib/query/queryClient';
import { HoursTab } from '@/modules/admin/components/HoursTab';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { sessionResponse } from '@/test/sessionFixtures';
import { demoOpeningHours, openingHoursBackend } from '@/test/siteContentFixtures';

vi.mock('@/lib/public-data/publicResource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/public-data/publicResource')>()),
  invalidatePublicContent: vi.fn(),
}));

// S2 Hours & Closures tab (CONT-01, CONT-04, PUB-03, OR-3; plan 11-16): the weekly hours card and what a save does for the public site.

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
        <HoursTab {...(onDirtyChange === undefined ? {} : { onDirtyChange })} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, user: userEvent.setup() };
}

/** Opens the tab and waits until the week is in the form. */
async function openTab(onDirtyChange?: (dirty: boolean) => void) {
  const view = renderTab(onDirtyChange);
  await screen.findByRole('checkbox', { name: 'Monday' });
  return view;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

function opens(day: string): HTMLElement {
  return screen.getByRole('combobox', { name: new RegExp(`^${day} opens$`, 'i') });
}

function closes(day: string): HTMLElement {
  return screen.getByRole('combobox', { name: new RegExp(`^${day} closes$`, 'i') });
}

describe('the Opening hours card (D-21, CONT-01)', () => {
  it('has the card heading and hint and seven day checkboxes, Monday to Sunday, ticked for the open days', async () => {
    openingHoursBackend();
    await openTab();

    expect(screen.getByRole('heading', { level: 2, name: 'Opening hours' })).toBeVisible();
    expect(screen.getByText('One opening and closing time per day.')).toBeVisible();
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.map((box) => box.closest('label')?.textContent)).toEqual([...DAYS]);
    expect(boxes.map((box) => (box as HTMLInputElement).checked)).toEqual([true, true, true, true, true, true, false]);
  });

  it('gives an open day its Opens and Closes selects at the saved times, and a closed day the word Closed', async () => {
    openingHoursBackend();
    await openTab();

    expect(opens('Monday')).toHaveValue('09:00');
    expect(closes('Monday')).toHaveValue('18:00');
    expect(screen.queryByRole('combobox', { name: /^Sunday opens$/i })).toBeNull();
    expect(screen.getByText('Closed')).toBeVisible();
  });

  it('offers the times every 30 minutes from 5:00 AM to 11:30 PM', async () => {
    openingHoursBackend();
    await openTab();

    const options = within(opens('Monday')).getAllByRole('option');
    expect(options).toHaveLength(38);
    expect(options[0]).toHaveTextContent('5:00 AM');
    expect(options[1]).toHaveTextContent('5:30 AM');
    expect(options.at(-1)).toHaveTextContent('11:30 PM');
  });

  it('keeps a saved time that is not on the list as one more choice, so nothing changes by itself', async () => {
    openingHoursBackend({
      ...demoOpeningHours,
      days: demoOpeningHours.days.map((day) => (day.day === 1 ? { ...day, opensAt: '09:15' } : day)),
    });
    await openTab();

    expect(opens('Monday')).toHaveValue('09:15');
  });

  it('reads the week to visitors under the rows: "Visitors see: Mon-Sat · 9:00 AM - 6:00 PM"', async () => {
    openingHoursBackend();
    await openTab();

    expect(screen.getByText('Visitors see: Mon-Sat · 9:00 AM - 6:00 PM')).toBeVisible();
  });

  it('reads "Visitors see: Closed every day" when no day is ticked', async () => {
    openingHoursBackend({
      ...demoOpeningHours,
      days: demoOpeningHours.days.map((day) => ({ day: day.day, opensAt: null, closesAt: null })),
    });
    await openTab();

    expect(screen.getByText('Visitors see: Closed every day')).toBeVisible();
  });

  it('has no axe violations', async () => {
    openingHoursBackend();
    const { container } = await openTab();

    await expectNoAxeViolations(container);
  });
});

describe('ticking Sunday open and saving (D-21, CONT-01, PUB-03)', () => {
  it('starts a ticked day at 9:00 AM to 6:00 PM and updates the preview as the times are chosen', async () => {
    openingHoursBackend();
    const { user } = await openTab();

    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));

    expect(opens('Sunday')).toHaveValue('09:00');
    expect(closes('Sunday')).toHaveValue('18:00');
    expect(screen.queryByText('Closed')).toBeNull();
    expect(screen.getByText('Visitors see: Mon-Sun · 9:00 AM - 6:00 PM')).toBeVisible();

    await user.selectOptions(opens('Sunday'), '10:00');
    await user.selectOptions(closes('Sunday'), '15:00');

    expect(screen.getByText('Visitors see: Mon-Sat · 9:00 AM - 6:00 PM')).toBeVisible();
    expect(screen.getByText('Sun · 10:00 AM - 3:00 PM')).toBeVisible();
  });

  it('sends PUT /api/v1/opening-hours with the version it opened with and all seven days', async () => {
    const backend = openingHoursBackend();
    const { user } = await openTab();
    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));
    await user.selectOptions(opens('Sunday'), '10:00');
    await user.selectOptions(closes('Sunday'), '15:00');

    await user.click(screen.getByRole('button', { name: 'Save Hours' }));

    await waitFor(() => {
      expect(backend.puts).toHaveLength(1);
    });
    expect(backend.puts[0]).toEqual({
      version: demoOpeningHours.version,
      days: [
        { day: 1, opensAt: '09:00', closesAt: '18:00' },
        { day: 2, opensAt: '09:00', closesAt: '18:00' },
        { day: 3, opensAt: '09:00', closesAt: '18:00' },
        { day: 4, opensAt: '09:00', closesAt: '18:00' },
        { day: 5, opensAt: '09:00', closesAt: '18:00' },
        { day: 6, opensAt: '09:00', closesAt: '18:00' },
        { day: 7, opensAt: '10:00', closesAt: '15:00' },
      ],
    });
  });

  it('shows the toast, clears the public data in this browser and keeps the saved week on screen', async () => {
    openingHoursBackend();
    const { user } = await openTab();
    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));
    await user.selectOptions(opens('Sunday'), '10:00');
    await user.selectOptions(closes('Sunday'), '15:00');

    await user.click(screen.getByRole('button', { name: 'Save Hours' }));

    expect(await screen.findByText('Opening hours saved')).toBeVisible();
    expect(screen.getByText('The Contact page and the open status use them now.')).toBeVisible();
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
    expect(opens('Sunday')).toHaveValue('10:00');
    expect(screen.getByText('Sun · 10:00 AM - 3:00 PM')).toBeVisible();
  });

  it('sends a second save with the version the first one answered, so one tab can save twice', async () => {
    const backend = openingHoursBackend();
    const { user } = await openTab();
    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));
    await user.click(screen.getByRole('button', { name: 'Save Hours' }));
    await screen.findByText('Opening hours saved');

    await user.selectOptions(closes('Sunday'), '17:00');
    await user.click(screen.getByRole('button', { name: 'Save Hours' }));

    await waitFor(() => {
      expect(backend.puts).toHaveLength(2);
    });
    expect(backend.puts[1]?.version).toBe('AAAAAAAAC01=');
  });

  it('checks every rule in the browser first: a closing time before opening sends nothing and shows the message', async () => {
    const backend = openingHoursBackend();
    const { user } = await openTab();
    await user.selectOptions(closes('Monday'), '08:00');

    await user.click(screen.getByRole('button', { name: 'Save Hours' }));

    expect(await screen.findByText('Closing time must be after opening time.')).toBeVisible();
    expect(closes('Monday')).toHaveFocus();
    expect(backend.puts).toHaveLength(0);
  });
});

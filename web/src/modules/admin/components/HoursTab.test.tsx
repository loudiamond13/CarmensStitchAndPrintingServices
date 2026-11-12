import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { createQueryClient } from '@/lib/query/queryClient';
import { HoursTab } from '@/modules/admin/components/HoursTab';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { createDeferred } from '@/test/fakeFetch';
import { server } from '@/test/msw';

import { sessionResponse } from '@/test/sessionFixtures';
import {
  businessTodayIs,
  demoClosures,
  demoOpeningHours,
  openingHoursBackend,
  problemAnswer,
  shopClosuresBackend,
} from '@/test/siteContentFixtures';

vi.mock('@/lib/public-data/publicResource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/public-data/publicResource')>()),
  invalidatePublicContent: vi.fn(),
}));

// S2 Hours & Closures tab (CONT-01, CONT-04, PUB-03, OR-3; plan 11-16): the weekly hours card, the closures card and what a save does for the public site.

// axe over the seven day rows takes longer than the 5 second default on a busy machine.
vi.setConfig({ testTimeout: 15_000 });

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  shopClosuresBackend();
  businessTodayIs('2026-11-12');
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

// Card B: the Holidays and closures (CONT-04, D-22).

const [CHRISTMAS, NEW_YEAR] = demoClosures;
if (CHRISTMAS === undefined || NEW_YEAR === undefined) {
  throw new Error('The demo closures are empty.');
}

/** Opens the tab and waits until both cards have their data. */
async function openBoth(onDirtyChange?: (dirty: boolean) => void) {
  const view = await openTab(onDirtyChange);
  await screen.findByRole('table', { name: 'Upcoming closures' });
  return view;
}

const addButton = (): HTMLElement => screen.getByRole('button', { name: 'Add Closure' });
const editOn = (day: string): HTMLElement => screen.getByRole('button', { name: `Edit closure on ${day}` });
const deleteOn = (day: string): HTMLElement => screen.getByRole('button', { name: `Delete closure on ${day}` });

describe('the Holidays and closures card (CONT-04)', () => {
  it('has the heading, the hint and an Add Closure button in the head', async () => {
    openingHoursBackend();
    await openBoth();

    expect(screen.getByRole('heading', { level: 2, name: 'Holidays and closures' })).toBeVisible();
    expect(
      screen.getByText(
        'Days the shop is closed. The Contact page lists them, and the open or closed status follows them.',
      ),
    ).toBeVisible();
    expect(addButton()).toBeVisible();
  });

  it('lists the upcoming closures by first day: one day with its note, a range with the note empty', async () => {
    openingHoursBackend();
    await openBoth();

    const table = screen.getByRole('table', { name: 'Upcoming closures' });
    const [, christmas, newYear] = within(table).getAllByRole('row');
    expect(within(christmas ?? table).getByText('Dec 25, 2026')).toBeVisible();
    expect(within(christmas ?? table).getByText('Christmas')).toBeVisible();
    expect(within(newYear ?? table).getByText('Dec 30, 2026 to Jan 1, 2027')).toBeVisible();
    expect(within(newYear ?? table).getByText('Not set')).toBeInTheDocument();
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Date', 'Public note', 'Actions']);
  });

  it('names each row action by its date: Edit closure on Dec 25, 2026 and Delete closure on Dec 25, 2026', async () => {
    openingHoursBackend();
    await openBoth();

    expect(editOn('Dec 25, 2026')).toBeVisible();
    expect(deleteOn('Dec 25, 2026')).toBeVisible();
    expect(editOn('Dec 30, 2026 to Jan 1, 2027')).toBeVisible();
    expect(deleteOn('Dec 30, 2026 to Jan 1, 2027')).toBeVisible();
  });

  it('shows the empty state with no extra button when no closure is coming up', async () => {
    openingHoursBackend();
    shopClosuresBackend([]);
    renderTab();

    expect(await screen.findByRole('heading', { name: 'No closures coming up' })).toBeVisible();
    expect(screen.getByText("Add holidays and special closures so visitors know when you're closed.")).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Add Closure' })).toHaveLength(1);
  });

  it('has no axe violations with closures listed', async () => {
    openingHoursBackend();
    const { container } = await openBoth();

    await expectNoAxeViolations(container);
  });

  it('has no axe violations with no closure coming up', async () => {
    openingHoursBackend();
    shopClosuresBackend([]);
    const { container } = renderTab();
    await screen.findByRole('heading', { name: 'No closures coming up' });

    await expectNoAxeViolations(container);
  });
});

describe('adding a closure (CONT-04, PUB-03)', () => {
  it('opens the window from Add Closure with the business today as the first day', async () => {
    openingHoursBackend();
    const { user } = await openBoth();

    await user.click(addButton());

    const dialog = await screen.findByRole('dialog', { name: 'Add Closure' });
    await waitFor(() => {
      expect(within(dialog).getByLabelText(/^First day/)).toHaveValue('2026-11-12');
    });
  });

  it('saves, closes, shows the toast, reads the list again, clears the public data and moves focus to the new row Edit', async () => {
    openingHoursBackend();
    const backend = shopClosuresBackend();
    const { user } = await openBoth();
    await user.click(addButton());
    const dialog = await screen.findByRole('dialog', { name: 'Add Closure' });
    const first = within(dialog).getByLabelText(/^First day/);
    await waitFor(() => {
      expect(first).toHaveValue('2026-11-12');
    });
    fireEvent.change(first, { target: { value: '2026-12-31' } });
    await user.type(within(dialog).getByLabelText(/^Public note/), 'New Year');

    await user.click(within(dialog).getByRole('button', { name: 'Save Closure' }));

    expect(await screen.findByText('Closure added')).toBeVisible();
    expect(screen.getByText('Dec 31, 2026 shows as closed.')).toBeVisible();
    expect(screen.queryByRole('dialog', { name: 'Add Closure' })).toBeNull();
    expect(backend.posts).toHaveLength(1);
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(editOn('Dec 31, 2026')).toHaveFocus();
    });
    expect(backend.gets).toBeGreaterThanOrEqual(2);
  });
});

describe('editing a closure (CONT-04)', () => {
  it('opens the window with the closure, saves, shows "Closure saved" and returns focus to the row Edit', async () => {
    openingHoursBackend();
    const backend = shopClosuresBackend();
    const { user } = await openBoth();
    await user.click(editOn('Dec 25, 2026'));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Closure' });
    const note = within(dialog).getByLabelText(/^Public note/);
    expect(note).toHaveValue('Christmas');
    await user.clear(note);
    await user.type(note, 'Christmas Day');

    await user.click(within(dialog).getByRole('button', { name: 'Save Closure' }));

    expect(await screen.findByText('Closure saved')).toBeVisible();
    expect(screen.getByText('The Contact page shows the change.')).toBeVisible();
    expect(backend.puts).toHaveLength(1);
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
    expect(await screen.findByText('Christmas Day')).toBeVisible();
    await waitFor(() => {
      expect(editOn('Dec 25, 2026')).toHaveFocus();
    });
  });
});

describe('deleting a closure (CONT-04)', () => {
  it('asks "Delete this closure?" with the date and the normal-hours line, and Cancel is focused first', async () => {
    openingHoursBackend();
    const { user } = await openBoth();

    await user.click(deleteOn('Dec 25, 2026'));

    const dialog = await screen.findByRole('dialog', { name: 'Delete this closure?' });
    expect(within(dialog).getByText('Dec 25, 2026. The shop shows its normal hours that day.')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Delete Closure' })).toBeVisible();
  });

  it('Cancel deletes nothing and returns focus to the Delete button', async () => {
    openingHoursBackend();
    const backend = shopClosuresBackend();
    const { user } = await openBoth();
    await user.click(deleteOn('Dec 25, 2026'));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this closure?' });

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Delete this closure?' })).toBeNull();
    });
    expect(backend.deletes).toHaveLength(0);
    expect(deleteOn('Dec 25, 2026')).toHaveFocus();
  });

  it('removes the row, shows "Closure deleted", clears the public data and moves focus to the next row Edit', async () => {
    openingHoursBackend();
    const backend = shopClosuresBackend();
    const { user } = await openBoth();
    await user.click(deleteOn('Dec 25, 2026'));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this closure?' });

    await user.click(within(dialog).getByRole('button', { name: 'Delete Closure' }));

    expect(await screen.findByText('Closure deleted')).toBeVisible();
    expect(screen.getByText('Dec 25, 2026 shows normal hours.')).toBeVisible();
    expect(backend.deletes).toEqual([CHRISTMAS.id]);
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Edit closure on Dec 25, 2026' })).toBeNull();
    });
    await waitFor(() => {
      expect(editOn('Dec 30, 2026 to Jan 1, 2027')).toHaveFocus();
    });
  });

  it('moves focus to the previous row Edit when the last row is deleted', async () => {
    openingHoursBackend();
    shopClosuresBackend();
    const { user } = await openBoth();
    await user.click(deleteOn('Dec 30, 2026 to Jan 1, 2027'));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this closure?' });

    await user.click(within(dialog).getByRole('button', { name: 'Delete Closure' }));

    await waitFor(() => {
      expect(editOn('Dec 25, 2026')).toHaveFocus();
    });
  });

  it('moves focus to Add Closure when the only row is deleted, and shows the empty state', async () => {
    openingHoursBackend();
    shopClosuresBackend([CHRISTMAS]);
    const { user } = await openBoth();
    await user.click(deleteOn('Dec 25, 2026'));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this closure?' });

    await user.click(within(dialog).getByRole('button', { name: 'Delete Closure' }));

    expect(await screen.findByRole('heading', { name: 'No closures coming up' })).toBeVisible();
    await waitFor(() => {
      expect(addButton()).toHaveFocus();
    });
  });

  it('on a 404 closes the question, says "Already deleted" and reads the list again', async () => {
    openingHoursBackend();
    const backend = shopClosuresBackend(demoClosures, {
      onDelete: (id, current) => {
        current.current = current.current.filter((closure) => closure.id !== id);
        return problemAnswer(404, { code: 'shop-closures.not-found' });
      },
    });
    const { user } = await openBoth();
    await user.click(deleteOn('Dec 25, 2026'));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this closure?' });

    await user.click(within(dialog).getByRole('button', { name: 'Delete Closure' }));

    expect(await screen.findByText('Already deleted')).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Delete this closure?' })).toBeNull();
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Edit closure on Dec 25, 2026' })).toBeNull();
    });
    expect(backend.gets).toBeGreaterThanOrEqual(2);
  });

  it('has no axe violations with the question open', async () => {
    openingHoursBackend();
    const { user, baseElement } = await openBoth();
    await user.click(deleteOn('Dec 25, 2026'));
    await screen.findByRole('dialog', { name: 'Delete this closure?' });

    await expectNoAxeViolations(baseElement);
  });
});

// Conflicts, unsaved changes and failures (SEC-07, 05 D-20, 08 D-58; plan 11-16, Task 3).

const hoursCard = (): HTMLElement => screen.getByRole('region', { name: 'Opening hours' });

/** The save answers 409 once, with Saturday's closing time changed by someone else in the meantime. */
function staleHoursOnce() {
  let refused = false;
  return openingHoursBackend(demoOpeningHours, {
    onPut: (_body, backend) => {
      if (refused) {
        return undefined;
      }
      refused = true;
      backend.current = {
        ...demoOpeningHours,
        days: demoOpeningHours.days.map((day) => (day.day === 6 ? { ...day, closesAt: '13:00' } : day)),
        version: 'AAAAAAAAC77=',
        updatedByName: 'Lito Santos',
      };
      return problemAnswer(409, { code: 'edit.stale' });
    },
  });
}

describe('a stale save of the hours (409, SEC-07, 05 D-20)', () => {
  it('shows the conflict banner inside the Opening hours card and keeps every typed choice', async () => {
    staleHoursOnce();
    const { user } = await openBoth();
    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));
    await user.selectOptions(closes('Sunday'), '15:00');

    await user.click(screen.getByRole('button', { name: 'Save Hours' }));

    const banner = await within(hoursCard()).findByRole('alert');
    expect(within(banner).getByText('This was changed by someone else.')).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'Sunday' })).toBeChecked();
    expect(closes('Sunday')).toHaveValue('15:00');
    expect(screen.queryByText('Opening hours saved')).toBeNull();
    expect(invalidatePublicContent).not.toHaveBeenCalled();
    expect(within(screen.getByRole('region', { name: 'Holidays and closures' })).queryByRole('alert')).toBeNull();
  });

  it('puts focus on Load Latest', async () => {
    staleHoursOnce();
    const { user } = await openBoth();
    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));

    await user.click(screen.getByRole('button', { name: 'Save Hours' }));

    expect(await screen.findByRole('button', { name: 'Load Latest' })).toHaveFocus();
  });

  it('asks Discard changes? before Load Latest replaces what was typed, and Keep Editing leaves it all as it was', async () => {
    const backend = staleHoursOnce();
    const { user } = await openBoth();
    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));
    await user.click(screen.getByRole('button', { name: 'Save Hours' }));
    await user.click(await screen.findByRole('button', { name: 'Load Latest' }));

    const dialog = await screen.findByRole('dialog', { name: 'Discard changes?' });
    expect(within(dialog).getByRole('button', { name: 'Keep Editing' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Keep Editing' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByRole('checkbox', { name: 'Sunday' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Load Latest' })).toBeVisible();
    expect(backend.gets).toBe(1);
  });

  it('shows the latest week after Discard Changes, drops the banner and sends the next save with the new version', async () => {
    const backend = staleHoursOnce();
    const { user } = await openBoth();
    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));
    await user.click(screen.getByRole('button', { name: 'Save Hours' }));
    await user.click(await screen.findByRole('button', { name: 'Load Latest' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Discard changes?' })).getByRole('button', {
        name: 'Discard Changes',
      }),
    );

    await waitFor(() => {
      expect(closes('Saturday')).toHaveValue('13:00');
    });
    expect(screen.getByRole('checkbox', { name: 'Sunday' })).not.toBeChecked();
    expect(screen.queryByRole('button', { name: 'Load Latest' })).toBeNull();
    expect(backend.gets).toBe(2);

    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));
    await user.click(screen.getByRole('button', { name: 'Save Hours' }));
    await waitFor(() => {
      expect(backend.puts).toHaveLength(2);
    });
    expect(backend.puts[1]?.version).toBe('AAAAAAAAC77=');
  });

  it('has no axe violations while the banner shows', async () => {
    staleHoursOnce();
    const { user, container } = await openBoth();
    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));
    await user.click(screen.getByRole('button', { name: 'Save Hours' }));
    await screen.findByRole('button', { name: 'Load Latest' });

    await expectNoAxeViolations(container);
  });
});

describe('Undo Changes (S2 card A)', () => {
  it('is aria-disabled while nothing changed and does nothing when pressed', async () => {
    const backend = openingHoursBackend();
    const { user } = await openBoth();
    const undo = screen.getByRole('button', { name: 'Undo Changes' });

    expect(undo).toHaveAttribute('aria-disabled', 'true');
    await user.click(undo);

    expect(backend.puts).toHaveLength(0);
    expect(screen.getByRole('checkbox', { name: 'Sunday' })).not.toBeChecked();
  });

  it('puts every day back to the saved week at once, with no question and no request', async () => {
    const backend = openingHoursBackend();
    const { user } = await openBoth();
    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));
    await user.selectOptions(opens('Monday'), '07:00');
    const undo = screen.getByRole('button', { name: 'Undo Changes' });
    expect(undo).toHaveAttribute('aria-disabled', 'false');

    await user.click(undo);

    expect(screen.getByRole('checkbox', { name: 'Sunday' })).not.toBeChecked();
    expect(opens('Monday')).toHaveValue('09:00');
    expect(screen.getByText('Visitors see: Mon-Sat · 9:00 AM - 6:00 PM')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(backend.puts).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Undo Changes' })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('unsaved hours (08 D-58)', () => {
  it('tells its page when the week differs from the saved one, and when it is saved again', async () => {
    openingHoursBackend();
    const onDirtyChange = vi.fn();
    const { user } = await openBoth(onDirtyChange);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    await user.click(screen.getByRole('button', { name: 'Save Hours' }));
    await screen.findByText('Opening hours saved');
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('is not unsaved when a day is ticked and unticked again, even though the form still holds its times', async () => {
    openingHoursBackend();
    const onDirtyChange = vi.fn();
    const { user } = await openBoth(onDirtyChange);

    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));
    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('tells its page the week is clean again after Undo Changes and when the tab closes', async () => {
    openingHoursBackend();
    const onDirtyChange = vi.fn();
    const { user, unmount } = await openBoth(onDirtyChange);
    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    await user.click(screen.getByRole('button', { name: 'Undo Changes' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    unmount();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });
});

describe('what the server says about the hours (400)', () => {
  it('puts the server message under the time it names, in place of the browser one, and focuses it', async () => {
    const backend = openingHoursBackend(demoOpeningHours, {
      onPut: () => problemAnswer(400, { errors: { 'Days[6].ClosesAt': ['Closing time must be after opening time.'] } }),
    });
    const { user } = await openBoth();
    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));

    await user.click(screen.getByRole('button', { name: 'Save Hours' }));

    expect(await screen.findByText('Closing time must be after opening time.')).toBeVisible();
    expect(closes('Sunday')).toHaveFocus();
    expect(closes('Sunday')).toHaveAttribute('aria-invalid', 'true');
    expect(backend.puts).toHaveLength(1);
    expect(invalidatePublicContent).not.toHaveBeenCalled();
  });

  it('says what went wrong in a toast when no shown time matches the key', async () => {
    openingHoursBackend(demoOpeningHours, { onPut: () => problemAnswer(500) });
    const { user } = await openBoth();
    await user.click(screen.getByRole('checkbox', { name: 'Sunday' }));

    await user.click(screen.getByRole('button', { name: 'Save Hours' }));

    expect(await screen.findByText('Something went wrong')).toBeVisible();
    expect(invalidatePublicContent).not.toHaveBeenCalled();
  });
});

describe('each card fails on its own (UI loading and error)', () => {
  it('shows "Loading the opening hours…" and "Loading closures…" while each card waits', async () => {
    const gate = createDeferred<undefined>();
    server.use(
      http.get('*/api/v1/opening-hours', async () => {
        await gate.promise;
        return HttpResponse.json(demoOpeningHours);
      }),
      http.get('*/api/v1/shop-closures', async () => {
        await gate.promise;
        return HttpResponse.json(demoClosures);
      }),
    );
    renderTab();

    expect(await screen.findByText('Loading the opening hours…')).toBeInTheDocument();
    expect(screen.getByText('Loading closures…')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Monday' })).toBeNull();

    gate.resolve(undefined);
    await screen.findByRole('checkbox', { name: 'Monday' });
    expect(await screen.findByRole('table', { name: 'Upcoming closures' })).toBeVisible();
  });

  it('shows "Couldn\'t load the opening hours." with Try Again while the closures card still loads', async () => {
    server.use(http.get('*/api/v1/opening-hours', () => problemAnswer(500)));
    const { user } = renderTab();

    expect(await screen.findByText("Couldn't load the opening hours.")).toBeVisible();
    expect(await screen.findByRole('table', { name: 'Upcoming closures' })).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'Holidays and closures' })).queryByRole('alert')).toBeNull();

    openingHoursBackend();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByRole('checkbox', { name: 'Monday' })).toBeVisible();
  });

  it('shows "Couldn\'t load closures." with Try Again while the hours card still works', async () => {
    server.use(http.get('*/api/v1/shop-closures', () => problemAnswer(500)));
    openingHoursBackend();
    const { user } = renderTab();

    expect(await screen.findByText("Couldn't load closures.")).toBeVisible();
    expect(await screen.findByRole('checkbox', { name: 'Monday' })).toBeVisible();

    shopClosuresBackend();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByRole('table', { name: 'Upcoming closures' })).toBeVisible();
  });

  it('has no axe violations in either error state', async () => {
    server.use(
      http.get('*/api/v1/opening-hours', () => problemAnswer(500)),
      http.get('*/api/v1/shop-closures', () => problemAnswer(500)),
    );
    const { container } = renderTab();
    await screen.findByText("Couldn't load the opening hours.");
    await screen.findByText("Couldn't load closures.");

    await expectNoAxeViolations(container);
  });
});

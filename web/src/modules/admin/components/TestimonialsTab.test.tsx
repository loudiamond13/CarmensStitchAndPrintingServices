import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { createQueryClient } from '@/lib/query/queryClient';
import { TestimonialsTab } from '@/modules/admin/components/TestimonialsTab';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { createDeferred } from '@/test/fakeFetch';
import { sessionResponse } from '@/test/sessionFixtures';
import {
  demoTestimonials,
  problemAnswer,
  TESTIMONIAL_IDS,
  testimonialsBackend,
  type TestimonialFixture,
} from '@/test/siteContentFixtures';

vi.mock('@/lib/public-data/publicResource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/public-data/publicResource')>()),
  invalidatePublicContent: vi.fn(),
}));

// S5 Testimonials tab (CONT-03, D-05; plan 11-24): the ordered list of every testimonial, shown and hidden, with its row actions.

// axe over four rows takes longer than the 5 second default on a busy machine.
vi.setConfig({ testTimeout: 15_000 });

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

function renderTab() {
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <TestimonialsTab />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

async function openTab() {
  const view = renderTab();
  const table = await screen.findByRole('table', { name: 'Testimonials' });
  return { ...view, table };
}

/** The body rows of the table, in order. */
function bodyRows(table: HTMLElement): HTMLElement[] {
  return within(table).getAllByRole('row').slice(1);
}

/** The text of one cell of a row, by its phone label. */
function cellText(row: HTMLElement, label: string): string {
  return row.querySelector(`td[data-label="${label}"]`)?.textContent ?? '';
}

/** A named button of the list (a row action), whether or not it is aria-disabled. */
function action(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

/** The demo testimonials with the change `patches` makes to the ones at those places. */
function demoWith(patches: Record<number, Partial<TestimonialFixture>>): TestimonialFixture[] {
  return demoTestimonials().map((item, index) => ({ ...item, ...patches[index] }));
}

/** Five testimonials, all shown, so only the first three are on the Home page. */
function fiveShown(): TestimonialFixture[] {
  return [
    ...demoTestimonials().map((item) => ({ ...item, isShown: true })),
    {
      id: '3a7d9e10-0000-4000-8000-000000000005',
      quote: 'A fifth made up quote.',
      name: 'Dina Lopez',
      teamOrRole: 'Manager, Sample Court Club',
      stars: 3,
      position: 5,
      isShown: true,
      version: 'AAAAAAAAG05=',
    },
  ];
}

describe('the Testimonials card (S5, CONT-03)', () => {
  it('has the card heading and hint and the Add Testimonial button', async () => {
    testimonialsBackend();
    await openTab();

    expect(screen.getByRole('heading', { level: 2, name: 'Testimonials' })).toBeVisible();
    expect(screen.getByText('The first 3 shown testimonials appear on the Home page, in this order.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add Testimonial' })).toBeVisible();
  });

  it('names the columns Quote, Name, Stars, Status and a hidden Actions', async () => {
    testimonialsBackend();
    const { table } = await openTab();

    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Quote', 'Name', 'Stars', 'Status', 'Actions']);
  });

  it('lists the testimonials in display order, the name over the team or role', async () => {
    testimonialsBackend();
    const { table } = await openTab();

    const rows = bodyRows(table);
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => cellText(row, 'Name'))).toEqual([
      'Juan Dela CruzCaptain, Brgy. Sample Ballers',
      'Ana ReyesCoach, Sample City Spikers',
      'Ben SantosPresident, Sample Riders MC',
      'Carlo Mendoza',
    ]);
    expect(rows.map((row) => cellText(row, 'Quote'))[0]).toBe('Seventeen pieces, names and numbers perfect.');
  });

  it('writes the stars as "5 stars" and "1 star", with one decorative star beside the words', async () => {
    testimonialsBackend();
    const { table } = await openTab();

    const rows = bodyRows(table);
    expect(rows.map((row) => cellText(row, 'Stars'))).toEqual(['5 stars', '5 stars', '4 stars', '1 star']);
    for (const row of rows) {
      const cell = row.querySelector('td[data-label="Stars"]');
      expect(cell?.querySelectorAll('svg')).toHaveLength(1);
      expect(cell?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('says Shown or Hidden in each status badge, and "On the Home page" under only the first 3 shown rows', async () => {
    testimonialsBackend(fiveShown());
    const { table } = await openTab();

    const rows = bodyRows(table);
    expect(rows.map((row) => cellText(row, 'Status'))).toEqual([
      'ShownOn the Home page',
      'ShownOn the Home page',
      'ShownOn the Home page',
      'Shown',
      'Shown',
    ]);
  });

  it('counts only shown rows toward the first 3: a hidden row in front does not take a place on the Home page', async () => {
    testimonialsBackend(demoWith({ 0: { isShown: false }, 3: { isShown: true } }));
    const { table } = await openTab();

    expect(bodyRows(table).map((row) => cellText(row, 'Status'))).toEqual([
      'Hidden',
      'ShownOn the Home page',
      'ShownOn the Home page',
      'ShownOn the Home page',
    ]);
  });

  it('names each row action for the person, each with a matching title', async () => {
    testimonialsBackend();
    await openTab();

    for (const name of [
      'Move testimonial from Ana Reyes up',
      'Move testimonial from Ana Reyes down',
      'Edit testimonial from Ana Reyes',
      'Hide testimonial from Ana Reyes',
      'Delete testimonial from Ana Reyes',
      'Show testimonial from Carlo Mendoza',
    ]) {
      expect(action(name)).toHaveAttribute('title', name);
    }
  });

  it('clamps a long quote to 2 lines in its cell, and breaks long words anywhere', async () => {
    testimonialsBackend(demoWith({ 0: { quote: 'Q'.repeat(300) } }));
    const { table } = await openTab();

    const clamped = bodyRows(table)[0]?.querySelector('td[data-label="Quote"] .line-clamp-2');
    expect(clamped).not.toBeNull();
    expect(clamped).toHaveClass('wrap-anywhere');
    expect(clamped?.textContent).toBe('Q'.repeat(300));
  });

  it('shows the quote as typed: markup in it stays text', async () => {
    testimonialsBackend(demoWith({ 0: { quote: 'Great <b>jerseys</b> & fast' } }));
    const { table } = await openTab();

    expect(bodyRows(table).map((row) => cellText(row, 'Quote'))[0]).toBe('Great <b>jerseys</b> & fast');
    expect(table.querySelector('b')).toBeNull();
  });

  it('has no axe violations', async () => {
    testimonialsBackend();
    const { container } = await openTab();

    await expectNoAxeViolations(container);
  });
});

describe('the list states (S5)', () => {
  it('says Loading testimonials while the first answer is on its way, then it is loaded', async () => {
    const gate = createDeferred<undefined>();
    testimonialsBackend(undefined, {
      onGet: async () => {
        await gate.promise;
        return undefined;
      },
    });
    renderTab();

    expect(await screen.findByText('Loading testimonials…')).toBeInTheDocument();
    gate.resolve(undefined);
    expect(await screen.findByRole('table', { name: 'Testimonials' })).toBeVisible();
    expect(screen.getByText('Testimonials loaded.')).toBeInTheDocument();
  });

  it("says Couldn't load testimonials with Try Again, and Try Again reads the list again", async () => {
    let fail = true;
    const backend = testimonialsBackend(undefined, { onGet: () => (fail ? problemAnswer(500) : undefined) });
    const { container } = renderTab();

    expect(await screen.findByText("Couldn't load testimonials.")).toBeVisible();
    await expectNoAxeViolations(container);
    fail = false;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByRole('table', { name: 'Testimonials' })).toBeVisible();
    expect(backend.gets).toBe(2);
  });

  it('with none says No testimonials yet and what to do, and has no button of its own (the head holds Add Testimonial)', async () => {
    testimonialsBackend([]);
    const { container } = renderTab();

    expect(await screen.findByText('No testimonials yet')).toBeVisible();
    expect(screen.getByText('Add what customers say about you. The Home page shows the first 3.')).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Add Testimonial' })).toHaveLength(1);
    await expectNoAxeViolations(container);
  });
});

describe('Add Testimonial and Edit (S5)', () => {
  it('opens the add window, saves, and puts focus on the new row Edit with the toast', async () => {
    const backend = testimonialsBackend();
    const user = userEvent.setup();
    const { table } = await openTab();
    await user.click(screen.getByRole('button', { name: 'Add Testimonial' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add Testimonial' });
    await user.type(within(dialog).getByLabelText(/^Quote/), 'Fast and neat.');
    await user.type(within(dialog).getByLabelText(/^Name/), 'Eli Cruz');

    await user.click(within(dialog).getByRole('button', { name: 'Save Testimonial' }));

    expect(await screen.findByText('Testimonial added')).toBeVisible();
    expect(backend.posts[0]?.body).toMatchObject({ name: 'Eli Cruz', isShown: true, stars: 5 });
    await waitFor(() => {
      expect(bodyRows(table)).toHaveLength(5);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit testimonial from Eli Cruz' })).toHaveFocus();
    });
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });

  it('opens the edit window with the whole quote, saves it with the version, and keeps focus on the same row Edit', async () => {
    const backend = testimonialsBackend(demoWith({ 1: { quote: 'L'.repeat(300) } }));
    const user = userEvent.setup();
    await openTab();
    await user.click(action('Edit testimonial from Ana Reyes'));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Testimonial' });
    expect(within(dialog).getByLabelText(/^Quote/)).toHaveValue('L'.repeat(300));
    await user.clear(within(dialog).getByLabelText(/^Team or role/));
    await user.type(within(dialog).getByLabelText(/^Team or role/), 'Head coach');

    await user.click(within(dialog).getByRole('button', { name: 'Save Testimonial' }));

    expect(await screen.findByText('Testimonial saved')).toBeVisible();
    expect(backend.puts[0]?.id).toBe(TESTIMONIAL_IDS.ana);
    expect(backend.puts[0]?.body).toMatchObject({ teamOrRole: 'Head coach', version: 'AAAAAAAAG02=' });
    await waitFor(() => {
      expect(action('Edit testimonial from Ana Reyes')).toHaveFocus();
    });
  });

  it('on a stale save shows the conflict banner and keeps the typed values', async () => {
    testimonialsBackend(undefined, { onPut: () => problemAnswer(409, { code: 'edit.stale' }) });
    const user = userEvent.setup();
    await openTab();
    await user.click(action('Edit testimonial from Ana Reyes'));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Testimonial' });
    await user.type(within(dialog).getByLabelText(/^Name/), ' Jr');

    await user.click(within(dialog).getByRole('button', { name: 'Save Testimonial' }));

    expect(await within(dialog).findByText('This was changed by someone else.')).toBeVisible();
    expect(within(dialog).getByLabelText(/^Name/)).toHaveValue('Ana Reyes Jr');
  });
});

describe('Move up and Move down (S5, D-51)', () => {
  it('moves Ana up at once with no question: the request, the public data cleared, the focus staying on its Move up and a polite line', async () => {
    const backend = testimonialsBackend();
    const user = userEvent.setup();
    const { table } = await openTab();

    await user.click(action('Move testimonial from Ben Santos up'));

    expect(await screen.findByText('Testimonial from Ben Santos moved to position 2 of 4.')).toBeInTheDocument();
    expect(backend.moves).toEqual([
      expect.objectContaining({ id: TESTIMONIAL_IDS.ben, direction: 'up', key: expect.stringMatching(/\S/) as string }),
    ]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(action('Move testimonial from Ben Santos up')).toHaveFocus();
    });
    await waitFor(() => {
      expect(bodyRows(table).map((row) => cellText(row, 'Name').slice(0, 5))).toEqual([
        'Juan ',
        'Ben S',
        'Ana R',
        'Carlo',
      ]);
    });
    expect(backend.gets).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Testimonial from Ben Santos moved to position 2 of 4.')).toHaveAttribute('role', 'status');
  });

  it('after a move to the first place, Move up is aria-disabled and focus goes to the Move down of the same row', async () => {
    testimonialsBackend();
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Move testimonial from Ana Reyes up'));

    expect(await screen.findByText('Testimonial from Ana Reyes moved to position 1 of 4.')).toBeInTheDocument();
    await waitFor(() => {
      expect(action('Move testimonial from Ana Reyes down')).toHaveFocus();
    });
    expect(action('Move testimonial from Ana Reyes up')).toHaveAttribute('aria-disabled', 'true');
  });

  it('after a move to the last place, Move down is aria-disabled and focus goes to the Move up of the same row', async () => {
    testimonialsBackend();
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Move testimonial from Ben Santos down'));

    expect(await screen.findByText('Testimonial from Ben Santos moved to position 4 of 4.')).toBeInTheDocument();
    await waitFor(() => {
      expect(action('Move testimonial from Ben Santos up')).toHaveFocus();
    });
    expect(action('Move testimonial from Ben Santos down')).toHaveAttribute('aria-disabled', 'true');
  });

  it('keeps the first row Move up and the last row Move down aria-disabled but focusable, and a press sends nothing', async () => {
    const backend = testimonialsBackend();
    const user = userEvent.setup();
    await openTab();
    const first = action('Move testimonial from Juan Dela Cruz up');
    const last = action('Move testimonial from Carlo Mendoza down');

    expect(first).toHaveAttribute('aria-disabled', 'true');
    expect(last).toHaveAttribute('aria-disabled', 'true');
    first.focus();
    expect(first).toHaveFocus();
    await user.click(first);
    await user.click(last);

    expect(backend.moves).toHaveLength(0);
  });

  it('while one row saves, the pressed control is busy and keeps focus, and every other row action is aria-disabled and ignores a press', async () => {
    const gate = createDeferred<undefined>();
    const backend = testimonialsBackend(undefined, {
      onMove: async () => {
        await gate.promise;
        return undefined;
      },
    });
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Move testimonial from Ben Santos up'));

    await waitFor(() => {
      expect(action('Move testimonial from Ben Santos up')).toHaveAttribute('aria-busy', 'true');
    });
    expect(action('Hide testimonial from Ana Reyes')).toHaveAttribute('aria-disabled', 'true');
    expect(action('Edit testimonial from Ana Reyes')).toHaveAttribute('aria-disabled', 'true');
    expect(action('Move testimonial from Ben Santos up')).toHaveFocus();
    await user.click(action('Hide testimonial from Ana Reyes'));
    expect(backend.hides).toHaveLength(0);

    gate.resolve(undefined);
    expect(await screen.findByText('Testimonial from Ben Santos moved to position 2 of 4.')).toBeInTheDocument();
  });

  it('shows a danger toast with the shared error line when a move fails, and changes nothing', async () => {
    testimonialsBackend(undefined, { onMove: () => problemAnswer(500) });
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Move testimonial from Ben Santos up'));

    expect(await screen.findByText("Couldn't move the testimonial from Ben Santos")).toBeVisible();
    expect(invalidatePublicContent).not.toHaveBeenCalled();
  });

  it('sends a new Idempotency-Key for the same move once a lost answer and the list read again show it already ran', async () => {
    let answerLost = true;
    const backend = testimonialsBackend(undefined, {
      onMove: (_id, _direction, current) => {
        if (!answerLost) {
          return undefined;
        }
        // The move ran on the server, but its answer never came back.
        if (current.moves.length === 1) {
          const items = [...current.items];
          const index = items.findIndex((item) => item.name === 'Ben Santos');
          const above = items[index - 1];
          const ben = items[index];
          if (above !== undefined && ben !== undefined) {
            items[index - 1] = ben;
            items[index] = above;
          }
          current.items = items.map((item, place) => ({ ...item, position: place + 1 }));
        }
        return problemAnswer(500);
      },
    });
    const user = userEvent.setup();
    const { table } = await openTab();

    await user.click(action('Move testimonial from Ben Santos up'));
    expect(await screen.findByText("Couldn't move the testimonial from Ben Santos")).toBeVisible();
    await waitFor(() => {
      expect(
        bodyRows(table)
          .map((row) => cellText(row, 'Name'))
          .at(1),
      ).toContain('Ben Santos');
    });
    answerLost = false;
    const firstKey = backend.moves[0]?.key;
    const sent = backend.moves.length;
    await user.click(action('Move testimonial from Ben Santos up'));

    await waitFor(() => {
      expect(backend.moves).toHaveLength(sent + 1);
    });
    expect(backend.moves[sent]?.key).not.toBe(firstKey);
  });

  it('keeps the same Idempotency-Key for the same move while the list read again does not show it yet, because it may still be running on the server', async () => {
    const backend = testimonialsBackend(undefined, { onMove: () => problemAnswer(500) });
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Move testimonial from Ben Santos up'));
    expect(await screen.findByText("Couldn't move the testimonial from Ben Santos")).toBeVisible();
    await waitFor(() => {
      expect(backend.gets).toBeGreaterThanOrEqual(2);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    await user.click(action('Move testimonial from Ben Santos up'));

    await waitFor(() => {
      expect(backend.moves).toHaveLength(2);
    });
    expect(backend.moves[1]?.key).toBe(backend.moves[0]?.key);
  });
});

describe('Hide and Show (S5, PUB-03)', () => {
  it('keeps the same Idempotency-Key for a repeated Hide while the list read again does not show it yet, because it may still be running on the server', async () => {
    const backend = testimonialsBackend(undefined, { onHide: () => problemAnswer(500) });
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Hide testimonial from Ana Reyes'));
    expect(await screen.findByText("Couldn't hide the testimonial from Ana Reyes")).toBeVisible();
    await waitFor(() => {
      expect(backend.gets).toBeGreaterThanOrEqual(2);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    await user.click(action('Hide testimonial from Ana Reyes'));

    await waitFor(() => {
      expect(backend.hideKeys).toHaveLength(2);
    });
    expect(backend.hideKeys[1]).toBe(backend.hideKeys[0]);
  });

  it('hides a testimonial at once: the toast, the public data cleared, the badge Hidden and focus staying on the toggle, now Show', async () => {
    const backend = testimonialsBackend();
    const user = userEvent.setup();
    const { table } = await openTab();

    await user.click(action('Hide testimonial from Ana Reyes'));

    expect(await screen.findByText('Testimonial hidden')).toBeVisible();
    expect(screen.getByText('The Home page shows the change.')).toBeVisible();
    expect(backend.hides).toEqual([TESTIMONIAL_IDS.ana]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(action('Show testimonial from Ana Reyes')).toHaveFocus();
    });
    expect(bodyRows(table).map((row) => cellText(row, 'Status'))).toEqual([
      'ShownOn the Home page',
      'Hidden',
      'ShownOn the Home page',
      'Hidden',
    ]);
  });

  it('shows a hidden testimonial again with its toast and keeps focus on the toggle, now Hide', async () => {
    const backend = testimonialsBackend();
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Show testimonial from Carlo Mendoza'));

    expect(await screen.findByText('Testimonial shown')).toBeVisible();
    expect(backend.shows).toEqual([TESTIMONIAL_IDS.carlo]);
    await waitFor(() => {
      expect(action('Hide testimonial from Carlo Mendoza')).toHaveFocus();
    });
  });

  it('shows a danger toast when a hide fails, and the row keeps its action', async () => {
    testimonialsBackend(undefined, { onHide: () => problemAnswer(500) });
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Hide testimonial from Ana Reyes'));

    expect(await screen.findByText("Couldn't hide the testimonial from Ana Reyes")).toBeVisible();
    expect(action('Hide testimonial from Ana Reyes')).toBeVisible();
    expect(invalidatePublicContent).not.toHaveBeenCalled();
  });
});

describe('Delete (S5)', () => {
  it('asks "Delete this testimonial?" with the person and the start of the quote, Cancel focused first, and deletes nothing on Cancel', async () => {
    const backend = testimonialsBackend();
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Delete testimonial from Juan Dela Cruz'));

    const dialog = await screen.findByRole('dialog', { name: 'Delete this testimonial?' });
    expect(
      within(dialog).getByText("Juan Dela Cruz: “Seventeen pieces, names and numbers perfect.” It's removed for good."),
    ).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Delete Testimonial' })).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(backend.deletes).toHaveLength(0);
  });

  it('shows only the start of a long quote, ending in an ellipsis', async () => {
    testimonialsBackend(demoWith({ 0: { quote: `${'Seventeen pieces, '.repeat(10)}end` } }));
    const user = userEvent.setup();
    await openTab();

    await user.click(action('Delete testimonial from Juan Dela Cruz'));

    const dialog = await screen.findByRole('dialog', { name: 'Delete this testimonial?' });
    expect(
      within(dialog).getByText(/^Juan Dela Cruz: “Seventeen pieces, .{0,40}…” It's removed for good\.$/),
    ).toBeVisible();
    expect(within(dialog).queryByText(/end/)).toBeNull();
  });

  it('deletes on Delete Testimonial: the toast, the row gone, the public data cleared and focus on the Edit of the next row', async () => {
    const backend = testimonialsBackend();
    const user = userEvent.setup();
    const { table } = await openTab();
    await user.click(action('Delete testimonial from Ana Reyes'));

    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete Testimonial' }));

    expect(await screen.findByText('Testimonial deleted')).toBeVisible();
    expect(screen.getByText('The Home page shows the change.')).toBeVisible();
    expect(backend.deletes).toEqual([TESTIMONIAL_IDS.ana]);
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(bodyRows(table)).toHaveLength(3);
    });
    await waitFor(() => {
      expect(action('Edit testimonial from Ben Santos')).toHaveFocus();
    });
  });

  it('puts focus on the Edit of the previous row when the last row is deleted', async () => {
    testimonialsBackend();
    const user = userEvent.setup();
    await openTab();
    await user.click(action('Delete testimonial from Carlo Mendoza'));

    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete Testimonial' }));

    await waitFor(() => {
      expect(action('Edit testimonial from Ben Santos')).toHaveFocus();
    });
  });

  it('puts focus on Add Testimonial when the only row is deleted', async () => {
    const [only] = demoTestimonials();
    testimonialsBackend(only === undefined ? [] : [only]);
    const user = userEvent.setup();
    await openTab();
    await user.click(action('Delete testimonial from Juan Dela Cruz'));

    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete Testimonial' }));

    expect(await screen.findByText('No testimonials yet')).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add Testimonial' })).toHaveFocus();
    });
  });

  it('says Already deleted and reads the list again when it was deleted by someone else', async () => {
    const backend = testimonialsBackend(undefined, {
      onDelete: (id, held) => {
        held.items = held.items.filter((item) => item.id !== id);
        return problemAnswer(404, { code: 'testimonials.not-found' });
      },
    });
    const user = userEvent.setup();
    await openTab();
    await user.click(action('Delete testimonial from Ana Reyes'));

    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete Testimonial' }));

    expect(await screen.findByText('Already deleted')).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Edit testimonial from Ana Reyes' })).toBeNull();
    });
    expect(backend.gets).toBe(2);
  });

  it('shows the shared error line in the question when the delete fails, and keeps the row', async () => {
    testimonialsBackend(undefined, { onDelete: () => problemAnswer(500) });
    const user = userEvent.setup();
    await openTab();
    await user.click(action('Delete testimonial from Ana Reyes'));
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Delete Testimonial' }));

    expect(await within(dialog).findByRole('alert')).toBeVisible();
    expect(invalidatePublicContent).not.toHaveBeenCalled();
  });

  it('has no axe violations while the Delete question shows', async () => {
    testimonialsBackend();
    const user = userEvent.setup();
    const { container } = await openTab();
    await user.click(action('Delete testimonial from Ana Reyes'));
    await screen.findByRole('dialog', { name: 'Delete this testimonial?' });

    await expectNoAxeViolations(container);
  });
});

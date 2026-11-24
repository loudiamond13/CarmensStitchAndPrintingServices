import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { QuoteNotesCard } from '@/modules/admin/components/QuoteNotesCard';
import type {
  QuoteRequestDetailResponse,
  QuoteRequestNote,
  QuoteRequestNoteAdded,
} from '@/modules/admin/services/quoteRequestsService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { MARIA, quoteProblem, quoteRequestDetail, quoteRequestId } from '@/test/quoteRequestFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The Notes card of the quote request page (D-17, OR-3; UI-SPEC R2 item 4): an add-only list, newest first, and the Add a note box.

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

const ID = quoteRequestId(1);
const NOTES_PATH = /\/api\/v1\/quote-requests\/([0-9a-f-]{36})\/notes$/;

/** A made-up second staff member. */
const JOSE = { id: '00000000-0000-4000-8000-0000000000a2', name: 'Jose Ramos', formerStaff: true } as const;

function note(
  n: number,
  text: string,
  createdAtUtc: string,
  createdBy: QuoteRequestNote['createdBy'] = MARIA,
): QuoteRequestNote {
  return { id: quoteRequestId(100 + n), text, createdBy, createdAtUtc };
}

function added(): QuoteRequestNoteAdded {
  return { id: ID, noteId: quoteRequestId(199), createdAtUtc: '2026-11-21T09:00:00Z', version: 'AAAAAAAAB9J=' };
}

interface Posted {
  id: string;
  body: unknown;
  key: string | null;
}

/** Answers POST /quote-requests/{id}/notes with `answer` (by default the slim answer) and records each call. */
function notesBackend(
  answer: () => QuoteRequestNoteAdded | Response | Promise<QuoteRequestNoteAdded | Response> = added,
) {
  const posts: Posted[] = [];
  server.use(
    http.post(NOTES_PATH, async ({ request }) => {
      const id = NOTES_PATH.exec(new URL(request.url).pathname)?.[1] ?? '';
      posts.push({ id, body: await request.json(), key: request.headers.get('Idempotency-Key') });
      const body = await answer();
      return body instanceof Response ? body : HttpResponse.json(body);
    }),
  );
  return posts;
}

interface Callbacks {
  onAdded?: (answer: QuoteRequestNoteAdded) => void;
  onConflict?: () => void;
}

function renderCard(request: QuoteRequestDetailResponse = quoteRequestDetail(ID), callbacks: Callbacks = {}) {
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <QuoteNotesCard
          request={request}
          onAdded={callbacks.onAdded ?? vi.fn()}
          onConflict={callbacks.onConflict ?? vi.fn()}
        />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user, ...view };
}

function box(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Add a note' });
}

describe('the list (UI-SPEC R2 empty and zero-one-many)', () => {
  it('shows the title, the hint and "No notes yet." when there are none', () => {
    renderCard();

    const card = screen.getByRole('region', { name: 'Internal notes' });
    expect(
      within(card).getByText("Only staff see these. A note can't be changed or removed after it's added."),
    ).toBeVisible();
    expect(within(card).getByText('No notes yet.')).toBeVisible();
    expect(within(card).queryByRole('list')).toBeNull();
  });

  it('lists one note with its author, the time and the text', () => {
    renderCard(quoteRequestDetail(ID, { notes: [note(1, 'Asked for the size chart.', '2026-11-21T08:05:00Z')] }));

    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Maria Santos');
    expect(items[0]).toHaveTextContent('Nov 21, 2026, 4:05 PM');
    expect(items[0]).toHaveTextContent('Asked for the size chart.');
    expect(screen.queryByText('No notes yet.')).toBeNull();
  });

  it('lists many notes in the order the server sends them, newest first, and keeps line breaks', () => {
    renderCard(
      quoteRequestDetail(ID, {
        notes: [
          note(2, 'Line one\nLine two', '2026-11-21T09:30:00Z', JOSE),
          note(1, 'Asked for the size chart.', '2026-11-21T08:05:00Z'),
        ],
      }),
    );

    const list = screen.getByRole('list');
    expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Jose Ramos'),
      expect.stringContaining('Maria Santos'),
    ]);
    const newest = items[0];
    if (newest === undefined) throw new Error('No newest note.');
    expect(newest).toHaveTextContent('(former staff)');
    const text = within(newest).getByText(/Line one/);
    expect(text.textContent).toBe('Line one\nLine two');
    expect(text.className).toContain('whitespace-pre-wrap');
  });
});

describe('Add Note (D-17, OR-3)', () => {
  it('says "Write a note first." under the box and sends nothing when the box is empty or only spaces', async () => {
    const posts = notesBackend();
    const { user } = renderCard();

    await user.click(screen.getByRole('button', { name: 'Add Note' }));
    expect(await screen.findByText('Write a note first.')).toBeVisible();
    expect(box()).toHaveAttribute('aria-invalid', 'true');
    expect(box()).toHaveFocus();

    await user.type(box(), '   ');
    await user.click(screen.getByRole('button', { name: 'Add Note' }));
    expect(screen.getByText('Write a note first.')).toBeVisible();
    expect(posts).toHaveLength(0);
  });

  it('says "Keep the note to 1,000 characters or fewer." and sends nothing for 1,001 characters', async () => {
    const posts = notesBackend();
    const { user } = renderCard();

    await user.click(box());
    await user.paste('a'.repeat(1001));
    await user.click(screen.getByRole('button', { name: 'Add Note' }));

    expect(await screen.findByText('Keep the note to 1,000 characters or fewer.')).toBeVisible();
    expect(posts).toHaveLength(0);
  });

  it('posts the trimmed note with an Idempotency-Key, shows Adding, then clears the box, keeps focus and says "Note added."', async () => {
    let answer: (value: QuoteRequestNoteAdded) => void = () => undefined;
    const posts = notesBackend(
      () =>
        new Promise<QuoteRequestNoteAdded>((resolve) => {
          answer = resolve;
        }),
    );
    const onAdded = vi.fn();
    const { user } = renderCard(quoteRequestDetail(ID), { onAdded });

    await user.type(box(), '  Called back, wants 12.  ');
    await user.click(screen.getByRole('button', { name: 'Add Note' }));

    expect(await screen.findByRole('button', { name: 'Adding' })).toBeVisible();
    expect(box()).toBeEnabled();
    await waitFor(() => {
      expect(posts).toHaveLength(1);
    });
    expect(posts[0]?.id).toBe(ID);
    expect(posts[0]?.body).toEqual({ text: 'Called back, wants 12.' });
    expect(posts[0]?.key).toMatch(/\S/);

    answer(added());

    await waitFor(() => {
      expect(onAdded).toHaveBeenCalledWith(added());
    });
    expect(box()).toHaveValue('');
    expect(box()).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Note added.');
    expect(screen.getByRole('button', { name: 'Add Note' })).toBeVisible();
  });

  it('sends a second note with a new Idempotency-Key', async () => {
    const posts = notesBackend();
    const { user } = renderCard();

    await user.type(box(), 'First');
    await user.click(screen.getByRole('button', { name: 'Add Note' }));
    await waitFor(() => {
      expect(box()).toHaveValue('');
    });
    await user.type(box(), 'Second');
    await user.click(screen.getByRole('button', { name: 'Add Note' }));

    await waitFor(() => {
      expect(posts).toHaveLength(2);
    });
    expect(posts[1]?.body).toEqual({ text: 'Second' });
    expect(posts[1]?.key).not.toBe(posts[0]?.key);
  });

  it('keeps the typed note and tells the page on a 409', async () => {
    notesBackend(() => quoteProblem(409, { code: 'quote-requests.conflict' }));
    const onConflict = vi.fn();
    const onAdded = vi.fn();
    const { user } = renderCard(quoteRequestDetail(ID), { onConflict, onAdded });

    await user.type(box(), 'Do not lose me');
    await user.click(screen.getByRole('button', { name: 'Add Note' }));

    await waitFor(() => {
      expect(onConflict).toHaveBeenCalledTimes(1);
    });
    expect(box()).toHaveValue('Do not lose me');
    expect(onAdded).not.toHaveBeenCalled();
  });

  it("puts the server's sentence under the box on a 400 with field errors, keeping the text", async () => {
    notesBackend(
      () =>
        new HttpResponse(JSON.stringify({ title: 'x', status: 400, errors: { text: ['Write a note first.'] } }), {
          status: 400,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
    );
    const { user } = renderCard();

    await user.type(box(), 'Looks fine here');
    await user.click(screen.getByRole('button', { name: 'Add Note' }));

    expect(await screen.findByText('Write a note first.')).toBeVisible();
    expect(box()).toHaveValue('Looks fine here');
    expect(box()).toHaveFocus();
  });

  it('shows a danger toast and keeps the text when the note cannot be sent', async () => {
    notesBackend(() => quoteProblem(500));
    const { user } = renderCard();

    await user.type(box(), 'Keep this');
    await user.click(screen.getByRole('button', { name: 'Add Note' }));

    expect(await screen.findByText("Couldn't add the note")).toBeVisible();
    expect(box()).toHaveValue('Keep this');
  });

  it('has no axe violations, with notes and with an error under the box', async () => {
    const { user, container } = renderCard(
      quoteRequestDetail(ID, { notes: [note(1, 'Asked for the size chart.', '2026-11-21T08:05:00Z')] }),
    );
    await expectNoAxeViolations(container);

    await user.click(screen.getByRole('button', { name: 'Add Note' }));
    await screen.findByText('Write a note first.');
    await expectNoAxeViolations(container);
  });
});

// The photos of the Get a Quote form (UI-SPEC Q2 and Q3; INQ-02, D-01, D-03, D-05, D-43): the picker loads on the first tap, the
// text is saved first, then each photo goes to its own place, at most two at a time, with the upload key the create call declared.
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ToastProvider } from '@/components/feedback/ToastProvider';
import { expectNoAxeViolations } from '@/test/axe';
import { pngFile } from '@/test/quotePhotoFixtures';
import { answerQuote, QUOTE_ID } from '@/test/quoteFixtures';
import { quoteService, type QuoteService } from '../services/quoteService';
import { QuoteForm } from './QuoteForm';

const SEND = { name: 'Send Inquiry' } as const;

function renderForm() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <ToastProvider>{children}</ToastProvider>
    </MemoryRouter>
  );
  return render(<QuoteForm />, { wrapper });
}

async function fillRequired(name = 'Juan Dela Cruz', number = '0917 123 4567') {
  await userEvent.type(screen.getByRole('textbox', { name: /Your name/ }), name);
  await userEvent.type(screen.getByRole('textbox', { name: /Contact number/ }), number);
}

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error('No file input');
  return input;
}

/** Picks photos through the first file input, then waits until the loaded picker lists them. */
async function pickPhotos(container: HTMLElement, files: File[]) {
  await userEvent.upload(fileInput(container), files);
  const list = await screen.findByRole('list', { name: 'Photos to send' });
  await waitFor(() => {
    expect(within(list).getAllByRole('listitem')).toHaveLength(files.length);
  });
}

type Upload = MockInstance<QuoteService['uploadPhoto']>;

function spyUploads(): Upload {
  return vi.spyOn(quoteService, 'uploadPhoto').mockResolvedValue(undefined);
}

/** An upload the test finishes by hand, so the moment "while they run" can be looked at. */
function holdUploads() {
  const gates: { slot: number; finish: () => void }[] = [];
  const spy = vi.spyOn(quoteService, 'uploadPhoto').mockImplementation(
    (_id, slot) =>
      new Promise<void>((resolve) => {
        gates.push({
          slot,
          finish: () => {
            resolve();
          },
        });
      }),
  );
  return { spy, gates };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('QuoteForm photo area (D-43: the picker loads on the first tap)', () => {
  it('shows the label, a Choose Photos button and the hint before any tap, and no picker yet', () => {
    answerQuote();
    renderForm();

    const group = screen.getByRole('group', { name: /Reference photos/ });
    expect(within(group).getByText('(optional)')).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Choose Photos' })).toBeInTheDocument();
    expect(within(group).getByText(/JPG, PNG, WebP or HEIC photos, up to 10 MB each, up to 5\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'browse' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Photos to send' })).not.toBeInTheDocument();
  });

  it('loads the picker when photos are chosen and lists them, the very Files the visitor picked', async () => {
    answerQuote();
    const { container } = renderForm();
    const logo = pngFile('logo.png');
    const sketch = pngFile('sketch.png', 128);

    await pickPhotos(container, [logo, sketch]);

    expect(screen.getByText('2 of 5 photos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove logo.png' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove sketch.png' })).toBeInTheDocument();
  });

  it('has no axe violations before the tap and with photos picked', async () => {
    answerQuote();
    const { container } = renderForm();
    await expectNoAxeViolations(container);

    await pickPhotos(container, [pngFile('logo.png')]);

    await expectNoAxeViolations(container);
  });
});

describe('QuoteForm sends photos after the text (INQ-02)', () => {
  it('declares the cleaned names and an upload key in the create call, then uploads each photo to its own place with that key', async () => {
    const probe = answerQuote();
    const uploads = spyUploads();
    const { container } = renderForm();
    const logo = pngFile('logo.png');
    const sketch = pngFile('sketch.png', 128);
    await pickPhotos(container, [logo, sketch]);
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
    expect(probe.creates).toHaveLength(1);
    const body = probe.creates[0]?.body;
    expect(body?.photos).toEqual(['logo.png', 'sketch.png']);
    expect(body?.uploadKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(uploads).toHaveBeenCalledTimes(2);
    const calls = uploads.mock.calls;
    const bySlot = [...calls].sort((a, b) => a[1] - b[1]);
    expect(bySlot.map((call) => call[0])).toEqual([QUOTE_ID, QUOTE_ID]);
    expect(bySlot.map((call) => call[1])).toEqual([0, 1]);
    expect(bySlot.map((call) => call[3])).toEqual(['logo.png', 'sketch.png']);
    expect(bySlot.map((call) => call[4])).toEqual([body?.uploadKey, body?.uploadKey]);
    expect(new Set(bySlot.map((call) => call[5])).size).toBe(2);
    expect(bySlot.every((call) => call[5] !== probe.creates[0]?.key)).toBe(true);
  });

  it('sends the File objects the visitor picked, byte for byte (D-05)', async () => {
    answerQuote();
    const uploads = spyUploads();
    const { container } = renderForm();
    const logo = pngFile('logo.png', 300);
    await pickPhotos(container, [logo]);
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
    const sent = uploads.mock.calls[0]?.[2];
    expect(sent).toBe(logo);
    expect(new Uint8Array(await (sent as File).arrayBuffer())).toEqual(new Uint8Array(await logo.arrayBuffer()));
  });

  it('starts no upload before the text is saved', async () => {
    const probe = answerQuote({ minimumSeconds: 1 });
    const uploads = spyUploads();
    const { container } = renderForm();
    await pickPhotos(container, [pngFile('logo.png')]);
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));
    expect(await screen.findByRole('button', { name: 'Sending' })).toBeInTheDocument();
    expect(probe.creates).toHaveLength(0);
    expect(uploads).not.toHaveBeenCalled();

    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
    expect(uploads).toHaveBeenCalledTimes(1);
  });

  it('runs at most two uploads at a time and starts the next as one ends', async () => {
    answerQuote();
    const { spy, gates } = holdUploads();
    const { container } = renderForm();
    await pickPhotos(container, [pngFile('a.png', 70), pngFile('b.png', 71), pngFile('c.png', 72)]);
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(2);
    });
    expect(gates.map((gate) => gate.slot)).toEqual([0, 1]);
    await act(async () => {
      gates[1]?.finish();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(3);
    });
    expect(gates.map((gate) => gate.slot)).toEqual([0, 1, 2]);
    await act(async () => {
      gates.forEach((gate) => {
        gate.finish();
      });
      await Promise.resolve();
    });
    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
  });

  it('sends a text-only inquiry with no photo names, no upload key and no upload call', async () => {
    const probe = answerQuote();
    const uploads = spyUploads();
    renderForm();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
    expect(probe.creates[0]?.body.photos ?? []).toEqual([]);
    expect(probe.creates[0]?.body.uploadKey ?? '').toBe('');
    expect(uploads).not.toHaveBeenCalled();
  });

  it('keeps the upload key in memory only (T-13-36)', async () => {
    const probe = answerQuote();
    spyUploads();
    const { container } = renderForm();
    await pickPhotos(container, [pngFile('logo.png')]);
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
    const key = probe.creates[0]?.body.uploadKey ?? 'missing';
    expect(JSON.stringify(Object.entries(window.localStorage))).not.toContain(key);
    expect(JSON.stringify(Object.entries(window.sessionStorage))).not.toContain(key);
    expect(window.location.href).not.toContain(key);
  });
});

describe('QuoteForm while it sends (Q3 loading)', () => {
  it('shows the polite photo line only with photos, and makes fields read-only, not disabled', async () => {
    answerQuote();
    const { gates } = holdUploads();
    const { container } = renderForm();
    expect(screen.queryByText(/Sending your photos/)).not.toBeInTheDocument();
    await pickPhotos(container, [pngFile('logo.png')]);
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    const line = await screen.findByText('Sending your photos. This can take a minute on mobile data.');
    expect(line.closest('[role="status"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Sending' })).toBeInTheDocument();
    const name = screen.getByRole('textbox', { name: /Your name/ });
    expect(name).toHaveAttribute('readonly');
    expect(name).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove logo.png' })).toHaveAttribute('aria-disabled', 'true');
    await waitFor(() => {
      expect(gates).toHaveLength(1);
    });
    await act(async () => {
      gates[0]?.finish();
      await Promise.resolve();
    });
    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
  });

  it('shows no photo line for a text-only send', async () => {
    answerQuote({ minimumSeconds: 1 });
    renderForm();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    expect(await screen.findByRole('button', { name: 'Sending' })).toBeInTheDocument();
    expect(screen.queryByText(/Sending your photos/)).not.toBeInTheDocument();
    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
  });
});

describe('QuoteForm Send Another with photos (Q3)', () => {
  it('clears the photos, makes a new upload key and a new ticket', async () => {
    const probe = answerQuote();
    spyUploads();
    const { container } = renderForm();
    await pickPhotos(container, [pngFile('logo.png')]);
    await fillRequired();
    await userEvent.click(screen.getByRole('button', SEND));
    await userEvent.click(await screen.findByRole('button', { name: 'Send Another' }));

    await screen.findByRole('textbox', { name: /Your name/ });
    expect(screen.queryByRole('list', { name: 'Photos to send' })).not.toBeInTheDocument();
    await pickPhotos(container, [pngFile('second.png', 90)]);
    await fillRequired('Maria Santos', '0918 765 4321');
    await userEvent.click(screen.getByRole('button', SEND));
    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });

    expect(probe.creates).toHaveLength(2);
    expect(probe.creates[1]?.body.photos).toEqual(['second.png']);
    expect(probe.creates[1]?.body.uploadKey).not.toBe(probe.creates[0]?.body.uploadKey);
  });
});

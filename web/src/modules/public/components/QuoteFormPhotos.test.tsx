// The photos of the Get a Quote form (UI-SPEC Q2 and Q3; INQ-02, D-01, D-03, D-05, D-43): the picker loads on the first tap, the
// text is saved first, then each photo goes to its own place, at most two at a time, with the upload key the create call declared.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ToastProvider } from '@/components/feedback/ToastProvider';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { siteFailureHandler } from '@/test/publicFixtures';
import { answerPhotos, pngFile } from '@/test/quotePhotoFixtures';
import { answerQuote, QUOTE_ID } from '@/test/quoteFixtures';
import { defaultBrowserImageParts } from '@/utils/images';
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
  vi.useRealTimers();
  vi.restoreAllMocks();
  server.events.removeAllListeners();
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

  it('keeps the polite status region in place before the send and only changes its text (WCAG 4.1.3)', async () => {
    answerQuote();
    const { gates } = holdUploads();
    const { container } = renderForm();
    await pickPhotos(container, [pngFile('logo.png')]);
    await fillRequired();
    const region = container.querySelector('form [role="status"]');
    expect(region).not.toBeNull();
    expect(region).toHaveTextContent('');

    await userEvent.click(screen.getByRole('button', SEND));

    await waitFor(() => {
      expect(region).toHaveTextContent('Sending your photos. This can take a minute on mobile data.');
    });
    expect(region?.isConnected).toBe(true);
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

describe('QuoteForm when photos do not upload (Q3 partial, D-03)', () => {
  // Sends on a fake clock, stepped until the success card shows, so the retry wait after a busy answer (IN-02) takes no real time.
  async function sendWith(files: File[]) {
    const { container } = renderForm();
    await pickPhotos(container, files);
    await fillRequired();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fireEvent.click(screen.getByRole('button', SEND));
    const sentCard = () => screen.queryByRole('heading', { level: 2, name: 'Inquiry sent' });
    for (let step = 0; step < 100 && sentCard() === null; step++) {
      await vi.advanceTimersByTimeAsync(100);
    }
    vi.useRealTimers();
    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
    return container;
  }

  it('retries a failed photo once with the same key, then names it with the Messenger button', async () => {
    answerQuote();
    const calls = answerPhotos({ 1: [503, 503] });

    await sendWith([pngFile('logo.png'), pngFile('sketch.heic', 128)]);

    expect(
      await screen.findByText(
        "We got your request, but 1 of your photos didn't upload: sketch.heic. Please send it to us on Messenger.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Message Us on Messenger' })).toHaveAttribute(
      'href',
      'https://m.me/cspsdemo',
    );
    const slotOne = calls.filter((call) => call.slot === 1);
    expect(slotOne).toHaveLength(2);
    expect(slotOne[0]?.key).toBe(slotOne[1]?.key);
    expect(calls.filter((call) => call.slot === 0)).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows no missing photo when the retry arrives', async () => {
    answerQuote();
    const calls = answerPhotos({ 0: ['network', 200] });

    await sendWith([pngFile('logo.png')]);

    expect(calls).toHaveLength(2);
    expect(screen.queryByText(/didn't upload/)).not.toBeInTheDocument();
  });

  it('uses the all-failed sentence when no photo arrived', async () => {
    answerQuote();
    answerPhotos({ 0: [500], 1: ['network'] });

    await sendWith([pngFile('logo.png'), pngFile('sketch.png', 128)]);

    expect(
      await screen.findByText(
        "We got your request, but your photos didn't upload. Please send them to us on Messenger.",
      ),
    ).toBeInTheDocument();
  });

  it('counts a refused photo (422) as missing, without a retry and without an error box', async () => {
    answerQuote();
    const calls = answerPhotos({ 0: [422] });

    await sendWith([pngFile('logo.png'), pngFile('sketch.png', 128)]);

    expect(await screen.findByText(/1 of your photos didn't upload: logo\.png\./)).toBeInTheDocument();
    expect(calls.filter((call) => call.slot === 0)).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('leaves the Messenger button out when the shop facts failed to load', async () => {
    server.use(siteFailureHandler());
    answerQuote();
    answerPhotos({ 0: [503] });

    await sendWith([pngFile('logo.png'), pngFile('sketch.png', 128)]);

    expect(await screen.findByText(/1 of your photos didn't upload/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Message Us on Messenger' })).not.toBeInTheDocument();
  });

  it('has no axe violations with a photo missing', async () => {
    answerQuote();
    answerPhotos({ 0: [503] });

    const container = await sendWith([pngFile('logo.png'), pngFile('sketch.png', 128)]);

    await screen.findByText(/1 of your photos didn't upload/);
    await expectNoAxeViolations(container);
  });
});

/** A promise the test opens by hand. */
function gate() {
  let open = (): void => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}

describe('QuoteForm never drops a photo still being loaded or checked (review W5 CR-01, D-03)', () => {
  it('waits for the photo piece still loading when Send is pressed, and declares the photo', async () => {
    const probe = answerQuote();
    const ticket = gate();
    server.use(
      http.get('*/api/v1/public/quote-requests/ticket', async () => {
        await ticket.opened;
        return HttpResponse.json({
          ticket: 'ticket-late',
          photoRules: { maxPhotos: 5, maxBytes: 10_485_760, maxPixels: 25_000_000 },
          minimumSeconds: 0,
        });
      }),
    );
    const uploads = spyUploads();
    const { container } = renderForm();
    await fillRequired();
    await userEvent.upload(fileInput(container), [pngFile('logo.png')]);
    const choose = screen.getByRole('button', { name: 'Choose Photos' });
    expect(choose).toHaveAttribute('aria-busy', 'true');
    const opened = vi.fn();
    fileInput(container).addEventListener('click', opened);
    await userEvent.click(choose);
    expect(opened).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', SEND));
    expect(screen.getByRole('button', { name: 'Sending' })).toBeInTheDocument();
    ticket.open();

    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
    expect(probe.creates).toHaveLength(1);
    expect(probe.creates[0]?.body.photos).toEqual(['logo.png']);
    expect(uploads).toHaveBeenCalledTimes(1);
  });

  it('waits for a photo still being checked when Send is pressed, and declares it', async () => {
    const probe = answerQuote();
    const uploads = spyUploads();
    const { container } = renderForm();
    await pickPhotos(container, [pngFile('logo.png')]);
    await fillRequired();
    const check = gate();
    const readHead = defaultBrowserImageParts.readHead.bind(defaultBrowserImageParts);
    vi.spyOn(defaultBrowserImageParts, 'readHead').mockImplementation(async (file) => {
      await check.opened;
      return readHead(file);
    });
    await userEvent.upload(fileInput(container), [pngFile('sketch.png', 128)]);

    await userEvent.click(screen.getByRole('button', SEND));
    expect(screen.getByRole('button', { name: 'Sending' })).toBeInTheDocument();
    check.open();

    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
    expect(probe.creates).toHaveLength(1);
    expect(probe.creates[0]?.body.photos).toEqual(['logo.png', 'sketch.png']);
    expect(uploads).toHaveBeenCalledTimes(2);
  });

  it('says so when a photo is dropped while the inquiry is sending, instead of losing it quietly', async () => {
    answerQuote();
    const { gates } = holdUploads();
    const { container } = renderForm();
    await pickPhotos(container, [pngFile('logo.png')]);
    await fillRequired();
    await userEvent.click(screen.getByRole('button', SEND));
    await waitFor(() => {
      expect(gates).toHaveLength(1);
    });
    const zone = screen.getByText(/Drop your logo/).closest('[data-over]');
    if (zone === null) throw new Error('No drop zone');

    fireEvent.drop(zone, { dataTransfer: { files: [pngFile('late.png', 90)] } });

    expect(await screen.findByRole('alert')).toHaveTextContent("Photos can't be added while your inquiry is sending.");
    await act(async () => {
      gates[0]?.finish();
      await Promise.resolve();
    });
    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
  });
});

describe('QuoteForm keeps the photos when the send fails (D-26)', () => {
  it('keeps every photo and starts no upload after a 429', async () => {
    answerQuote({ createStatuses: [429] });
    const calls = answerPhotos();
    const { container } = renderForm();
    await pickPhotos(container, [pngFile('logo.png'), pngFile('sketch.png', 128)]);
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    expect(await screen.findByRole('alert')).toHaveTextContent("You've sent a few requests in a short time.");
    expect(within(screen.getByRole('list', { name: 'Photos to send' })).getAllByRole('listitem')).toHaveLength(2);
    expect(calls).toHaveLength(0);
  });
});

describe('QuoteForm with a service of its own (the showcase demos, plan 13-23)', () => {
  it('reads the ticket, creates and uploads through the given service, and sends no quote request over the network', async () => {
    const seen: string[] = [];
    server.events.on('request:start', ({ request }) => {
      seen.push(request.url);
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const getTicket = vi.fn<QuoteService['getTicket']>().mockResolvedValue({
      ticket: 'demo-ticket',
      minimumSeconds: 0,
      photoRules: { maxPhotos: 5, maxBytes: 10_485_760, maxPixels: 25_000_000 },
    });
    const create = vi
      .fn<QuoteService['create']>()
      .mockResolvedValue({ id: QUOTE_ID, photoSlots: [{ slot: 0, fileName: 'logo.png' }] });
    const uploadPhoto = vi.fn<QuoteService['uploadPhoto']>().mockResolvedValue(undefined);
    const given: QuoteService = { getTicket, create, uploadPhoto };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter>
        <ToastProvider>{children}</ToastProvider>
      </MemoryRouter>
    );
    const { container } = render(<QuoteForm service={given} />, { wrapper });

    await pickPhotos(container, [pngFile('logo.png')]);
    await fillRequired();
    await userEvent.click(screen.getByRole('button', SEND));
    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });

    expect(getTicket).toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ ticket: 'demo-ticket', photos: ['logo.png'] }),
      expect.any(String),
    );
    expect(uploadPhoto).toHaveBeenCalledTimes(1);
    expect(seen.filter((url) => url.includes('/quote-requests'))).toEqual([]);
    const fetched = fetchSpy.mock.calls.map(([input]) => (input instanceof Request ? input.url : String(input)));
    expect(fetched.filter((url) => url.includes('/quote-requests'))).toEqual([]);
  });

  it('keeps the first service for the ticket, the create and the uploads when a new one is passed later', async () => {
    const make = (ticket: string) => ({
      getTicket: vi.fn<QuoteService['getTicket']>().mockResolvedValue({
        ticket,
        minimumSeconds: 0,
        photoRules: { maxPhotos: 5, maxBytes: 10_485_760, maxPixels: 25_000_000 },
      }),
      create: vi
        .fn<QuoteService['create']>()
        .mockResolvedValue({ id: QUOTE_ID, photoSlots: [{ slot: 0, fileName: 'logo.png' }] }),
      uploadPhoto: vi.fn<QuoteService['uploadPhoto']>().mockResolvedValue(undefined),
    });
    const first = make('first-ticket');
    const second = make('second-ticket');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter>
        <ToastProvider>{children}</ToastProvider>
      </MemoryRouter>
    );
    const { container, rerender } = render(<QuoteForm service={first} />, { wrapper });
    rerender(<QuoteForm service={second} />);

    await pickPhotos(container, [pngFile('logo.png')]);
    await fillRequired();
    await userEvent.click(screen.getByRole('button', SEND));
    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });

    expect(first.create).toHaveBeenCalledWith(expect.objectContaining({ ticket: 'first-ticket' }), expect.any(String));
    expect(first.uploadPhoto).toHaveBeenCalledTimes(1);
    expect(second.getTicket).not.toHaveBeenCalled();
    expect(second.create).not.toHaveBeenCalled();
    expect(second.uploadPhoto).not.toHaveBeenCalled();
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

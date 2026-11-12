import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { MediaPlaceholder } from '@/components/brand';
import { HttpError } from '@/core/api/errors';
import { createQueryClient } from '@/lib/query/queryClient';
import { PhotoSlot, type PhotoSlotProps, type SlotOutcome } from '@/modules/admin/components/PhotoSlot';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { useOrderHandlers } from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';
import { linePhoto, LINE_IDS } from '@/test/siteContentFixtures';
import { prepareImage, type PrepareResult } from '@/utils/images';

vi.mock('@/utils/images', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/images')>()),
  prepareImage: vi.fn(),
}));

// PhotoSlot, one named photo place (D-02, CONT-02; plan 11-22): the preview or its placeholder, Choose Photo (and Take Photo on touch
// devices), the picked file prepared in the browser before it goes up, the status line and the pick-error box.

vi.setConfig({ testTimeout: 15_000 });

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  useOrderHandlers();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
  vi.mocked(prepareImage).mockReset();
});

const OK: SlotOutcome = { ok: true };

function readyFile(file: File, overrides: Partial<Extract<PrepareResult, { ok: true }>> = {}): PrepareResult {
  return {
    ok: true,
    file: new Blob(['prepared'], { type: 'image/jpeg' }),
    name: `${file.name.replace(/\.\w+$/, '')}-small.jpg`,
    type: 'image/jpeg',
    width: 2000,
    height: 1500,
    preview: 'data:image/jpeg;base64,AAAA',
    previewUnavailable: false,
    ...overrides,
  };
}

function pickedImage(name = 'front.jpg'): File {
  return new File(['jpeg'], name, { type: 'image/jpeg' });
}

const baseProps = (overrides: Partial<PhotoSlotProps> = {}): PhotoSlotProps => ({
  label: 'Main photo',
  ratio: '4/5',
  photo: null,
  alt: 'Main photo of Polo Shirts',
  placeholder: <MediaPlaceholder label="Main photo" ratio="4 / 5" />,
  onUpload: vi.fn(() => Promise.resolve(OK)),
  onRemove: vi.fn(() => Promise.resolve(OK)),
  removeConfirm: {
    title: 'Remove the main photo?',
    message: 'The drawn jersey shows instead.',
    action: 'Remove Photo',
  },
  savedToast: { title: 'Photo saved', message: 'It shows on the website now.' },
  removedToast: { title: 'Photo removed', message: 'The drawing shows instead.' },
  hint: 'JPG, PNG, WEBP or HEIC · up to 10 MB',
  ...overrides,
});

function renderSlot(overrides: Partial<PhotoSlotProps> = {}) {
  const props = baseProps(overrides);
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <PhotoSlot {...props} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, props, user: userEvent.setup() };
}

/** The slot's own polite status line, apart from the toast layer. */
function statusLine(): HTMLElement {
  return within(screen.getByRole('group', { name: 'Main photo' })).getByRole('status');
}

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]:not([capture])');
  if (input === null) throw new Error('No file input');
  return input;
}

describe('an empty slot', () => {
  it('is a group named by its label, with the placeholder, the hint and Choose Photo', () => {
    renderSlot();

    const group = screen.getByRole('group', { name: 'Main photo' });
    expect(within(group).getByRole('img', { name: 'Main photo (no image yet)' })).toBeVisible();
    expect(within(group).getByText('JPG, PNG, WEBP or HEIC · up to 10 MB')).toBeVisible();
    expect(within(group).getByRole('button', { name: 'Choose Photo' })).toBeVisible();
    expect(within(group).queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
  });

  it('offers Take Photo only where hover is none, and picks one file at a time from the listed types', () => {
    const { container } = renderSlot();

    const take = screen.getByRole('button', { name: 'Take Photo' });
    expect(take.parentElement?.className).toMatch(/\bhidden\b/);
    expect(take.parentElement?.className).toMatch(/no-hover:/);
    const input = fileInput(container);
    expect(input).not.toHaveAttribute('multiple');
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp,image/heic,image/heif');
    expect(container.querySelector('input[capture="environment"]')).toHaveAttribute('accept', 'image/*');
  });

  it('says Picture instead of Photo when the slot is a picture', () => {
    renderSlot({ noun: 'Picture' });

    expect(screen.getByRole('button', { name: 'Choose Picture' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Take Picture' })).toBeInTheDocument();
  });

  it('keeps the 4:5 frame the slot was given', () => {
    const { container } = renderSlot();

    expect(container.querySelector('[data-ratio="4/5"]')).not.toBeNull();
  });

  it('has no axe violation', async () => {
    const { container } = renderSlot();

    await expectNoAxeViolations(container);
  });
});

describe('picking a file (IMG-05, D-18)', () => {
  it('prepares the file with the server rules, then sends the prepared bytes under the prepared name', async () => {
    vi.mocked(prepareImage).mockImplementation((file) => Promise.resolve(readyFile(file)));
    const { container, props, user } = renderSlot();

    await user.upload(fileInput(container), pickedImage('front.jpg'));

    await waitFor(() => {
      expect(props.onUpload).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(prepareImage)).toHaveBeenCalledTimes(1);
    const [original, rules] = vi.mocked(prepareImage).mock.calls[0] ?? [];
    expect(original?.name).toBe('front.jpg');
    expect(rules).toMatchObject({ maxBytes: 10_485_760, maxPixels: 25_000_000, maxSide: 10_000 });
    const sent = vi.mocked(props.onUpload).mock.calls[0]?.[0];
    expect(sent).toBeInstanceOf(File);
    expect(sent?.name).toBe('front-small.jpg');
    expect(sent?.type).toBe('image/jpeg');
    expect(await sent?.text()).toBe('prepared');
  });

  it('shows Uploading while the file goes up, then Saved, and the saved toast', async () => {
    vi.mocked(prepareImage).mockImplementation((file) => Promise.resolve(readyFile(file)));
    let finish: (outcome: SlotOutcome) => void = () => undefined;
    const onUpload = vi.fn(
      () =>
        new Promise<SlotOutcome>((resolve) => {
          finish = resolve;
        }),
    );
    const { container, user } = renderSlot({ onUpload });

    await user.upload(fileInput(container), pickedImage());

    const status = statusLine();
    await waitFor(() => {
      expect(status).toHaveTextContent('Uploading');
    });
    expect(screen.getByRole('button', { name: 'Choose Photo' })).toHaveAttribute('aria-busy', 'true');

    finish(OK);

    await waitFor(() => {
      expect(status).toHaveTextContent('Saved');
    });
    expect(screen.getByText('Photo saved')).toBeVisible();
    expect(screen.getByText('It shows on the website now.')).toBeVisible();
  });

  it('empties the input after a pick, so the same file can be picked again', async () => {
    vi.mocked(prepareImage).mockImplementation((file) => Promise.resolve(readyFile(file)));
    const { container, user } = renderSlot();

    await user.upload(fileInput(container), pickedImage());

    await waitFor(() => {
      expect(fileInput(container).value).toBe('');
    });
  });

  it('refuses a file the browser check turns down, in the pick-error box, and sends nothing', async () => {
    vi.mocked(prepareImage).mockResolvedValue({ ok: false, reason: 'type' });
    const { container, props, user } = renderSlot();

    await user.upload(fileInput(container), pickedImage('notes.jpg'));

    const box = await screen.findByRole('alert');
    expect(box).toHaveTextContent('notes.jpg');
    expect(box).toHaveTextContent("notes.jpg isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file.");
    expect(props.onUpload).not.toHaveBeenCalled();
    expect(statusLine()).toBeEmptyDOMElement();
  });

  it('refuses a prepared file that is still over the size rule, with the size in the words', async () => {
    vi.mocked(prepareImage).mockImplementation((file) =>
      Promise.resolve(readyFile(file, { file: new Blob([new Uint8Array(10_485_761)], { type: 'image/jpeg' }) })),
    );
    const { container, props, user } = renderSlot();

    await user.upload(fileInput(container), pickedImage('big.jpg'));

    expect(await screen.findByRole('alert')).toHaveTextContent('big.jpg is over 10 MB. Choose a smaller photo.');
    expect(props.onUpload).not.toHaveBeenCalled();
  });

  it('says so when the rules cannot be read, and sends nothing', async () => {
    server.use(http.get('*/api/v1/orders/image-rules', () => new HttpResponse(null, { status: 500 })));
    const { container, props, user } = renderSlot();

    await user.upload(fileInput(container), pickedImage('front.jpg'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't check this photo. Check your connection, then try again.",
    );
    expect(vi.mocked(prepareImage)).not.toHaveBeenCalled();
    expect(props.onUpload).not.toHaveBeenCalled();
  });

  it('shows the server line in the pick-error box when the upload is refused, and clears Uploading', async () => {
    vi.mocked(prepareImage).mockImplementation((file) => Promise.resolve(readyFile(file)));
    const error = new HttpError({
      kind: 'http',
      status: 400,
      problem: {
        type: undefined,
        title: 'x',
        status: 400,
        detail: 'front.jpg has too many pixels.',
        instance: undefined,
        traceId: undefined,
        code: 'images.too-big',
        errors: {},
      },
    });
    const onUpload = vi.fn(() => Promise.resolve<SlotOutcome>({ ok: false, error }));
    const { container, user } = renderSlot({ onUpload });

    await user.upload(fileInput(container), pickedImage('front.jpg'));

    expect(await screen.findByRole('alert')).toHaveTextContent('front.jpg has too many pixels.');
    expect(statusLine()).toBeEmptyDOMElement();
    expect(screen.queryByText('Photo saved')).not.toBeInTheDocument();
  });

  it('says to check the connection when the upload never reached the server', async () => {
    vi.mocked(prepareImage).mockImplementation((file) => Promise.resolve(readyFile(file)));
    const onUpload = vi.fn(() =>
      Promise.resolve<SlotOutcome>({ ok: false, error: new HttpError({ kind: 'network' }) }),
    );
    const { container, user } = renderSlot({ onUpload });

    await user.upload(fileInput(container), pickedImage('front.jpg'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't upload. Check your connection, then try again.",
    );
  });

  it('clears an earlier refusal when the next pick goes through', async () => {
    vi.mocked(prepareImage).mockResolvedValueOnce({ ok: false, reason: 'unreadable' });
    vi.mocked(prepareImage).mockImplementation((file) => Promise.resolve(readyFile(file)));
    const { container, user } = renderSlot();

    await user.upload(fileInput(container), pickedImage('bad.jpg'));
    await screen.findByRole('alert');
    await user.upload(fileInput(container), pickedImage('good.jpg'));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});

describe('a slot with a photo', () => {
  it('shows the preview with its alt text and says Replace Photo', () => {
    const photo = linePhoto(LINE_IDS.polo, 'main');
    renderSlot({ photo });

    const image = screen.getByRole('img', { name: 'Main photo of Polo Shirts' });
    expect(image).toHaveAttribute('src', photo.src);
    expect(image).toHaveAttribute('srcset', photo.srcSet);
    expect(screen.getByRole('button', { name: 'Replace Photo' })).toBeVisible();
    expect(screen.queryByRole('img', { name: 'Main photo (no image yet)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take Photo' })).not.toBeInTheDocument();
  });

  it('has Replace Photo and a Remove Photo button, and an empty slot has no Remove Photo', () => {
    const { unmount } = renderSlot({ photo: linePhoto(LINE_IDS.polo, 'main') });

    expect(screen.getByRole('button', { name: 'Replace Photo' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Remove Photo' })).toBeVisible();
    unmount();

    renderSlot();
    expect(screen.queryByRole('button', { name: 'Remove Photo' })).not.toBeInTheDocument();
  });

  it('has no axe violation with a photo', async () => {
    const { container } = renderSlot({ photo: linePhoto(LINE_IDS.polo, 'main') });

    await expectNoAxeViolations(container);
  });
});

/** A slot whose photo the test controls, so a removal can leave it empty as the card does. */
function ControlledSlot(props: Partial<PhotoSlotProps> & { onRemoved?: () => void }) {
  const [photo, setPhoto] = useState<PhotoSlotProps['photo']>(linePhoto(LINE_IDS.polo, 'main'));
  const { onRemoved, ...rest } = props;
  const merged = baseProps(rest);
  return (
    <PhotoSlot
      {...merged}
      photo={photo}
      onRemove={async () => {
        const outcome = await (merged.onRemove?.() ?? Promise.resolve<SlotOutcome>(OK));
        if (outcome.ok) {
          setPhoto(null);
          onRemoved?.();
        }
        return outcome;
      }}
    />
  );
}

function renderControlled(props: Partial<PhotoSlotProps> = {}) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ControlledSlot {...props} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, user: userEvent.setup() };
}

describe('removing a photo (D-02)', () => {
  it('asks first with the slot words and Cancel focused, and Cancel changes nothing', async () => {
    const onRemove = vi.fn(() => Promise.resolve(OK));
    const { user } = renderControlled({ onRemove });

    await user.click(screen.getByRole('button', { name: 'Remove Photo' }));

    const dialog = await screen.findByRole('dialog', { name: 'Remove the main photo?' });
    expect(within(dialog).getByText('The drawn jersey shows instead.')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Remove Photo' })).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Replace Photo' })).toBeVisible();
  });

  it('removes on confirm, says Photo removed, shows the placeholder and puts focus on Choose Photo', async () => {
    const onRemove = vi.fn(() => Promise.resolve(OK));
    const { user } = renderControlled({ onRemove });

    await user.click(screen.getByRole('button', { name: 'Remove Photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove the main photo?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove Photo' }));

    await waitFor(() => {
      expect(onRemove).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('Photo removed')).toBeVisible();
    expect(screen.getByText('The drawing shows instead.')).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('img', { name: 'Main photo (no image yet)' })).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Choose Photo' })).toHaveFocus();
    });
    expect(statusLine()).toBeEmptyDOMElement();
  });

  it('keeps the photo and shows the failure in the question when the removal fails', async () => {
    const onRemove = vi.fn(() =>
      Promise.resolve<SlotOutcome>({ ok: false, error: new HttpError({ kind: 'network' }) }),
    );
    const { user } = renderControlled({ onRemove });

    await user.click(screen.getByRole('button', { name: 'Remove Photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove the main photo?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove Photo' }));

    expect(await within(dialog).findByText(/Couldn't reach the server/)).toBeVisible();
    expect(screen.queryByText('Photo removed')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Main photo of Polo Shirts' })).toBeVisible();
  });

  it('shows Removing on the confirm button while it goes, and holds the slot actions', async () => {
    let finish: (outcome: SlotOutcome) => void = () => undefined;
    const onRemove = vi.fn(
      () =>
        new Promise<SlotOutcome>((resolve) => {
          finish = resolve;
        }),
    );
    const { user } = renderControlled({ onRemove });

    await user.click(screen.getByRole('button', { name: 'Remove Photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove the main photo?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove Photo' }));

    expect(await within(dialog).findByRole('button', { name: 'Removing' })).toHaveAttribute('aria-busy', 'true');
    finish(OK);
    await screen.findByText('Photo removed');
  });
});

describe('one action at a time (WEB-09)', () => {
  it('while a file goes up, Replace Photo is the busy control with its focus kept, and Remove Photo is aria-disabled and does nothing', async () => {
    vi.mocked(prepareImage).mockImplementation((file) => Promise.resolve(readyFile(file)));
    let finish: (outcome: SlotOutcome) => void = () => undefined;
    const onUpload = vi.fn(
      () =>
        new Promise<SlotOutcome>((resolve) => {
          finish = resolve;
        }),
    );
    const { container, props, user } = renderSlot({ photo: linePhoto(LINE_IDS.polo, 'main'), onUpload });
    const replace = screen.getByRole('button', { name: 'Replace Photo' });
    replace.focus();

    await user.upload(fileInput(container), pickedImage());

    await waitFor(() => {
      expect(replace).toHaveAttribute('aria-busy', 'true');
    });
    expect(replace).toHaveAttribute('aria-disabled', 'true');
    // aria-disabled, never disabled: the control keeps keyboard focus while it waits.
    expect(replace).not.toBeDisabled();
    const remove = screen.getByRole('button', { name: 'Remove Photo' });
    expect(remove).toHaveAttribute('aria-disabled', 'true');
    expect(remove).not.toHaveAttribute('aria-busy');
    await user.click(remove);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(props.onRemove).not.toHaveBeenCalled();

    finish(OK);
    await waitFor(() => {
      expect(replace).not.toHaveAttribute('aria-disabled');
    });
    expect(remove).not.toHaveAttribute('aria-disabled');
  });

  it('while the slot is locked by another slot, every action is aria-disabled and a press picks nothing', async () => {
    const { container, user } = renderSlot({ locked: true });
    const input = fileInput(container);
    const clicked = vi.fn();
    input.addEventListener('click', clicked);

    const choose = screen.getByRole('button', { name: 'Choose Photo' });
    expect(choose).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Take Photo' })).toHaveAttribute('aria-disabled', 'true');
    await user.click(choose);

    expect(clicked).not.toHaveBeenCalled();
  });

  it('tells its card when it is busy and when it is free again', async () => {
    vi.mocked(prepareImage).mockImplementation((file) => Promise.resolve(readyFile(file)));
    const onBusyChange = vi.fn();
    const { container, user } = renderSlot({ onBusyChange });

    await user.upload(fileInput(container), pickedImage());

    await waitFor(() => {
      expect(onBusyChange).toHaveBeenLastCalledWith(false);
    });
    expect(onBusyChange).toHaveBeenCalledWith(true);
  });
});

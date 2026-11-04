import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { HttpError } from '@/core/api/errors';
import { createQueryClient } from '@/lib/query/queryClient';
import { OrderPhotosCard } from '@/modules/admin/components/OrderPhotosCard';
import { orderKey, useOrderQuery } from '@/modules/admin/hooks/useOrderQuery';
import { VIEWER_SIZES } from '@/modules/admin/imageSlots';
import { photoUploadQueue } from '@/modules/admin/hooks/usePhotoUploadQueue';
import { orderPhotosService } from '@/modules/admin/services/orderPhotosService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import {
  buildOrderDetail,
  order0148,
  orderImage,
  useOrderHandlers,
  type OrderDetailFixture,
} from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';
import { prepareImage, type PrepareResult } from '@/utils/images';

vi.mock('@/utils/images', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/images')>()),
  prepareImage: vi.fn(),
}));

// The Images card of the order page (ORD-04, IMG-05; UI-SPEC P1 and P3): the add area, the waiting tile and the saved photo.

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  useOrderHandlers();
});

afterEach(() => {
  photoUploadQueue.clear(order0148.id);
  queryClient.clear();
  clearSession();
});

function readyFile(file: File): PrepareResult {
  return {
    ok: true,
    file,
    name: file.name,
    type: 'image/jpeg',
    width: 3000,
    height: 2000,
    preview: 'data:image/jpeg;base64,AAAA',
    previewUnavailable: false,
  };
}

function Harness() {
  const query = useOrderQuery(order0148.id);
  return query.data === undefined ? null : <OrderPhotosCard order={query.data} />;
}

function renderCard(order: OrderDetailFixture = order0148) {
  queryClient.setQueryData(orderKey(order0148.id), order);
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Harness />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function galleryInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"][multiple]');
  if (input === null) throw new Error('No gallery input');
  return input;
}

describe('OrderPhotosCard (tracer)', () => {
  it('shows only the add area on an order with no photos, with the hint ending 0/5', async () => {
    renderCard();

    expect(await screen.findByRole('heading', { level: 2, name: 'Images' })).toBeVisible();
    expect(await screen.findAllByText('JPG, PNG, WEBP or HEIC · up to 10 MB each · 0/5')).not.toHaveLength(0);
    expect(screen.queryByRole('list', { name: 'Order photos' })).not.toBeInTheDocument();
  });

  it('turns a picked photo into a waiting tile and then a saved photo with the thumb from the server', async () => {
    const saved = buildOrderDetail({ images: [orderImage(1)] });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(orderPhotosService, 'upload').mockImplementation(async () => {
      await gate;
      return saved;
    });
    const file = new File(['jpeg'], 'front.jpg', { type: 'image/jpeg' });
    vi.mocked(prepareImage).mockResolvedValue(readyFile(file));
    const { container } = renderCard();
    await screen.findAllByText(/0\/5/);

    await userEvent.setup().upload(galleryInput(container), file);

    const list = await screen.findByRole('list', { name: 'Order photos' });
    expect(within(list).getByText('front.jpg')).toBeVisible();
    // With one file the wait is too short to see; the tile is waiting, or already uploading while the answer is held.
    expect(await within(list).findByText(/^(Waiting to upload|Uploading)$/)).toBeVisible();

    release();
    const thumb = await screen.findByRole('button', {
      name: 'Open photo 1 of 1: Order ORD-2026-0148 photo 1',
    });
    await waitFor(() => {
      expect(within(list).queryByText('front.jpg')).not.toBeInTheDocument();
    });
    expect(thumb.querySelector('img')?.getAttribute('src')).toContain('/api/testing/images/photo01');
    await expectNoAxeViolations(container);
  });
});

function pickedImage(name: string): File {
  return new File(['jpeg'], name, { type: 'image/jpeg' });
}

/** Every pick is a good 3000 x 2000 photo, as prepareImage would answer. */
function prepareEveryFile(): void {
  vi.mocked(prepareImage).mockImplementation((file) => Promise.resolve(readyFile(file)));
}

function orderWithPhotos(count: number): OrderDetailFixture {
  return buildOrderDetail({ images: Array.from({ length: count }, (_, index) => orderImage(index + 1)) });
}

describe('several photos (IMG-05, D-31)', () => {
  it('uploads four photos one by one with the count in the status line, then says they were added', async () => {
    prepareEveryFile();
    const answers = [1, 2, 3, 4].map((count) => orderWithPhotos(count));
    const releases: (() => void)[] = [];
    const upload = vi.spyOn(orderPhotosService, 'upload').mockImplementation(() => {
      const answer = answers[releases.length];
      return new Promise((resolve) => {
        releases.push(() => {
          if (answer !== undefined) resolve(answer);
        });
      });
    });
    const { container } = renderCard();
    await screen.findAllByText(/0\/5/);

    await userEvent.setup().upload(
      galleryInput(container),
      ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'].map((name) => pickedImage(name)),
    );

    expect(await screen.findByText('Uploading photo 1 of 4')).toBeVisible();
    for (let index = 0; index < 4; index += 1) {
      await waitFor(() => {
        expect(releases).toHaveLength(index + 1);
      });
      await act(async () => {
        releases[index]?.();
        await Promise.resolve();
      });
      if (index < 3) {
        expect(await screen.findByText(`Uploading photo ${String(index + 2)} of 4`)).toBeVisible();
      }
    }

    expect(await screen.findByText('Photos added')).toBeVisible();
    expect(screen.getByText('4 photos added to ORD-2026-0148.')).toBeVisible();
    expect(screen.getByText('All photos uploaded.')).toBeInTheDocument();
    expect(upload.mock.calls.map((call) => call[2])).toEqual(['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg']);
    expect(screen.queryByText(/Uploading photo/)).not.toBeInTheDocument();
  });

  it('says 1 photo added in the singular', async () => {
    prepareEveryFile();
    vi.spyOn(orderPhotosService, 'upload').mockResolvedValue(orderWithPhotos(1));
    const { container } = renderCard();
    await screen.findAllByText(/0\/5/);

    await userEvent.setup().upload(galleryInput(container), pickedImage('a.jpg'));

    expect(await screen.findByText('1 photo added to ORD-2026-0148.')).toBeVisible();
  });
});

describe('refused files never leave the browser (OR-3, IMG-02, UIC-12, UIC-28)', () => {
  it('refuses an svg renamed .jpg in the pick-error box and sends no upload request (UIC-47)', async () => {
    let hits = 0;
    server.use(
      http.post('*/api/v1/orders/:id/images', () => {
        hits += 1;
        return HttpResponse.json(order0148);
      }),
    );
    const upload = vi.spyOn(orderPhotosService, 'upload');
    vi.mocked(prepareImage).mockResolvedValue({ ok: false, reason: 'type' });
    const { container } = renderCard();
    await screen.findAllByText(/0\/5/);

    await userEvent
      .setup()
      .upload(
        galleryInput(container),
        new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'photo.jpg', { type: 'image/jpeg' }),
      );

    const box = await screen.findByRole('alert');
    expect(box).toHaveTextContent("photo.jpg isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file.");
    expect(screen.queryByRole('list', { name: 'Order photos' })).not.toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
    expect(hits).toBe(0);
    await expectNoAxeViolations(container);
  });

  it('lists each refused file with its reason, a file over the size limit and one with too many pixels included', async () => {
    const files = [pickedImage('broken.jpg'), pickedImage('big.jpg'), pickedImage('huge.jpg')];
    vi.mocked(prepareImage).mockImplementation((file) => {
      if (file.name === 'broken.jpg') return Promise.resolve({ ok: false, reason: 'unreadable' });
      if (file.name === 'big.jpg') {
        return Promise.resolve({ ...readyFile(new File([new ArrayBuffer(10_485_761)], 'big.jpg')) });
      }
      return Promise.resolve({ ...readyFile(file), width: 6000, height: 5000 });
    });
    const upload = vi.spyOn(orderPhotosService, 'upload');
    const { container } = renderCard();
    await screen.findAllByText(/0\/5/);

    await userEvent.setup().upload(galleryInput(container), files);

    const box = await screen.findByRole('alert');
    expect(box).toHaveTextContent("broken.jpg couldn't be read. Try another photo.");
    expect(box).toHaveTextContent('big.jpg is over 10 MB. Choose a smaller photo.');
    expect(box).toHaveTextContent('huge.jpg is too big. Photos can be at most 25 megapixels.');
    expect(upload).not.toHaveBeenCalled();
  });

  it('adds the good files as tiles while the refused ones are listed, and clears the list at the next pick', async () => {
    vi.spyOn(orderPhotosService, 'upload').mockImplementation(() => new Promise(() => undefined));
    vi.mocked(prepareImage).mockImplementation((file) =>
      Promise.resolve(file.name === 'logo.svg' ? { ok: false, reason: 'type' } : readyFile(file)),
    );
    const { container } = renderCard();
    await screen.findAllByText(/0\/5/);
    const user = userEvent.setup();

    await user.upload(galleryInput(container), [pickedImage('logo.svg'), pickedImage('front.jpg')]);

    const list = await screen.findByRole('list', { name: 'Order photos' });
    expect(within(list).getByText('front.jpg')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('logo.svg');

    await user.upload(galleryInput(container), pickedImage('back.jpg'));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});

describe('the limit of 5 (D-08, UIC-29)', () => {
  it('adds the first files up to the room and says how many were left out', async () => {
    prepareEveryFile();
    vi.spyOn(orderPhotosService, 'upload').mockImplementation(() => new Promise(() => undefined));
    const { container } = renderCard(orderWithPhotos(3));
    await screen.findAllByText(/3\/5/);

    await userEvent.setup().upload(
      galleryInput(container),
      ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'].map((name) => pickedImage(name)),
    );

    const list = await screen.findByRole('list', { name: 'Order photos' });
    await waitFor(() => {
      expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    });
    expect(within(list).getByText('a.jpg')).toBeVisible();
    expect(within(list).getByText('b.jpg')).toBeVisible();
    expect(within(list).queryByText('c.jpg')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      "An order can have up to 5 photos. 2 of the photos you picked weren't added.",
    );
    expect(vi.mocked(prepareImage)).toHaveBeenCalledTimes(2);
  });

  it("says 1 of the photos you picked wasn't added in the singular", async () => {
    prepareEveryFile();
    vi.spyOn(orderPhotosService, 'upload').mockImplementation(() => new Promise(() => undefined));
    const { container } = renderCard(orderWithPhotos(4));
    await screen.findAllByText(/4\/5/);

    await userEvent.setup().upload(galleryInput(container), [pickedImage('a.jpg'), pickedImage('b.jpg')]);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "An order can have up to 5 photos. 1 of the photos you picked wasn't added.",
    );
  });

  it('replaces the add area with the limit note at 5 photos', async () => {
    renderCard(orderWithPhotos(5));

    expect(
      await screen.findByText('This order has 5 photos, the most it can have. Delete one to add another.'),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'browse' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose Photos' })).not.toBeInTheDocument();
  });

  it('counts waiting files toward the limit', async () => {
    prepareEveryFile();
    vi.spyOn(orderPhotosService, 'upload').mockImplementation(() => new Promise(() => undefined));
    const { container } = renderCard(orderWithPhotos(3));
    await screen.findAllByText(/3\/5/);
    const user = userEvent.setup();

    await user.upload(galleryInput(container), [pickedImage('a.jpg'), pickedImage('b.jpg')]);

    expect(
      await screen.findByText('This order has 5 photos, the most it can have. Delete one to add another.'),
    ).toBeVisible();
  });
});

function problem(status: number, code: string, message: string): HttpError {
  return new HttpError({
    kind: 'http',
    status,
    problem: {
      type: undefined,
      title: 'Generic status words.',
      status,
      detail: message,
      instance: undefined,
      traceId: undefined,
      code,
      errors: {},
    },
  });
}

function tileOf(fileName: string): HTMLElement {
  const tile = screen.getByText(fileName).closest('li');
  if (tile === null) throw new Error(`No tile for ${fileName}`);
  return tile;
}

describe('failed uploads (D-10, UIC-13 to UIC-15, UIC-27)', () => {
  it('keeps the failed file with its reason, Try Again and Remove, shows the banner above the list, and clears it after a good retry', async () => {
    prepareEveryFile();
    const upload = vi
      .spyOn(orderPhotosService, 'upload')
      .mockResolvedValueOnce(orderWithPhotos(1))
      .mockRejectedValueOnce(new HttpError({ kind: 'network' }))
      .mockResolvedValueOnce(orderWithPhotos(2))
      .mockResolvedValueOnce(orderWithPhotos(3));
    const { container } = renderCard();
    await screen.findAllByText(/0\/5/);
    const user = userEvent.setup();

    await user.upload(
      galleryInput(container),
      ['a.jpg', 'b.jpg', 'c.jpg'].map((name) => pickedImage(name)),
    );

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent("1 of 3 photos didn't upload.");
    expect(banner).toHaveTextContent("They're below. Try again or remove them. If you leave this page, they're lost.");
    const list = screen.getByRole('list', { name: 'Order photos' });
    expect(banner.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[2]).toBe(tileOf('b.jpg'));
    expect(
      within(tileOf('b.jpg')).getByText("Didn't upload. Couldn't upload. Check your connection, then try again."),
    ).toBeVisible();
    await expectNoAxeViolations(container);

    await user.click(within(tileOf('b.jpg')).getByRole('button', { name: 'Try again, b.jpg' }));

    expect(await screen.findByText('3 photos added to ORD-2026-0148.')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(upload).toHaveBeenCalledTimes(4);
  });

  it('shows Remove only for a failure the server would refuse again, and Remove clears the tile and the banner', async () => {
    prepareEveryFile();
    vi.spyOn(orderPhotosService, 'upload').mockRejectedValue(
      problem(400, 'images.type', "a.jpg isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file."),
    );
    const { container } = renderCard();
    await screen.findAllByText(/0\/5/);
    const user = userEvent.setup();

    await user.upload(galleryInput(container), pickedImage('a.jpg'));

    const tile = await waitFor(() => tileOf('a.jpg'));
    expect(await screen.findByRole('alert')).toHaveTextContent("1 of 1 photo didn't upload.");
    expect(
      within(tile).getByText("Didn't upload. a.jpg isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file."),
    ).toBeVisible();
    expect(within(tile).queryByRole('button', { name: /^Try again/ })).not.toBeInTheDocument();

    await user.click(within(tile).getByRole('button', { name: 'Remove a.jpg' }));

    expect(screen.queryByText('a.jpg')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('turns the card read-only when the order locks meanwhile, fails waiting files with the server text, and raises a danger toast', async () => {
    prepareEveryFile();
    const message = 'This order is completed. Reopen it to make changes.';
    vi.spyOn(orderPhotosService, 'upload').mockRejectedValue(problem(422, 'orders.locked', message));
    useOrderHandlers({ detail: buildOrderDetail({ status: 'completed' }) });
    const { container } = renderCard();
    await screen.findAllByText(/0\/5/);

    await userEvent.setup().upload(
      galleryInput(container),
      ['a.jpg', 'b.jpg'].map((name) => pickedImage(name)),
    );

    expect(await screen.findByText("Couldn't save the photo change")).toBeVisible();
    expect(screen.getAllByText(message).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'browse' })).not.toBeInTheDocument();
    });
    for (const name of ['a.jpg', 'b.jpg']) {
      const tile = tileOf(name);
      expect(within(tile).getByText(`Didn't upload. ${message}`)).toBeVisible();
      expect(within(tile).getByRole('button', { name: `Remove ${name}` })).toBeVisible();
      expect(within(tile).queryByRole('button', { name: /^Try again/ })).not.toBeInTheDocument();
    }
  });
});

const FIVE = ['Front', 'Back', 'Sleeve', 'Collar', 'Number'] as const;

/**
 * An order whose photos carry their own descriptions, so a test can tell which photo the viewer shows. A name from FIVE keeps
 * the id of its place in FIVE, so a shorter list is the same photos with some deleted.
 */
function namedPhotos(names: readonly string[]): OrderDetailFixture {
  return buildOrderDetail({
    images: names.map((name, index) => {
      const known = (FIVE as readonly string[]).indexOf(name);
      return orderImage((known >= 0 ? known : index) + 1, { description: name, position: index });
    }),
  });
}

function thumbOf(position: number, total: number, description: string): HTMLElement {
  return screen.getByRole('button', { name: `Open photo ${String(position)} of ${String(total)}: ${description}` });
}

function setOrder(order: OrderDetailFixture): void {
  act(() => {
    queryClient.setQueryData(orderKey(order0148.id), order);
  });
}

describe('the photo viewer (D-16, D-04, D-27, UIC-25, UIC-44)', () => {
  it('opens at the photo pressed with the viewer srcSet and the viewer sizes', async () => {
    const { container } = renderCard(namedPhotos(FIVE));
    await screen.findByRole('list', { name: 'Order photos' });

    await userEvent.setup().click(thumbOf(2, 5, 'Back'));

    const dialog = await screen.findByRole('dialog', { name: 'Order photos' });
    expect(within(dialog).getByText('Photo 2 of 5')).toBeVisible();
    const image = within(dialog).getByRole('img', { name: 'Back' });
    expect(image).toHaveAttribute('sizes', VIEWER_SIZES);
    expect(image.getAttribute('srcset')).toContain('/api/testing/images/photo02?size=csps_view_1600 1600w');
    await expectNoAxeViolations(container);
  });

  it('uses the default description as the alt text of a photo with none', async () => {
    renderCard(orderWithPhotos(3));
    await screen.findByRole('list', { name: 'Order photos' });

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Open photo 3 of 3: Order ORD-2026-0148 photo 3' }));

    const dialog = await screen.findByRole('dialog', { name: 'Order photos' });
    expect(within(dialog).getByRole('img', { name: 'Order ORD-2026-0148 photo 3' })).toBeInTheDocument();
  });

  it('offers Open Full Size as a link to the full-size address in a new tab', async () => {
    renderCard(namedPhotos(FIVE));
    await screen.findByRole('list', { name: 'Order photos' });

    await userEvent.setup().click(thumbOf(3, 5, 'Sleeve'));

    const dialog = await screen.findByRole('dialog', { name: 'Order photos' });
    const link = within(dialog).getByRole('link', { name: /Open Full Size/ });
    expect(link).toHaveAttribute('href', '/api/testing/images/photo03?size=csps_full_2000');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('steps with the arrows and on Esc puts focus on the thumb of the photo shown last', async () => {
    renderCard(namedPhotos(FIVE));
    await screen.findByRole('list', { name: 'Order photos' });
    const user = userEvent.setup();

    await user.click(thumbOf(2, 5, 'Back'));
    const dialog = await screen.findByRole('dialog', { name: 'Order photos' });
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(within(dialog).getByText('Photo 4 of 5')).toBeVisible();
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(thumbOf(4, 5, 'Collar')).toHaveFocus();
  });

  it('wraps from the last photo to the first and back', async () => {
    renderCard(namedPhotos(FIVE));
    await screen.findByRole('list', { name: 'Order photos' });
    const user = userEvent.setup();

    await user.click(thumbOf(5, 5, 'Number'));
    const dialog = await screen.findByRole('dialog', { name: 'Order photos' });
    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByText('Photo 1 of 5')).toBeVisible();
    await user.keyboard('{ArrowLeft}');
    expect(within(dialog).getByText('Photo 5 of 5')).toBeVisible();
  });

  it('returns focus to the thumb of the photo shown last when Close viewer is pressed', async () => {
    renderCard(namedPhotos(FIVE));
    await screen.findByRole('list', { name: 'Order photos' });
    const user = userEvent.setup();

    await user.click(thumbOf(1, 5, 'Front'));
    await user.click(await screen.findByRole('button', { name: 'Next image' }));
    await user.click(screen.getByRole('button', { name: 'Close viewer' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(thumbOf(2, 5, 'Back')).toHaveFocus();
  });

  it('gives a waiting file no open button', async () => {
    prepareEveryFile();
    vi.spyOn(orderPhotosService, 'upload').mockImplementation(() => new Promise(() => undefined));
    const { container } = renderCard(namedPhotos(['Front', 'Back']));
    await screen.findByRole('list', { name: 'Order photos' });

    await userEvent.setup().upload(galleryInput(container), pickedImage('queued.jpg'));

    const tile = await waitFor(() => tileOf('queued.jpg'));
    expect(within(tile).queryByRole('button', { name: /^Open photo/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Open photo/ })).toHaveLength(2);
  });

  it('keeps the same photo when the photos reload without another one, and the nearest when it is gone', async () => {
    renderCard(namedPhotos(FIVE));
    await screen.findByRole('list', { name: 'Order photos' });
    const user = userEvent.setup();
    await user.click(thumbOf(4, 5, 'Collar'));
    const dialog = await screen.findByRole('dialog', { name: 'Order photos' });

    // Photo 2 is deleted elsewhere: the viewer stays on Collar, now photo 3 of 4.
    setOrder(namedPhotos(['Front', 'Sleeve', 'Collar', 'Number']));
    await waitFor(() => {
      expect(within(dialog).getByText('Photo 3 of 4')).toBeVisible();
    });
    expect(within(dialog).getByRole('img', { name: 'Collar' })).toBeInTheDocument();

    // Collar itself is deleted: the viewer shows the photo now at that place.
    setOrder(namedPhotos(['Front', 'Sleeve', 'Number']));
    await waitFor(() => {
      expect(within(dialog).getByRole('img', { name: 'Number' })).toBeInTheDocument();
    });
    expect(within(dialog).getByText('Photo 3 of 3')).toBeVisible();
  });

  it('closes when no photos are left and puts focus on the card heading', async () => {
    renderCard(namedPhotos(['Front', 'Back']));
    await screen.findByRole('list', { name: 'Order photos' });
    await userEvent.setup().click(thumbOf(1, 2, 'Front'));
    await screen.findByRole('dialog', { name: 'Order photos' });

    setOrder(buildOrderDetail({ images: [] }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Images' })).toHaveFocus();
    });
  });
});

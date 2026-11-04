import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { OrderPhotosCard } from '@/modules/admin/components/OrderPhotosCard';
import { orderKey, useOrderQuery } from '@/modules/admin/hooks/useOrderQuery';
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

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { OrderPhotosCard } from '@/modules/admin/components/OrderPhotosCard';
import { orderKey, useOrderQuery } from '@/modules/admin/hooks/useOrderQuery';
import { photoUploadQueue } from '@/modules/admin/hooks/usePhotoUploadQueue';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { buildOrderDetail, order0148, orderImage, useOrderHandlers } from '@/test/orderFixtures';
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

function renderCard() {
  queryClient.setQueryData(orderKey(order0148.id), order0148);
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
    server.use(
      http.post('*/api/v1/orders/:id/images', async () => {
        await gate;
        return HttpResponse.json(saved);
      }),
    );
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

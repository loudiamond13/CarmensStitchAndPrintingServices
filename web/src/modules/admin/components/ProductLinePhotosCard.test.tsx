import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { createQueryClient } from '@/lib/query/queryClient';
import { ProductLinePhotosCard, type ProductLinePhotos } from '@/modules/admin/components/ProductLinePhotosCard';
import { productLinesService } from '@/modules/admin/services/productLinesService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { useOrderHandlers } from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';
import { demoLineDetail, LINE_IDS, linePhotosBackend, productLinesBackend } from '@/test/siteContentFixtures';
import { prepareImage, type PrepareResult } from '@/utils/images';

vi.mock('@/utils/images', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/images')>()),
  prepareImage: vi.fn(),
}));

vi.mock('@/lib/public-data/publicResource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/public-data/publicResource')>()),
  invalidatePublicContent: vi.fn(),
}));

// The Photos card of the product line editor (D-02, CONT-02, PUB-03; plan 11-22): three PhotoSlots (Main photo, Back view, Fabric detail)
// over the photo routes of plan 11-19.

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
  vi.mocked(invalidatePublicContent).mockClear();
  vi.restoreAllMocks();
});

const polo = demoLineDetail('polo');

function Harness({ initial }: { initial: ProductLinePhotos }) {
  const [photos, setPhotos] = useState(initial);
  return (
    <ProductLinePhotosCard
      lineId={polo.id}
      title={polo.title}
      number={polo.number}
      placeholderArt={polo.placeholderArt}
      photos={photos}
      onPhotoChange={(slot, photo) => {
        setPhotos((current) => ({ ...current, [slot]: photo }));
      }}
    />
  );
}

function renderCard(initial: ProductLinePhotos = polo.photos) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Harness initial={initial} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, user: userEvent.setup() };
}

function readyFile(file: File): PrepareResult {
  return {
    ok: true,
    file: new Blob(['prepared'], { type: 'image/jpeg' }),
    name: file.name,
    type: 'image/jpeg',
    width: 2000,
    height: 1500,
    preview: null,
    previewUnavailable: true,
  };
}

function inputOf(slot: string): HTMLInputElement {
  const input = screen
    .getByRole('group', { name: slot })
    .querySelector<HTMLInputElement>('input[type="file"]:not([capture])');
  if (input === null) throw new Error(`No file input in ${slot}`);
  return input;
}

describe('the Photos card with no photos yet', () => {
  it('has the Photos heading and three slots with their labels and frames', () => {
    const { container } = renderCard();

    expect(screen.getByRole('heading', { level: 2, name: 'Photos' })).toBeVisible();
    expect(
      screen.getByText('Main photo, back view and fabric detail. Until a photo is added, the drawing shows.'),
    ).toBeVisible();
    for (const [name, ratio] of [
      ['Main photo', '4/5'],
      ['Back view', '1/1'],
      ['Fabric detail', '1/1'],
    ] as const) {
      const group = screen.getByRole('group', { name });
      expect(group.querySelector(`[data-ratio="${ratio}"]`)).not.toBeNull();
      expect(within(group).getByRole('button', { name: 'Choose Photo' })).toBeVisible();
    }
    expect(container.querySelectorAll('input[type="file"]:not([capture])')).toHaveLength(3);
  });

  it('draws the line art for an empty Main photo and labelled boxes for the other two', () => {
    renderCard();

    const main = screen.getByRole('group', { name: 'Main photo' });
    const art = within(main).getByRole('img', { name: 'Drawn jersey (no photo yet)' });
    expect(art.querySelector('svg')).not.toBeNull();
    expect(
      within(screen.getByRole('group', { name: 'Back view' })).getByRole('img', { name: 'Back view (no image yet)' }),
    ).toBeVisible();
    expect(
      within(screen.getByRole('group', { name: 'Fabric detail' })).getByRole('img', {
        name: 'Fabric detail (no image yet)',
      }),
    ).toBeVisible();
  });

  it('has no axe violation', async () => {
    const { container } = renderCard();

    await expectNoAxeViolations(container);
  });
});

describe('adding a main photo (CONT-02, PUB-03)', () => {
  it('sends POST photos/main with one Idempotency-Key, shows the toast, the new photo, and clears the public data', async () => {
    const lines = productLinesBackend();
    const photos = linePhotosBackend(lines);
    vi.mocked(prepareImage).mockImplementation((file) => Promise.resolve(readyFile(file)));
    const upload = vi.spyOn(productLinesService, 'uploadPhoto');
    const { user } = renderCard();

    await user.upload(inputOf('Main photo'), new File(['jpeg'], 'front.jpg', { type: 'image/jpeg' }));

    expect(await screen.findByText('Photo saved')).toBeVisible();
    expect(screen.getByText('It shows on the website now.')).toBeVisible();
    expect(photos.uploads).toHaveLength(1);
    expect(photos.uploads[0]).toMatchObject({ lineId: LINE_IDS.polo, slot: 'main' });
    expect(photos.uploads[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(upload).toHaveBeenCalledTimes(1);
    const [lineId, slot, blob, name, key] = upload.mock.calls[0] ?? [];
    expect(lineId).toBe(LINE_IDS.polo);
    expect(slot).toBe('main');
    expect(await (blob as Blob).text()).toBe('prepared');
    expect(name).toBe('front.jpg');
    expect(key).toBe(photos.uploads[0]?.key);
    expect(invalidatePublicContent).toHaveBeenCalledTimes(1);
    const main = screen.getByRole('group', { name: 'Main photo' });
    await waitFor(() => {
      expect(within(main).getByRole('img', { name: 'Main photo of Polo Shirts' })).toBeVisible();
    });
    expect(within(main).getByRole('button', { name: 'Replace Photo' })).toBeVisible();
    expect(within(main).queryByRole('img', { name: 'Drawn jersey (no photo yet)' })).not.toBeInTheDocument();
    expect(within(main).getByRole('status')).toHaveTextContent('Saved');
  });

  it('reads the line list again after a photo is saved, so the table shows the new thumb', async () => {
    const lines = productLinesBackend();
    linePhotosBackend(lines);
    vi.mocked(prepareImage).mockImplementation((file) => Promise.resolve(readyFile(file)));
    const { user } = renderCard();
    await queryClient.fetchQuery({ queryKey: ['product-lines'], queryFn: () => ['stale'] });

    await user.upload(inputOf('Back view'), new File(['jpeg'], 'back.jpg', { type: 'image/jpeg' }));

    await screen.findByText('Photo saved');
    expect(queryClient.getQueryState(['product-lines'])?.isInvalidated).toBe(true);
  });
});

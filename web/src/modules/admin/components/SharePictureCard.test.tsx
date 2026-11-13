import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { HttpError } from '@/core/api/errors';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { createQueryClient } from '@/lib/query/queryClient';
import { SharePictureCard } from '@/modules/admin/components/SharePictureCard';
import { useSiteSettingsQuery } from '@/modules/admin/hooks/useSiteSettingsQuery';
import { siteSettingsService } from '@/modules/admin/services/siteSettingsService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { createDeferred } from '@/test/fakeFetch';
import { useOrderHandlers } from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';
import {
  demoSiteSettings,
  problemAnswer,
  sharePicture,
  sharePictureBackend,
  siteSettingsBackend,
  type SiteSettingsBackend,
} from '@/test/siteContentFixtures';
import { prepareImage, type PrepareResult } from '@/utils/images';

vi.mock('@/utils/images', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/images')>()),
  prepareImage: vi.fn(),
}));

vi.mock('@/lib/public-data/publicResource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/public-data/publicResource')>()),
  invalidatePublicContent: vi.fn(),
}));

// The Link preview picture card of Business Info (D-26, PUB-04; plan 11-34): one PhotoSlot (1.91:1, "Picture") over plan 11-30's routes. It saves
// on its own, at once, and reads the settings again after each change (the picture moves the settings row's version, 11-30 OI-1).

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

/** The card fed from the settings query, as the Business Info tab feeds it. */
function Harness() {
  const query = useSiteSettingsQuery();
  if (query.data === undefined) {
    return null;
  }
  return <SharePictureCard picture={query.data.sharePicture} />;
}

async function renderCard(settings: SiteSettingsBackend) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Harness />
      </ToastProvider>
    </QueryClientProvider>,
  );
  await screen.findByRole('group', { name: 'Link preview picture' });
  expect(settings.gets).toBeGreaterThan(0);
  return { ...view, user: userEvent.setup() };
}

function readyFile(file: File, overrides: Partial<Extract<PrepareResult, { ok: true }>> = {}): PrepareResult {
  return {
    ok: true,
    file: new Blob(['prepared'], { type: 'image/jpeg' }),
    name: file.name,
    type: 'image/jpeg',
    width: 2000,
    height: 1050,
    preview: null,
    previewUnavailable: true,
    ...overrides,
  };
}

const jpeg = (name = 'shop.jpg'): File => new File(['jpeg'], name, { type: 'image/jpeg' });

function slot(): HTMLElement {
  return screen.getByRole('group', { name: 'Link preview picture' });
}

function inputOf(): HTMLInputElement {
  const input = slot().querySelector<HTMLInputElement>('input[type="file"]:not([capture])');
  if (input === null) throw new Error('No file input in the slot');
  return input;
}

describe('the card with no picture yet (D-26)', () => {
  it('has the heading, its hint, the 1.91:1 frame with the placeholder, the type and size hint, Choose Picture and the note', async () => {
    await renderCard(siteSettingsBackend());

    expect(screen.getByRole('heading', { level: 2, name: 'Link preview picture' })).toBeVisible();
    expect(screen.getByText('Shown when someone shares a page on Facebook or Messenger.')).toBeVisible();
    expect(slot().querySelector('[data-ratio="1.91/1"]')).not.toBeNull();
    expect(within(slot()).getByText('No picture yet')).toBeVisible();
    expect(
      within(slot()).getByText('JPG, PNG, WEBP or HEIC · up to 10 MB · 1200 × 630 pixels works best'),
    ).toBeVisible();
    expect(within(slot()).getByRole('button', { name: 'Choose Picture' })).toBeVisible();
    expect(within(slot()).queryByRole('button', { name: 'Remove Picture' })).not.toBeInTheDocument();
    expect(screen.getByText('Products and Gallery use their own newest photo when they have one.')).toBeVisible();
  });

  it('keeps the camera button for touch devices, named Take Picture', async () => {
    await renderCard(siteSettingsBackend());

    expect(within(slot()).getByRole('button', { name: 'Take Picture', hidden: true })).toBeInTheDocument();
  });

  it('has no axe violation', async () => {
    const { container } = await renderCard(siteSettingsBackend());

    await expectNoAxeViolations(container);
  });
});

describe('choosing a picture (PUB-04, D-26)', () => {
  it('prepares the file, sends POST with one Idempotency-Key, shows Uploading then Saved and the toast, and reads the settings again', async () => {
    const settings = siteSettingsBackend();
    const pictures = sharePictureBackend(settings);
    vi.mocked(prepareImage).mockImplementation((file) => Promise.resolve(readyFile(file)));
    const upload = vi.spyOn(siteSettingsService, 'uploadSharePicture');
    const { user } = await renderCard(settings);
    const readsBefore = settings.gets;

    await user.upload(inputOf(), jpeg());

    expect(await screen.findByText('Picture saved')).toBeVisible();
    expect(screen.getByText('Shared links use it now.')).toBeVisible();
    expect(vi.mocked(prepareImage)).toHaveBeenCalledOnce();
    expect(pictures.uploads).toHaveLength(1);
    expect(pictures.uploads[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
    const [blob, name, key] = upload.mock.calls[0] ?? [];
    if (blob === undefined) throw new Error('No file was sent');
    expect(await blob.text()).toBe('prepared');
    expect(name).toBe('shop.jpg');
    expect(key).toBe(pictures.uploads[0]?.key);
    expect(settings.gets).toBe(readsBefore + 1);
    expect(invalidatePublicContent).toHaveBeenCalledTimes(1);
    expect(within(slot()).getByRole('status')).toHaveTextContent('Saved');
  });

  it('shows Uploading while the file is on its way', async () => {
    const settings = siteSettingsBackend();
    sharePictureBackend(settings);
    const gate = createDeferred<undefined>();
    // A form body that waits cannot go through jsdom's FormData and Node's fetch, so the wait is held in the service.
    vi.spyOn(siteSettingsService, 'uploadSharePicture').mockImplementation(async () => {
      await gate.promise;
      return sharePicture('waited');
    });
    vi.mocked(prepareImage).mockImplementation((file) => Promise.resolve(readyFile(file)));
    const { user } = await renderCard(settings);

    await user.upload(inputOf(), jpeg());

    await waitFor(() => {
      expect(within(slot()).getByRole('status')).toHaveTextContent('Uploading');
    });
    gate.resolve(undefined);
    expect(await screen.findByText('Picture saved')).toBeVisible();
  });

  it('shows the new preview from the 320 and 640 addresses and the word Replace Picture', async () => {
    const settings = siteSettingsBackend();
    sharePictureBackend(settings);
    vi.mocked(prepareImage).mockImplementation((file) => Promise.resolve(readyFile(file)));
    const { user } = await renderCard(settings);

    await user.upload(inputOf(), jpeg());

    const image = await within(slot()).findByRole('img', { name: 'The link preview picture' });
    expect(image.getAttribute('src')).toBe(sharePicture('upload-1').src320);
    expect(image.getAttribute('srcset')).toBe(
      `${sharePicture('upload-1').src320} 320w, ${sharePicture('upload-1').src640} 640w`,
    );
    expect(within(slot()).getByRole('button', { name: 'Replace Picture' })).toBeVisible();
    expect(within(slot()).queryByText('No picture yet')).not.toBeInTheDocument();
  });

  it('shows the picture the settings already hold, from the 320 and 640 addresses', async () => {
    const settings = siteSettingsBackend({ ...demoSiteSettings, sharePicture: sharePicture('held') });
    await renderCard(settings);

    const image = slot().querySelector('img');
    expect(image?.getAttribute('src')).toBe(sharePicture('held').src320);
    expect(image?.getAttribute('srcset')).toContain('640w');
  });

  it('has no axe violation with a picture', async () => {
    const settings = siteSettingsBackend({ ...demoSiteSettings, sharePicture: sharePicture('held') });
    const { container } = await renderCard(settings);

    await expectNoAxeViolations(container);
  });
});

const held = (): SiteSettingsBackend =>
  siteSettingsBackend({ ...demoSiteSettings, sharePicture: sharePicture('held') });

describe('a card with a picture (D-26)', () => {
  it('says Replace Picture and has a Remove Picture button, and Choose Picture is gone', async () => {
    await renderCard(held());

    expect(within(slot()).getByRole('button', { name: 'Replace Picture' })).toBeVisible();
    expect(within(slot()).getByRole('button', { name: 'Remove Picture' })).toBeVisible();
    expect(within(slot()).queryByRole('button', { name: 'Choose Picture' })).not.toBeInTheDocument();
  });

  it('keeps the frame full width up to 639px and 320px wide from 640px', async () => {
    await renderCard(held());

    const frame = slot().querySelector('[data-ratio="1.91/1"]');
    expect(frame).toHaveClass('w-full', 'min-[640px]:w-80');
  });

  it('replaces the picture with a new file: one more upload, a new preview, the settings read again', async () => {
    const settings = held();
    const pictures = sharePictureBackend(settings);
    vi.mocked(prepareImage).mockImplementation((file) => Promise.resolve(readyFile(file)));
    const { user } = await renderCard(settings);

    await user.upload(inputOf(), jpeg('new.jpg'));

    expect(await screen.findByText('Picture saved')).toBeVisible();
    expect(pictures.uploads).toHaveLength(1);
    await waitFor(() => {
      expect(slot().querySelector('img')?.getAttribute('src')).toBe(sharePicture('upload-1').src320);
    });
    expect(within(slot()).getByRole('button', { name: 'Replace Picture' })).toBeVisible();
  });
});

describe('removing the picture (D-26, PUB-04)', () => {
  it('asks first in the approved words with Cancel focused, and Cancel sends nothing', async () => {
    const settings = held();
    const pictures = sharePictureBackend(settings);
    const { user } = await renderCard(settings);

    await user.click(within(slot()).getByRole('button', { name: 'Remove Picture' }));

    const dialog = await screen.findByRole('dialog', { name: 'Remove the link preview picture?' });
    expect(within(dialog).getByText('Shared links show no picture until you add one.')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Remove Picture' })).toBeVisible();
    await expectNoAxeViolations(dialog);

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(pictures.removals).toBe(0);
    expect(within(slot()).getByRole('button', { name: 'Replace Picture' })).toBeVisible();
  });

  it('sends DELETE on confirm, says Picture removed, shows the empty frame, reads the settings again and puts focus on Choose Picture', async () => {
    const settings = held();
    const pictures = sharePictureBackend(settings);
    const { user } = await renderCard(settings);
    const readsBefore = settings.gets;

    await user.click(within(slot()).getByRole('button', { name: 'Remove Picture' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove the link preview picture?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove Picture' }));

    expect(await screen.findByText('Picture removed')).toBeVisible();
    expect(screen.getByText('Shared links show no picture.')).toBeVisible();
    expect(pictures.removals).toBe(1);
    expect(settings.gets).toBe(readsBefore + 1);
    expect(invalidatePublicContent).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(within(slot()).getByText('No picture yet')).toBeVisible();
    expect(slot().querySelector('img')).toBeNull();
    await waitFor(() => {
      expect(within(slot()).getByRole('button', { name: 'Choose Picture' })).toHaveFocus();
    });
  });

  it('keeps the picture and shows the failure in the question when the removal fails', async () => {
    const settings = held();
    sharePictureBackend(settings, { onRemove: () => problemAnswer(500) });
    const { user } = await renderCard(settings);

    await user.click(within(slot()).getByRole('button', { name: 'Remove Picture' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove the link preview picture?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove Picture' }));

    expect(await within(dialog).findByRole('alert')).toBeVisible();
    expect(screen.queryByText('Picture removed')).not.toBeInTheDocument();
    expect(slot().querySelector('img')).not.toBeNull();
    expect(invalidatePublicContent).not.toHaveBeenCalled();
  });
});

describe('a refused file (P9 rules, D-26)', () => {
  it('shows the P9 pick-error box for a file that is not a picture we can use (an SVG), and sends nothing', async () => {
    const settings = siteSettingsBackend();
    const pictures = sharePictureBackend(settings);
    vi.mocked(prepareImage).mockResolvedValue({ ok: false, reason: 'type' });
    const { user } = await renderCard(settings);

    // Named as a JPEG by the picker, an SVG by its bytes: the browser check reads the bytes.
    await user.upload(inputOf(), new File(['<svg/>'], 'logo.svg', { type: 'image/jpeg' }));

    const box = await screen.findByRole('alert');
    expect(box).toHaveTextContent('logo.svg');
    expect(box).toHaveTextContent("logo.svg isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file.");
    expect(pictures.uploads).toHaveLength(0);
    expect(within(slot()).getByRole('status')).toBeEmptyDOMElement();
    await expectNoAxeViolations(slot());
  });

  it('shows the P9 words for a file over 10 MB, and sends nothing', async () => {
    const settings = siteSettingsBackend();
    const pictures = sharePictureBackend(settings);
    vi.mocked(prepareImage).mockImplementation((file) =>
      Promise.resolve(readyFile(file, { file: new Blob([new Uint8Array(10_485_761)], { type: 'image/jpeg' }) })),
    );
    const { user } = await renderCard(settings);

    await user.upload(inputOf(), jpeg('big.jpg'));

    expect(await screen.findByRole('alert')).toHaveTextContent('big.jpg is over 10 MB. Choose a smaller photo.');
    expect(pictures.uploads).toHaveLength(0);
  });

  it('shows the server line in the same box when the server refuses the picture, and the settings are not read again', async () => {
    const settings = siteSettingsBackend();
    vi.mocked(prepareImage).mockImplementation((file) => Promise.resolve(readyFile(file)));
    vi.spyOn(siteSettingsService, 'uploadSharePicture').mockRejectedValue(
      new HttpError({
        kind: 'http',
        status: 400,
        problem: {
          type: undefined,
          title: 'x',
          status: 400,
          detail: 'shop.jpg has too many pixels.',
          instance: undefined,
          traceId: undefined,
          code: 'images.too-big',
          errors: {},
        },
      }),
    );
    const { user } = await renderCard(settings);
    const readsBefore = settings.gets;

    await user.upload(inputOf(), jpeg());

    expect(await screen.findByRole('alert')).toHaveTextContent('shop.jpg has too many pixels.');
    expect(settings.gets).toBe(readsBefore);
    expect(invalidatePublicContent).not.toHaveBeenCalled();
    expect(within(slot()).getByRole('status')).toBeEmptyDOMElement();
  });
});

describe('one action at a time (WEB-09)', () => {
  it('while the picture goes up, Replace Picture is the busy control and Remove Picture is aria-disabled and does nothing', async () => {
    const settings = held();
    const pictures = sharePictureBackend(settings);
    vi.mocked(prepareImage).mockImplementation((file) => Promise.resolve(readyFile(file)));
    const gate = createDeferred<undefined>();
    vi.spyOn(siteSettingsService, 'uploadSharePicture').mockImplementation(async () => {
      await gate.promise;
      return sharePicture('waited');
    });
    const { user } = await renderCard(settings);
    const replace = within(slot()).getByRole('button', { name: 'Replace Picture' });
    replace.focus();

    await user.upload(inputOf(), jpeg());

    await waitFor(() => {
      expect(replace).toHaveAttribute('aria-busy', 'true');
    });
    expect(replace).toHaveAttribute('aria-disabled', 'true');
    expect(replace).not.toBeDisabled();
    const remove = within(slot()).getByRole('button', { name: 'Remove Picture' });
    expect(remove).toHaveAttribute('aria-disabled', 'true');
    await user.click(remove);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pictures.removals).toBe(0);
    await expectNoAxeViolations(slot());

    gate.resolve(undefined);
    await screen.findByText('Picture saved');
    await waitFor(() => {
      expect(remove).not.toHaveAttribute('aria-disabled');
    });
  });
});

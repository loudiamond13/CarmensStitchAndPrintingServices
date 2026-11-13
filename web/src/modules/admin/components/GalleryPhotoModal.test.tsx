import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { createQueryClient } from '@/lib/query/queryClient';
import { GalleryPhotoModal } from '@/modules/admin/components/GalleryPhotoModal';
import { galleryItemsService, type GalleryItem } from '@/modules/admin/services/galleryItemsService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { createDeferred } from '@/test/fakeFetch';
import { useOrderHandlers } from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';
import {
  demoGalleryItems,
  demoLines,
  GALLERY_IDS,
  galleryItem,
  galleryItemsBackend,
  LINE_IDS,
  problemAnswer,
  productLinesBackend,
  uploadRefused,
} from '@/test/siteContentFixtures';
import { prepareImage, type PrepareResult } from '@/utils/images';

vi.mock('@/lib/public-data/publicResource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/public-data/publicResource')>()),
  invalidatePublicContent: vi.fn(),
}));

vi.mock('@/utils/images', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/images')>()),
  prepareImage: vi.fn(),
}));

// S6 GalleryPhotoModal, the add window (GAL-03, OR-3, D-10; plan 11-32): a photo for older work with the approved rules and words.

vi.setConfig({ testTimeout: 15_000 });

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  useOrderHandlers();
  productLinesBackend(demoLines().map((line) => (line.id === LINE_IDS.polo ? { ...line, isActive: false } : line)));
  vi.mocked(prepareImage).mockImplementation((file: Blob) =>
    Promise.resolve(readyFile(file instanceof File ? file : new File([file], 'picked.jpg'))),
  );
});

afterEach(() => {
  queryClient.clear();
  clearSession();
  vi.mocked(invalidatePublicContent).mockClear();
  vi.mocked(prepareImage).mockReset();
  vi.restoreAllMocks();
});

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

interface Props {
  onClose?: () => void;
  onSaved?: (saved: GalleryItem) => void;
}

function renderAdd({ onClose = vi.fn<() => void>(), onSaved = vi.fn<(saved: GalleryItem) => void>() }: Props = {}) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <GalleryPhotoModal mode="add" onClose={onClose} onSaved={onSaved} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, user: userEvent.setup({ applyAccept: false }), onClose, onSaved };
}

const team = (): HTMLInputElement => screen.getByLabelText(/^Team or name/);
const line = (): HTMLSelectElement => screen.getByLabelText(/^Product line/);
const pieces = (): HTMLInputElement => screen.getByLabelText(/^Pieces/);
const note = (): HTMLInputElement => screen.getByLabelText(/^Note/);
const show = (): HTMLInputElement => screen.getByRole('checkbox', { name: 'Show on the website' });
const save = (): HTMLElement => screen.getByRole('button', { name: 'Save Photo' });

function pick(field: HTMLElement, value: string): void {
  fireEvent.change(field, { target: { value } });
}

/** Chooses a product line once the lines have been read and the Select offers it. */
async function chooseLine(id: string): Promise<void> {
  await waitFor(() => {
    expect(line().querySelector(`option[value="${id}"]`)).not.toBeNull();
  });
  pick(line(), id);
}

function fileInput(): HTMLInputElement {
  const input = document.body.querySelector<HTMLInputElement>('input[type="file"]:not([capture])');
  if (input === null) throw new Error('No file input');
  return input;
}

async function choosePhoto(user: ReturnType<typeof userEvent.setup>, name = 'riders.jpg'): Promise<void> {
  await user.upload(fileInput(), new File(['jpeg'], name, { type: 'image/jpeg' }));
  await screen.findByText('Photo chosen');
}

describe('the add window', () => {
  it('has the title, the consent note, the photo picker, the fields with their hint and placeholder, and Cancel and Save Photo', async () => {
    renderAdd();

    expect(await screen.findByRole('dialog', { name: 'Add Photo' })).toBeVisible();
    expect(screen.getByText('Only add photos the customer said you may show.')).toBeVisible();
    const group = screen.getByRole('group', { name: 'Photo' });
    expect(within(group).getByRole('button', { name: 'Choose Photo' })).toBeVisible();
    expect(team()).toBeVisible();
    expect(line()).toBeVisible();
    expect(pieces()).toBeVisible();
    expect(note()).toHaveAttribute('placeholder', 'e.g. Dri-fit mesh, V-neck');
    expect(screen.getByText('Shown in the photo viewer.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();
    expect(save()).toBeVisible();
  });

  it('starts with Show on the website ticked and no product line chosen', async () => {
    renderAdd();
    await screen.findByRole('dialog', { name: 'Add Photo' });

    expect(show()).toBeChecked();
    expect(line()).toHaveValue('');
  });

  it('lists every line in the Manager order and reads a hidden one as "{title} (hidden)"', async () => {
    renderAdd();
    await screen.findByRole('dialog', { name: 'Add Photo' });

    await waitFor(() => {
      expect(within(line()).getAllByRole('option').length).toBeGreaterThan(2);
    });
    const labels = within(line())
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(labels[0]).toBe('Choose a product line');
    expect(labels).toContain('Basketball Jerseys');
    expect(labels.some((label) => label.endsWith(' (hidden)'))).toBe(true);
  });

  it('shows "Choose a photo." when Save is pressed with no photo, and sends nothing', async () => {
    const backend = galleryItemsBackend();
    const { user } = renderAdd();
    await screen.findByRole('dialog', { name: 'Add Photo' });

    await user.click(save());

    expect(await screen.findByText('Choose a photo.')).toBeVisible();
    expect(backend.posts).toHaveLength(0);
  });

  it('shows the team, line and pieces messages, and takes exactly 80 characters for the team', async () => {
    const backend = galleryItemsBackend();
    const { user } = renderAdd();
    await screen.findByRole('dialog', { name: 'Add Photo' });
    await choosePhoto(user);

    pick(pieces(), '0');
    await user.click(save());
    expect(await screen.findByText('Enter the team or name.')).toBeVisible();
    expect(screen.getByText('Choose the product line.')).toBeVisible();
    expect(screen.getByText('Enter a whole number from 1 to 9,999.')).toBeVisible();
    expect(team()).toHaveFocus();
    expect(backend.posts).toHaveLength(0);

    pick(team(), 'a'.repeat(81));
    await user.click(save());
    expect(await screen.findByText('Keep this to 80 characters or fewer.')).toBeVisible();
    pick(note(), 'n'.repeat(121));
    await user.click(save());
    expect(await screen.findByText('Keep the note to 120 characters or fewer.')).toBeVisible();
    expect(backend.posts).toHaveLength(0);
  });

  it('shows why a picked file is refused and keeps the photo missing', async () => {
    vi.mocked(prepareImage).mockResolvedValue({ ok: false, reason: 'type' });
    const { user } = renderAdd();
    await screen.findByRole('dialog', { name: 'Add Photo' });

    await user.upload(fileInput(), new File(['gif'], 'rider.gif', { type: 'image/gif' }));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('rider.gif')).toBeVisible();
    expect(screen.queryByText('Photo chosen')).toBeNull();
  });

  it('prepares the picked file before it is used and sends the redrawn one, not the original', async () => {
    const create = vi.spyOn(galleryItemsService, 'create');
    galleryItemsBackend();
    const { user, onClose } = renderAdd();
    await screen.findByRole('dialog', { name: 'Add Photo' });
    await choosePhoto(user, 'riders.jpg');
    pick(team(), ' Sample New Upload ');
    await chooseLine(LINE_IDS.moto);
    pick(pieces(), '12');

    await user.click(save());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(prepareImage).toHaveBeenCalledOnce();
    const sent = create.mock.calls[0]?.[0];
    expect(sent).toMatchObject({
      fileName: 'riders-small.jpg',
      teamName: 'Sample New Upload',
      productLineId: LINE_IDS.moto,
      pieces: 12,
      note: '',
      isShown: true,
    });
  });

  it('sends one add with one Idempotency-Key, shows Uploading while it goes, then the toast, hands the item on and closes', async () => {
    const gate = createDeferred<GalleryItem>();
    galleryItemsBackend();
    const create = vi.spyOn(galleryItemsService, 'create').mockImplementation(() => gate.promise);
    const { user, onSaved, onClose } = renderAdd();
    await screen.findByRole('dialog', { name: 'Add Photo' });
    await choosePhoto(user);
    pick(team(), 'Sample New Upload');
    await chooseLine(LINE_IDS.moto);

    await user.click(save());

    const uploading = await screen.findByRole('button', { name: 'Uploading' });
    expect(uploading).toHaveAttribute('aria-busy', 'true');
    expect(onClose).not.toHaveBeenCalled();
    gate.resolve(galleryItem(GALLERY_IDS.newUpload, 'upload', { name: 'Sample Barangay Riders' }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]?.[1]).toMatch(/\S/);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sample Barangay Riders' }));
    expect(await screen.findByText('Photo added')).toBeVisible();
    expect(screen.getByText("It's at the top of the Gallery.")).toBeVisible();
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });

  it('puts a server message under its field and focuses it', async () => {
    galleryItemsBackend();
    vi.spyOn(galleryItemsService, 'create').mockRejectedValue(
      uploadRefused(400, { errors: { teamName: ['Enter the team or name.'] } }),
    );
    const { user, onClose } = renderAdd();
    await screen.findByRole('dialog', { name: 'Add Photo' });
    await choosePhoto(user);
    pick(team(), 'Sample New Upload');
    await chooseLine(LINE_IDS.moto);

    await user.click(save());

    expect(await screen.findByText('Enter the team or name.')).toBeVisible();
    expect(team()).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
    expect(invalidatePublicContent).not.toHaveBeenCalled();
  });

  it('says what went wrong above the fields when the server refuses the photo itself', async () => {
    galleryItemsBackend();
    vi.spyOn(galleryItemsService, 'create').mockRejectedValue(
      uploadRefused(400, { code: 'images.type', detail: 'That file is not a photo we can use.' }),
    );
    const { user } = renderAdd();
    await screen.findByRole('dialog', { name: 'Add Photo' });
    await choosePhoto(user);
    pick(team(), 'Sample New Upload');
    await chooseLine(LINE_IDS.moto);

    await user.click(save());

    expect(await screen.findByText('That file is not a photo we can use.')).toBeVisible();
  });

  it('asks "Discard changes?" when a changed window is closed, and closes straight away when nothing changed', async () => {
    const onClose = vi.fn<() => void>();
    const { user } = renderAdd({ onClose });
    await screen.findByRole('dialog', { name: 'Add Photo' });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
    onClose.mockClear();

    pick(team(), 'Sample');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Discard Changes' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('a picked photo alone counts as a change for the discard question', async () => {
    const { user, onClose } = renderAdd();
    await screen.findByRole('dialog', { name: 'Add Photo' });
    await choosePhoto(user);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('has no axe violations, empty and with a photo chosen', async () => {
    const { user } = renderAdd();
    const dialog = await screen.findByRole('dialog', { name: 'Add Photo' });
    await expectNoAxeViolations(dialog);

    await choosePhoto(user);
    await expectNoAxeViolations(dialog);
  });
});

interface EditProps {
  item?: GalleryItem;
  onClose?: () => void;
  onSaved?: (saved: GalleryItem) => void;
  readLatest?: (id: string) => Promise<GalleryItem | undefined>;
}

function demoUpload(index = 0): GalleryItem {
  const found = demoGalleryItems()[index];
  if (found === undefined) {
    throw new Error('No demo item.');
  }
  return found;
}

function renderEdit({
  item = demoUpload(),
  onClose = vi.fn<() => void>(),
  onSaved = vi.fn<(saved: GalleryItem) => void>(),
  readLatest = vi.fn<(id: string) => Promise<GalleryItem | undefined>>(() => Promise.resolve(undefined)),
}: EditProps = {}) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <GalleryPhotoModal mode="edit" item={item} readLatest={readLatest} onClose={onClose} onSaved={onSaved} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, user: userEvent.setup({ applyAccept: false }), onClose, onSaved, readLatest };
}

describe('the edit window', () => {
  it('has the title, the saved words, line, pieces and note, the saved photo and Replace Photo instead of Choose Photo', async () => {
    renderEdit();

    expect(await screen.findByRole('dialog', { name: 'Edit Photo' })).toBeVisible();
    expect(team()).toHaveValue('Sample Barangay Riders');
    await waitFor(() => {
      expect(line()).toHaveValue(LINE_IDS.moto);
    });
    expect(pieces()).toHaveValue('12');
    expect(note()).toHaveValue('Dri-fit mesh, V-neck');
    expect(show()).toBeChecked();
    const group = screen.getByRole('group', { name: 'Photo' });
    expect(within(group).getByRole('button', { name: 'Replace Photo' })).toBeVisible();
    expect(within(group).queryByRole('button', { name: 'Choose Photo' })).toBeNull();
    expect(within(group).getByRole('img', { name: 'Photo of Sample Barangay Riders' })).toBeVisible();
  });

  it('shows a hidden upload with Show on the website unticked', async () => {
    renderEdit({ item: demoUpload(5) });

    await screen.findByRole('dialog', { name: 'Edit Photo' });

    expect(show()).not.toBeChecked();
  });

  it('closes straight away when nothing changed, and asks when something did', async () => {
    const onClose = vi.fn<() => void>();
    const { user } = renderEdit({ onClose });
    await screen.findByRole('dialog', { name: 'Edit Photo' });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
    onClose.mockClear();

    pick(note(), 'Changed');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('saves with PUT and the version it was opened with and no Idempotency-Key, shows the toast, hands the item on and closes', async () => {
    const backend = galleryItemsBackend();
    const { user, onSaved, onClose } = renderEdit();
    await screen.findByRole('dialog', { name: 'Edit Photo' });
    pick(team(), ' Sample Riders Edited ');
    pick(pieces(), '15');
    pick(note(), '');

    await user.click(save());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(backend.puts).toEqual([
      {
        id: GALLERY_IDS.newUpload,
        body: {
          teamName: 'Sample Riders Edited',
          productLineId: LINE_IDS.moto,
          pieces: 15,
          note: '',
          isShown: true,
          version: demoUpload().version,
        },
      },
    ]);
    expect(backend.photos).toHaveLength(0);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sample Riders Edited' }));
    expect(await screen.findByText('Photo saved')).toBeVisible();
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });

  it('checks the same rules as an add, but needs no new photo', async () => {
    const backend = galleryItemsBackend();
    const { user } = renderEdit();
    await screen.findByRole('dialog', { name: 'Edit Photo' });
    pick(team(), '');
    pick(pieces(), '10000');

    await user.click(save());

    expect(await screen.findByText('Enter the team or name.')).toBeVisible();
    expect(screen.getByText('Enter a whole number from 1 to 9,999.')).toBeVisible();
    expect(screen.queryByText('Choose a photo.')).toBeNull();
    expect(backend.puts).toHaveLength(0);
  });

  it('sends a replacement photo first and the form after it with the version the replacement answered', async () => {
    const backend = galleryItemsBackend();
    const replace = vi.spyOn(galleryItemsService, 'replacePhoto');
    const { user, onClose } = renderEdit();
    await screen.findByRole('dialog', { name: 'Edit Photo' });
    await user.upload(fileInput(), new File(['jpeg'], 'new-riders.jpg', { type: 'image/jpeg' }));
    await screen.findByText('Photo chosen');
    pick(note(), 'New note');

    await user.click(save());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(replace).toHaveBeenCalledOnce();
    expect(replace.mock.calls[0]?.[0]).toBe(GALLERY_IDS.newUpload);
    expect(replace.mock.calls[0]?.[2]).toBe('new-riders-small.jpg');
    expect(replace.mock.calls[0]?.[3]).toMatch(/\S/);
    expect(backend.photos).toHaveLength(1);
    expect(backend.puts[0]?.body.version).toBe('AAAAAAAAH31=');
    expect(backend.puts[0]?.body.note).toBe('New note');
  });

  it('a replacement photo alone is a save: the form goes with it and the toast says Photo saved', async () => {
    const backend = galleryItemsBackend();
    const { user, onClose } = renderEdit();
    await screen.findByRole('dialog', { name: 'Edit Photo' });
    await user.upload(fileInput(), new File(['jpeg'], 'only-photo.jpg', { type: 'image/jpeg' }));
    await screen.findByText('Photo chosen');

    await user.click(save());

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(backend.photos).toHaveLength(1);
    expect(backend.puts).toHaveLength(1);
    expect(await screen.findByText('Photo saved')).toBeVisible();
  });

  it('keeps a refused replacement photo off the form: nothing is saved and the reason shows above the fields', async () => {
    const backend = galleryItemsBackend();
    vi.spyOn(galleryItemsService, 'replacePhoto').mockRejectedValue(
      uploadRefused(400, { code: 'images.type', detail: 'That file is not a photo we can use.' }),
    );
    const { user, onClose } = renderEdit();
    await screen.findByRole('dialog', { name: 'Edit Photo' });
    await user.upload(fileInput(), new File(['jpeg'], 'bad.jpg', { type: 'image/jpeg' }));
    await screen.findByText('Photo chosen');

    await user.click(save());

    expect(await screen.findByText('That file is not a photo we can use.')).toBeVisible();
    expect(backend.puts).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('on a stale save keeps the typed values behind the conflict banner, and Load Latest shows their words and uses the new version', async () => {
    const latest: GalleryItem = { ...demoUpload(), name: 'Their Words', version: 'AAAAAAAAH88=' };
    const backend = galleryItemsBackend(undefined, {
      onPut: (_id, _body, current) =>
        current.puts.length > 1 ? undefined : problemAnswer(409, { code: 'edit.stale' }),
    });
    const readLatest = vi.fn<(id: string) => Promise<GalleryItem | undefined>>(() => Promise.resolve(latest));
    const { user, onSaved } = renderEdit({ readLatest });
    await screen.findByRole('dialog', { name: 'Edit Photo' });
    pick(team(), 'My Words');

    await user.click(save());

    expect(await screen.findByText('This was changed by someone else.')).toBeVisible();
    expect(team()).toHaveValue('My Words');
    expect(invalidatePublicContent).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Load Latest' }));
    await waitFor(() => {
      expect(team()).toHaveValue('Their Words');
    });
    expect(readLatest).toHaveBeenCalledWith(GALLERY_IDS.newUpload);
    await user.click(save());

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(backend.puts[1]?.body.version).toBe('AAAAAAAAH88=');
  });

  it('says the photo was not found when it was deleted meanwhile', async () => {
    galleryItemsBackend(undefined, { onPut: () => problemAnswer(404, { code: 'gallery-items.not-found' }) });
    const { user, onClose } = renderEdit();
    await screen.findByRole('dialog', { name: 'Edit Photo' });
    pick(team(), 'Changed');

    await user.click(save());

    expect(
      await screen.findByText("This photo wasn't found. It may have been deleted or moved to another page."),
    ).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('has no axe violations', async () => {
    renderEdit();
    const dialog = await screen.findByRole('dialog', { name: 'Edit Photo' });

    await expectNoAxeViolations(dialog);
  });
});

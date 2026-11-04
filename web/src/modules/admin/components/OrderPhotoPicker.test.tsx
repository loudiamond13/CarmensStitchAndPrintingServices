import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { DraftDescriptionWindow, OrderPhotoPicker, type DraftPhoto } from '@/modules/admin/components/OrderPhotoPicker';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { useOrderHandlers } from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';
import { prepareImage, type PrepareResult } from '@/utils/images';

vi.mock('@/utils/images', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/images')>()),
  prepareImage: vi.fn(),
}));

// The draft photo picker of the New Order form (ORD-04, D-09; UI-SPEC P2): picked photos become draft tiles that can be moved,
// covered and removed on the form with no request.

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  useOrderHandlers();
});

afterEach(() => {
  server.events.removeAllListeners();
  queryClient.clear();
  clearSession();
});

function readyFile(file: File, overrides: Partial<Extract<PrepareResult, { ok: true }>> = {}): PrepareResult {
  return {
    ok: true,
    file,
    name: file.name,
    type: 'image/jpeg',
    width: 3000,
    height: 2000,
    preview: 'data:image/jpeg;base64,AAAA',
    previewUnavailable: false,
    ...overrides,
  };
}

/** Every pick is a good 3000 x 2000 photo, as prepareImage would answer. */
function prepareEveryFile(): void {
  vi.mocked(prepareImage).mockImplementation((file) => Promise.resolve(readyFile(file)));
}

function pickedImage(name: string): File {
  return new File(['jpeg'], name, { type: 'image/jpeg' });
}

function Harness({ initial = [] }: { initial?: readonly DraftPhoto[] }) {
  const [drafts, setDrafts] = useState<readonly DraftPhoto[]>(initial);
  return (
    <>
      <OrderPhotoPicker value={drafts} onChange={setDrafts} />
      <output data-testid="count">{drafts.map((draft) => draft.name).join(',')}</output>
    </>
  );
}

function renderPicker(initial: readonly DraftPhoto[] = []) {
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness initial={initial} />
    </QueryClientProvider>,
  );
}

function galleryInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"][multiple]');
  if (input === null) throw new Error('No gallery input');
  return input;
}

describe('OrderPhotoPicker (tracer)', () => {
  it('shows only the add area with the hint ending 0/5 when there are no drafts (UIC-3)', async () => {
    const { container } = renderPicker();

    expect((await screen.findAllByText('JPG, PNG, WEBP or HEIC · up to 10 MB each · 0/5')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('list', { name: 'Order photos' })).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('turns picked files into draft tiles in pick order, named New order photo 1 and 2, with no request', async () => {
    prepareEveryFile();
    const { container } = renderPicker();
    await screen.findAllByText(/0\/5/);

    await userEvent.setup().upload(galleryInput(container), [pickedImage('one.jpg'), pickedImage('two.jpg')]);

    const list = await screen.findByRole('list', { name: 'Order photos' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(
      within(list)
        .getAllByText(/^New order photo \d$/)
        .map((line) => line.textContent),
    ).toEqual(['New order photo 1', 'New order photo 2']);
    expect(screen.getByTestId('count')).toHaveTextContent('one.jpg,two.jpg');
    expect(screen.getAllByText(/2\/5/).length).toBeGreaterThan(0);
    await expectNoAxeViolations(container);
  });
});

function draftOf(name: string, description = ''): DraftPhoto {
  return {
    id: `draft-${name}`,
    blob: new Blob(['jpeg'], { type: 'image/jpeg' }),
    name,
    preview: 'data:image/jpeg;base64,AAAA',
    previewUnavailable: false,
    description,
  };
}

function tileTexts(): (string | null)[] {
  const list = screen.getByRole('list', { name: 'Order photos' });
  return within(list)
    .getAllByText(/^(New order photo \d|Back mockup)$/)
    .map((line) => line.textContent);
}

describe('arranging drafts (D-08, D-09, UIC-5)', () => {
  it('Move right on photo 1 swaps the two drafts, and the default texts follow the positions', async () => {
    const user = userEvent.setup();
    renderPicker([draftOf('one.jpg'), draftOf('two.jpg')]);
    await screen.findAllByText(/2\/5/);

    await user.click(screen.getByRole('button', { name: 'Move photo 1 right' }));

    expect(screen.getByTestId('count')).toHaveTextContent('two.jpg,one.jpg');
    expect(tileTexts()).toEqual(['New order photo 1', 'New order photo 2']);
    expect(screen.getByText('Moved to position 2 of 2.')).toBeInTheDocument();
  });

  it('a described draft keeps its own text when it moves, and a default one follows its place', async () => {
    const user = userEvent.setup();
    renderPicker([draftOf('one.jpg', 'Back mockup'), draftOf('two.jpg')]);
    await screen.findAllByText(/2\/5/);

    await user.click(screen.getByRole('button', { name: 'Move photo 1 right' }));

    expect(tileTexts()).toEqual(['New order photo 1', 'Back mockup']);
  });

  it('Make Cover on photo 2 puts it first, says so, and moves focus to its Edit description', async () => {
    const user = userEvent.setup();
    renderPicker([draftOf('one.jpg'), draftOf('two.jpg')]);
    await screen.findAllByText(/2\/5/);

    await user.click(screen.getByRole('button', { name: 'Make cover, photo 2' }));

    expect(screen.getByTestId('count')).toHaveTextContent('two.jpg,one.jpg');
    expect(screen.getByText("Moved to position 1 of 2. It's now the cover.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit description of photo 1' })).toHaveFocus();
  });

  it('Remove photo 1 drops it at once with no question, and the count follows', async () => {
    const user = userEvent.setup();
    renderPicker([draftOf('one.jpg'), draftOf('two.jpg')]);
    await screen.findAllByText(/2\/5/);

    await user.click(screen.getByRole('button', { name: 'Remove photo 1' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('count')).toHaveTextContent('two.jpg');
    expect(tileTexts()).toEqual(['New order photo 1']);
    expect(screen.getAllByText(/1\/5/).length).toBeGreaterThan(0);
  });

  it('the Edit description press tells the page which draft was meant', async () => {
    const user = userEvent.setup();
    const edited = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <OrderPhotoPicker
          value={[draftOf('one.jpg'), draftOf('two.jpg')]}
          onChange={vi.fn()}
          onEditDescription={edited}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Edit description of photo 2' }));

    expect(edited).toHaveBeenCalledWith('draft-two.jpg');
  });
});

describe('the limit of 5 (D-08, UIC-29)', () => {
  it('limit: picking 6 files adds the first 5 and the count line says 1 was left out', async () => {
    prepareEveryFile();
    const { container } = renderPicker();
    await screen.findAllByText(/0\/5/);
    const names = ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg', 'f.jpg'];

    await userEvent.setup().upload(galleryInput(container), names.map(pickedImage));

    await screen.findByText("An order can have up to 5 photos. 1 of the photos you picked wasn't added.");
    expect(screen.getByTestId('count')).toHaveTextContent('a.jpg,b.jpg,c.jpg,d.jpg,e.jpg');
    expect(prepareImage).toHaveBeenCalledTimes(5);
  });

  it('limit: at 5 drafts the F1 note replaces the add area', async () => {
    const { container } = renderPicker(['a', 'b', 'c', 'd', 'e'].map((name) => draftOf(`${name}.jpg`)));

    expect(
      await screen.findByText("You've picked 5 photos, the most an order can have. Remove one to pick another."),
    ).toBeVisible();
    expect(container.querySelector('input[type="file"]')).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('limit: removing one at 5 brings the add area back', async () => {
    const user = userEvent.setup();
    const { container } = renderPicker(['a', 'b', 'c', 'd', 'e'].map((name) => draftOf(`${name}.jpg`)));
    await screen.findByText(/the most an order can have/);

    await user.click(screen.getByRole('button', { name: 'Remove photo 3' }));

    expect(container.querySelector('input[type="file"][multiple]')).not.toBeNull();
    expect(screen.queryByText(/the most an order can have/)).not.toBeInTheDocument();
  });
});

describe('a photo being prepared and a refused file (UIC-8, OR-3)', () => {
  it('shows a Skeleton in the tile until the data: preview is ready', async () => {
    let release: (result: PrepareResult) => void = () => undefined;
    vi.mocked(prepareImage).mockImplementation(
      () =>
        new Promise<PrepareResult>((resolve) => {
          release = resolve;
        }),
    );
    const file = pickedImage('slow.jpg');
    const { container } = renderPicker();
    await screen.findAllByText(/0\/5/);

    await userEvent.setup().upload(galleryInput(container), file);

    const list = await screen.findByRole('list', { name: 'Order photos' });
    expect(list.querySelector('[style*="--sk-h"]')).not.toBeNull();
    expect(within(list).getByText('New order photo 1')).toBeVisible();
    expect(screen.getByTestId('count')).toBeEmptyDOMElement();

    release(readyFile(file));

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('slow.jpg');
    });
    expect(list.querySelector('[style*="--sk-h"]')).toBeNull();
    expect(list.querySelector('img')?.getAttribute('src')).toBe('data:image/jpeg;base64,AAAA');
  });

  it('a refused file leaves no tile, is listed with its reason, and gives its place back', async () => {
    vi.mocked(prepareImage).mockImplementation((file) =>
      Promise.resolve(file.name === 'bad.svg' ? { ok: false, reason: 'type' } : readyFile(file)),
    );
    const { container } = renderPicker();
    await screen.findAllByText(/0\/5/);

    await userEvent.setup().upload(galleryInput(container), [pickedImage('bad.svg'), pickedImage('good.jpg')]);

    expect(
      await screen.findByText("bad.svg isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file."),
    ).toBeVisible();
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('good.jpg');
    });
    expect(tileTexts()).toEqual(['New order photo 1']);
  });
});

/** The picker with its description window, as the New Order form draws them (the window sits outside the form). */
function DescribeHarness({ initial }: { initial: readonly DraftPhoto[] }) {
  const [drafts, setDrafts] = useState<readonly DraftPhoto[]>(initial);
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <>
      <OrderPhotoPicker value={drafts} onChange={setDrafts} onEditDescription={setEditing} />
      <DraftDescriptionWindow
        drafts={drafts}
        editingId={editing}
        onChange={setDrafts}
        onClose={() => {
          setEditing(null);
        }}
      />
    </>
  );
}

function renderDescribing(initial: readonly DraftPhoto[]) {
  return render(
    <QueryClientProvider client={queryClient}>
      <DescribeHarness initial={initial} />
    </QueryClientProvider>,
  );
}

describe('describing a draft (D-12, UIC-5)', () => {
  it('Edit description of photo 2 opens the window for "New order · Photo 2 of 2" with the default text selected', async () => {
    const user = userEvent.setup();
    renderDescribing([draftOf('one.jpg'), draftOf('two.jpg')]);
    await screen.findAllByText(/2\/5/);

    await user.click(screen.getByRole('button', { name: 'Edit description of photo 2' }));

    const dialog = await screen.findByRole('dialog', { name: 'Edit Description' });
    expect(within(dialog).getByText('New order · Photo 2 of 2')).toBeVisible();
    const box = within(dialog).getByLabelText<HTMLTextAreaElement>('Photo description');
    expect(box).toHaveValue('New order photo 2');
    expect(box).toHaveFocus();
    expect(box.selectionEnd - box.selectionStart).toBe('New order photo 2'.length);
  });

  it('typing Back mockup and Save Description updates the tile and closes, with no request', async () => {
    const user = userEvent.setup();
    const requests: string[] = [];
    server.events.on('request:start', ({ request }) => {
      requests.push(request.url);
    });
    renderDescribing([draftOf('one.jpg'), draftOf('two.jpg')]);
    await screen.findAllByText(/2\/5/);
    requests.length = 0;
    await user.click(screen.getByRole('button', { name: 'Edit description of photo 2' }));
    const box = await screen.findByLabelText('Photo description');

    await user.clear(box);
    await user.type(box, 'Back mockup');
    await user.click(screen.getByRole('button', { name: 'Save Description' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edit Description' })).not.toBeInTheDocument();
    });
    expect(tileTexts()).toEqual(['New order photo 1', 'Back mockup']);
    expect(requests).toEqual([]);
  });

  it('saving the default text keeps the draft on its default, which follows moves', async () => {
    const user = userEvent.setup();
    renderDescribing([draftOf('one.jpg'), draftOf('two.jpg')]);
    await screen.findAllByText(/2\/5/);
    await user.click(screen.getByRole('button', { name: 'Edit description of photo 2' }));
    await screen.findByRole('dialog', { name: 'Edit Description' });

    await user.click(screen.getByRole('button', { name: 'Save Description' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edit Description' })).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Move photo 2 left' }));

    expect(tileTexts()).toEqual(['New order photo 1', 'New order photo 2']);
  });
});

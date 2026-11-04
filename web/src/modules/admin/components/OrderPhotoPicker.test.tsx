import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { OrderPhotoPicker, type DraftPhoto } from '@/modules/admin/components/OrderPhotoPicker';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
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
    const tiles = within(list).getAllByRole('listitem');
    expect(tiles).toHaveLength(2);
    expect(within(tiles[0] as HTMLElement).getByText('New order photo 1')).toBeVisible();
    expect(within(tiles[1] as HTMLElement).getByText('New order photo 2')).toBeVisible();
    expect(screen.getByTestId('count')).toHaveTextContent('one.jpg,two.jpg');
    expect(screen.getAllByText(/2\/5/).length).toBeGreaterThan(0);
    await expectNoAxeViolations(container);
  });
});

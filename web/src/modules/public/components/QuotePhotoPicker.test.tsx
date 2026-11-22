import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuotePhotoPicker } from '@/modules/public/components/QuotePhotoPicker';
import { expectNoAxeViolations } from '@/test/axe';
import { previewImage } from '@/utils/images';

vi.mock('@/utils/images', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/images')>()),
  previewImage: vi.fn(),
}));

// The public photo picker (UI-SPEC Q2; INQ-02, D-05, D-06): a visitor picks, previews and removes photos. The files are handed on
// exactly as picked.

const PREVIEW = 'data:image/jpeg;base64,AAAA';
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngFile(name: string, size = 64): File {
  const bytes = new Uint8Array(size);
  bytes.set(PNG_SIGNATURE);
  return new File([bytes], name, { type: 'image/png' });
}

interface HarnessProps {
  initial?: readonly File[];
  onChange?: (photos: File[]) => void;
}

function Harness({ initial = [], onChange }: HarnessProps) {
  const [photos, setPhotos] = useState<readonly File[]>(initial);
  return (
    <QuotePhotoPicker
      photos={photos}
      onChange={(next) => {
        onChange?.(next);
        setPhotos(next);
      }}
    />
  );
}

function galleryInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"][multiple]');
  if (input === null) throw new Error('No gallery input');
  return input;
}

function photoList(): HTMLElement {
  return screen.getByRole('list', { name: 'Photos to send' });
}

const createObjectURL = vi.fn(() => 'blob:csps/never');

beforeEach(() => {
  vi.mocked(previewImage).mockReset();
  vi.mocked(previewImage).mockResolvedValue(PREVIEW);
  createObjectURL.mockClear();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectURL });
});

afterEach(() => {
  Reflect.deleteProperty(URL, 'createObjectURL');
});

describe('QuotePhotoPicker (tracer)', () => {
  it('shows the label, the add area and its hint, and no list or count line, with no photos', async () => {
    const { container } = render(<Harness />);

    expect(screen.getByText('Reference photos')).toBeInTheDocument();
    expect(screen.getByText('(optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'browse' })).toBeInTheDocument();
    expect(
      screen.getAllByText(
        'JPG, PNG, WebP or HEIC photos, up to 10 MB each, up to 5. Have a PDF or AI file? Send it to us on Messenger.',
      ),
    ).not.toHaveLength(0);
    expect(screen.queryByRole('list', { name: 'Photos to send' })).not.toBeInTheDocument();
    expect(screen.queryByText(/of 5 photos/)).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('adds a row with a 64px data: preview, the name, the size, a Remove button and the count line', async () => {
    const { container } = render(<Harness />);
    const logo = pngFile('logo.png', 2_516_582);

    await userEvent.setup().upload(galleryInput(container), logo);

    const row = await within(photoList()).findByRole('listitem');
    await waitFor(() => {
      expect(row.querySelector('img')).toHaveAttribute('src', PREVIEW);
    });
    expect(row.querySelector('img')).toHaveClass('size-16');
    expect(within(row).getByText('logo.png')).toBeInTheDocument();
    expect(within(row).getByText('2.4 MB')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Remove logo.png' })).toBeInTheDocument();
    expect(screen.getByText('1 of 5 photos')).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);
  });

  it('hands on the very File the input gave, never a redrawn copy (D-05)', async () => {
    const onChange = vi.fn<(photos: File[]) => void>();
    const { container } = render(<Harness onChange={onChange} />);
    const logo = pngFile('logo.png');

    await userEvent.setup().upload(galleryInput(container), logo);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
    });
    const handed = onChange.mock.calls[0]?.[0];
    expect(handed).toHaveLength(1);
    expect(handed?.[0]).toBe(logo);
  });

  it('shows a 64px Skeleton until the preview is drawn, then the image', async () => {
    let finish: (url: string | null) => void = () => undefined;
    vi.mocked(previewImage).mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          finish = resolve;
        }),
    );
    const { container } = render(<Harness initial={[pngFile('logo.png')]} />);

    const row = await within(photoList()).findByRole('listitem');
    expect(row.querySelector('img')).toBeNull();
    expect(row.querySelector('span[aria-hidden="true"]')).not.toBeNull();

    await act(async () => {
      finish(PREVIEW);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(row.querySelector('img')).toHaveAttribute('src', PREVIEW);
    });
    await expectNoAxeViolations(container);
  });

  it('shows the image icon with hidden "No preview" for a photo the browser cannot draw', async () => {
    vi.mocked(previewImage).mockResolvedValue(null);
    const { container } = render(<Harness initial={[pngFile('logo.heic')]} />);

    const row = await within(photoList()).findByRole('listitem');

    expect(await within(row).findByText('No preview')).toBeInTheDocument();
    expect(row.querySelector('img')).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('draws one preview at a time and never asks for a file over 10 MB', async () => {
    const order: string[] = [];
    vi.mocked(previewImage).mockImplementation((file) => {
      order.push(file instanceof File ? file.name : 'blob');
      return Promise.resolve(PREVIEW);
    });
    const big = pngFile('big.png', 10_485_761);
    render(<Harness initial={[pngFile('a.png'), big, pngFile('b.png')]} />);

    await waitFor(() => {
      expect(within(photoList()).getAllByRole('listitem')[2]?.querySelector('img')).not.toBeNull();
    });
    expect(order).toEqual(['a.png', 'b.png']);
  });

  it('removes a row on Remove, hands on the rest, and puts focus on the add control', async () => {
    const onChange = vi.fn<(photos: File[]) => void>();
    const user = userEvent.setup();
    render(<Harness initial={[pngFile('logo.png')]} onChange={onChange} />);

    await user.click(await screen.findByRole('button', { name: 'Remove logo.png' }));

    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.queryByRole('list', { name: 'Photos to send' })).not.toBeInTheDocument();
    expect(screen.queryByText(/of 5 photos/)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'browse' })).toHaveFocus();
    });
  });
});

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState, type Ref } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuotePhotoPicker, type QuotePhotoPickerHandle } from '@/modules/public/components/QuotePhotoPicker';
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

function textFile(name: string): File {
  return new File(['this is not a photo'], name, { type: 'image/jpeg' });
}

interface HarnessProps {
  initial?: readonly File[];
  onChange?: (photos: File[]) => void;
  disabled?: boolean;
  handleRef?: Ref<QuotePhotoPickerHandle>;
}

function Harness({ initial = [], onChange, disabled = false, handleRef }: HarnessProps) {
  const [photos, setPhotos] = useState<readonly File[]>(initial);
  return (
    <QuotePhotoPicker
      photos={photos}
      disabled={disabled}
      handleRef={handleRef}
      onChange={(next) => {
        onChange?.(next);
        setPhotos(next);
      }}
    />
  );
}

function cameraInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"][capture]');
  if (input === null) throw new Error('No camera input');
  return input;
}

function removeNames(): string[] {
  return screen.getAllByRole('button', { name: /^Remove / }).map((button) => button.getAttribute('aria-label') ?? '');
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

const TYPE_LINE = "notes.jpg isn't a photo we can take. Use JPG, PNG, WebP or HEIC, or send it on Messenger.";

describe('QuotePhotoPicker refused picks (D-02, D-06)', () => {
  it('refuses a text file named like a photo in a role=alert box and still adds the good file of the same pick', async () => {
    const onChange = vi.fn<(photos: File[]) => void>();
    const { container } = render(<Harness onChange={onChange} />);
    const logo = pngFile('logo.png');

    await userEvent.setup().upload(galleryInput(container), [textFile('notes.jpg'), logo]);

    const box = await screen.findByRole('alert');
    expect(within(box).getAllByRole('listitem')).toHaveLength(1);
    expect(within(box).getByText(TYPE_LINE)).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith([logo]);
    expect(await screen.findByRole('button', { name: 'Remove logo.png' })).toBeInTheDocument();
    expect(screen.getByText('1 of 5 photos')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('refuses a file one byte over 10 MB and takes one of exactly 10 MB', async () => {
    const { container } = render(<Harness />);
    const exact = pngFile('exact.png', 10_485_760);

    await userEvent.setup().upload(galleryInput(container), [pngFile('big.png', 10_485_761), exact]);

    const box = await screen.findByRole('alert');
    expect(
      within(box).getByText('big.png is over 10 MB. Send a smaller photo, or send it on Messenger.'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Remove exact.png' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove big.png' })).not.toBeInTheDocument();
  });

  it('names a file that cannot be read', async () => {
    const { container } = render(<Harness />);
    const broken = pngFile('broken.png');
    vi.spyOn(broken, 'slice').mockReturnValue({
      arrayBuffer: () => Promise.reject(new Error('no access')),
    } as unknown as Blob);

    await userEvent.setup().upload(galleryInput(container), broken);

    expect(await screen.findByText("broken.png couldn't be read. Try another photo.")).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Photos to send' })).not.toBeInTheDocument();
  });

  it('with 4 picked, takes the fifth and says 2 of 3 were not added, in the plural', async () => {
    const onChange = vi.fn<(photos: File[]) => void>();
    const initial = ['a', 'b', 'c', 'd'].map((name) => pngFile(`${name}.png`));
    const { container } = render(<Harness initial={initial} onChange={onChange} />);

    await userEvent.setup().upload(galleryInput(container), [pngFile('e.png'), pngFile('f.png'), pngFile('g.png')]);

    const box = await screen.findByRole('alert');
    expect(
      within(box).getByText("You can send up to 5 photos. 2 of the photos you picked weren't added."),
    ).toBeInTheDocument();
    expect(within(box).queryByRole('list')).not.toBeInTheDocument();
    expect(onChange.mock.lastCall?.[0]).toHaveLength(5);
    expect(screen.getByText('5 of 5 photos')).toBeInTheDocument();
  });

  it("says 1 of the photos wasn't added in the singular", async () => {
    const initial = ['a', 'b', 'c', 'd'].map((name) => pngFile(`${name}.png`));
    const { container } = render(<Harness initial={initial} />);

    await userEvent.setup().upload(galleryInput(container), [pngFile('e.png'), pngFile('f.png')]);

    expect(
      await screen.findByText("You can send up to 5 photos. 1 of the photos you picked wasn't added."),
    ).toBeInTheDocument();
  });

  it('clears the box on the next pick', async () => {
    const { container } = render(<Harness />);
    const user = userEvent.setup();
    await user.upload(galleryInput(container), textFile('notes.jpg'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.upload(galleryInput(container), pngFile('logo.png'));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('clears the box on submit, when the form asks', async () => {
    const handle = createRef<QuotePhotoPickerHandle>();
    const { container } = render(<Harness handleRef={handle} />);
    await userEvent.setup().upload(galleryInput(container), textFile('notes.jpg'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    act(() => {
      handle.current?.clearErrors();
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('empties each input after a pick, so the same file can be picked again', async () => {
    const { container } = render(<Harness />);

    await userEvent.setup().upload(galleryInput(container), pngFile('logo.png'));

    expect(galleryInput(container).value).toBe('');
  });
});

describe('QuotePhotoPicker limits and the add area (D-02)', () => {
  it('replaces the add area with the info Note at 5 photos', async () => {
    const initial = ['a', 'b', 'c', 'd', 'e'].map((name) => pngFile(`${name}.png`));
    const { container } = render(<Harness initial={initial} />);

    expect(
      screen.getByText("That's 5 photos, the most one request can take. Remove one to add another."),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'browse' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take Photo' })).not.toBeInTheDocument();
    expect(screen.getByText('5 of 5 photos')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('brings the add area back when a photo is removed from 5', async () => {
    const initial = ['a', 'b', 'c', 'd', 'e'].map((name) => pngFile(`${name}.png`));
    render(<Harness initial={initial} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove e.png' }));

    expect(await screen.findByRole('button', { name: 'browse' })).toBeInTheDocument();
    expect(screen.getByText('4 of 5 photos')).toBeInTheDocument();
  });

  it('shows the Take Photo and Choose Photos buttons for devices that cannot hover, and the drop zone only where they can', () => {
    const { container } = render(<Harness />);

    const takePhoto = screen.getByRole('button', { name: 'Take Photo' });
    const choosePhotos = screen.getByRole('button', { name: 'Choose Photos' });
    expect(takePhoto.parentElement?.parentElement).toHaveClass('no-hover:flex');
    expect(choosePhotos).toBeInTheDocument();
    expect(screen.getByText(/Drop your logo/).closest('[data-over]')).toHaveClass('no-hover:hidden');
    expect(cameraInput(container)).toHaveAttribute('accept', 'image/*');
    expect(cameraInput(container)).toHaveAttribute('capture', 'environment');
    expect(galleryInput(container)).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp,image/heic,image/heif');
  });

  it('adds a photo taken with the camera input', async () => {
    const { container } = render(<Harness />);

    await userEvent.setup().upload(cameraInput(container), pngFile('camera.png'));

    expect(await screen.findByRole('button', { name: 'Remove camera.png' })).toBeInTheDocument();
  });

  it('adds files dropped on the drop zone, and marks the zone while a drag is over it', async () => {
    render(<Harness />);
    const zone = screen.getByText(/Drop your logo/).closest('[data-over]');
    if (zone === null) throw new Error('No drop zone');

    fireEvent.dragOver(zone);
    expect(zone).toHaveAttribute('data-over', 'true');
    fireEvent.drop(zone, { dataTransfer: { files: [pngFile('dropped.png')] } });

    expect(zone).toHaveAttribute('data-over', 'false');
    expect(await screen.findByRole('button', { name: 'Remove dropped.png' })).toBeInTheDocument();
  });

  it('keeps focus on a Remove and ignores its press while the form is sending', async () => {
    const onChange = vi.fn<(photos: File[]) => void>();
    render(<Harness initial={[pngFile('logo.png')]} disabled onChange={onChange} />);
    const remove = await screen.findByRole('button', { name: 'Remove logo.png' });

    await userEvent.setup().click(remove);

    expect(remove).toHaveAttribute('aria-disabled', 'true');
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(['browse', 'Take Photo', 'Choose Photos'])(
    'opens no chooser from %s while the form is sending',
    async (name) => {
      const { container } = render(<Harness disabled />);
      const opened = vi.fn();
      galleryInput(container).addEventListener('click', opened);
      cameraInput(container).addEventListener('click', opened);
      const button = screen.getByRole('button', { name });

      await userEvent.setup().click(button);

      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(opened).not.toHaveBeenCalled();
    },
  );

  it('wraps a long file name anywhere', async () => {
    render(<Harness initial={[pngFile(`${'a'.repeat(70)}.png`)]} />);

    const name = await screen.findByText(`${'a'.repeat(70)}.png`);

    expect(name).toHaveClass('wrap-anywhere');
  });
});

describe('QuotePhotoPicker keyboard and focus (UI Q2 a11y)', () => {
  it('reaches browse, Take Photo, Choose Photos and every Remove by Tab', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[pngFile('a.png'), pngFile('b.png')]} />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'browse' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Take Photo' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Choose Photos' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Remove a.png' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Remove b.png' })).toHaveFocus();
  });

  it("puts focus on the next row's Remove after removing the middle of three", async () => {
    const user = userEvent.setup();
    render(<Harness initial={[pngFile('a.png'), pngFile('b.png'), pngFile('c.png')]} />);

    await user.click(screen.getByRole('button', { name: 'Remove b.png' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Remove c.png' })).toHaveFocus();
    });
    expect(removeNames()).toEqual(['Remove a.png', 'Remove c.png']);
  });

  it('puts focus on the previous Remove after removing the last row', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[pngFile('a.png'), pngFile('b.png'), pngFile('c.png')]} />);

    await user.click(screen.getByRole('button', { name: 'Remove c.png' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Remove b.png' })).toHaveFocus();
    });
  });

  it('puts focus on the add control after removing the only row', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[pngFile('a.png')]} />);

    await user.click(screen.getByRole('button', { name: 'Remove a.png' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'browse' })).toHaveFocus();
    });
  });

  it('has no axe violations with three photos', async () => {
    const { container } = render(<Harness initial={[pngFile('a.png'), pngFile('b.png'), pngFile('c.png')]} />);

    await waitFor(() => {
      expect(container.querySelectorAll('img')).toHaveLength(3);
    });
    await expectNoAxeViolations(container);
  });
});

describe('QuotePhotoPicker picks that overlap (review W1 IN-05)', () => {
  it('keeps 5 photos and counts what was left out when two picks are made at once', async () => {
    const onChange = vi.fn<(photos: File[]) => void>();
    const { container } = render(<Harness onChange={onChange} />);
    const first = [pngFile('a1.png'), pngFile('a2.png'), pngFile('a3.png')];
    const second = [pngFile('b1.png'), pngFile('b2.png'), pngFile('b3.png')];

    fireEvent.change(galleryInput(container), { target: { files: first } });
    fireEvent.change(cameraInput(container), { target: { files: second } });

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(5);
    });
    expect(removeNames()).toEqual([
      'Remove a1.png',
      'Remove a2.png',
      'Remove a3.png',
      'Remove b1.png',
      'Remove b2.png',
    ]);
    expect(
      await screen.findByText("You can send up to 5 photos. 1 of the photos you picked wasn't added."),
    ).toBeInTheDocument();
    expect(screen.getByText('5 of 5 photos')).toBeInTheDocument();
  });

  it('adds the same photo once, however many times it is picked', async () => {
    const { container } = render(<Harness />);
    const logo = pngFile('logo.png');
    const user = userEvent.setup();

    await user.upload(galleryInput(container), logo);
    await screen.findByRole('button', { name: 'Remove logo.png' });
    await user.upload(galleryInput(container), logo);
    await user.upload(galleryInput(container), [logo, logo]);

    await waitFor(() => {
      expect(screen.getByText('1 of 5 photos')).toBeInTheDocument();
    });
    expect(removeNames()).toEqual(['Remove logo.png']);
  });

  it('takes a different photo that has the same name', async () => {
    const { container } = render(<Harness />);
    const user = userEvent.setup();

    await user.upload(galleryInput(container), pngFile('photo.png', 64));
    await screen.findByRole('button', { name: 'Remove photo.png' });
    await user.upload(galleryInput(container), pngFile('photo.png', 128));

    await waitFor(() => {
      expect(screen.getByText('2 of 5 photos')).toBeInTheDocument();
    });
  });

  it('does not keep a preview that was drawn after its photo was removed', async () => {
    const finishers: ((url: string | null) => void)[] = [];
    vi.mocked(previewImage).mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          finishers.push(resolve);
        }),
    );
    const { container } = render(<Harness />);
    const logo = pngFile('logo.png');
    const user = userEvent.setup();
    await user.upload(galleryInput(container), logo);
    await user.click(await screen.findByRole('button', { name: 'Remove logo.png' }));

    await act(async () => {
      finishers[0]?.(PREVIEW);
      await Promise.resolve();
    });
    await user.upload(galleryInput(container), logo);

    await screen.findByRole('button', { name: 'Remove logo.png' });
    await waitFor(() => {
      expect(previewImage).toHaveBeenCalledTimes(2);
    });
  });
});

describe('QuotePhotoPicker first pick (D-43)', () => {
  it('checks and adds the files the visitor picked before the picker was loaded', async () => {
    const onChange = vi.fn<(photos: File[]) => void>();
    const logo = pngFile('logo.png');
    render(<QuotePhotoPicker photos={[]} onChange={onChange} firstPick={[logo, textFile('notes.jpg')]} />);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([logo]);
    });
    expect(await screen.findByText(/notes\.jpg isn't a photo we can take/)).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('applies the first pick once, even if the picker renders again', async () => {
    const onChange = vi.fn<(photos: File[]) => void>();
    const logo = pngFile('logo.png');
    const view = render(<QuotePhotoPicker photos={[]} onChange={onChange} firstPick={[logo]} />);
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    view.rerender(<QuotePhotoPicker photos={[logo]} onChange={onChange} firstPick={[logo]} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

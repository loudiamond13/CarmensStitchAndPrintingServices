import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { ImageUploader, type AddControlHandle, type ImageUploaderProps, type PhotoTileModel } from '@/components/media';

// The photo list (plan 09-08; owner rulings D-13, D-14, D-17, D-25). The component is presentational: every action goes
// to a callback, and the order screens wire them. The look of the tile is in PhotoTile.test.tsx.

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

function saved(n: number, extra: Partial<PhotoTileModel> = {}): PhotoTileModel {
  return {
    id: `p${String(n)}`,
    state: 'saved',
    description: `Order ORD-2026-0148 photo ${String(n)}`,
    thumb: { src: PIXEL, width: 88, height: 88 },
    ...extra,
  };
}

function props(overrides: Partial<ImageUploaderProps> = {}): ImageUploaderProps {
  return {
    photos: [saved(1), saved(2)],
    max: 5,
    maxMegabytes: 10,
    mode: 'live',
    busy: false,
    onAddFiles: vi.fn(),
    onMove: vi.fn(),
    onMakeCover: vi.fn(),
    onEditDescription: vi.fn(),
    onDelete: vi.fn(),
    onRemove: vi.fn(),
    onRetry: vi.fn(),
    onOpen: vi.fn(),
    ...overrides,
  };
}

function file(name: string, type = 'image/jpeg'): File {
  return new File(['x'], name, { type });
}

function list(): HTMLElement {
  return screen.getByRole('list', { name: 'Order photos' });
}

function tile(n: number): HTMLElement {
  const item = within(list()).getAllByRole('listitem')[n - 1];
  if (item === undefined) {
    throw new Error(`No tile ${String(n)}.`);
  }
  return item;
}

function input(container: HTMLElement, camera: boolean): HTMLInputElement {
  const found = container.querySelector(camera ? 'input[type="file"][capture]' : 'input[type="file"]:not([capture])');
  if (!(found instanceof HTMLInputElement)) {
    throw new Error('No file input.');
  }
  return found;
}

function dropZone(): HTMLElement {
  const zone = screen.getByText(/Drag images here or/).closest<HTMLElement>('[data-over]');
  if (zone === null) {
    throw new Error('No drop zone.');
  }
  return zone;
}

const createObjectURL = vi.fn(() => 'blob:csps/never');

beforeEach(() => {
  createObjectURL.mockClear();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectURL });
});

afterEach(() => {
  Reflect.deleteProperty(URL, 'createObjectURL');
});

describe('ImageUploader live list with two saved photos (D-25)', () => {
  it('names the list "Order photos" and shows one tile per photo', () => {
    render(<ImageUploader {...props()} />);
    expect(within(list()).getAllByRole('listitem')).toHaveLength(2);
  });

  it('puts the Cover tag on photo 1 only, and Make Cover on every other photo (D-14)', () => {
    render(<ImageUploader {...props()} />);
    expect(within(tile(1)).getByText('Cover')).toBeDefined();
    expect(within(tile(1)).queryByRole('button', { name: /^Make cover/ })).toBeNull();
    expect(within(tile(2)).queryByText('Cover')).toBeNull();
    expect(within(tile(2)).getByRole('button', { name: 'Make cover, photo 2' })).toBeDefined();
  });

  it('shows "Photo {n} of {total}" and the description in each tile', () => {
    render(<ImageUploader {...props()} />);
    expect(within(tile(1)).getByText('Photo 1 of 2')).toBeDefined();
    expect(within(tile(2)).getByText('Photo 2 of 2')).toBeDefined();
    expect(within(tile(2)).getByText('Order ORD-2026-0148 photo 2')).toBeDefined();
  });

  it('gives each photo its four 44 px controls, named per photo, with a matching title (D-13)', () => {
    render(<ImageUploader {...props()} />);
    for (const [n, count] of [
      [1, 2],
      [2, 2],
    ] as const) {
      const names = [
        `Open photo ${String(n)} of ${String(count)}: Order ORD-2026-0148 photo ${String(n)}`,
        `Move photo ${String(n)} left`,
        `Move photo ${String(n)} right`,
        `Edit description of photo ${String(n)}`,
        `Delete photo ${String(n)}`,
      ];
      for (const name of names) {
        const button = within(tile(n)).getByRole('button', { name });
        if (!name.startsWith('Open photo')) {
          expect(button.getAttribute('title')).toBe(name);
          expect(button.className).toContain('w-11');
          expect(button.className).toContain('h-11');
        }
      }
    }
  });

  it('sends each action to its callback with the photo id', async () => {
    const p = props();
    render(<ImageUploader {...p} />);
    await userEvent.click(within(tile(1)).getByRole('button', { name: 'Move photo 1 right' }));
    expect(p.onMove).toHaveBeenCalledWith('p1', 1);
    await userEvent.click(within(tile(2)).getByRole('button', { name: 'Move photo 2 left' }));
    expect(p.onMove).toHaveBeenCalledWith('p2', 0);
    await userEvent.click(within(tile(2)).getByRole('button', { name: 'Make cover, photo 2' }));
    expect(p.onMakeCover).toHaveBeenCalledWith('p2');
    await userEvent.click(within(tile(1)).getByRole('button', { name: 'Edit description of photo 1' }));
    expect(p.onEditDescription).toHaveBeenCalledWith('p1');
    await userEvent.click(within(tile(2)).getByRole('button', { name: 'Delete photo 2' }));
    expect(p.onDelete).toHaveBeenCalledWith('p2');
  });

  it('opens a photo when its thumb is pressed', async () => {
    const p = props();
    render(<ImageUploader {...p} />);
    await userEvent.click(
      within(tile(2)).getByRole('button', { name: 'Open photo 2 of 2: Order ORD-2026-0148 photo 2' }),
    );
    expect(p.onOpen).toHaveBeenCalledWith('p2');
  });
});

describe('ImageUploader add area (D-17, D-08)', () => {
  it('shows the hint with the size and the count, in the drop zone and under the touch buttons', () => {
    render(<ImageUploader {...props()} />);
    expect(screen.getAllByText('JPG, PNG, WEBP or HEIC · up to 10 MB each · 2/5')).toHaveLength(2);
  });

  it('reads the limit and the size from the props', () => {
    render(<ImageUploader {...props({ photos: [saved(1)], max: 3, maxMegabytes: 8 })} />);
    expect(screen.getAllByText('JPG, PNG, WEBP or HEIC · up to 8 MB each · 1/3')).toHaveLength(2);
  });

  it('shows only the add area, with 0/5, when a live card has no photos (UIC-1)', () => {
    render(<ImageUploader {...props({ photos: [] })} />);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getAllByText('JPG, PNG, WEBP or HEIC · up to 10 MB each · 0/5')).toHaveLength(2);
  });

  it('shows the drop zone on devices that hover and hides it where hover is none', () => {
    render(<ImageUploader {...props()} />);
    expect(screen.getByText(/Drag images here or/).textContent).toBe('Drag images here or browse');
    const zone = dropZone();
    expect(zone.className).toContain('no-hover:hidden');
    expect(zone.getAttribute('data-over')).toBe('false');
  });

  it('shows Take Photo and Choose Photos only where hover is none (D-17)', () => {
    render(<ImageUploader {...props()} />);
    const takePhoto = screen.getByRole('button', { name: 'Take Photo' });
    const row = takePhoto.closest('[class*="no-hover:flex"]');
    expect(row?.className).toContain('hidden');
    expect(row).toBe(screen.getByRole('button', { name: 'Choose Photos' }).closest('[class*="no-hover:flex"]'));
  });

  it('gives Choose Photos an image-only list, many files and no capture', () => {
    const { container } = render(<ImageUploader {...props()} />);
    const gallery = input(container, false);
    expect(gallery.accept).toBe('image/jpeg,image/png,image/webp,image/heic,image/heif');
    expect(gallery.multiple).toBe(true);
    expect(gallery.hasAttribute('capture')).toBe(false);
    expect(gallery.hidden).toBe(true);
  });

  it('gives Take Photo its own input: any image, one file, rear camera', () => {
    const { container } = render(<ImageUploader {...props()} />);
    const camera = input(container, true);
    expect(camera.accept).toBe('image/*');
    expect(camera.getAttribute('capture')).toBe('environment');
    expect(camera.multiple).toBe(false);
    expect(camera.hidden).toBe(true);
  });

  it('opens the right input from Take Photo, Choose Photos and browse', async () => {
    const { container } = render(<ImageUploader {...props()} />);
    const gallery = vi.spyOn(input(container, false), 'click');
    const camera = vi.spyOn(input(container, true), 'click');
    await userEvent.click(screen.getByRole('button', { name: 'Take Photo' }));
    expect(camera).toHaveBeenCalledTimes(1);
    expect(gallery).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Choose Photos' }));
    await userEvent.click(screen.getByRole('button', { name: 'browse' }));
    expect(gallery).toHaveBeenCalledTimes(2);
    expect(camera).toHaveBeenCalledTimes(1);
  });

  it('passes two chosen files to onAddFiles with "gallery"', () => {
    const p = props();
    const { container } = render(<ImageUploader {...p} />);
    const files = [file('a.jpg'), file('b.png', 'image/png')];
    fireEvent.change(input(container, false), { target: { files } });
    expect(p.onAddFiles).toHaveBeenCalledTimes(1);
    expect(p.onAddFiles).toHaveBeenCalledWith(files, 'gallery');
  });

  it('passes the camera file to onAddFiles with "camera"', () => {
    const p = props();
    const { container } = render(<ImageUploader {...p} />);
    const files = [file('shot.jpg')];
    fireEvent.change(input(container, true), { target: { files } });
    expect(p.onAddFiles).toHaveBeenCalledWith(files, 'camera');
  });

  it('passes dropped files with "drop" and marks the zone while files are dragged over it', () => {
    const p = props();
    render(<ImageUploader {...p} />);
    const zone = dropZone();
    fireEvent.dragOver(zone);
    expect(zone.dataset.over).toBe('true');
    fireEvent.dragLeave(zone);
    expect(zone.dataset.over).toBe('false');
    const files = [file('drop.webp', 'image/webp')];
    fireEvent.drop(zone, { dataTransfer: { files } });
    expect(zone.dataset.over).toBe('false');
    expect(p.onAddFiles).toHaveBeenCalledWith(files, 'drop');
  });

  it('empties each input after a pick, so the same file can be picked again', () => {
    const { container } = render(<ImageUploader {...props()} />);
    for (const camera of [false, true]) {
      const field = input(container, camera);
      const written: string[] = [];
      Object.defineProperty(field, 'value', {
        configurable: true,
        get: () => '',
        set: (value: string) => {
          written.push(value);
        },
      });
      fireEvent.change(field, { target: { files: [file('same.jpg')] } });
      expect(written).toEqual(['']);
    }
  });

  it('calls nothing for an empty pick', () => {
    const p = props();
    const { container } = render(<ImageUploader {...p} />);
    fireEvent.change(input(container, false), { target: { files: [] } });
    expect(p.onAddFiles).not.toHaveBeenCalled();
  });

  it('reads no file itself and makes no blob address (T-09-25)', () => {
    const { container } = render(<ImageUploader {...props()} />);
    fireEvent.change(input(container, false), { target: { files: [file('a.jpg')] } });
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

describe('ImageUploader accessibility', () => {
  it('has no axe violations with photos and with none', async () => {
    const full = render(<ImageUploader {...props()} />);
    await expectNoAxeViolations(full.container);
    full.unmount();
    const empty = render(<ImageUploader {...props({ photos: [] })} />);
    await expectNoAxeViolations(empty.container);
  });
});

function pending(
  n: number,
  state: 'waiting' | 'uploading' | 'failed',
  extra: Partial<PhotoTileModel> = {},
): PhotoTileModel {
  return {
    id: `w${String(n)}`,
    state,
    description: '',
    fileName: `file-${String(n)}.jpg`,
    preview: PIXEL,
    ...extra,
  };
}

function buttonNames(scope: HTMLElement): (string | null)[] {
  return within(scope)
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label'));
}

describe('ImageUploader busy (D-15)', () => {
  it('makes every saved-photo control aria-disabled with focus kept, and turns drag off', () => {
    render(<ImageUploader {...props({ busy: true })} />);
    for (const n of [1, 2]) {
      const names = [
        `Move photo ${String(n)} left`,
        `Move photo ${String(n)} right`,
        `Edit description of photo ${String(n)}`,
        `Delete photo ${String(n)}`,
        ...(n === 2 ? ['Make cover, photo 2'] : []),
      ];
      for (const name of names) {
        const button = within(tile(n)).getByRole('button', { name });
        expect(button.getAttribute('aria-disabled'), name).toBe('true');
        button.focus();
        expect(document.activeElement, name).toBe(button);
      }
      expect(tile(n).hasAttribute('draggable')).toBe(false);
    }
  });

  it('still takes picked files while busy', () => {
    const p = props({ busy: true });
    const { container } = render(<ImageUploader {...p} />);
    const files = [file('late.jpg')];
    fireEvent.change(input(container, false), { target: { files } });
    expect(p.onAddFiles).toHaveBeenCalledWith(files, 'gallery');
  });

  it('makes the saved-photo controls work again when not busy', () => {
    render(<ImageUploader {...props()} />);
    expect(within(tile(2)).getByRole('button', { name: 'Delete photo 2' }).getAttribute('aria-disabled')).toBeNull();
    expect(tile(2).getAttribute('draggable')).toBe('true');
  });
});

describe('ImageUploader modes', () => {
  it('shows row 1 only in readonly: no add area, no controls, no list drag', () => {
    const { container } = render(<ImageUploader {...props({ mode: 'readonly' })} />);
    expect(screen.queryByRole('button', { name: 'browse' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Take Photo' })).toBeNull();
    expect(container.querySelector('input')).toBeNull();
    expect(screen.queryByText(/JPG, PNG/)).toBeNull();
    for (const n of [1, 2]) {
      expect(buttonNames(tile(n))).toEqual([`Open photo ${String(n)} of 2: Order ORD-2026-0148 photo ${String(n)}`]);
      expect(tile(n).hasAttribute('draggable')).toBe(false);
    }
  });

  it('says "No photos on this order." in readonly with no photos (UIC-2)', () => {
    render(<ImageUploader {...props({ mode: 'readonly', photos: [] })} />);
    expect(screen.getByText('No photos on this order.')).toBeDefined();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('does not say it for a live card with no photos', () => {
    render(<ImageUploader {...props({ photos: [] })} />);
    expect(screen.queryByText('No photos on this order.')).toBeNull();
  });

  it('shows the same controls in draft mode, with "Remove photo {n}" for a draft photo', () => {
    const drafts: PhotoTileModel[] = [1, 2].map((n) => ({
      id: `d${String(n)}`,
      state: 'draft',
      description: `New order photo ${String(n)}`,
      fileName: `draft-${String(n)}.jpg`,
      preview: PIXEL,
    }));
    const p = props({ mode: 'draft', photos: drafts });
    render(<ImageUploader {...p} />);
    expect(buttonNames(tile(2))).toEqual([
      'Make cover, photo 2',
      'Move photo 2 left',
      'Move photo 2 right',
      'Edit description of photo 2',
      'Remove photo 2',
    ]);
    expect(screen.getAllByText('JPG, PNG, WEBP or HEIC · up to 10 MB each · 2/5')).toHaveLength(2);
  });
});

describe('ImageUploader pending files and positions', () => {
  it('numbers only the photos that hold a position, and lists the others after them', () => {
    render(
      <ImageUploader
        {...props({
          photos: [saved(1), saved(2), pending(1, 'waiting'), pending(2, 'uploading'), pending(3, 'failed')],
        })}
      />,
    );
    expect(within(tile(1)).getByText('Photo 1 of 2')).toBeDefined();
    expect(within(tile(2)).getByText('Photo 2 of 2')).toBeDefined();
    expect(within(tile(3)).getByText('Waiting to upload')).toBeDefined();
    expect(within(tile(4)).getByText('Uploading')).toBeDefined();
    expect(within(tile(5)).getByText('file-3.jpg')).toBeDefined();
    expect(within(tile(2)).getByRole('button', { name: 'Move photo 2 right' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  it('counts waiting, uploading and failed files in the hint', () => {
    render(<ImageUploader {...props({ photos: [saved(1), pending(1, 'waiting'), pending(2, 'failed')] })} />);
    expect(screen.getAllByText('JPG, PNG, WEBP or HEIC · up to 10 MB each · 3/5')).toHaveLength(2);
  });

  it('sends Try Again and Remove of a failed file to their callbacks', async () => {
    const p = props({
      photos: [
        saved(1),
        pending(1, 'failed', { failure: { reason: 'Check your connection, then try again.', retryable: true } }),
      ],
    });
    render(<ImageUploader {...p} />);
    await userEvent.click(within(tile(2)).getByRole('button', { name: 'Try again, file-1.jpg' }));
    await userEvent.click(within(tile(2)).getByRole('button', { name: 'Remove file-1.jpg' }));
    expect(p.onRetry).toHaveBeenCalledWith('w1');
    expect(p.onRemove).toHaveBeenCalledWith('w1');
  });
});

describe('ImageUploader limit (D-08)', () => {
  const five = [1, 2, 3, 4, 5].map((n) => saved(n));

  it('replaces the add area with the limit note the caller passes', () => {
    const { container } = render(
      <ImageUploader {...props({ photos: five, limitNote: 'This order has 5 photos, the most it can have.' })} />,
    );
    expect(screen.getByText('This order has 5 photos, the most it can have.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'browse' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Choose Photos' })).toBeNull();
    expect(screen.queryByText(/JPG, PNG/)).toBeNull();
    expect(container.querySelector('input')).toBeNull();
  });

  it('counts waiting and failed files toward the limit (UIC-35)', () => {
    const photos = [saved(1), saved(2), saved(3), pending(1, 'waiting'), pending(2, 'failed')];
    render(<ImageUploader {...props({ photos, limitNote: 'Limit reached.' })} />);
    expect(screen.getByText('Limit reached.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'browse' })).toBeNull();
  });

  it('shows the add area below the limit even with a limit note passed', () => {
    render(<ImageUploader {...props({ limitNote: 'Limit reached.' })} />);
    expect(screen.queryByText('Limit reached.')).toBeNull();
    expect(screen.getByRole('button', { name: 'browse' })).toBeDefined();
  });

  it('shows nothing in place of the add area at the limit when no note is passed', () => {
    render(<ImageUploader {...props({ photos: five })} />);
    expect(screen.queryByRole('button', { name: 'browse' })).toBeNull();
    expect(within(list()).getAllByRole('listitem')).toHaveLength(5);
  });
});

describe('ImageUploader pick errors (UIC-34, UIC-40)', () => {
  it('shows one line per refused file in an alert, with the file name first', () => {
    render(
      <ImageUploader
        {...props({
          pickErrors: [
            {
              fileName: 'notes.pdf',
              reason: "notes.pdf isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file.",
            },
            { fileName: 'huge.jpg', reason: 'huge.jpg is over 10 MB. Choose a smaller photo.' },
          ],
        })}
      />,
    );
    const alert = screen.getByRole('alert');
    const lines = within(alert).getAllByRole('listitem');
    expect(lines).toHaveLength(2);
    const [first = alert, second = alert] = lines;
    expect(within(first).getByText('notes.pdf').className).toContain('wrap-anywhere');
    expect(within(second).getByText('huge.jpg is over 10 MB. Choose a smaller photo.')).toBeDefined();
  });

  it('wraps a long file name anywhere', () => {
    const name = `${'y'.repeat(120)}.png`;
    render(<ImageUploader {...props({ pickErrors: [{ fileName: name, reason: 'Could not be read.' }] })} />);
    expect(screen.getByText(name).className).toContain('wrap-anywhere');
  });

  it('adds a count line for files left out over the limit', () => {
    render(<ImageUploader {...props({ pickErrors: [], leftOutCount: 2 })} />);
    expect(
      within(screen.getByRole('alert')).getByText(
        "An order can have up to 5 photos. 2 of the photos you picked weren't added.",
      ),
    ).toBeDefined();
  });

  it('says it in the singular for one file', () => {
    render(<ImageUploader {...props({ leftOutCount: 1 })} />);
    expect(
      screen.getByText("An order can have up to 5 photos. 1 of the photos you picked wasn't added."),
    ).toBeDefined();
  });

  it('shows no alert when nothing was refused', () => {
    render(<ImageUploader {...props({ pickErrors: [], leftOutCount: 0 })} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('has no axe violations with errors, a limit note, pending files and every mode', async () => {
    const cases: Partial<ImageUploaderProps>[] = [
      { pickErrors: [{ fileName: 'a.pdf', reason: 'Not a photo.' }], leftOutCount: 1 },
      { photos: [1, 2, 3, 4, 5].map((n) => saved(n)), limitNote: 'Limit reached.' },
      { photos: [saved(1), pending(1, 'waiting'), pending(2, 'uploading'), pending(3, 'failed')] },
      { mode: 'readonly' },
      { mode: 'readonly', photos: [] },
      { busy: true },
    ];
    for (const overrides of cases) {
      const { container, unmount } = render(<ImageUploader {...props(overrides)} />);
      await expectNoAxeViolations(container);
      unmount();
    }
  });
});

describe('ImageUploader drag between tiles (D-13 bonus)', () => {
  it('moves tile 1 to position 3 when it is dropped on tile 3', () => {
    const p = props({ photos: [saved(1), saved(2), saved(3)] });
    render(<ImageUploader {...p} />);
    fireEvent.dragStart(tile(1));
    fireEvent.dragOver(tile(3));
    fireEvent.drop(tile(3));
    expect(p.onMove).toHaveBeenCalledTimes(1);
    expect(p.onMove).toHaveBeenCalledWith('p1', 2);
  });

  it('does nothing for a drop on the tile it started from, or with no drag in progress', () => {
    const p = props({ photos: [saved(1), saved(2), saved(3)] });
    render(<ImageUploader {...p} />);
    fireEvent.dragStart(tile(2));
    fireEvent.drop(tile(2));
    fireEvent.drop(tile(1));
    fireEvent.dragStart(tile(1));
    fireEvent.dragEnd(tile(1));
    fireEvent.drop(tile(3));
    expect(p.onMove).not.toHaveBeenCalled();
  });

  it('keeps waiting files out of the drag', () => {
    const p = props({ photos: [saved(1), saved(2), pending(1, 'waiting')] });
    render(<ImageUploader {...p} />);
    expect(tile(3).hasAttribute('draggable')).toBe(false);
    fireEvent.dragStart(tile(1));
    fireEvent.drop(tile(3));
    expect(p.onMove).not.toHaveBeenCalled();
  });

  it('never marks the drop zone for a tile drag, and ignores files dropped during it', () => {
    const p = props();
    render(<ImageUploader {...p} />);
    fireEvent.dragStart(tile(2));
    const zone = dropZone();
    fireEvent.dragOver(zone);
    expect(zone.dataset.over).toBe('false');
    fireEvent.drop(zone, { dataTransfer: { files: [file('a.jpg')] } });
    expect(p.onAddFiles).not.toHaveBeenCalled();
  });
});

describe('ImageUploader names and sizes (UIC-42, UIC-31)', () => {
  it('names every per-photo control from the copy contract', () => {
    const p = props({
      photos: [
        saved(1),
        saved(2),
        pending(1, 'failed', { failure: { reason: 'Try later.', retryable: true } }),
        { id: 'd9', state: 'draft', description: 'New order photo 3', preview: PIXEL },
      ],
    });
    render(<ImageUploader {...p} />);
    const all = new Set(
      within(list())
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    );
    for (const name of [
      'Open photo 1 of 3: Order ORD-2026-0148 photo 1',
      'Move photo 2 left',
      'Move photo 2 right',
      'Edit description of photo 2',
      'Delete photo 2',
      'Make cover, photo 2',
      'Try again, file-1.jpg',
      'Remove file-1.jpg',
      'Remove photo 3',
    ]) {
      expect(all.has(name), name).toBe(true);
    }
  });

  it('keeps one column on a phone and a 16 px gap: the list is an auto-fill grid of at least 280 px (UIC-31)', () => {
    render(<ImageUploader {...props()} />);
    const classes = list().className;
    expect(classes).toContain('grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]');
    expect(classes).toContain('gap-4');
    expect(tile(1).className).toContain('min-w-0');
  });
});

describe('ImageUploader hover and touch (UIC-45)', () => {
  const original = window.matchMedia.bind(window);

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: original });
  });

  it.each([true, false])('finds every action of a tile with hover %s', (hover) => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: query.includes('hover: none') ? !hover : hover,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
    render(<ImageUploader {...props()} />);
    expect(buttonNames(tile(2))).toEqual([
      'Open photo 2 of 2: Order ORD-2026-0148 photo 2',
      'Make cover, photo 2',
      'Move photo 2 left',
      'Move photo 2 right',
      'Edit description of photo 2',
      'Delete photo 2',
    ]);
  });
});

describe('ImageUploader first add control', () => {
  it('focuses "browse" through the handle when nothing shows the touch buttons', () => {
    const ref = createRef<AddControlHandle>();
    render(<ImageUploader {...props({ addControlRef: ref })} />);
    ref.current?.focus();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'browse' }));
  });

  it('focuses "Choose Photos" when that is the one that shows', () => {
    const ref = createRef<AddControlHandle>();
    render(<ImageUploader {...props({ addControlRef: ref })} />);
    const choose = screen.getByRole('button', { name: 'Choose Photos' });
    vi.spyOn(choose, 'getClientRects').mockReturnValue([new DOMRect()] as unknown as DOMRectList);
    ref.current?.focus();
    expect(document.activeElement).toBe(choose);
  });

  it('does nothing when the limit hides the add area', () => {
    const ref = createRef<AddControlHandle>();
    render(
      <ImageUploader
        {...props({ addControlRef: ref, photos: [1, 2, 3, 4, 5].map((n) => saved(n)), limitNote: 'Limit reached.' })}
      />,
    );
    const before = document.activeElement;
    ref.current?.focus();
    expect(document.activeElement).toBe(before);
  });
});

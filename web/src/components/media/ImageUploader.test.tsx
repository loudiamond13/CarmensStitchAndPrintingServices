import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { ImageUploader, type ImageUploaderProps, type PhotoTileModel } from '@/components/media';

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

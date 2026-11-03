import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import type { PhotoTileModel } from '@/components/media';
import { PhotoTile, type PhotoTileProps } from './PhotoTile';

// One photo tile (plan 09-08; UI-SPEC P1 "Photo tile"). It is rendered inside a list, as the uploader does.

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

const savedPhoto: PhotoTileModel = {
  id: 'p2',
  state: 'saved',
  description: 'Back mockup, red and black',
  thumb: { src: PIXEL, width: 88, height: 88 },
};

function tileProps(overrides: Partial<PhotoTileProps> = {}): PhotoTileProps {
  return {
    photo: savedPhoto,
    position: 2,
    total: 3,
    mode: 'live',
    busy: false,
    canDrag: false,
    onMove: vi.fn(),
    onMakeCover: vi.fn(),
    onEditDescription: vi.fn(),
    onDelete: vi.fn(),
    onRemove: vi.fn(),
    onRetry: vi.fn(),
    onOpen: vi.fn(),
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    onDropOn: vi.fn(),
    ...overrides,
  };
}

function renderTile(overrides: Partial<PhotoTileProps> = {}) {
  return render(
    <ul>
      <PhotoTile {...tileProps(overrides)} />
    </ul>,
  );
}

describe('PhotoTile saved photo (D-25)', () => {
  it('opens the viewer from a thumb button named by position and description', () => {
    renderTile();
    const open = screen.getByRole('button', { name: 'Open photo 2 of 3: Back mockup, red and black' });
    expect(open.querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('shows the label, the description and Make Cover on a photo that is not the cover', () => {
    renderTile();
    expect(screen.getByText('Photo 2 of 3')).toBeDefined();
    expect(screen.getByText('Back mockup, red and black')).toBeDefined();
    const makeCover = screen.getByRole('button', { name: 'Make cover, photo 2' });
    expect(makeCover.textContent).toBe('Make Cover');
    expect(screen.queryByText('Cover')).toBeNull();
  });

  it('marks the cover with its tag and ring and has no Make Cover', () => {
    const { container } = renderTile({ position: 1 });
    expect(screen.getByText('Cover')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Make cover/ })).toBeNull();
    expect(container.querySelector('li > div')?.innerHTML).toContain('accent-line');
  });

  it('puts the D-05 reveal on the decorative grip only, and hides the grip where hover is none', () => {
    const { container } = renderTile();
    const tokens = (element: Element) =>
      [...element.classList].filter((token) => /(^|:)opacity-(0|100)$/.test(token)).sort((a, b) => a.localeCompare(b));
    const revealed = [...container.querySelectorAll('*')].filter((element) => tokens(element).length > 0);
    expect(revealed).toHaveLength(1);
    const grip = revealed[0] ?? document.body;
    expect(grip.getAttribute('aria-hidden')).toBe('true');
    expect(tokens(grip)).toEqual([
      'group-focus-within/thumb:opacity-100',
      'group-hover/thumb:opacity-100',
      'opacity-0',
    ]);
    expect(grip.classList.contains('no-hover:hidden')).toBe(true);
  });

  it('has no axe violations', async () => {
    const { container } = renderTile();
    await expectNoAxeViolations(container);
  });
});

const waitingPhoto: PhotoTileModel = {
  id: 'w1',
  state: 'waiting',
  description: '',
  fileName: 'front-mockup.heic',
  preview: PIXEL,
};

const failedPhoto: PhotoTileModel = {
  id: 'f1',
  state: 'failed',
  description: '',
  fileName: 'back-mockup.jpg',
  preview: PIXEL,
  failure: { reason: 'Check your connection, then try again.', retryable: true },
};

const draftPhoto: PhotoTileModel = {
  id: 'd1',
  state: 'draft',
  description: 'New order photo 2',
  fileName: 'draft.jpg',
  preview: PIXEL,
};

function moveButtons() {
  return [
    screen.getByRole('button', { name: /^Move photo \d+ left$/ }),
    screen.getByRole('button', { name: /^Move photo \d+ right$/ }),
  ] as const;
}

function skeletonIn(container: Element): Element | null {
  return container.querySelector('[style*="--sk-h"]');
}

function onlyElement(container: Element, selector: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(selector);
  if (found === null) {
    throw new Error(`Nothing matches ${selector}.`);
  }
  return found;
}

describe('PhotoTile ends of the list (D-13)', () => {
  it('makes Move left aria-disabled on the first photo, keeps it focusable and does nothing when pressed', async () => {
    const onMove = vi.fn();
    renderTile({ position: 1, onMove });
    const [left, right] = moveButtons();
    expect(left.getAttribute('aria-disabled')).toBe('true');
    expect(right.getAttribute('aria-disabled')).toBeNull();
    left.focus();
    expect(document.activeElement).toBe(left);
    await userEvent.click(left);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('makes Move right aria-disabled on the last photo and does nothing when pressed', async () => {
    const onMove = vi.fn();
    renderTile({ position: 3, total: 3, onMove });
    const [left, right] = moveButtons();
    expect(right.getAttribute('aria-disabled')).toBe('true');
    expect(left.getAttribute('aria-disabled')).toBeNull();
    await userEvent.click(right);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('makes both move buttons aria-disabled and shows no Make Cover for the only photo (UIC-35)', () => {
    renderTile({ position: 1, total: 1 });
    const [left, right] = moveButtons();
    expect(left.getAttribute('aria-disabled')).toBe('true');
    expect(right.getAttribute('aria-disabled')).toBe('true');
    expect(screen.queryByRole('button', { name: /^Make cover/ })).toBeNull();
  });
});

describe('PhotoTile busy (D-15)', () => {
  it('makes every saved-photo control aria-disabled, keeps focus on them and swallows presses', async () => {
    const p = tileProps({ busy: true });
    render(
      <ul>
        <PhotoTile {...p} />
      </ul>,
    );
    const names = [
      'Make cover, photo 2',
      'Move photo 2 left',
      'Move photo 2 right',
      'Edit description of photo 2',
      'Delete photo 2',
    ];
    for (const name of names) {
      const button = screen.getByRole('button', { name });
      expect(button.getAttribute('aria-disabled'), name).toBe('true');
      button.focus();
      expect(document.activeElement, name).toBe(button);
      await userEvent.click(button);
    }
    expect(p.onMove).not.toHaveBeenCalled();
    expect(p.onMakeCover).not.toHaveBeenCalled();
    expect(p.onEditDescription).not.toHaveBeenCalled();
    expect(p.onDelete).not.toHaveBeenCalled();
  });

  it('is not draggable while busy', () => {
    const { container } = renderTile({ busy: true, canDrag: false });
    expect(container.querySelector('li')?.hasAttribute('draggable')).toBe(false);
  });

  it('leaves Try Again and Remove on a failed tile working while busy', async () => {
    const onRemove = vi.fn();
    const onRetry = vi.fn();
    renderTile({ busy: true, photo: failedPhoto, position: 0, onRemove, onRetry });
    await userEvent.click(screen.getByRole('button', { name: 'Try again, back-mockup.jpg' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove back-mockup.jpg' }));
    expect(onRetry).toHaveBeenCalledWith('f1');
    expect(onRemove).toHaveBeenCalledWith('f1');
  });
});

describe('PhotoTile waiting, uploading and failed states', () => {
  it('shows a waiting file with its name, "Waiting to upload" and only Remove', async () => {
    const onRemove = vi.fn();
    renderTile({ photo: waitingPhoto, position: 0, onRemove });
    expect(screen.getByText('front-mockup.heic')).toBeDefined();
    expect(screen.getByText('Waiting to upload')).toBeDefined();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['Remove front-mockup.heic']);
    expect(buttons[0]?.textContent).toBe('Remove');
    await userEvent.click(buttons[0] ?? document.body);
    expect(onRemove).toHaveBeenCalledWith('w1');
    expect(screen.queryByText(/Photo \d+ of/)).toBeNull();
  });

  it('shows an uploading file with a spinner, "Uploading" and no buttons, in a row that keeps its height', () => {
    const { container } = renderTile({ photo: { ...waitingPhoto, state: 'uploading' }, position: 0 });
    expect(screen.getByText('Uploading')).toBeDefined();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(container.querySelector('svg.animate-csp-spin')).not.toBeNull();
    expect(onlyElement(container, 'li > div:last-child').className).toContain('min-h-9');
  });

  it('shows a failed retryable file with the reason, Try Again and Remove', async () => {
    const onRetry = vi.fn();
    renderTile({ photo: failedPhoto, position: 0, onRetry });
    expect(screen.getByText("Didn't upload. Check your connection, then try again.")).toBeDefined();
    const retry = screen.getByRole('button', { name: 'Try again, back-mockup.jpg' });
    expect(retry.textContent).toBe('Try Again');
    expect(screen.getByRole('button', { name: 'Remove back-mockup.jpg' })).toBeDefined();
    await userEvent.click(retry);
    expect(onRetry).toHaveBeenCalledWith('f1');
  });

  it('shows a failed file the server would refuse again with Remove only', () => {
    renderTile({
      photo: { ...failedPhoto, failure: { reason: 'This file is over 10 MB.', retryable: false } },
      position: 0,
    });
    expect(screen.getByText("Didn't upload. This file is over 10 MB.")).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Try again/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove back-mockup.jpg' })).toBeDefined();
  });

  it('shows its preview as a plain image that is not a button', () => {
    const { container } = renderTile({ photo: waitingPhoto, position: 0 });
    const preview = onlyElement(container, 'img');
    expect(preview.getAttribute('src')).toBe(PIXEL);
    expect(preview.getAttribute('alt')).toBe('');
    expect(preview.closest('button')).toBeNull();
  });

  it('has no axe violations in any state', async () => {
    for (const photo of [waitingPhoto, { ...waitingPhoto, state: 'uploading' as const }, failedPhoto]) {
      const { container, unmount } = renderTile({ photo, position: 0 });
      await expectNoAxeViolations(container);
      unmount();
    }
  });
});

describe('PhotoTile draft photo', () => {
  it('names its remove control "Remove photo {n}" and has no Delete', async () => {
    const onRemove = vi.fn();
    const onDelete = vi.fn();
    renderTile({ photo: draftPhoto, position: 2, onRemove, onDelete });
    expect(screen.queryByRole('button', { name: 'Delete photo 2' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Remove photo 2' }));
    expect(onRemove).toHaveBeenCalledWith('d1');
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('New order photo 2')).toBeDefined();
  });

  it('shows a Skeleton in the thumb box while the preview is still being made (UIC-8)', () => {
    const { container } = renderTile({
      photo: { ...draftPhoto, preview: undefined, previewPending: true },
    });
    expect(skeletonIn(container)).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows the placeholder and "No preview. It shows after upload." when the browser cannot draw the file (UIC-22)', () => {
    const { container } = renderTile({
      photo: { ...draftPhoto, preview: undefined, previewUnavailable: true },
    });
    expect(screen.getByRole('img', { name: 'No image yet' })).toBeDefined();
    expect(screen.getByText('No preview. It shows after upload.')).toBeDefined();
    expect(skeletonIn(container)).toBeNull();
  });
});

describe('PhotoTile readonly (D-11)', () => {
  it('shows row 1 only: no move, cover, edit or delete, and no grip', () => {
    const { container } = renderTile({ mode: 'readonly' });
    expect(screen.getByText('Photo 2 of 3')).toBeDefined();
    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Open photo 2 of 3: Back mockup, red and black',
    ]);
    expect(container.querySelector('[aria-hidden="true"].opacity-0')).toBeNull();
  });

  it('still opens the viewer from the thumb', async () => {
    const onOpen = vi.fn();
    renderTile({ mode: 'readonly', onOpen });
    await userEvent.click(screen.getByRole('button', { name: /^Open photo 2 of 3/ }));
    expect(onOpen).toHaveBeenCalledWith('p2');
  });

  it('keeps Remove on a failed file that is not part of the order (P3 locked meanwhile)', () => {
    renderTile({
      mode: 'readonly',
      photo: { ...failedPhoto, failure: { reason: 'This order is completed.', retryable: false } },
      position: 0,
    });
    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Remove back-mockup.jpg',
    ]);
  });
});

describe('PhotoTile thumb and long text', () => {
  it('uses a 1 / 1 box for a saved photo without a stored size (UIC-30)', () => {
    const { container } = renderTile({ photo: { ...savedPhoto, thumb: { src: PIXEL } } });
    const box = onlyElement(container, 'button > div');
    expect(box.style.getPropertyValue('--ratio')).toBe('1 / 1');
    const image = onlyElement(container, 'img');
    expect(image.getAttribute('width')).toBe('88');
    expect(image.getAttribute('height')).toBe('88');
  });

  it('passes the delivered picture list to the thumb', () => {
    const { container } = renderTile({
      photo: { ...savedPhoto, thumb: { src: PIXEL, srcSet: 'https://img.invalid/a.jpg 88w', sizes: '88px' } },
    });
    const image = onlyElement(container, 'img');
    expect(image.getAttribute('srcset')).toBe('https://img.invalid/a.jpg 88w');
    expect(image.getAttribute('sizes')).toBe('88px');
  });

  it('clamps a long description and a long file name to 2 lines that wrap anywhere (UIC-38, UIC-40)', () => {
    const long = 'x'.repeat(200);
    renderTile({ photo: { ...savedPhoto, description: long } });
    const description = screen.getByText(long);
    expect(description.className).toContain('line-clamp-2');
    expect(description.className).toContain('wrap-anywhere');
    cleanup();
    renderTile({ photo: { ...waitingPhoto, fileName: `${long}.jpg` }, position: 0 });
    const name = screen.getByText(`${long}.jpg`);
    expect(name.className).toContain('line-clamp-2');
    expect(name.className).toContain('wrap-anywhere');
    expect(screen.getByRole('button', { name: `Remove ${long}.jpg` })).toBeDefined();
  });
});

describe('PhotoTile drag (D-13 bonus)', () => {
  it('is draggable only when allowed', () => {
    const on = renderTile({ canDrag: true });
    expect(onlyElement(on.container, 'li').getAttribute('draggable')).toBe('true');
    on.unmount();
    const off = renderTile({ canDrag: false });
    expect(onlyElement(off.container, 'li').hasAttribute('draggable')).toBe(false);
  });

  it('reports the start, the end and a drop on it, and allows the drop', () => {
    const p = tileProps({ canDrag: true });
    const { container } = render(
      <ul>
        <PhotoTile {...p} />
      </ul>,
    );
    const item = onlyElement(container, 'li');
    fireEvent.dragStart(item);
    expect(p.onDragStart).toHaveBeenCalledWith('p2');
    expect(fireEvent.dragOver(item)).toBe(false);
    fireEvent.drop(item);
    expect(p.onDropOn).toHaveBeenCalledWith('p2');
    fireEvent.dragEnd(item);
    expect(p.onDragEnd).toHaveBeenCalledTimes(1);
  });

  it('ignores drag events when it cannot be dragged', () => {
    const p = tileProps({ canDrag: false });
    const { container } = render(
      <ul>
        <PhotoTile {...p} />
      </ul>,
    );
    const item = onlyElement(container, 'li');
    fireEvent.dragStart(item);
    fireEvent.drop(item);
    expect(p.onDragStart).not.toHaveBeenCalled();
    expect(p.onDropOn).not.toHaveBeenCalled();
  });
});

describe('PhotoTile has no hover-only control (D-14, UIC-45)', () => {
  const original = window.matchMedia.bind(window);

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: original });
  });

  function mockHover(hover: boolean): void {
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
  }

  /** True when no class on the button or on its way up to the tile hides it or gates it on hover. */
  function alwaysReachable(button: HTMLElement): boolean {
    let element: HTMLElement | null = button;
    while (element !== null && element.tagName !== 'LI') {
      for (const token of element.classList) {
        if (
          /^(opacity-(0|\d+)|invisible|hidden|sr-only)$/.test(token) ||
          /^(group-)?hover:(visible|opacity)/.test(token)
        ) {
          return false;
        }
      }
      element = element.parentElement;
    }
    return true;
  }

  it.each([true, false])('finds every action, always reachable, with hover %s', (hover) => {
    mockHover(hover);
    renderTile();
    const names = [
      'Open photo 2 of 3: Back mockup, red and black',
      'Make cover, photo 2',
      'Move photo 2 left',
      'Move photo 2 right',
      'Edit description of photo 2',
      'Delete photo 2',
    ];
    for (const name of names) {
      expect(alwaysReachable(screen.getByRole('button', { name })), name).toBe(true);
    }
  });
});

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { scenarios as mediaScenarios, SECOND_THUMB_REMOVE, UPLOADER_IMAGES } from '@/dev/scenarios/groups/media';
import type { OrderImage } from '@/lib/csps';
import { expectNoAxeViolations } from '@/test/axe';
import { ImageUploader } from '@/ui/media';
import {
  dropClasses,
  dropHintClasses,
  dropTitleClasses,
  linkButtonClasses,
  thumbActionsClasses,
  thumbButtonClasses,
  thumbClasses,
  thumbCoverClasses,
  thumbGripClasses,
  thumbImageClasses,
  thumbPlaceholderClasses,
  thumbRingClasses,
  thumbsClasses,
  uploaderClasses,
} from './media.recipe';

// The converted App. D.3 ImageUploader (plan 02-25, CSPS-UI-SPEC.md §6.3) with owner ruling D-05: the thumb grip and
// actions are hidden at rest on hover devices, shown on hover, on keyboard focus within the thumb, and always on touch.
// The look is proven by the parity suite (`--grep @media`, including the hover, focus-visible and touch passes); these
// tests pin the markup, the behaviour and the reveal classes no focused control may lack.

/** The only opacity tokens the class gate allows here (D-05, class-gate.config.mjs). */
const REVEAL = [
  'group-focus-within/thumb:opacity-100',
  'group-hover/thumb:opacity-100',
  'no-hover:opacity-100',
  'opacity-0',
];

const THUMBS_NAME = 'Order images — drag to reorder; the first is the cover';

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean).sort();
}

/** True when the element carries every token of the class list. */
function hasClasses(element: Element | null | undefined, classes: string): boolean {
  const own = new Set(element?.classList ?? []);
  return tokens(classes).length > 0 && tokens(classes).every((token) => own.has(token));
}

function revealTokens(element: Element | null | undefined): string[] {
  return [...(element?.classList ?? [])].filter((token) => /(^|:)opacity-\d+$/.test(token)).sort();
}

const images: OrderImage[] = UPLOADER_IMAGES.map((image) => ({ ...image }) as unknown as OrderImage);

function thumbs(): HTMLElement[] {
  return within(screen.getByRole('list', { name: THUMBS_NAME })).getAllByRole('listitem');
}

function thumbAt(index: number): HTMLElement {
  const thumb = thumbs()[index];
  if (thumb === undefined) {
    throw new Error(`No thumb ${String(index)}.`);
  }
  return thumb;
}

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('No file input.');
  }
  return input;
}

function file(name: string, type: string): File {
  return new File(['x'], name, { type });
}

const byId = new Map(mediaScenarios.map((scenario) => [scenario.id, scenario]));

function renderCase(id: string) {
  const scenario = byId.get(id);
  if (scenario === undefined) {
    throw new Error(`No media scenario "${id}".`);
  }
  return render(renderNode(kit, scenario.node, scenario.handlers ?? []));
}

// UI-CR-01: previews are `data:` URLs read with FileReader, because the strict CSP's img-src allows `data:` and not
// `blob:`. jsdom has no URL.createObjectURL; a spy stands in for it so the tests can prove it is never called.
const createObjectURL = vi.fn(() => 'blob:csps/never');

/** A one-byte file's `data:` URL ("x" is "eA==" in base64). */
function dataUrl(type: string): string {
  return `data:${type};base64,eA==`;
}

beforeEach(() => {
  createObjectURL.mockClear();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: createObjectURL,
  });
});

afterEach(() => {
  Reflect.deleteProperty(URL, 'createObjectURL');
});

describe('ImageUploader drop zone (App. D.3)', () => {
  it('shows the cloud icon, the browse link button and the "{n}/{max}" hint in the dashed zone', () => {
    const { container } = render(<ImageUploader />);
    const root = container.firstElementChild;
    expect(hasClasses(root, uploaderClasses)).toBe(true);
    const zone = root?.firstElementChild;
    expect(hasClasses(zone, dropClasses)).toBe(true);
    expect(zone?.querySelector('svg')).not.toBeNull();
    const title = screen.getByText(/Drag images here or/);
    expect(title.tagName).toBe('P');
    expect(title.textContent).toBe('Drag images here or browse');
    expect(hasClasses(title, dropTitleClasses)).toBe(true);
    const browse = screen.getByRole('button', { name: 'browse' });
    expect(hasClasses(browse, linkButtonClasses)).toBe(true);
    const hint = screen.getByText('JPG, PNG or WEBP · up to 10 MB each · 0/12');
    expect(hasClasses(hint, dropHintClasses)).toBe(true);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('accepts images only, through a hidden multiple file input that "browse" opens', async () => {
    const { container } = render(<ImageUploader />);
    const input = fileInput(container);
    expect(input.hidden).toBe(true);
    expect(input.multiple).toBe(true);
    expect(input.accept).toBe('image/*');
    const click = vi.spyOn(input, 'click');
    await userEvent.click(screen.getByRole('button', { name: 'browse' }));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('adds the chosen image files (not other files), up to max, and reports them', async () => {
    const onFiles = vi.fn<(files: File[]) => void>();
    const onChange = vi.fn<(images: OrderImage[]) => void>();
    const { container } = render(<ImageUploader max={2} onFiles={onFiles} onChange={onChange} />);
    fireEvent.change(fileInput(container), {
      target: {
        files: [file('a.png', 'image/png'), file('notes.pdf', 'application/pdf'), file('b.jpg', 'image/jpeg')],
      },
    });
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0]?.[0].map((f) => f.name)).toEqual(['a.png', 'b.jpg']);
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
    });
    const next = onChange.mock.calls[0]?.[0];
    expect(next?.map((image) => [image.name, image.src])).toEqual([
      ['a.png', dataUrl('image/png')],
      ['b.jpg', dataUrl('image/jpeg')],
    ]);
    expect(thumbs()).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'a.png' })).toBeInstanceOf(HTMLImageElement);
    expect(screen.getByText('JPG, PNG or WEBP · up to 10 MB each · 2/2')).toBeDefined();

    fireEvent.change(fileInput(container), { target: { files: [file('c.png', 'image/png')] } });
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(thumbs()).toHaveLength(2);
  });

  it('adds nothing when a migrated list already holds more than max (UI-WR-10)', async () => {
    const onFiles = vi.fn<(files: File[]) => void>();
    const onChange = vi.fn<(images: OrderImage[]) => void>();
    const { container } = render(<ImageUploader images={images} max={2} onFiles={onFiles} onChange={onChange} />);
    expect(screen.getByText('JPG, PNG or WEBP · up to 10 MB each · 3/2')).toBeDefined();

    fireEvent.change(fileInput(container), {
      target: { files: [file('a.png', 'image/png'), file('b.png', 'image/png')] },
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });

    expect(onFiles).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores a pick with no image and an empty pick', () => {
    const onFiles = vi.fn<(files: File[]) => void>();
    const { container } = render(<ImageUploader onFiles={onFiles} />);
    fireEvent.change(fileInput(container), { target: { files: [file('notes.txt', 'text/plain')] } });
    fireEvent.change(fileInput(container), { target: { files: null } });
    expect(onFiles).not.toHaveBeenCalled();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('marks a file drag over the zone with data-over="true" and adds the dropped images', async () => {
    const onFiles = vi.fn<(files: File[]) => void>();
    const { container } = render(<ImageUploader onFiles={onFiles} />);
    const zone = container.firstElementChild?.firstElementChild;
    if (!(zone instanceof HTMLElement)) {
      throw new Error('No drop zone.');
    }
    expect(zone.dataset.over).toBe('false');
    fireEvent.dragOver(zone);
    expect(zone.dataset.over).toBe('true');
    fireEvent.dragLeave(zone);
    expect(zone.dataset.over).toBe('false');
    fireEvent.dragOver(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [file('drop.webp', 'image/webp')] } });
    expect(zone.dataset.over).toBe('false');
    expect(onFiles).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(thumbs()).toHaveLength(1);
    });
    fireEvent.drop(zone, {});
    expect(onFiles).toHaveBeenCalledTimes(1);
  });
});

describe('ImageUploader previews under the strict CSP (UI-CR-01)', () => {
  it('previews a picked image as a data: URL, which img-src allows, and never makes a blob: URL', async () => {
    const onChange = vi.fn<(images: OrderImage[]) => void>();
    const { container } = render(<ImageUploader onChange={onChange} />);
    fireEvent.change(fileInput(container), { target: { files: [file('front.png', 'image/png')] } });
    const preview = await screen.findByRole('img', { name: 'front.png' });
    expect(preview.getAttribute('src')).toBe(dataUrl('image/png'));
    expect(onChange.mock.calls.at(-1)?.[0].map((image) => image.src)).toEqual([dataUrl('image/png')]);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('counts images still being read against max, so two quick picks never pass it', async () => {
    const onFiles = vi.fn<(files: File[]) => void>();
    const { container } = render(<ImageUploader max={2} onFiles={onFiles} />);
    fireEvent.change(fileInput(container), { target: { files: [file('a.png', 'image/png')] } });
    fireEvent.change(fileInput(container), {
      target: { files: [file('b.png', 'image/png'), file('c.png', 'image/png')] },
    });
    expect(onFiles.mock.calls.map(([files]) => files.map((f) => f.name))).toEqual([['a.png'], ['b.png']]);
    await waitFor(() => {
      expect(thumbs()).toHaveLength(2);
    });
    expect(thumbs().map((thumb) => within(thumb).getByRole('img').getAttribute('alt'))).toEqual(['a.png', 'b.png']);
  });

  it('keeps the images added or removed while a pick was being read', async () => {
    const onChange = vi.fn<(images: OrderImage[]) => void>();
    const { container } = render(<ImageUploader defaultImages={images} onChange={onChange} />);
    fireEvent.change(fileInput(container), { target: { files: [file('new.png', 'image/png')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove front-mockup.png' }));
    await screen.findByRole('img', { name: 'new.png' });
    expect(onChange.mock.calls.at(-1)?.[0].map((image) => image.name)).toEqual([
      'back-mockup.png',
      'shorts.png',
      'new.png',
    ]);
  });

  it('skips a file that cannot be read, and changes nothing after it unmounts', async () => {
    const onChange = vi.fn<(images: OrderImage[]) => void>();
    const failing = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementationOnce(function (this: FileReader) {
      this.dispatchEvent(new ProgressEvent('error'));
    });
    const { container, unmount } = render(<ImageUploader onChange={onChange} />);
    fireEvent.change(fileInput(container), {
      target: { files: [file('broken.png', 'image/png'), file('ok.png', 'image/png')] },
    });
    await screen.findByRole('img', { name: 'ok.png' });
    expect(onChange.mock.calls.at(-1)?.[0].map((image) => image.name)).toEqual(['ok.png']);
    failing.mockRestore();

    fireEvent.change(fileInput(container), { target: { files: [file('late.png', 'image/png')] } });
    unmount();
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('ImageUploader thumbnails (App. D.3)', () => {
  it('lists the images, the first as the cover with its tag and ring, each a chip-less placeholder without a file', () => {
    render(<ImageUploader defaultImages={images} />);
    const list = screen.getByRole('list', { name: THUMBS_NAME });
    expect(hasClasses(list, thumbsClasses)).toBe(true);
    const [cover, second, third] = [thumbAt(0), thumbAt(1), thumbAt(2)];
    expect(hasClasses(cover, thumbClasses)).toBe(true);
    expect(cover.classList.contains('group/thumb')).toBe(true);
    expect(cover.draggable).toBe(true);
    expect(hasClasses(cover, thumbRingClasses.cover)).toBe(true);
    expect(hasClasses(second, thumbRingClasses.plain)).toBe(true);
    const tag = within(cover).getByText('Cover');
    expect(hasClasses(tag, thumbCoverClasses)).toBe(true);
    expect(within(second).queryByText('Cover')).toBeNull();
    const placeholder = within(cover).getByRole('img', { name: 'No image yet' });
    expect(hasClasses(placeholder, thumbPlaceholderClasses)).toBe(true);
    expect(placeholder.textContent).toBe('23');
    expect(within(third).getByRole('img', { name: 'No image yet' }).textContent).toBe('');
    expect(screen.getByText('JPG, PNG or WEBP · up to 10 MB each · 3/12')).toBeDefined();
  });

  it('names a photo by its file name, or "Order image {n}" when it has none', () => {
    render(
      <ImageUploader
        defaultImages={[
          { id: 'a', name: 'front.png', src: 'blob:csps/a' },
          { id: 'b', src: 'blob:csps/b' },
        ]}
      />,
    );
    const front = screen.getByRole('img', { name: 'front.png' });
    expect(hasClasses(front, thumbImageClasses)).toBe(true);
    expect(screen.getByRole('img', { name: 'Order image 2' }).getAttribute('src')).toBe('blob:csps/b');
    expect(screen.getByRole('button', { name: 'Remove image' })).toBeDefined();
  });

  it('gives every thumb "Make cover image" (not the cover) and "Remove {name}" buttons', () => {
    render(<ImageUploader defaultImages={images} />);
    const [cover, second] = [thumbAt(0), thumbAt(1)];
    expect(within(cover).queryByRole('button', { name: 'Make cover image' })).toBeNull();
    within(cover).getByRole('button', { name: 'Remove front-mockup.png' });
    within(second).getByRole('button', { name: 'Make cover image' });
    const remove = within(second).getByRole('button', { name: 'Remove back-mockup.png' });
    expect(hasClasses(remove, thumbButtonClasses)).toBe(true);
    expect(remove.getAttribute('type')).toBe('button');
  });

  it('moves an image to the cover, removes one, and reports each list', async () => {
    const onChange = vi.fn<(images: OrderImage[]) => void>();
    render(<ImageUploader defaultImages={images} onChange={onChange} />);
    await userEvent.click(within(thumbAt(2)).getByRole('button', { name: 'Make cover image' }));
    expect(onChange.mock.calls[0]?.[0].map((image) => image.id)).toEqual(['img-0148-3', 'img-0148-1', 'img-0148-2']);
    expect(within(thumbAt(0)).getByText('Cover')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Remove front-mockup.png' }));
    expect(onChange.mock.calls[1]?.[0].map((image) => image.id)).toEqual(['img-0148-3', 'img-0148-2']);
    expect(thumbs()).toHaveLength(2);
  });

  it('reorders by native drag: a thumb dropped on another takes its place, and a thumb drag never marks the zone', () => {
    const onChange = vi.fn<(images: OrderImage[]) => void>();
    const { container } = render(<ImageUploader defaultImages={images} onChange={onChange} />);
    fireEvent.dragStart(thumbAt(2));
    const zone = container.firstElementChild?.firstElementChild;
    if (!(zone instanceof HTMLElement)) {
      throw new Error('No drop zone.');
    }
    fireEvent.dragOver(zone);
    expect(zone.dataset.over).toBe('false');
    fireEvent.dragOver(thumbAt(0));
    fireEvent.drop(thumbAt(0));
    expect(onChange.mock.calls[0]?.[0].map((image) => image.id)).toEqual(['img-0148-3', 'img-0148-1', 'img-0148-2']);

    // A drop on the thumb it started from, or with no drag in progress, changes nothing.
    fireEvent.dragStart(thumbAt(1));
    fireEvent.drop(thumbAt(1));
    fireEvent.drop(thumbAt(0));
    fireEvent.dragStart(thumbAt(0));
    fireEvent.dragEnd(thumbAt(0));
    fireEvent.drop(thumbAt(2));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('shows the images it is given when controlled', () => {
    const onChange = vi.fn<(images: OrderImage[]) => void>();
    const { rerender } = render(<ImageUploader images={images.slice(0, 1)} onChange={onChange} />);
    expect(thumbs()).toHaveLength(1);
    rerender(<ImageUploader images={images} onChange={onChange} />);
    expect(thumbs()).toHaveLength(3);
  });
});

describe('ImageUploader thumb actions are never hidden from keyboard or touch users (owner ruling D-05)', () => {
  it('puts the reveal classes on both the grip and the actions of every thumb', () => {
    render(<ImageUploader defaultImages={images} />);
    for (const thumb of thumbs()) {
      const grip = thumb.querySelector(':scope > span[aria-hidden="true"]');
      expect(hasClasses(grip, thumbGripClasses)).toBe(true);
      expect(revealTokens(grip)).toEqual(REVEAL);
      const actions = within(thumb).getByRole('button', { name: /^Remove/ }).parentElement;
      expect(hasClasses(actions, thumbActionsClasses)).toBe(true);
      expect(revealTokens(actions)).toEqual(REVEAL);
    }
  });

  it('every control reached by Tab is named and sits in a thumb whose focus reveals its grip and actions', async () => {
    render(<ImageUploader defaultImages={images} />);
    const reached: string[] = [];
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'browse' }));
    for (;;) {
      await userEvent.tab();
      const focused = document.activeElement;
      if (!(focused instanceof HTMLButtonElement)) {
        break;
      }
      reached.push(focused.getAttribute('aria-label') ?? '');
      const thumb = focused.closest('li');
      expect(thumb?.classList.contains('group/thumb')).toBe(true);
      expect(revealTokens(focused.parentElement)).toEqual(REVEAL);
      expect(revealTokens(thumb?.querySelector(':scope > span[aria-hidden="true"]'))).toEqual(REVEAL);
      // The focused control itself is never the element faded out.
      expect(revealTokens(focused)).toEqual([]);
    }
    expect(reached).toEqual([
      'Remove front-mockup.png',
      'Make cover image',
      'Remove back-mockup.png',
      'Make cover image',
      'Remove shorts.png',
    ]);
  });
});

describe('ImageUploader scenarios and axe', () => {
  it('lists the media cases the parity suite compares (both themes; hover, focus-visible and the touch pass)', () => {
    expect(
      mediaScenarios.map((s) => [s.id, s.themes.join('+'), s.states.join('+'), s.passes?.join('+') ?? '', s.target]),
    ).toEqual([
      ['uploader-empty', 'light+dark', 'rest+focus-visible', '', 'button'],
      ['uploader-with-images', 'light+dark', 'rest+hover+focus-visible', 'touch', SECOND_THUMB_REMOVE],
    ]);
    expect(mediaScenarios.every((s) => s.group === 'media' && s.parity && !s.responsive)).toBe(true);
  });

  it('renders each case through the kit, and the state target exists', () => {
    const empty = renderCase('uploader-empty');
    expect(empty.container.querySelector('button')?.textContent).toBe('browse');
    empty.unmount();
    const full = renderCase('uploader-with-images');
    expect(full.container.querySelector(SECOND_THUMB_REMOVE)?.getAttribute('aria-label')).toBe(
      'Remove back-mockup.png',
    );
  });

  it('has no axe violations, empty and with images', async () => {
    const empty = renderCase('uploader-empty');
    await expectNoAxeViolations(empty.container);
    empty.unmount();
    const full = renderCase('uploader-with-images');
    await expectNoAxeViolations(full.container);
  });

  it('renders the same markup again for the same props, and the new list for new props', () => {
    const { container, rerender } = render(<ImageUploader defaultImages={images} max={12} />);
    const first = container.innerHTML;
    rerender(<ImageUploader defaultImages={images} max={12} />);
    expect(container.innerHTML).toBe(first);
    rerender(<ImageUploader images={images.slice(1)} max={5} />);
    expect(thumbs()).toHaveLength(2);
    expect(screen.getByText('JPG, PNG or WEBP · up to 10 MB each · 2/5')).toBeDefined();
  });
});

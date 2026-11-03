import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

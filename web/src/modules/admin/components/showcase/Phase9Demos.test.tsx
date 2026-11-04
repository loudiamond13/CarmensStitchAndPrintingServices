// Phase 9 demos in the Component Showcase (UI-SPEC "UI Considerations"; plan 09-30): the photo list in its states, the status line and
// banner, a photo that fails to load, the Orders list covers, the viewer on photos of every shape, the description window with its
// 409 banner and the delete dialog, all on made-up photos drawn as local data: addresses. No test here may cause a request.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ToastProvider } from '@/components';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { Phase9Demos } from './Phase9Demos';

function renderDemos() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Phase9Demos />
      </ToastProvider>
    </MemoryRouter>,
  );
}

function caseFrame(id: string): HTMLElement {
  const frame = document.querySelector(`[data-case="${id}"]`);
  if (!(frame instanceof HTMLElement)) {
    throw new Error(`No [data-case="${id}"] frame.`);
  }
  return frame;
}

/** Every case of the section, in the order the page shows them. */
const CASE_IDS = [
  'photos-list-three',
  'photos-list-one',
  'photos-list-limit',
  'photos-list-uploading',
  'photos-list-not-retryable',
  'photos-list-drafts',
  'photos-list-readonly-empty',
  'photos-list-long-text',
  'photos-status-and-banner',
  'photos-image-failure',
  'photos-order-covers',
  'photos-viewer',
  'photos-description-conflict',
  'photos-delete-dialog',
];

/** Every request the page makes, seen two ways: MSW's request events and a spy on fetch. */
const requests: string[] = [];
let fetchSpy: MockInstance<typeof fetch>;

beforeEach(() => {
  requests.length = 0;
  server.events.on('request:start', ({ request }) => {
    requests.push(request.url);
  });
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  server.events.removeAllListeners();
  fetchSpy.mockRestore();
});

describe('Phase9Demos: the photo list', () => {
  it('shows three saved photos with the Cover tag on the first and every control named per photo', () => {
    renderDemos();
    const frame = within(caseFrame('photos-list-three'));

    expect(frame.getAllByRole('listitem')).toHaveLength(3);
    expect(frame.getAllByText('Cover', { exact: true })).toHaveLength(1);
    for (const name of [
      'Move photo 2 left',
      'Move photo 2 right',
      'Edit description of photo 2',
      'Delete photo 2',
      'Make cover, photo 3',
    ]) {
      expect(frame.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('shows one photo with no Make Cover and both move buttons off', () => {
    renderDemos();
    const frame = within(caseFrame('photos-list-one'));

    expect(frame.getAllByRole('listitem')).toHaveLength(1);
    expect(frame.queryByRole('button', { name: /^Make cover/ })).toBeNull();
    expect(frame.getByRole('button', { name: 'Move photo 1 left' })).toHaveAttribute('aria-disabled', 'true');
    expect(frame.getByRole('button', { name: 'Move photo 1 right' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows the limit note in place of the add area at five photos', () => {
    renderDemos();
    const frame = within(caseFrame('photos-list-limit'));

    expect(frame.getAllByRole('listitem')).toHaveLength(5);
    expect(
      frame.getByText('This order has 5 photos, the most it can have. Delete one to add another.'),
    ).toBeInTheDocument();
    expect(frame.queryByRole('button', { name: 'browse' })).toBeNull();
    expect(frame.queryByRole('button', { name: 'Choose Photos' })).toBeNull();
  });

  it('shows an uploading, a waiting and a failed file that can be tried again or removed', () => {
    renderDemos();
    const frame = within(caseFrame('photos-list-uploading'));

    expect(frame.getByText('Uploading')).toBeInTheDocument();
    expect(frame.getByText('Waiting to upload')).toBeInTheDocument();
    expect(
      frame.getByText("Didn't upload. Couldn't upload. Check your connection, then try again."),
    ).toBeInTheDocument();
    expect(frame.getByRole('button', { name: 'Try again, sleeve.jpg' })).toBeInTheDocument();
    expect(frame.getByRole('button', { name: 'Remove sleeve.jpg' })).toBeInTheDocument();
  });

  it('shows a refused file with Remove only', () => {
    renderDemos();
    const frame = within(caseFrame('photos-list-not-retryable'));

    expect(frame.getByText("Didn't upload. The server didn't accept this photo.")).toBeInTheDocument();
    expect(frame.getByRole('button', { name: 'Remove logo.png' })).toBeInTheDocument();
    expect(frame.queryByRole('button', { name: /^Try again/ })).toBeNull();
  });

  it('shows drafts (one with its preview, one being made, one with no preview) and the pick-error box with the left-out count', () => {
    renderDemos();
    const frame = within(caseFrame('photos-list-drafts'));

    expect(frame.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
    expect(frame.getByText('No preview. It shows after upload.')).toBeInTheDocument();
    const box = frame.getByRole('alert');
    expect(within(box).getByText('logo.svg')).toBeInTheDocument();
    expect(within(box).getByText('scan.png')).toBeInTheDocument();
    expect(within(box).getByText('panorama.jpg')).toBeInTheDocument();
    expect(within(box).getByText(/2 of the photos you picked weren't added\.$/)).toBeInTheDocument();
  });

  it('shows "No photos on this order." for a read-only order with none', () => {
    renderDemos();

    expect(within(caseFrame('photos-list-readonly-empty')).getByText('No photos on this order.')).toBeInTheDocument();
  });

  it('keeps a 200-character description and a very long file name inside their tiles', () => {
    renderDemos();
    const frame = within(caseFrame('photos-list-long-text'));

    expect(frame.getAllByRole('listitem')).toHaveLength(2);
    expect(frame.getByRole('button', { name: /^Remove team-photo-with-a-very-long-name-/ })).toBeInTheDocument();
  });
});

describe('Phase9Demos: the status line, the banner and the covers', () => {
  it('shows the uploading line, the Saved line and the partial-failure banner', () => {
    renderDemos();
    const frame = within(caseFrame('photos-status-and-banner'));

    expect(frame.getByText('Uploading photo 2 of 3')).toBeInTheDocument();
    expect(frame.getByText('Saved')).toBeInTheDocument();
    expect(frame.getByText("1 of 3 photos didn't upload.")).toBeInTheDocument();
    expect(
      frame.getByText("They're below. Try again or remove them. If you leave this page, they're lost."),
    ).toBeInTheDocument();
  });

  it('shows a photo that fails to load as a placeholder named by its description', () => {
    renderDemos();
    const frame = within(caseFrame('photos-image-failure'));

    fireEvent.error(frame.getByRole('img', { name: 'Order ORD-2026-0148 photo 1' }));

    const box = frame.getByRole('img', { name: 'Order ORD-2026-0148 photo 1' });
    expect(box.tagName).toBe('DIV');
    expect(frame.queryByText('No images yet')).toBeNull();
  });

  it('shows the image chip on the cover of three photos, none on one, and the placeholder when there is none', () => {
    renderDemos();
    const frame = within(caseFrame('photos-order-covers'));

    expect(frame.getAllByRole('article')).toHaveLength(3);
    expect(
      frame.getByRole('button', { name: 'View order ORD-2026-0148, In Production, 3 images' }),
    ).toBeInTheDocument();
    expect(frame.getByRole('button', { name: 'View order ORD-2026-0149, In Production' })).toBeInTheDocument();
    expect(frame.getAllByText('No images yet').length).toBeGreaterThan(0);
  });
});

describe('Phase9Demos: the viewer, the description window and the delete dialog', () => {
  it('opens the viewer on five photos of every shape, steps with the arrow keys and closes with Esc', async () => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(within(caseFrame('photos-viewer')).getByRole('button', { name: 'Open viewer with 5 photos' }));
    const viewer = await screen.findByRole('dialog', { name: 'Order photos' });
    expect(within(viewer).getByText('Photo 1 of 5')).toBeInTheDocument();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(within(viewer).getByText('Photo 3 of 5')).toBeInTheDocument();
    expect(within(viewer).getByRole('img', { name: 'Very tall photo of order ORD-2026-0148' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('opens the viewer on one photo with no Previous or Next', async () => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(within(caseFrame('photos-viewer')).getByRole('button', { name: 'Open viewer with 1 photo' }));
    const viewer = await screen.findByRole('dialog', { name: 'Order photos' });
    expect(within(viewer).getByText('Photo 1 of 1')).toBeInTheDocument();
    expect(within(viewer).queryByRole('button', { name: 'Next image' })).toBeNull();
    expect(within(viewer).queryByRole('button', { name: 'Previous image' })).toBeNull();
  });

  it('opens the description window with the stale-save banner and Load Latest', async () => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(
      within(caseFrame('photos-description-conflict')).getByRole('button', { name: 'Open Edit Description (409)' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Edit Description' });
    expect(within(dialog).getByText('ORD-2026-0148 · Photo 1 of 3')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Load Latest' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Photo description')).toHaveValue('Order ORD-2026-0148 photo 1');
  });

  it('opens the delete dialog with its sentence and Cancel focused', async () => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(within(caseFrame('photos-delete-dialog')).getByRole('button', { name: 'Open Delete Photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete photo 1?' });
    expect(
      within(dialog).getByText("It's removed from ORD-2026-0148 right away. This can't be undone."),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('makes no request, whatever is pressed', async () => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(within(caseFrame('photos-viewer')).getByRole('button', { name: 'Open viewer with 5 photos' }));
    await screen.findByRole('dialog', { name: 'Order photos' });
    await user.keyboard('{ArrowRight}{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await user.click(within(caseFrame('photos-delete-dialog')).getByRole('button', { name: 'Open Delete Photo' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete Photo' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await user.click(within(caseFrame('photos-list-three')).getByRole('button', { name: 'Delete photo 2' }));
    await user.click(within(caseFrame('photos-list-uploading')).getByRole('button', { name: 'Remove sleeve.jpg' }));

    expect(requests).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Phase9Demos: strict mode and the data', () => {
  it('renders every case in StrictMode', () => {
    const { container } = render(
      <StrictMode>
        <MemoryRouter>
          <ToastProvider>
            <Phase9Demos />
          </ToastProvider>
        </MemoryRouter>
      </StrictMode>,
    );

    for (const id of CASE_IDS) {
      expect(caseFrame(id)).toBeInTheDocument();
    }
    expect(container.querySelectorAll('[data-case]')).toHaveLength(CASE_IDS.length);
  });

  it('draws every photo as a local data: address and names no outside address', () => {
    const { container } = renderDemos();

    const sources = [...container.querySelectorAll('img')].map((image) => image.getAttribute('src') ?? '');
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((source) => source.startsWith('data:'))).toBe(true);
    expect(container.textContent).not.toMatch(/@(?!example\.com)/);
    const addresses = [...container.querySelectorAll('[src], [srcset], [href]')].flatMap((element) =>
      ['src', 'srcset', 'href'].map((name) => element.getAttribute(name) ?? ''),
    );
    expect(addresses.filter((address) => /^https?:\/\//.test(address))).toEqual([]);
  });

  // The whole section is about 60 photo controls and many frames, so axe gets a longer budget than the 5 s default.
  it('has no axe violations in the static cases', async () => {
    const { container } = renderDemos();
    expect(caseFrame('photos-list-three')).toBeInTheDocument();

    await expectNoAxeViolations(container);
  }, 30_000);

  it.each([
    ['photos-viewer', 'Open viewer with 5 photos'],
    ['photos-viewer', 'Open viewer with 1 photo'],
    ['photos-description-conflict', 'Open Edit Description (409)'],
    ['photos-delete-dialog', 'Open Delete Photo'],
  ])('has no axe violations with a live case open: %s, %s', async (id, trigger) => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(within(caseFrame(id)).getByRole('button', { name: trigger }));
    const dialog = await screen.findByRole('dialog');

    await expectNoAxeViolations(dialog);
  });
});

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { createMemoryRouter, useLocation } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it, vi } from 'vitest';
import { useLightboxHistory } from './useLightboxHistory';

// useLightboxHistory (UI-SPEC G2 "History"): opening adds one history entry with the same URL and a lightbox state, so Back
// closes the lightbox; closing by Esc, Close or a tap removes that entry; the state holds only an open flag.

interface HarnessProps {
  onClose?: () => void;
}

function Harness({ onClose }: HarnessProps) {
  const [open, setOpen] = useState(false);
  const history = useLightboxHistory(open, () => {
    setOpen(false);
    onClose?.();
  });
  const location = useLocation();
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        open
      </button>
      <button type="button" onClick={history.close}>
        close
      </button>
      <button
        type="button"
        onClick={() => {
          history.leaveTo('/contact');
        }}
      >
        quote
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
        }}
      >
        parent closes
      </button>
      <output data-testid="where">{`${location.pathname}${location.search}`}</output>
      <output data-testid="state">{JSON.stringify(location.state)}</output>
      <output data-testid="open">{open ? 'open' : 'closed'}</output>
    </div>
  );
}

/** A memory router at /gallery?category=moto with the harness on every path. */
function setup(initialState: unknown = null, onClose?: () => void) {
  const router = createMemoryRouter(
    [{ path: '*', element: <Harness {...(onClose === undefined ? {} : { onClose })} /> }],
    { initialEntries: [{ pathname: '/gallery', search: '?category=moto', state: initialState }] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('useLightboxHistory (GAL-02)', () => {
  it('pushes one entry with the same URL and an open flag when the lightbox opens', async () => {
    const router = setup();
    const before = router.state.location.key;

    await userEvent.click(screen.getByRole('button', { name: 'open' }));

    await waitFor(() => {
      expect(router.state.location.key).not.toBe(before);
    });
    expect(router.state.historyAction).toBe('PUSH');
    expect(screen.getByTestId('where')).toHaveTextContent('/gallery?category=moto');
    expect(router.state.location.state).toEqual({ 'csps-gallery-lightbox': true });
    expect(screen.getByTestId('open')).toHaveTextContent('open');
  });

  it('closes the lightbox when Back is pressed, and stays on the same URL', async () => {
    const onClose = vi.fn();
    const router = setup(null, onClose);
    const before = router.state.location.key;
    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await waitFor(() => {
      expect(router.state.location.state).not.toBeNull();
    });

    await act(async () => {
      await router.navigate(-1);
    });

    await waitFor(() => {
      expect(screen.getByTestId('open')).toHaveTextContent('closed');
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(router.state.location.key).toBe(before);
    expect(screen.getByTestId('where')).toHaveTextContent('/gallery?category=moto');
  });

  it('removes the entry when it is closed by Esc, Close or a tap, so no extra entry is left', async () => {
    const onClose = vi.fn();
    const router = setup(null, onClose);
    const before = router.state.location.key;
    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await waitFor(() => {
      expect(router.state.location.state).not.toBeNull();
    });

    await userEvent.click(screen.getByRole('button', { name: 'close' }));

    await waitFor(() => {
      expect(screen.getByTestId('open')).toHaveTextContent('closed');
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(router.state.location.key).toBe(before);
    expect(router.state.location.state).toBeNull();
    expect(router.state.historyAction).toBe('POP');
  });

  it('opens again after it was closed', async () => {
    const router = setup();
    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await waitFor(() => {
      expect(router.state.location.state).not.toBeNull();
    });
    await userEvent.click(screen.getByRole('button', { name: 'close' }));
    await waitFor(() => {
      expect(screen.getByTestId('open')).toHaveTextContent('closed');
    });

    await userEvent.click(screen.getByRole('button', { name: 'open' }));

    await waitFor(() => {
      expect(router.state.location.state).not.toBeNull();
    });
    expect(screen.getByTestId('open')).toHaveTextContent('open');
  });

  it('goes to another page by replacing the lightbox entry, so Back from there lands on the Gallery with it closed', async () => {
    const router = setup();
    const before = router.state.location.key;
    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await waitFor(() => {
      expect(router.state.location.state).not.toBeNull();
    });

    await userEvent.click(screen.getByRole('button', { name: 'quote' }));

    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent('/contact');
    });
    expect(router.state.historyAction).toBe('REPLACE');
    await act(async () => {
      await router.navigate(-1);
    });
    expect(router.state.location.key).toBe(before);
    expect(screen.getByTestId('where')).toHaveTextContent('/gallery?category=moto');
  });

  it('takes its open flag off the entry when the page closes the lightbox itself (a filter change)', async () => {
    const router = setup();
    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await waitFor(() => {
      expect(router.state.location.state).not.toBeNull();
    });

    await userEvent.click(screen.getByRole('button', { name: 'parent closes' }));

    await waitFor(() => {
      expect(router.state.location.state).toBeNull();
    });
    expect(screen.getByTestId('open')).toHaveTextContent('closed');
  });

  it('clears an open flag left on the entry by a reload, with the lightbox closed', async () => {
    const router = setup({ 'csps-gallery-lightbox': true });

    await waitFor(() => {
      expect(router.state.location.state).toBeNull();
    });
    expect(screen.getByTestId('open')).toHaveTextContent('closed');
  });

  it('closes without navigating when no entry was pushed', async () => {
    const onClose = vi.fn();
    const router = setup(null, onClose);
    const before = router.state.location.key;

    await userEvent.click(screen.getByRole('button', { name: 'close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(router.state.location.key).toBe(before);
  });
});

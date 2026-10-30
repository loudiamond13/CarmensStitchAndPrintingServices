import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Link, RouterProvider, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ConfirmDialog } from '@/components/overlays';
import { useUnsavedChangesGuard } from '@/modules/admin/hooks/useUnsavedChangesGuard';

// The "Discard changes?" guard (ORD-15; plan 08-13): useBlocker needs a data router, so every test uses createMemoryRouter.

function FormPage({ dirty }: { dirty: boolean }) {
  const navigate = useNavigate();
  const guard = useUnsavedChangesGuard({ isDirty: dirty });
  return (
    <>
      <h1>The form</h1>
      <Link to="/elsewhere">Leave</Link>
      <button
        type="button"
        onClick={() => {
          guard.allowLeave();
          void navigate('/saved');
        }}
      >
        Save and go
      </button>
      <button
        type="button"
        onClick={() => {
          guard.allowLeave();
        }}
      >
        Mark saved
      </button>
      <button
        type="button"
        onClick={() => {
          void navigate('/admin/login');
        }}
      >
        Sign out
      </button>
      <ConfirmDialog
        open={guard.dialog.open}
        title="Discard changes?"
        message="Your changes to this order haven't been saved. If you leave now, they're lost."
        cancelLabel="Keep Editing"
        confirmLabel="Discard Changes"
        onConfirm={guard.dialog.onDiscard}
        onCancel={guard.dialog.onKeepEditing}
      />
    </>
  );
}

function renderGuard(dirty: boolean) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <FormPage dirty={dirty} /> },
      { path: '/elsewhere', element: <p>Elsewhere</p> },
      { path: '/saved', element: <p>Saved page</p> },
      { path: '/admin/login', element: <p>Sign-in page</p> },
    ],
    { initialEntries: ['/elsewhere', '/'], initialIndex: 1 },
  );
  const arrivals: string[] = [];
  router.subscribe((state) => {
    arrivals.push(state.location.pathname);
  });
  render(<RouterProvider router={router} />);
  return { router, arrivals, user: userEvent.setup() };
}

function fireBeforeUnload(): Event {
  const event = new Event('beforeunload', { cancelable: true });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe('leaving a dirty form inside the app', () => {
  it('opens "Discard changes?" with Keep Editing focused first', async () => {
    const { user, router } = renderGuard(true);

    await user.click(screen.getByRole('link', { name: 'Leave' }));

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Keep Editing' })).toHaveFocus();
    expect(router.state.location.pathname).toBe('/');
  });

  it('stays on the form and returns focus to the control that tried to leave on Keep Editing', async () => {
    const { user, router } = renderGuard(true);
    const link = screen.getByRole('link', { name: 'Leave' });
    await user.click(link);

    await user.click(await screen.findByRole('button', { name: 'Keep Editing' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(router.state.location.pathname).toBe('/');
    expect(link).toHaveFocus();
  });

  it('asks again on a second leave after Keep Editing', async () => {
    const { user } = renderGuard(true);
    await user.click(screen.getByRole('link', { name: 'Leave' }));
    await user.click(await screen.findByRole('button', { name: 'Keep Editing' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('link', { name: 'Leave' }));

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeVisible();
  });

  it('leaves once on Discard Changes, even when it is pressed twice', async () => {
    const { user, router, arrivals } = renderGuard(true);
    await user.click(screen.getByRole('link', { name: 'Leave' }));
    const discard = await screen.findByRole('button', { name: 'Discard Changes' });

    await user.dblClick(discard);

    expect(await screen.findByText('Elsewhere')).toBeVisible();
    expect(router.state.location.pathname).toBe('/elsewhere');
    expect(arrivals.filter((path) => path === '/elsewhere')).toHaveLength(1);
  });

  it('holds browser Back too, and lets it through on Discard Changes', async () => {
    const { user, router } = renderGuard(true);

    await act(async () => {
      await router.navigate(-1);
    });

    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/');
    await user.click(screen.getByRole('button', { name: 'Discard Changes' }));
    expect(await screen.findByText('Elsewhere')).toBeVisible();
  });
});

describe('when nothing is lost', () => {
  it('does not ask on a clean form', async () => {
    const { user } = renderGuard(false);

    await user.click(screen.getByRole('link', { name: 'Leave' }));

    expect(await screen.findByText('Elsewhere')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not ask after a save, because the leaving flag is set before the navigation', async () => {
    const { user, router } = renderGuard(true);

    await user.click(screen.getByRole('button', { name: 'Save and go' }));

    expect(await screen.findByText('Saved page')).toBeVisible();
    expect(router.state.location.pathname).toBe('/saved');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('never asks on the way to the sign-in page, so a sign-out is not held', async () => {
    const { user } = renderGuard(true);

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByText('Sign-in page')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('reload and close', () => {
  it('asks the browser for its own prompt when the form is dirty', () => {
    renderGuard(true);

    expect(fireBeforeUnload().defaultPrevented).toBe(true);
  });

  it('lets a clean form go', () => {
    renderGuard(false);

    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it('lets a saved form go', async () => {
    const { user } = renderGuard(true);
    await user.click(screen.getByRole('button', { name: 'Mark saved' }));

    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });
});

// Phase 5 demos in the Component Showcase (UI-SPEC C1; D-32, D-33; plan 05-42): the new primitives and the roster, audit
// row and profile pieces, all on made-up data and local state. No test here may cause a request.
import { fireEvent, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ToastProvider } from '@/components';
import { server } from '@/test/msw';
import { expectNoAxeViolations } from '@/test/axe';
import { Phase5Demos } from './Phase5Demos';

function renderDemos() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Phase5Demos />
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

describe('Phase5Demos: the primitives', () => {
  it('shows the RadioGroup with the invitation chosen, and choosing the other route moves the selection', async () => {
    const user = userEvent.setup();
    renderDemos();
    const group = within(caseFrame('staff-radio-group')).getByRole('group', { name: 'How they get access' });

    expect(within(group).getByRole('radio', { name: 'Email an invitation' })).toBeChecked();
    await user.click(within(group).getByRole('radio', { name: 'Set a temporary password' }));

    expect(within(group).getByRole('radio', { name: 'Set a temporary password' })).toBeChecked();
    expect(within(group).getByRole('radio', { name: 'Email an invitation' })).not.toBeChecked();
  });

  it('shows the DateInput as a From and To pair that takes a picked date', () => {
    renderDemos();
    const frame = within(caseFrame('staff-date-input'));

    const from = frame.getByLabelText('From');
    expect(from).toHaveAttribute('type', 'date');
    fireEvent.change(from, { target: { value: '2026-10-01' } });
    expect(from).toHaveValue('2026-10-01');
    expect(frame.getByLabelText('To')).toHaveAttribute('type', 'date');
  });

  it('keeps the stale-save banner behind a button so the page never moves focus on load, then Load Latest hides it', async () => {
    const user = userEvent.setup();
    renderDemos();
    const frame = within(caseFrame('staff-conflict-banner'));
    expect(frame.queryByRole('alert')).toBeNull();
    expect(document.body).toHaveFocus();

    await user.click(frame.getByRole('button', { name: 'Show stale save banner' }));
    const alert = frame.getByRole('alert');
    expect(alert).toHaveTextContent('This was changed by someone else.');
    expect(within(alert).getByRole('button', { name: 'Load Latest' })).toHaveFocus();

    await user.click(within(alert).getByRole('button', { name: 'Load Latest' }));
    await waitFor(() => {
      expect(frame.queryByRole('alert')).toBeNull();
    });
  });

  it('shows RecordMeta with a System row and a former-staff row', () => {
    renderDemos();
    const meta = within(caseFrame('staff-record-meta'));

    expect(meta.getByText('Recorded by')).toBeInTheDocument();
    expect(meta.getByText(/^System ·/)).toBeInTheDocument();
    expect(meta.getByText('Last changed by')).toBeInTheDocument();
    expect(meta.getByText(/^Paolo Garcia ·/)).toBeInTheDocument();
    expect(meta.getByText('(former staff)')).toBeInTheDocument();
  });
});

describe('Phase5Demos: the audit row and the roster', () => {
  it('opens and closes an audit row detail with its toggle', async () => {
    const user = userEvent.setup();
    renderDemos();
    const frame = within(caseFrame('staff-audit-row'));
    const toggle = frame.getByRole('button', { name: /^Show details for Role changed, / });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(frame.getByText('Role: Admin to Manager')).not.toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(frame.getByText('Role: Admin to Manager')).toBeVisible();
    const detail = document.getElementById('staff-audit-detail-1');
    if (detail === null) {
      throw new Error('No audit detail.');
    }
    expect(within(detail).getByText('203.0.113.0')).toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(frame.getByText('Role: Admin to Manager')).not.toBeVisible();
  });

  it('lists roster rows in Active, Inactive, Locked, Invite pending, Invite expired and own-row states', () => {
    renderDemos();
    const roster = within(caseFrame('staff-roster-rows'));
    const rowOf = (name: RegExp): HTMLElement => roster.getByRole('row', { name });

    expect(within(rowOf(/Paolo Garcia/)).getByText('Active')).toBeInTheDocument();
    expect(within(rowOf(/Jomar Santos/)).getByText('Inactive')).toBeInTheDocument();
    expect(within(rowOf(/Rhea Villanueva/)).getByText('Locked')).toBeInTheDocument();
    expect(within(rowOf(/Liza Mercado/)).getByText('Invite pending')).toBeInTheDocument();
    expect(within(rowOf(/Noel Bautista/)).getByText('Invite expired')).toBeInTheDocument();

    // The signed-in Manager's own row says "You" and has only the link to My Profile (D-19).
    const own = rowOf(/Carmen Reyes/);
    expect(within(own).getByText('You')).toBeInTheDocument();
    expect(within(own).getByRole('link', { name: 'Edit your details in My Profile' })).toBeInTheDocument();
    expect(within(own).queryByRole('button')).toBeNull();
    expect(within(rowOf(/Paolo Garcia/)).getByRole('button', { name: 'Delete Paolo Garcia' })).toBeInTheDocument();
  });

  it('wraps a 100 character name inside its cell instead of widening the row', () => {
    renderDemos();
    const roster = within(caseFrame('staff-roster-rows'));
    const long = roster.getByText(/^Maria Concepcion Villanueva/, { selector: 'strong' });

    expect(long.textContent).toHaveLength(100);
    const cellText = long.parentElement;
    expect(cellText?.className).toContain('min-w-0');
    expect(cellText?.className).toContain('wrap-anywhere');
  });
});

describe('Phase5Demos: made-up data, local state, no request (D-32, D-33)', () => {
  it('makes no request while the demos render and are used', async () => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(within(caseFrame('staff-radio-group')).getByRole('radio', { name: 'Set a temporary password' }));
    await user.click(
      within(caseFrame('staff-audit-row')).getByRole('button', { name: /^Show details for Role changed/ }),
    );
    await user.click(
      within(caseFrame('staff-conflict-banner')).getByRole('button', { name: 'Show stale save banner' }),
    );
    await user.click(within(caseFrame('staff-conflict-banner')).getByRole('button', { name: 'Load Latest' }));

    expect(requests).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('has no axe violations', async () => {
    const { container } = renderDemos();
    expect(caseFrame('staff-roster-rows')).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });
});

const PASSWORD_SAMPLE = /^[A-Za-z]+-[A-Za-z]+-\d{4}$/;

describe('Phase5Demos: the panels, dialogs and profile tabs are live', () => {
  it('opens Add User on the invitation route; Create User closes it and focus returns to the trigger', async () => {
    const user = userEvent.setup();
    renderDemos();
    const trigger = within(caseFrame('staff-add-user')).getByRole('button', { name: 'Open Add User (invitation)' });

    await user.click(trigger);
    const panel = await screen.findByRole('dialog', { name: 'Add User' });
    expect(within(panel).getByRole('radio', { name: 'Email an invitation' })).toBeChecked();
    expect(within(panel).queryByLabelText('Temporary password')).toBeNull();

    await user.click(within(panel).getByRole('button', { name: 'Create User' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('opens Add User on the temporary password route and shows the sample password once, then Done closes it', async () => {
    const user = userEvent.setup();
    renderDemos();
    const trigger = within(caseFrame('staff-add-user')).getByRole('button', {
      name: 'Open Add User (temporary password)',
    });

    await user.click(trigger);
    const panel = await screen.findByRole('dialog', { name: 'Add User' });
    expect(within(panel).getByRole('radio', { name: 'Set a temporary password' })).toBeChecked();
    expect(within(panel).getByLabelText('Temporary password')).toHaveValue(expect.stringMatching(PASSWORD_SAMPLE));

    await user.click(within(panel).getByRole('button', { name: 'Create User' }));
    const done = await screen.findByRole('dialog', { name: 'User created' });
    const shown = within(done).getByLabelText('Temporary password for Ana');
    expect(shown).toHaveAttribute('readonly');
    expect(shown).toHaveValue(expect.stringMatching(PASSWORD_SAMPLE));

    await user.click(within(done).getByRole('button', { name: 'Done' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('lets the other route be chosen inside the panel', async () => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(within(caseFrame('staff-add-user')).getByRole('button', { name: 'Open Add User (invitation)' }));
    const panel = await screen.findByRole('dialog', { name: 'Add User' });
    await user.click(within(panel).getByRole('radio', { name: 'Set a temporary password' }));

    expect(within(panel).getByLabelText('Temporary password')).toHaveValue(expect.stringMatching(PASSWORD_SAMPLE));
  });

  it.each([
    ['Open Deactivate User', 'Deactivate Paolo Garcia?', 'Keep Active'],
    ['Open Lock User', 'Lock Paolo Garcia?', 'Keep Unlocked'],
    ['Open Delete User', 'Delete Paolo Garcia?', 'Cancel'],
    ['Open Set Temporary Password', 'Set a temporary password', 'Cancel'],
  ])('"%s" opens "%s" with focus on the safe button; it closes and focus returns', async (label, title, safe) => {
    const user = userEvent.setup();
    renderDemos();
    const trigger = within(caseFrame('staff-user-dialogs')).getByRole('button', { name: label });

    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: title });
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: safe })).toHaveFocus();
    });

    await user.click(within(dialog).getByRole('button', { name: safe }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it.each([
    ['Open Deactivate User', 'Deactivate Paolo Garcia?', 'Deactivate User'],
    ['Open Lock User', 'Lock Paolo Garcia?', 'Lock User'],
    ['Open Delete User', 'Delete Paolo Garcia?', 'Delete User'],
  ])('confirming "%s" only closes the dialog', async (label, title, confirm) => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(within(caseFrame('staff-user-dialogs')).getByRole('button', { name: label }));
    const dialog = await screen.findByRole('dialog', { name: title });
    await user.click(within(dialog).getByRole('button', { name: confirm }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(requests).toEqual([]);
  });

  it('sets a temporary password in the demo dialog: the shown-once step carries a sample value, then Done closes it', async () => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(
      within(caseFrame('staff-user-dialogs')).getByRole('button', { name: 'Open Set Temporary Password' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Set a temporary password' });
    await user.click(within(dialog).getByRole('button', { name: 'Set Password' }));

    const done = await screen.findByRole('dialog', { name: 'Temporary password set' });
    expect(within(done).getByLabelText('Temporary password for Paolo')).toHaveValue(
      expect.stringMatching(PASSWORD_SAMPLE),
    );
    await user.click(within(done).getByRole('button', { name: 'Done' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('shows the profile tabs: Details first, and choosing Security or pressing Right shows that panel', async () => {
    const user = userEvent.setup();
    renderDemos();
    const frame = within(caseFrame('staff-profile-tabs'));
    const details = frame.getByRole('tab', { name: 'Details' });

    expect(details).toHaveAttribute('aria-selected', 'true');
    expect(frame.getByRole('tabpanel', { name: 'Details' })).toBeVisible();

    await user.click(frame.getByRole('tab', { name: 'Security' }));
    expect(frame.getByRole('tab', { name: 'Security' })).toHaveAttribute('aria-selected', 'true');
    expect(frame.getByRole('tabpanel', { name: 'Security' })).toBeVisible();
    expect(frame.queryByRole('tabpanel', { name: 'Details' })).toBeNull();

    await user.keyboard('{ArrowRight}');
    expect(frame.getByRole('tab', { name: 'Appearance' })).toHaveAttribute('aria-selected', 'true');
    expect(frame.getByRole('tabpanel', { name: 'Appearance' })).toBeVisible();
  });

  it('makes no request through any panel, dialog or tab', async () => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(
      within(caseFrame('staff-add-user')).getByRole('button', { name: 'Open Add User (temporary password)' }),
    );
    const panel = await screen.findByRole('dialog', { name: 'Add User' });
    await user.click(within(panel).getByRole('button', { name: 'Create User' }));
    const done = await screen.findByRole('dialog', { name: 'User created' });
    await user.click(within(done).getByRole('button', { name: 'Done' }));
    await user.click(within(caseFrame('staff-profile-tabs')).getByRole('tab', { name: 'Appearance' }));

    expect(requests).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('has no axe violations with a dialog open', async () => {
    const user = userEvent.setup();
    renderDemos();

    await user.click(within(caseFrame('staff-user-dialogs')).getByRole('button', { name: 'Open Lock User' }));
    const dialog = await screen.findByRole('dialog', { name: 'Lock Paolo Garcia?' });

    await expectNoAxeViolations(dialog);
  });
});

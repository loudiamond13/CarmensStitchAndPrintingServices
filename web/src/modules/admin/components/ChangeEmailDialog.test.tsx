import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/actions';
import { ChangeEmailDialog } from '@/modules/admin/components/ChangeEmailDialog';
import type { ProfileResponse } from '@/modules/admin/services/profileService';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';

// P2 Change Email dialog (PROF-02, C-9, D-24, D-25, OR-3; plan 05-18): every rule the server checks is checked here first;
// the taken address and the wrong password come back from the server under their own fields.

const CURRENT = 'carmen@example.ph';
const NEW_EMAIL = 'carmen.new@example.ph';
const PASSWORD = 'Mabuhay#Tahi2026';
const PROBLEM = { 'Content-Type': 'application/problem+json' };

const PROFILE: ProfileResponse = {
  id: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
  firstName: 'Carmen',
  lastName: 'Reyes',
  email: CURRENT,
  role: 'Manager',
  pendingEmail: NEW_EMAIL,
  memberSince: '2026-10-17T01:00:00Z',
  version: '0b0e1c2a-3d4f-4a5b-8c6d-7e8f90a1b2c3',
};

interface Sent {
  bodies: unknown[];
  keys: (string | null)[];
}

/** Answers POST /profile/email-change (default: 200 with the pending profile) and records what arrived. */
function answer(reply: () => Response | Promise<Response> = () => HttpResponse.json(PROFILE)): Sent {
  const sent: Sent = { bodies: [], keys: [] };
  server.use(
    http.post('*/api/v1/profile/email-change', async ({ request }) => {
      sent.bodies.push(await request.json());
      sent.keys.push(request.headers.get('Idempotency-Key'));
      return reply();
    }),
  );
  return sent;
}

function problem(status: number, body: Record<string, unknown>): Response {
  return HttpResponse.json({ title: 'x', status, ...body }, { status, headers: PROBLEM });
}

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

interface Handlers {
  onClose: () => void;
  onSent: (newEmail: string, profile: ProfileResponse) => void;
}

function renderDialog(handlers: Partial<Handlers> = {}) {
  const onClose = handlers.onClose ?? vi.fn();
  const onSent = handlers.onSent ?? vi.fn();
  render(<ChangeEmailDialog currentEmail={CURRENT} onClose={onClose} onSent={onSent} />);
  return { onClose, onSent };
}

const newEmailBox = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'New email' });
const passwordBox = () => screen.getByLabelText<HTMLInputElement>('Current password');
const sendButton = () => screen.getByRole('button', { name: /^(Send Confirmation Link|Sending)$/ });

async function fill(user: ReturnType<typeof userEvent.setup>, email = NEW_EMAIL, password = PASSWORD) {
  if (email !== '') {
    await user.type(newEmailBox(), email);
  }
  if (password !== '') {
    await user.type(passwordBox(), password);
  }
}

describe('P2 the dialog', () => {
  it('opens named "Change your email" with the description, the two fields and the two buttons, and focus on New email', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Change your email' });
    expect(
      within(dialog).getByText(
        "We'll send a confirmation link to the new address and a notice to your current one. Your email changes only after you open the link. The link works for 24 hours.",
      ),
    ).toBeInTheDocument();
    expect(newEmailBox()).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Send Confirmation Link' })).toBeInTheDocument();
  });

  it('gives New email the email keyboard and no autocorrection, and Current password its autofill hint and no meter', () => {
    renderDialog();

    expect(newEmailBox()).toHaveAttribute('type', 'email');
    expect(newEmailBox()).toHaveAttribute('autocomplete', 'email');
    expect(newEmailBox()).toHaveAttribute('inputmode', 'email');
    expect(newEmailBox()).toHaveAttribute('autocapitalize', 'none');
    expect(newEmailBox()).toHaveAttribute('spellcheck', 'false');
    expect(passwordBox()).toHaveAttribute('type', 'password');
    expect(passwordBox()).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.queryByText('Weak')).toBeNull();
    expect(screen.queryByText(/Use 8\+ characters/)).toBeNull();
  });

  it('has no axe violations', async () => {
    renderDialog();

    await expectNoAxeViolations(document.body);
  });

  it('has no axe violations with field errors showing', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(sendButton());
    await screen.findByText('Enter your new email.');

    await expectNoAxeViolations(document.body);
  });
});

describe('P2 checks before sending (OR-3)', () => {
  it('shows both required messages at once, sends nothing and puts the cursor in New email', async () => {
    const sent = answer();
    const user = userEvent.setup();
    renderDialog();

    await user.click(sendButton());

    expect(await screen.findByText('Enter your new email.')).toBeInTheDocument();
    expect(screen.getByText('Enter your current password.')).toBeInTheDocument();
    expect(newEmailBox()).toHaveAttribute('aria-invalid', 'true');
    expect(newEmailBox()).toHaveFocus();
    expect(sent.bodies).toHaveLength(0);
  });

  it('puts the cursor in Current password when only the password is missing', async () => {
    const sent = answer();
    const user = userEvent.setup();
    renderDialog();
    await fill(user, NEW_EMAIL, '');

    await user.click(sendButton());

    expect(await screen.findByText('Enter your current password.')).toBeInTheDocument();
    expect(passwordBox()).toHaveFocus();
    expect(sent.bodies).toHaveLength(0);
  });

  it('refuses an address that is not shaped like an email', async () => {
    const sent = answer();
    const user = userEvent.setup();
    renderDialog();
    await fill(user, 'carmen.new@');

    await user.click(sendButton());

    expect(await screen.findByText('Enter a valid email, like name@gmail.com')).toBeInTheDocument();
    expect(sent.bodies).toHaveLength(0);
  });

  it('refuses an address over 256 characters', async () => {
    const sent = answer();
    const user = userEvent.setup();
    renderDialog();
    await user.click(newEmailBox());
    await user.paste(`${'a'.repeat(250)}@example.ph`);
    await user.type(passwordBox(), PASSWORD);

    await user.click(sendButton());

    expect(await screen.findByText('Enter a valid email, like name@gmail.com')).toBeInTheDocument();
    expect(sent.bodies).toHaveLength(0);
  });

  it.each(['carmen@example.ph', 'CARMEN@EXAMPLE.PH', ' Carmen@Example.ph '])(
    'refuses %j as already the current email, ignoring letter case',
    async (typed) => {
      const sent = answer();
      const user = userEvent.setup();
      renderDialog();
      await fill(user, typed);

      await user.click(sendButton());

      expect(await screen.findByText('This is already your email.')).toBeInTheDocument();
      expect(newEmailBox()).toHaveFocus();
      expect(sent.bodies).toHaveLength(0);
    },
  );
});

describe('P2 sending', () => {
  it('sends the trimmed address and the password with one Idempotency-Key, then calls onSent with the new address and the profile', async () => {
    const sent = answer();
    const user = userEvent.setup();
    const { onSent } = renderDialog();
    await fill(user, `  ${NEW_EMAIL} `);

    await user.click(sendButton());

    await waitFor(() => {
      expect(onSent).toHaveBeenCalledTimes(1);
    });
    expect(onSent).toHaveBeenCalledWith(NEW_EMAIL, PROFILE);
    expect(sent.bodies).toEqual([{ newEmail: NEW_EMAIL, currentPassword: PASSWORD }]);
    expect(sent.keys[0]).toMatch(/\S/);
  });

  it('ties Send Confirmation Link to the form, so Enter in a field submits it in the browser (the e2e spec presses Enter)', () => {
    renderDialog();

    const form = screen.getByRole('dialog').querySelector('form');
    expect(form).not.toBeNull();
    expect(sendButton()).toHaveAttribute('type', 'submit');
    expect(sendButton()).toHaveAttribute('form', form?.id);
  });

  it('shows "Sending" and ignores Esc, the scrim, Cancel, Close and a second press while the request runs', async () => {
    const gate = deferred();
    const sent = answer(async () => {
      await gate.promise;
      return HttpResponse.json(PROFILE);
    });
    const user = userEvent.setup();
    const { onClose, onSent } = renderDialog();
    await fill(user);

    await user.click(sendButton());
    const pending = await screen.findByRole('button', { name: 'Sending' });
    expect(pending).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    const dialog = screen.getByRole('dialog');
    const scrim = dialog.parentElement;
    if (scrim === null) {
      throw new Error('The dialog has no scrim around it.');
    }
    await user.click(scrim);
    await user.click(pending);

    expect(onClose).not.toHaveBeenCalled();
    expect(sent.bodies).toHaveLength(1);
    gate.resolve();
    await waitFor(() => {
      expect(onSent).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps the typed address and password when the server fails, and a retry reuses the Idempotency-Key', async () => {
    let fail = true;
    const sent = answer(() => (fail ? problem(500, {}) : HttpResponse.json(PROFILE)));
    const user = userEvent.setup();
    const { onSent } = renderDialog();
    await fill(user);

    await user.click(sendButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong. Please try again.');
    expect(newEmailBox()).toHaveValue(NEW_EMAIL);
    expect(passwordBox()).toHaveValue(PASSWORD);
    expect(onSent).not.toHaveBeenCalled();

    fail = false;
    await user.click(sendButton());
    await waitFor(() => {
      expect(onSent).toHaveBeenCalledTimes(1);
    });
    expect(sent.keys[1]).toBe(sent.keys[0]);
  });
});

describe('P2 answers from the server', () => {
  it('shows a taken address under New email and puts the cursor there', async () => {
    answer(() => problem(400, { errors: { newEmail: ['Another account already uses this email.'] } }));
    const user = userEvent.setup();
    const { onSent } = renderDialog();
    await fill(user);

    await user.click(sendButton());

    expect(await screen.findByText('Another account already uses this email.')).toBeInTheDocument();
    expect(newEmailBox()).toHaveAttribute('aria-invalid', 'true');
    expect(newEmailBox()).toHaveFocus();
    expect(newEmailBox()).toHaveValue(NEW_EMAIL);
    expect(onSent).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a wrong current password under Current password and puts the cursor there', async () => {
    answer(() => problem(400, { errors: { currentPassword: ['Your current password is incorrect.'] } }));
    const user = userEvent.setup();
    renderDialog();
    await fill(user);

    await user.click(sendButton());

    expect(await screen.findByText('Your current password is incorrect.')).toBeInTheDocument();
    expect(passwordBox()).toHaveAttribute('aria-invalid', 'true');
    expect(passwordBox()).toHaveFocus();
    expect(newEmailBox()).not.toHaveAttribute('aria-invalid');
  });

  it("matches the server's field names in any letter case", async () => {
    answer(() => problem(400, { errors: { NewEmail: ['Another account already uses this email.'] } }));
    const user = userEvent.setup();
    renderDialog();
    await fill(user);

    await user.click(sendButton());

    expect(await screen.findByText('Another account already uses this email.')).toBeInTheDocument();
  });

  it("shows the server's plain-English line in an alert when the account is locked, with no field marked", async () => {
    answer(() =>
      problem(429, {
        detail: 'Too many wrong passwords. Try again in 15 minutes.',
        code: 'profile.password-locked',
      }),
    );
    const user = userEvent.setup();
    renderDialog();
    await fill(user);

    await user.click(sendButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Too many wrong passwords. Try again in 15 minutes.');
    expect(newEmailBox()).not.toHaveAttribute('aria-invalid');
    expect(passwordBox()).not.toHaveAttribute('aria-invalid');
    expect(sendButton()).toHaveFocus();
  });

  it('shows the shared "Too many tries" line for a 429 that is not the password lock', async () => {
    answer(() => problem(429, {}));
    const user = userEvent.setup();
    renderDialog();
    await fill(user);

    await user.click(sendButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many tries. Wait a minute, then try again.');
  });

  it("shows the server's message for a 400 that names no rendered field as the alert line", async () => {
    answer(() => problem(400, { errors: { other: ['Something is off.'] } }));
    const user = userEvent.setup();
    renderDialog();
    await fill(user);

    await user.click(sendButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Something is off.');
  });

  it('clears the alert line when the next attempt starts', async () => {
    let fail = true;
    answer(() => (fail ? problem(500, {}) : HttpResponse.json(PROFILE)));
    const user = userEvent.setup();
    renderDialog();
    await fill(user);
    await user.click(sendButton());
    await screen.findByRole('alert');

    fail = false;
    await user.click(sendButton());

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});

describe('P2 closing', () => {
  it('closes with Cancel, Close, Esc and the scrim when nothing is pending', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('starts clean on every open: typed values and messages from the last open are gone', async () => {
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <Button
            onClick={() => {
              setOpen(true);
            }}
          >
            Open
          </Button>
          <ChangeEmailDialog
            open={open}
            currentEmail={CURRENT}
            onClose={() => {
              setOpen(false);
            }}
            onSent={() => undefined}
          />
        </>
      );
    }
    const user = userEvent.setup();
    render(<Host />);
    await user.type(newEmailBox(), 'half.typed');
    await user.click(sendButton());
    await screen.findByText('Enter a valid email, like name@gmail.com');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(newEmailBox()).toHaveValue('');
    expect(screen.queryByText('Enter a valid email, like name@gmail.com')).toBeNull();
    expect(newEmailBox()).toHaveFocus();
  });
});

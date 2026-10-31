import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Controller, useFormState } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { HttpError } from '@/core/api/errors';
import { useSetPasswordForm } from './useSetPasswordForm';

// The form state the three set-password screens share (IN-18; PROF-03 uses the same rule messages).

const ACCOUNT = { email: 'paolo.garcia@gmail.com', firstName: 'Paolo', lastName: 'Garcia' };

function problem(status: number, errors: Record<string, string[]> = {}, title?: string): HttpError {
  return new HttpError({
    kind: 'http',
    status,
    problem: {
      type: undefined,
      title,
      status,
      detail: undefined,
      instance: undefined,
      traceId: undefined,
      code: undefined,
      errors,
    },
  });
}

const SERVER_CASES: readonly (readonly [string, HttpError])[] = [
  ['server-new', problem(400, { NewPassword: ['Too common.'] })],
  ['server-confirm', problem(400, { confirmPassword: ['Does not match.'] })],
  ['server-token', problem(400, { token: ['Gone.'] })],
  ['server-409', problem(409, { newPassword: ['Ignored.'] })],
];

interface HarnessProps {
  saved?: (password: string) => void;
}

/** A bare form wired like the real screens, with buttons to drive the helper's functions. */
function Harness({ saved }: HarnessProps) {
  const { formRef, control, banner, setBanner, showBanner, applyFieldErrors, submitHandler } =
    useSetPasswordForm(ACCOUNT);
  const { errors } = useFormState({ control });
  const [handled, setHandled] = useState('');
  return (
    <>
      <form
        ref={formRef}
        aria-label="Set password"
        noValidate
        onSubmit={submitHandler((values) => {
          saved?.(values.newPassword);
          return Promise.resolve();
        })}
      >
        <Controller
          control={control}
          name="newPassword"
          render={({ field }) => <input {...field} aria-label="New password" type="password" />}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field }) => <input {...field} aria-label="Confirm password" type="password" />}
        />
        <button type="submit">Save</button>
      </form>
      <p data-testid="new-error">{errors.newPassword?.message}</p>
      <p data-testid="confirm-error">{errors.confirmPassword?.message}</p>
      <p data-testid="banner">{banner?.title}</p>
      <p data-testid="handled">{handled}</p>
      <button
        type="button"
        onClick={() => {
          setBanner({ title: 'Old banner', message: '', error: undefined });
        }}
      >
        Show old banner
      </button>
      <button
        type="button"
        onClick={() => {
          showBanner(problem(503, {}, 'Try later.'));
        }}
      >
        Show failure
      </button>
      {SERVER_CASES.map(([name, error]) => (
        <button
          key={name}
          type="button"
          onClick={() => {
            setHandled(String(applyFieldErrors(error)));
          }}
        >
          {name}
        </button>
      ))}
    </>
  );
}

describe('useSetPasswordForm', () => {
  it('puts the cursor in the new password field when it opens', async () => {
    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByLabelText('New password')).toHaveFocus();
    });
  });

  it('focuses the first invalid field and shows the rule message when the form is saved empty', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByTestId('new-error')).not.toBeEmptyDOMElement();
    });
    expect(screen.getByLabelText('New password')).toHaveFocus();
  });

  it('focuses the confirmation when only that field is wrong', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('New password'), 'Sunrise-2026!');
    await user.type(screen.getByLabelText('Confirm password'), 'Sunrise-2027!');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByTestId('confirm-error')).toHaveTextContent("Passwords don't match.");
    });
    expect(screen.getByLabelText('Confirm password')).toHaveFocus();
  });

  it('calls the save with a valid pair and clears an old banner first', async () => {
    const user = userEvent.setup();
    const passwords: string[] = [];
    render(
      <Harness
        saved={(password) => {
          passwords.push(password);
        }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Show old banner' }));
    expect(screen.getByTestId('banner')).toHaveTextContent('Old banner');

    await user.type(screen.getByLabelText('New password'), 'Sunrise-2026!');
    await user.type(screen.getByLabelText('Confirm password'), 'Sunrise-2026!');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(passwords).toEqual(['Sunrise-2026!']);
    });
    expect(screen.getByTestId('banner')).toBeEmptyDOMElement();
  });

  it('maps the server message for newPassword onto the field, whatever its casing, and focuses it', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'server-new' }));

    expect(screen.getByTestId('handled')).toHaveTextContent('true');
    expect(screen.getByTestId('new-error')).toHaveTextContent('Too common.');
    expect(screen.getByLabelText('New password')).toHaveFocus();
  });

  it('maps the server message for confirmPassword onto the confirmation and focuses it', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'server-confirm' }));

    expect(screen.getByTestId('confirm-error')).toHaveTextContent('Does not match.');
    expect(screen.getByLabelText('Confirm password')).toHaveFocus();
  });

  it.each(['server-token', 'server-409'])(
    'leaves %s to the screen: no field is marked and false is returned',
    async (name) => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(screen.getByRole('button', { name }));

      expect(screen.getByTestId('handled')).toHaveTextContent('false');
      expect(screen.getByTestId('new-error')).toBeEmptyDOMElement();
      expect(screen.getByTestId('confirm-error')).toBeEmptyDOMElement();
    },
  );

  it('shows the plain-English banner for a failure', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Show failure' }));

    expect(screen.getByTestId('banner')).not.toBeEmptyDOMElement();
  });
});

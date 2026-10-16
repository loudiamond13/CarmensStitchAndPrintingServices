import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { NewPasswordFields } from '@/modules/admin/components/NewPasswordFields';
import type { NewPasswordValues } from '@/modules/admin/authSchemas';
import { expectNoAxeViolations } from '@/test/axe';

// The shared new-password fields (S3, S5, S6; plan 04-28; A11Y-03, OQ-2 default A).

function Harness({ email }: { email: string | null }) {
  const { control } = useForm<NewPasswordValues>({ defaultValues: { newPassword: '', confirmPassword: '' } });
  return (
    <form aria-label="Set a new password">
      <NewPasswordFields control={control} email={email} />
    </form>
  );
}

describe('NewPasswordFields', () => {
  it('has the hidden username input only when the email is known', () => {
    const { container, rerender } = render(<Harness email="paolo@gmail.com" />);
    const username = container.querySelector('input[autocomplete="username"]');
    expect(username).toHaveValue('paolo@gmail.com');
    expect(username).toHaveAttribute('type', 'email');
    expect(username).toHaveAttribute('readonly');
    expect(username).not.toBeVisible();

    rerender(<Harness email={null} />);
    expect(container.querySelector('input[autocomplete="username"]')).toBeNull();
  });

  it('names both fields, with new-password autocomplete and Show and Hide on each', async () => {
    const user = userEvent.setup();
    render(<Harness email={null} />);

    const fresh = screen.getByLabelText('New password');
    const confirm = screen.getByLabelText('Confirm new password');
    expect(fresh).toHaveAttribute('autocomplete', 'new-password');
    expect(confirm).toHaveAttribute('autocomplete', 'new-password');
    const shows = screen.getAllByRole('button', { name: 'Show password' });
    expect(shows).toHaveLength(2);

    for (const show of shows.slice(0, 1)) {
      await user.click(show);
    }
    expect(fresh).toHaveAttribute('type', 'text');
    expect(confirm).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('allows paste into both fields', async () => {
    const user = userEvent.setup();
    render(<Harness email={null} />);

    await user.click(screen.getByLabelText('New password'));
    await user.paste('Mabuhay#Tahi2026');
    await user.click(screen.getByLabelText('Confirm new password'));
    await user.paste('Mabuhay#Tahi2026');

    expect(screen.getByLabelText('New password')).toHaveValue('Mabuhay#Tahi2026');
    expect(screen.getByLabelText('Confirm new password')).toHaveValue('Mabuhay#Tahi2026');
  });

  it('shows the strength meter and the rule hint under New password (OQ-2 default A)', async () => {
    const user = userEvent.setup();
    render(<Harness email={null} />);

    expect(screen.getByText('Use 8+ characters with a number and a symbol')).toBeInTheDocument();
    expect(
      screen.getByText("Use 8 to 64 characters with at least one number and one symbol. Don't use your name or email."),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('New password'), 'Mabuhay#Tahi2026');

    expect(screen.queryByText('Use 8+ characters with a number and a symbol')).not.toBeInTheDocument();
    expect(screen.getByText(/^(Weak|Fair|Good|Strong)$/)).toBeInTheDocument();
    expect(
      screen.getByText("Use 8 to 64 characters with at least one number and one symbol. Don't use your name or email."),
    ).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<Harness email="paolo@gmail.com" />);

    await expectNoAxeViolations(container);
  });
});

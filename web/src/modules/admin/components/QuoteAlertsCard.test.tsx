import { zodResolver } from '@hookform/resolvers/zod';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { QuoteAlertsCard } from '@/modules/admin/components/QuoteAlertsCard';
import { businessInfoSchema, businessInfoValuesOf, type BusinessInfoInput } from '@/modules/admin/siteContentSchemas';
import { expectNoAxeViolations } from '@/test/axe';
import { demoSiteSettings } from '@/test/siteContentFixtures';

// R5 Quote alerts card (INQ-04, D-07, OR-3; plan 13-07): the card on its own, in a form made from the Business Info schema.

function CardInForm({ address }: { address: string }) {
  const form = useForm<BusinessInfoInput>({
    resolver: zodResolver(businessInfoSchema),
    mode: 'onBlur',
    defaultValues: { ...businessInfoValuesOf(demoSiteSettings), quoteAlertsEmail: address },
  });
  return (
    <form noValidate>
      <QuoteAlertsCard control={form.control} />
      <button type="submit">Save</button>
    </form>
  );
}

describe('QuoteAlertsCard', () => {
  it('shows the Quote alerts title and hint, and the labelled email field with its hint', () => {
    render(<CardInForm address="" />);

    const card = screen.getByRole('region', { name: 'Quote alerts' });
    expect(within(card).getByRole('heading', { level: 2, name: 'Quote alerts' })).toBeVisible();
    expect(within(card).getByText('Where we email you when a visitor sends a quote request.')).toBeVisible();
    const field = within(card).getByLabelText('Quote alerts email');
    expect(field).toHaveAttribute('type', 'email');
    expect(field).toHaveAttribute('inputmode', 'email');
    expect(field).toHaveAccessibleDescription(
      'Any inbox works, including the shop email. Leave it empty to get no emails; new requests still show in Quote Requests.',
    );
  });

  it('shows the saved address when the form opens (R5 populated) and an empty field when none is saved', () => {
    const { unmount } = render(<CardInForm address="quotes@example.com" />);
    expect(screen.getByLabelText('Quote alerts email')).toHaveValue('quotes@example.com');
    unmount();

    render(<CardInForm address="" />);
    expect(screen.getByLabelText('Quote alerts email')).toHaveValue('');
  });

  it('checks the address when it is left and shows the server wording', async () => {
    const user = userEvent.setup();
    render(<CardInForm address="" />);

    await user.type(screen.getByLabelText('Quote alerts email'), 'nope');
    await user.tab();

    expect(await screen.findByText('Enter a valid email, like name@gmail.com')).toBeVisible();
    expect(screen.getByLabelText('Quote alerts email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('has no axe violations, empty or with an error', async () => {
    const user = userEvent.setup();
    const { container } = render(<CardInForm address="" />);
    await expectNoAxeViolations(container);

    await user.type(screen.getByLabelText('Quote alerts email'), 'nope');
    await user.tab();
    await screen.findByText('Enter a valid email, like name@gmail.com');
    await expectNoAxeViolations(container);
  });
});

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { PublicWebsiteFormCard } from '@/modules/admin/components/PublicWebsiteFormCard';
import type { PublicWebsiteFieldsOrder } from '@/modules/admin/components/PublicWebsiteFields';
import type { PublicWebsiteFormInput } from '@/modules/admin/publicWebsiteSchemas';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import { buildOrderDetail, PRODUCT_LINE_OPTIONS, publicWebsiteBlock, useOrderHandlers } from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The Public website card of the New Order and Edit Order forms (UI-SPEC O1, F1 and F2; D-11, D-16; plan 11-35).

const BLANK: PublicWebsiteFormInput = {
  customerConsent: false,
  showOnWebsite: false,
  productLineId: '',
  publicName: '',
};

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  useOrderHandlers();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

interface HostProps {
  teamName?: string;
  order?: PublicWebsiteFieldsOrder | null;
  lineFromItems?: boolean;
  values?: PublicWebsiteFormInput;
}

function Host({ teamName = 'Test Hawks', order = null, lineFromItems, values = BLANK }: HostProps) {
  const form = useForm<PublicWebsiteFormInput>({ defaultValues: values });
  return (
    <PublicWebsiteFormCard
      form={form}
      order={order}
      teamName={teamName}
      headingId="card-heading"
      {...(lineFromItems === undefined ? {} : { lineFromItems })}
    />
  );
}

async function openCard(props: HostProps = {}) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <Host {...props} />
    </QueryClientProvider>,
  );
  const region = screen.getByRole('region', { name: 'Public website' });
  await within(region).findByRole('option', { name: PRODUCT_LINE_OPTIONS[0]?.title ?? '' });
  return { ...view, region, user: userEvent.setup() };
}

describe('the card', () => {
  it('is a region named Public website with its hint, the four fields and no preview', async () => {
    const { region } = await openCard();

    expect(within(region).getByRole('heading', { level: 2, name: 'Public website' })).toBeVisible();
    expect(within(region).getByText("Only with the customer's OK.")).toBeVisible();
    expect(within(region).getByRole('checkbox', { name: 'Customer said OK to show' })).toBeVisible();
    expect(within(region).getByRole('checkbox', { name: 'Show on the website' })).toBeVisible();
    expect(within(region).getByRole('combobox', { name: 'Show under' })).toBeVisible();
    expect(within(region).getByRole('textbox', { name: 'Name shown' })).toBeVisible();
    expect(within(region).queryByText(/^Visitors see:/)).toBeNull();
  });

  it('starts with both boxes unticked (D-11 off by default)', async () => {
    const { region } = await openCard();

    expect(within(region).getByRole('checkbox', { name: 'Customer said OK to show' })).not.toBeChecked();
    expect(within(region).getByRole('checkbox', { name: 'Show on the website' })).not.toBeChecked();
  });

  it('keeps Show on the website aria-disabled, with its hint, until the OK is ticked', async () => {
    const { region, user } = await openCard();
    const ok = within(region).getByRole('checkbox', { name: 'Customer said OK to show' });
    const show = within(region).getByRole('checkbox', { name: 'Show on the website' });

    expect(show).toHaveAttribute('aria-disabled', 'true');
    expect(show).toHaveAccessibleDescription('Tick Customer said OK to show first.');
    await user.click(show);
    expect(show).not.toBeChecked();

    await user.click(ok);
    expect(show).not.toHaveAttribute('aria-disabled', 'true');
    await user.click(show);
    expect(show).toBeChecked();
  });

  it('unticks Show on the website when the OK is unticked', async () => {
    const { region, user } = await openCard();
    const ok = within(region).getByRole('checkbox', { name: 'Customer said OK to show' });
    const show = within(region).getByRole('checkbox', { name: 'Show on the website' });
    await user.click(ok);
    await user.click(show);

    await user.click(ok);

    expect(show).not.toBeChecked();
    expect(show).toHaveAttribute('aria-disabled', 'true');
  });

  it('offers the active lines', async () => {
    const { region } = await openCard();

    expect(
      within(within(region).getByRole('combobox', { name: 'Show under' }))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Choose a line', ...PRODUCT_LINE_OPTIONS.map((line) => line.title)]);
  });
});

describe('the name and the team', () => {
  it('says the team typed on the form in the name hint', async () => {
    const { region } = await openCard({ teamName: 'Test Hawks' });

    expect(within(region).getByText('Leave empty to show the team name, Test Hawks.')).toBeVisible();
    expect(within(region).getByRole('textbox', { name: 'Name shown' })).toHaveAttribute('placeholder', 'Test Hawks');
  });

  it('asks for a name when the form has no team', async () => {
    const { region } = await openCard({ teamName: '' });

    expect(within(region).getByText('This order has no team name. Enter the name to show.')).toBeVisible();
  });
});

describe('the line', () => {
  it('is not required on a new order, where the line is worked out from the items on save', async () => {
    const { region, user } = await openCard({ lineFromItems: true });
    await user.click(within(region).getByRole('checkbox', { name: 'Customer said OK to show' }));
    await user.click(within(region).getByRole('checkbox', { name: 'Show on the website' }));

    expect(within(region).getByRole('combobox', { name: 'Show under' })).not.toBeRequired();
  });

  it('is required once Show is ticked on an order that already has its items', async () => {
    const { region, user } = await openCard({ lineFromItems: false });
    await user.click(within(region).getByRole('checkbox', { name: 'Customer said OK to show' }));
    await user.click(within(region).getByRole('checkbox', { name: 'Show on the website' }));

    expect(within(region).getByRole('combobox', { name: /^Show under/ })).toBeRequired();
  });

  it("lists an order's current line even when it was hidden after the order chose it", async () => {
    const hiddenId = '8c1f4a20-0000-4000-8000-0000000000ff';
    const order = buildOrderDetail({
      publicWebsite: publicWebsiteBlock({ productLineId: hiddenId, productLineTitle: 'Retired Line' }),
    });
    const { region } = await openCard({ order, values: { ...BLANK, productLineId: hiddenId } });

    expect(within(region).getByRole('option', { name: 'Retired Line' })).toBeInTheDocument();
  });
});

describe('accessibility', () => {
  it('has no axe violations in any state', async () => {
    const { container, region, user } = await openCard();
    await expectNoAxeViolations(container);

    await user.click(within(region).getByRole('checkbox', { name: 'Customer said OK to show' }));
    await expectNoAxeViolations(container);

    await user.click(within(region).getByRole('checkbox', { name: 'Show on the website' }));
    await expectNoAxeViolations(container);
  });
});

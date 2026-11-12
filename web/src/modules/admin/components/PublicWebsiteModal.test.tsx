import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { createQueryClient } from '@/lib/query/queryClient';
import { PublicWebsiteModal } from '@/modules/admin/components/PublicWebsiteModal';
import { orderKey } from '@/modules/admin/hooks/useOrderQuery';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { expectNoAxeViolations } from '@/test/axe';
import {
  buildOrderDetail,
  order0148,
  ORDER_VERSION,
  orderProblem,
  PRODUCT_LINE_OPTIONS,
  publicWebsiteBlock,
  useOrderHandlers,
  type OrderBackend,
} from '@/test/orderFixtures';
import { sessionResponse } from '@/test/sessionFixtures';

// The Public Website window (UI-SPEC O1; D-09, D-11, D-13, D-16; plan 11-27): the OK, Show, the line, the name; Show waits for the OK.

const BASKETBALL = '8c1f4a20-0000-4000-8000-000000000001';
const AUTO_LINE_ORDER = buildOrderDetail({
  publicWebsite: publicWebsiteBlock({ autoProductLineId: BASKETBALL, productLineId: BASKETBALL }),
});

let queryClient: QueryClient;
let backend: OrderBackend;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
  backend = useOrderHandlers({ detail: SHOWN_ANSWER });
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

/** The order the server answers after the OK and Show were saved. */
const SHOWN_ANSWER = buildOrderDetail({
  publicWebsite: publicWebsiteBlock({
    customerConsent: true,
    consentRecordedAtUtc: '2026-10-08T03:00:00Z',
    consentRecordedByName: 'Liza Mercado',
    shownOnWebsite: true,
    shownSinceUtc: '2026-10-08T03:00:00Z',
    autoProductLineId: BASKETBALL,
    productLineId: BASKETBALL,
    productLineTitle: 'Basketball Jerseys',
    hasPhoto: true,
  }),
  version: 'AAAAAAAAB9F=',
});

/** A trigger button that opens the window, so the focus return can be seen. */
function Harness({
  order,
  onClose,
  onSaved,
}: {
  order: OrderDetailResponse;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Edit public website settings
      </button>
      <PublicWebsiteModal
        order={order}
        open={open}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        onSaved={onSaved}
      />
    </>
  );
}

function setup(order: OrderDetailResponse) {
  queryClient.setQueryData(orderKey(order.id), order);
  const user = userEvent.setup();
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <Harness order={order} onClose={onClose} onSaved={onSaved} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user, onClose, onSaved };
}

async function openWindow(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  await user.click(screen.getByRole('button', { name: 'Edit public website settings' }));
  const dialog = await screen.findByRole('dialog', { name: 'Public Website' });
  // The line options arrive after the window opens.
  await within(dialog).findByRole('option', { name: PRODUCT_LINE_OPTIONS[0]?.title ?? '' });
  return dialog;
}

describe('the fields', () => {
  it('describes the window with the order number and the team', async () => {
    const { user } = setup(AUTO_LINE_ORDER);

    const dialog = await openWindow(user);

    expect(within(dialog).getByText('ORD-2026-0148 · Brgy. San Roque Ballers')).toBeVisible();
  });

  it('keeps Show on the website aria-disabled, with its hint as its description, until the OK is ticked', async () => {
    const { user } = setup(AUTO_LINE_ORDER);
    const dialog = await openWindow(user);
    const ok = within(dialog).getByRole('checkbox', { name: 'Customer said OK to show' });
    const show = within(dialog).getByRole('checkbox', { name: 'Show on the website' });

    expect(ok).not.toBeChecked();
    expect(show).toHaveAttribute('aria-disabled', 'true');
    expect(show).toHaveAccessibleDescription('Tick Customer said OK to show first.');

    await user.click(show);
    expect(show).not.toBeChecked();

    await user.click(ok);
    expect(show).not.toHaveAttribute('aria-disabled', 'true');

    await user.click(show);
    expect(show).toBeChecked();
  });

  it('presets Show under to the line the server worked out from the items', async () => {
    const { user } = setup(AUTO_LINE_ORDER);
    const dialog = await openWindow(user);

    expect(within(dialog).getByRole('combobox', { name: 'Show under' })).toHaveValue(BASKETBALL);
  });

  it('has no axe violations', async () => {
    const { user } = setup(AUTO_LINE_ORDER);
    const dialog = await openWindow(user);

    await expectNoAxeViolations(dialog);
  });
});

describe('saving', () => {
  it('sends the OK, Show, the preset line, no name and the order version; closes, returns focus to Edit and says the order is shown', async () => {
    const { user, onClose, onSaved } = setup(AUTO_LINE_ORDER);
    const dialog = await openWindow(user);

    await user.click(within(dialog).getByRole('checkbox', { name: 'Customer said OK to show' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Show on the website' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(backend.writes).toHaveLength(1);
    expect(backend.writes[0]?.method).toBe('PUT');
    expect(backend.writes[0]?.path).toBe(`/orders/${order0148.id}/public`);
    expect(backend.writes[0]?.body).toEqual({
      customerConsent: true,
      showOnWebsite: true,
      productLineId: BASKETBALL,
      publicName: null,
      version: ORDER_VERSION,
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Public Website' })).not.toBeInTheDocument();
    });
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit public website settings' })).toHaveFocus();
    expect(await screen.findByText('Order shown on the website')).toBeVisible();
    expect(queryClient.getQueryData(orderKey(order0148.id))).toEqual(SHOWN_ANSWER);
  });
});

const VOLLEYBALL = '8c1f4a20-0000-4000-8000-000000000002';
const ONE_LINE_NAME = 'Sample Ballers';

/** The window of an order already on the website under Basketball. */
const ALREADY_SHOWN = SHOWN_ANSWER;

function box(dialog: HTMLElement, name: string): HTMLElement {
  return within(dialog).getByRole('checkbox', { name });
}

async function save(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement): Promise<void> {
  await user.click(within(dialog).getByRole('button', { name: 'Save Changes' }));
}

describe('the rules, in the server words (OR-3)', () => {
  it('unticks Show on the website when the OK is unticked', async () => {
    const { user } = setup(ALREADY_SHOWN);
    const dialog = await openWindow(user);

    expect(box(dialog, 'Show on the website')).toBeChecked();
    await user.click(box(dialog, 'Customer said OK to show'));

    expect(box(dialog, 'Customer said OK to show')).not.toBeChecked();
    expect(box(dialog, 'Show on the website')).not.toBeChecked();
    expect(box(dialog, 'Show on the website')).toHaveAttribute('aria-disabled', 'true');
  });

  it('asks for a line when the order is shown with none, under Show under, and sends nothing', async () => {
    const { user } = setup(order0148);
    const dialog = await openWindow(user);

    expect(within(dialog).getByRole('combobox', { name: 'Show under' })).toHaveValue('');
    await user.click(box(dialog, 'Customer said OK to show'));
    await user.click(box(dialog, 'Show on the website'));
    await save(user, dialog);

    expect(await within(dialog).findByText('Choose the product line to show this order under.')).toBeVisible();
    expect(backend.writes).toEqual([]);
  });

  it('asks for the name of an order with no team when it is shown, and says so in the hint', async () => {
    const noTeam = buildOrderDetail({
      teamName: null,
      publicWebsite: publicWebsiteBlock({ autoProductLineId: BASKETBALL, productLineId: BASKETBALL }),
    });
    const { user } = setup(noTeam);
    const dialog = await openWindow(user);

    expect(within(dialog).getByText('This order has no team name. Enter the name to show.')).toBeVisible();
    await user.click(box(dialog, 'Customer said OK to show'));
    await user.click(box(dialog, 'Show on the website'));
    await save(user, dialog);

    expect(await within(dialog).findAllByText('This order has no team name. Enter the name to show.')).not.toHaveLength(
      0,
    );
    expect(within(dialog).getByRole('textbox', { name: /^Name shown/ })).toHaveAttribute('aria-invalid', 'true');
    expect(backend.writes).toEqual([]);
  });

  it('takes the name typed for an order with no team', async () => {
    const noTeam = buildOrderDetail({
      teamName: null,
      publicWebsite: publicWebsiteBlock({ autoProductLineId: BASKETBALL, productLineId: BASKETBALL }),
    });
    const { user } = setup(noTeam);
    const dialog = await openWindow(user);

    await user.click(box(dialog, 'Customer said OK to show'));
    await user.click(box(dialog, 'Show on the website'));
    await user.type(within(dialog).getByRole('textbox', { name: /^Name shown/ }), ONE_LINE_NAME);
    await save(user, dialog);

    await waitFor(() => {
      expect(backend.writes).toHaveLength(1);
    });
    expect(backend.writes[0]?.body).toMatchObject({ publicName: ONE_LINE_NAME, showOnWebsite: true });
  });

  it('refuses a name over 80 characters, and sends nothing', async () => {
    const { user } = setup(AUTO_LINE_ORDER);
    const dialog = await openWindow(user);

    await user.click(within(dialog).getByRole('textbox', { name: 'Name shown' }));
    await user.paste('a'.repeat(81));
    await save(user, dialog);

    expect(await within(dialog).findByText('Keep the name to 80 characters or fewer.')).toBeVisible();
    expect(backend.writes).toEqual([]);
  });

  it('names the team in the placeholder and the hint of Name shown', async () => {
    const { user } = setup(AUTO_LINE_ORDER);
    const dialog = await openWindow(user);

    const name = within(dialog).getByRole('textbox', { name: 'Name shown' });
    expect(name).toHaveAttribute('placeholder', 'Brgy. San Roque Ballers');
    expect(name).toHaveAccessibleDescription('Leave empty to show the team name, Brgy. San Roque Ballers.');
  });

  it('puts a refusal from the server under its field', async () => {
    backend = useOrderHandlers({
      detail: SHOWN_ANSWER,
      reply: () =>
        new HttpResponse(
          JSON.stringify({
            title: 'x',
            status: 400,
            errors: { publicName: ['Keep the name to 80 characters or fewer.'] },
          }),
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        ),
    });
    const { user } = setup(AUTO_LINE_ORDER);
    const dialog = await openWindow(user);

    await user.click(box(dialog, 'Customer said OK to show'));
    await save(user, dialog);

    expect(await within(dialog).findByText('Keep the name to 80 characters or fewer.')).toBeVisible();
    expect(within(dialog).getByRole('textbox', { name: 'Name shown' })).toHaveFocus();
  });
});

describe('the line to show under (D-09)', () => {
  const TWO_LINES = buildOrderDetail({
    publicWebsite: publicWebsiteBlock({ autoProductLineId: VOLLEYBALL, productLineId: VOLLEYBALL }),
  });

  it('presets the line with the most pieces, and lets another line be chosen', async () => {
    const { user } = setup(TWO_LINES);
    const dialog = await openWindow(user);
    const line = within(dialog).getByRole('combobox', { name: 'Show under' });

    expect(line).toHaveValue(VOLLEYBALL);
    await user.selectOptions(line, BASKETBALL);
    await user.click(box(dialog, 'Customer said OK to show'));
    await user.click(box(dialog, 'Show on the website'));
    await save(user, dialog);

    await waitFor(() => {
      expect(backend.writes).toHaveLength(1);
    });
    expect(backend.writes[0]?.body).toMatchObject({ productLineId: BASKETBALL });
  });

  it('still offers the line an order is filed under after that line was hidden', async () => {
    const hiddenLine = '8c1f4a20-0000-4000-8000-0000000000aa';
    const filed = buildOrderDetail({
      publicWebsite: publicWebsiteBlock({
        productLineId: hiddenLine,
        productLineTitle: 'Retired Jerseys',
      }),
    });
    const { user } = setup(filed);
    const dialog = await openWindow(user);

    const line = within(dialog).getByRole('combobox', { name: 'Show under' });
    expect(within(line).getByRole('option', { name: 'Retired Jerseys' })).toBeInTheDocument();
    expect(line).toHaveValue(hiddenLine);
  });
});

describe('the preview, from the server pieces', () => {
  const SEVENTEEN = buildOrderDetail({
    publicWebsite: publicWebsiteBlock({ autoProductLineId: BASKETBALL, productLineId: BASKETBALL, pieces: 17 }),
  });

  it('reads the team in capitals, the line and the pieces, and follows what is typed and chosen', async () => {
    const { user } = setup(SEVENTEEN);
    const dialog = await openWindow(user);

    expect(within(dialog).getByText('Visitors see: BRGY. SAN ROQUE BALLERS · Basketball · 17 pcs')).toBeVisible();

    await user.type(within(dialog).getByRole('textbox', { name: 'Name shown' }), ONE_LINE_NAME);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Show under' }), VOLLEYBALL);

    expect(within(dialog).getByText('Visitors see: SAMPLE BALLERS · Volleyball · 17 pcs')).toBeVisible();
  });

  it('leaves the line out while none is chosen', async () => {
    const { user } = setup(order0148);
    const dialog = await openWindow(user);

    expect(within(dialog).getByText('Visitors see: BRGY. SAN ROQUE BALLERS · 48 pcs')).toBeVisible();
  });
});

describe('the toasts of a save (UI-SPEC Toasts)', () => {
  it('says the order is taken off, and that its photos stay, when Show is switched off', async () => {
    backend = useOrderHandlers({ detail: order0148 });
    const { user } = setup(ALREADY_SHOWN);
    const dialog = await openWindow(user);

    await user.click(box(dialog, 'Show on the website'));
    await save(user, dialog);

    expect(await screen.findByText('Order taken off the website')).toBeVisible();
    expect(screen.getByText('Its photos stay on the order.')).toBeVisible();
    expect(backend.writes[0]?.body).toMatchObject({ customerConsent: true, showOnWebsite: false });
  });

  it('says the order is taken off when the OK is removed', async () => {
    backend = useOrderHandlers({ detail: order0148 });
    const { user } = setup(ALREADY_SHOWN);
    const dialog = await openWindow(user);

    await user.click(box(dialog, 'Customer said OK to show'));
    await save(user, dialog);

    expect(await screen.findByText('Order taken off the website')).toBeVisible();
    expect(backend.writes[0]?.body).toMatchObject({ customerConsent: false, showOnWebsite: false });
  });

  it('says the settings are saved when only the details of a shown order changed', async () => {
    backend = useOrderHandlers({
      detail: buildOrderDetail({
        ...SHOWN_ANSWER,
        publicWebsite: { ...SHOWN_ANSWER.publicWebsite, publicName: ONE_LINE_NAME },
      }),
    });
    const { user } = setup(ALREADY_SHOWN);
    const dialog = await openWindow(user);

    await user.type(within(dialog).getByRole('textbox', { name: 'Name shown' }), ONE_LINE_NAME);
    await save(user, dialog);

    expect(await screen.findByText('Public website settings saved')).toBeVisible();
    expect(screen.getByText('ORD-2026-0148 is updated.')).toBeVisible();
  });

  it('says the settings are saved when only the OK was recorded', async () => {
    backend = useOrderHandlers({
      detail: buildOrderDetail({ publicWebsite: publicWebsiteBlock({ customerConsent: true }) }),
    });
    const { user } = setup(AUTO_LINE_ORDER);
    const dialog = await openWindow(user);

    await user.click(box(dialog, 'Customer said OK to show'));
    await save(user, dialog);

    expect(await screen.findByText('Public website settings saved')).toBeVisible();
  });
});

describe('a stale save and a window that was changed (05 D-20, D-58)', () => {
  it('shows the conflict banner and keeps what was chosen', async () => {
    backend = useOrderHandlers({ detail: SHOWN_ANSWER, reply: () => orderProblem(409, 'edit.stale') });
    const { user } = setup(AUTO_LINE_ORDER);
    const dialog = await openWindow(user);

    await user.click(box(dialog, 'Customer said OK to show'));
    await user.click(box(dialog, 'Show on the website'));
    await save(user, dialog);

    expect(await within(dialog).findByRole('button', { name: 'Load Latest' })).toBeVisible();
    expect(within(dialog).getByText(/Your typed changes stay here/)).toBeVisible();
    expect(screen.getByRole('dialog', { name: 'Public Website' })).toBeVisible();
    expect(box(dialog, 'Customer said OK to show')).toBeChecked();
    expect(box(dialog, 'Show on the website')).toBeChecked();
    expect((backend.writes[0]?.body as { version: string }).version).toBe(ORDER_VERSION);
  });

  it('closes a window nothing was typed in at once', async () => {
    const { user, onClose } = setup(AUTO_LINE_ORDER);
    const dialog = await openWindow(user);

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('asks Discard changes? before closing a changed window, and keeps it open on Keep Editing', async () => {
    const { user, onClose } = setup(AUTO_LINE_ORDER);
    const dialog = await openWindow(user);

    await user.click(box(dialog, 'Customer said OK to show'));
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    const ask = await screen.findByRole('dialog', { name: 'Discard changes?' });
    await user.click(within(ask).getByRole('button', { name: 'Keep Editing' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(box(dialog, 'Customer said OK to show')).toBeChecked();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Discard changes?' })).getByRole('button', {
        name: 'Discard Changes',
      }),
    );

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

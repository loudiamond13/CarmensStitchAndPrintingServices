import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import {
  categoryDetail,
  categoryDetailBackend,
  createCategoryBackend,
  OTHERS_ID,
  RENT,
  updateCategoryBackend,
} from '@/test/expenseFixtures';
import { expectNoAxeViolations } from '@/test/axe';
import { sessionResponse } from '@/test/sessionFixtures';
import { CategoryModal } from './CategoryModal';

// S2 Category modal, add and edit (D-08, D-12, D-13, OQ-6, SEC-07; plan 06-17): a name, a badge color with live previews, and one save.

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
});

const PROBLEM = { 'Content-Type': 'application/problem+json' };

function problem(status: number, body: Record<string, unknown> = {}): Response {
  return Response.json({ title: 'x', status, ...body }, { status, headers: PROBLEM });
}

const COLORS = ['Taupe', 'Orange', 'Blue', 'Plum', 'Amber', 'Green'] as const;

const nameInput = () => screen.getByRole<HTMLInputElement>('textbox', { name: /^Name/ });
const radio = (color: (typeof COLORS)[number]) => screen.getByRole<HTMLInputElement>('radio', { name: color });
const saveButton = () => screen.getByRole('button', { name: /^(Save Category|Save Changes|Saving)$/ });

interface Handlers {
  onClose?: () => void;
  onSaved?: (category: unknown) => void;
}

function renderAdd(handlers: Handlers = {}) {
  const onClose = handlers.onClose ?? vi.fn();
  const onSaved = handlers.onSaved ?? vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <CategoryModal mode="add" onClose={onClose} onSaved={onSaved} />
    </QueryClientProvider>,
  );
  return { onClose, onSaved };
}

function renderEdit(handlers: Handlers = {}, categoryId = RENT.id) {
  const onClose = handlers.onClose ?? vi.fn();
  const onSaved = handlers.onSaved ?? vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <CategoryModal mode="edit" categoryId={categoryId} onClose={onClose} onSaved={onSaved} />
    </QueryClientProvider>,
  );
  return { onClose, onSaved };
}

async function loaded() {
  await waitFor(() => {
    expect(nameInput().value).not.toBe('');
  });
}

describe('S2 add mode', () => {
  it('opens as the "Add Category" dialog with its description, focus on Name, Taupe chosen, and Cancel and Save Category', () => {
    renderAdd();

    const dialog = screen.getByRole('dialog', { name: 'Add Category' });
    expect(within(dialog).getByText('Staff pick from this list when they record a company expense.')).toBeVisible();
    expect(nameInput()).toHaveFocus();
    expect(nameInput()).toHaveValue('');
    expect(nameInput()).toHaveAttribute('maxlength', '40');
    expect(radio('Taupe')).toBeChecked();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeVisible();
    expect(saveButton()).toHaveTextContent('Save Category');
  });

  it('offers six colors named in words, in order, as native radios in a group named Badge color', () => {
    renderAdd();

    const group = screen.getByRole('group', { name: 'Badge color' });
    expect(
      within(group)
        .getAllByRole('radio')
        .map((item) => item.getAttribute('type')),
    ).toEqual(COLORS.map(() => 'radio'));
    expect(within(group).getAllByRole('radio', { checked: false }).length).toBe(5);
    expect(
      within(group)
        .getAllByRole('radio')
        .map((item) => item.getAttribute('aria-labelledby'))
        .map((id) => document.getElementById(id ?? '')?.textContent),
    ).toEqual([...COLORS]);
  });

  it('previews the badge beside each color: "Sample" while the name is empty, then the typed name', async () => {
    const user = userEvent.setup();
    renderAdd();

    for (const color of COLORS) {
      expect(radio(color)).toHaveAccessibleDescription('Sample');
    }

    await user.type(nameInput(), 'Packaging');

    for (const color of COLORS) {
      expect(radio(color)).toHaveAccessibleDescription('Packaging');
    }
  });

  it('shows "Enter a category name." under Name before any request, and puts focus on Name', async () => {
    const sent = createCategoryBackend();
    const user = userEvent.setup();
    const { onSaved } = renderAdd();

    await user.click(saveButton());

    expect(await screen.findByText('Enter a category name.')).toBeVisible();
    expect(nameInput()).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput()).toHaveFocus();
    expect(sent.bodies).toHaveLength(0);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('saves the trimmed name and the chosen color with one Idempotency-Key, then reports the category and closes', async () => {
    const sent = createCategoryBackend();
    const user = userEvent.setup();
    const { onSaved, onClose } = renderAdd();

    await user.type(nameInput(), '  Packaging  ');
    await user.click(radio('Blue'));
    await user.click(saveButton());

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(sent.bodies).toEqual([{ name: 'Packaging', tone: 'info' }]);
    expect(sent.keys[0]).toMatch(/\S+/);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Packaging' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sends Taupe (neutral) when the color was never changed', async () => {
    const sent = createCategoryBackend();
    const user = userEvent.setup();
    renderAdd();

    await user.type(nameInput(), 'Packaging');
    await user.click(saveButton());

    await waitFor(() => {
      expect(sent.bodies).toHaveLength(1);
    });
    expect(sent.bodies[0]).toEqual({ name: 'Packaging', tone: 'neutral' });
  });

  it('shows the server duplicate-name message under Name, keeps what was typed and leaves the dialog open', async () => {
    createCategoryBackend(() => problem(400, { errors: { name: ['Another category already has this name.'] } }));
    const user = userEvent.setup();
    const { onSaved, onClose } = renderAdd();

    await user.type(nameInput(), 'Rent');
    await user.click(radio('Plum'));
    await user.click(saveButton());

    expect(await screen.findByText('Another category already has this name.')).toBeVisible();
    expect(nameInput()).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput()).toHaveFocus();
    expect(nameInput()).toHaveValue('Rent');
    expect(radio('Plum')).toBeChecked();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows one alert line for a failure that belongs to no field and retries with the same key', async () => {
    let calls = 0;
    const sent = createCategoryBackend(() => {
      calls += 1;
      return calls === 1 ? problem(500) : Response.json(categoryDetail(), { status: 201 });
    });
    const user = userEvent.setup();
    const { onSaved } = renderAdd();

    await user.type(nameInput(), 'Packaging');
    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    await user.click(saveButton());

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(sent.keys[0]).toBe(sent.keys[1]);
  });

  it('starts empty with Taupe when it is closed and opened again', async () => {
    function Reopen() {
      const [open, setOpen] = useState(true);
      return (
        <QueryClientProvider client={queryClient}>
          <button
            type="button"
            onClick={() => {
              setOpen(!open);
            }}
          >
            Toggle
          </button>
          <CategoryModal
            mode="add"
            open={open}
            onClose={() => {
              setOpen(false);
            }}
            onSaved={() => undefined}
          />
        </QueryClientProvider>
      );
    }
    const user = userEvent.setup();
    render(<Reopen />);
    await user.type(nameInput(), 'Draft');
    await user.click(radio('Blue'));

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await user.click(screen.getByRole('button', { name: 'Toggle' }));

    expect(nameInput()).toHaveValue('');
    expect(radio('Taupe')).toBeChecked();
  });

  it('has no axe violations, with and without an error', async () => {
    const user = userEvent.setup();
    renderAdd();
    await expectNoAxeViolations(screen.getByRole('dialog', { name: 'Add Category' }));

    await user.click(saveButton());
    await screen.findByText('Enter a category name.');
    await expectNoAxeViolations(screen.getByRole('dialog', { name: 'Add Category' }));
  });
});

describe('S2 edit mode', () => {
  it('reads the category fresh, fills the saved name and color, shows RecordMeta (System for a seeded one) and focuses Name', async () => {
    categoryDetailBackend(categoryDetail());
    renderEdit();

    const dialog = screen.getByRole('dialog', { name: 'Edit Category' });
    expect(
      within(dialog).getByText('A new name shows on every expense in this category, past ones too.'),
    ).toBeVisible();
    await loaded();
    expect(nameInput()).toHaveValue('Rent');
    expect(radio('Orange')).toBeChecked();
    expect(within(dialog).getByText('Recorded by')).toBeVisible();
    expect(within(dialog).getByText(/^System ·/)).toBeVisible();
    await waitFor(() => {
      expect(nameInput()).toHaveFocus();
    });
    expect(saveButton()).toHaveTextContent('Save Changes');
  });

  it('saves the new name and color with the row version it opened with and no Idempotency-Key', async () => {
    categoryDetailBackend(categoryDetail({ version: 'AAAAAAAAB9E=' }));
    const sent = updateCategoryBackend(() => Response.json(categoryDetail({ name: 'Rent and bills' })));
    const user = userEvent.setup();
    const { onSaved, onClose } = renderEdit();
    await loaded();

    await user.clear(nameInput());
    await user.type(nameInput(), 'Rent and bills');
    await user.click(radio('Green'));
    await user.click(saveButton());

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(sent.ids).toEqual([RENT.id]);
    expect(sent.bodies).toEqual([{ name: 'Rent and bills', tone: 'success', version: 'AAAAAAAAB9E=' }]);
    expect(sent.keys[0]).toBeNull();
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Rent and bills' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the duplicate-name message under Name on a 400', async () => {
    categoryDetailBackend(categoryDetail());
    updateCategoryBackend(() => problem(400, { errors: { name: ['Another category already has this name.'] } }));
    const user = userEvent.setup();
    renderEdit();
    await loaded();

    await user.clear(nameInput());
    await user.type(nameInput(), 'Utilities');
    await user.click(saveButton());

    expect(await screen.findByText('Another category already has this name.')).toBeVisible();
    expect(nameInput()).toHaveValue('Utilities');
  });

  describe('a stale save (SEC-07, 05 D-20)', () => {
    const STALE_BODY = { code: 'edit.stale', detail: 'This was changed by someone else.' };
    const STALE_TITLE = 'This was changed by someone else.';

    it('keeps every typed value on a 409, shows the banner and puts focus on Load Latest', async () => {
      categoryDetailBackend(categoryDetail());
      updateCategoryBackend(() => problem(409, STALE_BODY));
      const user = userEvent.setup();
      const { onSaved } = renderEdit();
      await loaded();

      await user.clear(nameInput());
      await user.type(nameInput(), 'Rent and bills');
      await user.click(radio('Plum'));
      await user.click(saveButton());

      expect(await screen.findByText(STALE_TITLE)).toBeVisible();
      expect(
        screen.getByText('Reload and try again. Your typed changes stay here until you press Load Latest.'),
      ).toBeVisible();
      expect(screen.getByRole('button', { name: 'Load Latest' })).toHaveFocus();
      expect(nameInput()).toHaveValue('Rent and bills');
      expect(radio('Plum')).toBeChecked();
      expect(onSaved).not.toHaveBeenCalled();
    });

    it('Load Latest replaces the values and the version, removes the banner, focuses Name and says so politely', async () => {
      categoryDetailBackend(categoryDetail());
      let calls = 0;
      const sent = updateCategoryBackend(() => {
        calls += 1;
        return calls === 1 ? problem(409, STALE_BODY) : Response.json(categoryDetail({ name: 'Rent and bills' }));
      });
      const user = userEvent.setup();
      renderEdit();
      await loaded();
      await user.clear(nameInput());
      await user.type(nameInput(), 'Mine');
      await user.click(saveButton());
      await screen.findByText(STALE_TITLE);

      categoryDetailBackend(categoryDetail({ name: 'Rent and utilities', tone: 'info', version: 'AAAAAAAAB9Q=' }));
      await user.click(screen.getByRole('button', { name: 'Load Latest' }));

      await waitFor(() => {
        expect(screen.queryByText(STALE_TITLE)).toBeNull();
      });
      expect(nameInput()).toHaveValue('Rent and utilities');
      expect(radio('Blue')).toBeChecked();
      expect(nameInput()).toHaveFocus();
      expect(screen.getByText('Latest version loaded. Make your changes again.')).toBeInTheDocument();

      await user.click(saveButton());
      await waitFor(() => {
        expect(sent.bodies).toHaveLength(2);
      });
      expect(sent.bodies[1]).toMatchObject({ name: 'Rent and utilities', version: 'AAAAAAAAB9Q=' });
    });
  });

  describe('Others (OQ-6)', () => {
    const others = () => categoryDetail({ id: OTHERS_ID, name: 'Others', tone: 'neutral', isOthers: true });

    it('shows the name read-only (still focusable) with its hint, and puts focus on the chosen color', async () => {
      categoryDetailBackend(others());
      renderEdit({}, OTHERS_ID);
      await loaded();

      expect(nameInput()).toHaveValue('Others');
      expect(nameInput()).toHaveAttribute('readonly');
      expect(nameInput()).not.toBeDisabled();
      expect(screen.getByText("The Others name can't change, so it always sorts last.")).toBeVisible();
      await waitFor(() => {
        expect(radio('Taupe')).toHaveFocus();
      });
    });

    it('lets the color change and saves it with the unchanged name', async () => {
      categoryDetailBackend(others());
      const sent = updateCategoryBackend(() => Response.json(others()));
      const user = userEvent.setup();
      const { onSaved } = renderEdit({}, OTHERS_ID);
      await loaded();

      await user.click(radio('Amber'));
      await user.click(saveButton());

      await waitFor(() => {
        expect(onSaved).toHaveBeenCalledTimes(1);
      });
      expect(sent.bodies[0]).toMatchObject({ name: 'Others', tone: 'warning' });
    });

    it('does not show the Others hint for any other category', async () => {
      categoryDetailBackend(categoryDetail());
      renderEdit();
      await loaded();

      expect(nameInput()).not.toHaveAttribute('readonly');
      expect(screen.queryByText("The Others name can't change, so it always sorts last.")).toBeNull();
    });
  });

  it("says Couldn't load this category with Try Again when the read fails, and Try Again reads it again", async () => {
    let calls = 0;
    categoryDetailBackend(() => {
      calls += 1;
      return calls === 1 ? problem(500) : categoryDetail();
    });
    const user = userEvent.setup();
    renderEdit();

    expect(await screen.findByText("Couldn't load this category.")).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    await loaded();
    expect(nameInput()).toHaveValue('Rent');
  });

  it('has no axe violations once loaded', async () => {
    categoryDetailBackend(categoryDetail());
    renderEdit();
    await loaded();

    await expectNoAxeViolations(screen.getByRole('dialog', { name: 'Edit Category' }));
  });
});

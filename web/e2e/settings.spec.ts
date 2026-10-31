// Settings and the expense categories end to end (D-08, D-10..D-15, D-30, OQ-3..OQ-6; plan 06-17), in all five projects. Since plan 08-08
// Settings has four list tabs and opens on Product Types, so the Phase 6 flows choose the Company Expense Categories tab first, and
// one more test (@settings-order-lists) walks the product type list. A Manager opens Settings from the sidebar (the drawer on a phone),
// adds a category in Blue, renames it, retires it (the Add Expense picker
// hides it and the list filter shows it as retired), uses it again and deletes a never-used one; a used category and Others have no
// Delete; an Admin sees no Settings item and is sent away; and the page and its dialogs fit a 320 px phone. The shared CSPS_E2E
// database keeps the categories earlier runs made, so each check finds its own rows by a unique name. Every test runs under the
// shared guard (console, page errors, CSP, failed responses).
import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL, press, RENT } from './helpers.ts';
import { createExpense, createStaff } from './testing-api.ts';

/** The Company Expense Categories tab, the one the Phase 6 flows run on. */
const COMPANY_TAB = '/admin/settings?tab=expense-categories';

/** Opens Settings from the navigation (the sidebar, or the drawer on a phone) on its first tab, Product Types. */
async function openSettingsHome(page: Page) {
  const menu = page.getByRole('button', { name: 'Open navigation' });
  if (await menu.isVisible()) {
    await menu.click();
    await page
      .getByRole('dialog', { name: 'Navigation' })
      .getByRole('link', { name: /^Settings/ })
      .click();
  } else {
    await page
      .locator('aside nav[aria-label="Admin"]')
      .getByRole('link', { name: /^Settings/ })
      .click();
  }
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Product types' })).toBeVisible();
}

/** Opens Settings from the navigation, then the Company Expense Categories tab. */
async function openSettings(page: Page) {
  await openSettingsHome(page);
  await page.getByRole('tab', { name: 'Company Expense Categories' }).click();
  await expect(page).toHaveURL(/\/admin\/settings\?tab=expense-categories$/);
  await expect(page.getByRole('table', { name: 'Expense categories' })).toBeVisible();
}

/** The category table's row for a name. */
function rowFor(page: Page, name: string) {
  return page.locator('tbody tr').filter({ hasText: name });
}

/** Picks a badge color in an open Category dialog by its word. */
async function chooseColor(dialog: Locator, color: string) {
  await dialog.locator('label').filter({ hasText: color }).first().click();
  await expect(dialog.getByRole('radio', { name: color })).toBeChecked();
}

/** The id the server gave an entry just added to a list ("expense-categories" by default). */
function categoryAdded(page: Page, list = 'expense-categories'): Promise<string> {
  const path = `/api/v1/${list}`;
  return page
    .waitForResponse((response) => new URL(response.url()).pathname === path && response.request().method() === 'POST')
    .then(async (response) => {
      const body: unknown = await response.json();
      if (typeof body !== 'object' || body === null || !('id' in body) || typeof body.id !== 'string') {
        throw new Error(`POST ${path} returned an unexpected body.`);
      }
      return body.id;
    });
}

test('@settings a Manager opens Settings from the sidebar, adds a category in Blue, renames it, retires it, uses it again and deletes a never-used one', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().slice(0, 8);
  const manager = await createStaff(request, 'Manager');
  const name = `E2E cat ${token}`;
  const renamed = `E2E cat ${token} v2`;
  await signInAs(page, request, manager);
  await page.goto('/admin/sessions');
  await expect(page.getByRole('heading', { level: 1, name: 'Signed-in devices' })).toBeVisible();

  // The sidebar leads to Settings, which is the current item; the seeded list is there, with Others last and its sub line.
  await openSettings(page);
  await expect(page).toHaveTitle('Settings · CSPS Admin');
  // On a phone the drawer's own sidebar is still closing, so the first match is enough.
  await expect(page.locator('aside nav[aria-label="Admin"] a[aria-current="page"]').first()).toContainText('Settings');
  await expect(page.getByRole('heading', { level: 2, name: 'Company Expense Categories' })).toBeVisible();
  await expect(rowFor(page, 'Others')).toContainText('Always listed last');
  await expect(page.locator('tbody tr').last()).toContainText('Others');
  await expectNoAxeViolations(page);

  // Add a category in Blue: the dialog previews the typed name on every color, and the new row is Active with 0 expenses.
  const add = page.getByRole('button', { name: 'Add Category' });
  await press(page, add);
  const addDialog = page.getByRole('dialog', { name: 'Add Category' });
  await expect(addDialog).toBeVisible();
  await expect(addDialog.getByRole('textbox', { name: /^Name/ })).toBeFocused();
  await expect(addDialog.getByRole('radio', { name: 'Taupe' })).toBeChecked();
  await addDialog.getByRole('textbox', { name: /^Name/ }).fill(name);
  await chooseColor(addDialog, 'Blue');
  await expect(addDialog.getByRole('radio', { name: 'Blue' })).toHaveAccessibleDescription(name);
  await expectNoAxeViolations(page);
  const added = categoryAdded(page);
  await addDialog.getByRole('button', { name: 'Save Category' }).click();
  await added;
  await expect(addDialog).toBeHidden();
  await expect(page.getByText('Category added', { exact: true })).toBeVisible();
  await expect(page.getByText(`${name} is ready to use.`)).toBeVisible();
  await expect(add).toBeFocused();
  const row = rowFor(page, name);
  await expect(row).toHaveCount(1);
  await expect(row.locator('td[data-label="Status"]')).toContainText('Active');
  await expect(row.locator('td[data-label="Expenses"]')).toHaveText('0');
  await expectNoAxeViolations(page);

  // A second category with the same name is refused under Name, with what was typed kept.
  guard.expectStatus('/api/v1/expense-categories', 400);
  await press(page, add);
  const duplicate = page.getByRole('dialog', { name: 'Add Category' });
  await duplicate.getByRole('textbox', { name: /^Name/ }).fill(name.toUpperCase());
  await duplicate.getByRole('button', { name: 'Save Category' }).click();
  await expect(duplicate.getByText('Another category already has this name.')).toBeVisible();
  await expect(duplicate.getByRole('textbox', { name: /^Name/ })).toHaveValue(name.toUpperCase());
  await duplicate.getByRole('button', { name: 'Cancel' }).click();
  await expect(duplicate).toBeHidden();

  // Rename and recolor it from its row: the dialog opens on the saved values with Recorded by naming the Manager.
  const edit = row.getByRole('button', { name: `Edit ${name}` });
  await press(page, edit);
  const editDialog = page.getByRole('dialog', { name: 'Edit Category' });
  await expect(editDialog).toBeVisible();
  const nameField = editDialog.getByRole('textbox', { name: /^Name/ });
  await expect(nameField).toHaveValue(name);
  await expect(nameField).toBeFocused();
  await expect(editDialog.getByRole('radio', { name: 'Blue' })).toBeChecked();
  await expect(editDialog.getByText('Recorded by')).toBeVisible();
  await nameField.fill(renamed);
  await chooseColor(editDialog, 'Plum');
  await expectNoAxeViolations(page);
  await editDialog.getByRole('button', { name: 'Save Changes' }).click();
  await expect(editDialog).toBeHidden();
  await expect(page.getByText('Category updated', { exact: true })).toBeVisible();
  const renamedRow = rowFor(page, renamed);
  await expect(renamedRow).toHaveCount(1);
  await expect(rowFor(page, name).filter({ hasNotText: 'v2' })).toHaveCount(0);
  await expect(renamedRow.getByRole('button', { name: `Edit ${renamed}` })).toBeFocused();

  // Retire it: it acts at once, the status and the action flip, and focus stays on the flipped action.
  await press(page, renamedRow.getByRole('button', { name: `Retire ${renamed}` }));
  await expect(renamedRow.locator('td[data-label="Status"]')).toContainText('Retired');
  await expect(renamedRow.getByRole('button', { name: `Use ${renamed} again` })).toBeFocused();
  await expect(page.getByText('Category retired', { exact: true })).toBeVisible();
  await expect(
    page.getByText(`${renamed} no longer shows in the Add Expense form. Past expenses keep it.`),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  // The Add Expense picker no longer offers it, and the list filter still shows it, marked retired.
  await page.goto('/admin/expenses');
  await expect(page.getByRole('heading', { level: 1, name: 'Company Expenses' })).toBeVisible();
  const filter = page.getByRole('combobox', { name: 'Category' });
  await expect(filter.locator('option', { hasText: `${renamed} (retired)` })).toHaveCount(1);
  await page.getByRole('button', { name: 'Add Expense' }).first().click();
  const expenseDialog = page.getByRole('dialog', { name: 'Add Expense' });
  const picker = expenseDialog.getByRole('combobox', { name: /^Category/ });
  await expect(picker.locator('option', { hasText: 'Rent' })).toHaveCount(1);
  await expect(picker.locator('option', { hasText: renamed })).toHaveCount(0);
  await expenseDialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(expenseDialog).toBeHidden();

  // Use it again: the picker offers it once more.
  await page.goto(COMPANY_TAB);
  await expect(page.getByRole('table', { name: 'Expense categories' })).toBeVisible();
  await press(page, renamedRow.getByRole('button', { name: `Use ${renamed} again` }));
  await expect(renamedRow.locator('td[data-label="Status"]')).toContainText('Active');
  await expect(renamedRow.getByRole('button', { name: `Retire ${renamed}` })).toBeFocused();
  await expect(page.getByText('Category back in use', { exact: true })).toBeVisible();
  await expect(page.getByText(`${renamed} shows in the Add Expense form again.`)).toBeVisible();
  await page.goto('/admin/expenses');
  await page.getByRole('button', { name: 'Add Expense' }).first().click();
  const againDialog = page.getByRole('dialog', { name: 'Add Expense' });
  await expect(
    againDialog.getByRole('combobox', { name: /^Category/ }).locator('option', { hasText: renamed }),
  ).toHaveCount(1);
  await againDialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(againDialog).toBeHidden();

  // Delete the never-used category: the confirmation names it, Cancel has focus, and the row leaves.
  await page.goto(COMPANY_TAB);
  await expect(page.getByRole('table', { name: 'Expense categories' })).toBeVisible();
  await press(page, renamedRow.getByRole('button', { name: `Delete ${renamed}` }));
  const confirm = page.getByRole('dialog', { name: `Delete the ${renamed} category?` });
  await expect(confirm).toBeVisible();
  await expect(
    confirm.getByText("No expense has ever used it, so it can be deleted. This can't be undone."),
  ).toBeVisible();
  await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expectNoAxeViolations(page);
  await confirm.getByRole('button', { name: 'Delete Category' }).click();
  await expect(confirm).toBeHidden();
  await expect(renamedRow).toHaveCount(0);
  await expect(page.getByText('Category deleted', { exact: true })).toBeVisible();
  // Focus moved to another row's Edit button (the next row, which is whichever category follows it).
  await expect(page.locator(':focus')).toHaveAttribute('title', /^Edit /);
  await expectNoAxeViolations(page);
});

test('@settings-order-lists a Manager adds a product type in Blue, renames it, retires it, uses it again and deletes it, and the other tabs open', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().slice(0, 8);
  const manager = await createStaff(request, 'Manager');
  const name = `E2E type ${token}`;
  const renamed = `E2E type ${token} v2`;
  await signInAs(page, request, manager);
  await page.goto('/admin/sessions');
  await expect(page.getByRole('heading', { level: 1, name: 'Signed-in devices' })).toBeVisible();

  // Settings opens on Product Types: four tabs in order, the active one selected, the Items count column, no tab in the URL.
  await openSettingsHome(page);
  expect(await page.getByRole('tab').allTextContents()).toEqual([
    'Product Types',
    'Payment Methods',
    'Order Expense Categories',
    'Company Expense Categories',
  ]);
  await expect(page.getByRole('tab', { name: 'Product Types' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { level: 2, name: 'Product Types' })).toBeVisible();
  await expect(page.locator('tbody td[data-label="Items"]').first()).toBeVisible();
  await expectNoAxeViolations(page);

  // Add a product type in Blue: the new row is Active with 0 items.
  const add = page.getByRole('button', { name: 'Add Product Type' });
  await press(page, add);
  const addDialog = page.getByRole('dialog', { name: 'Add Product Type' });
  await expect(addDialog).toBeVisible();
  await expect(addDialog.getByRole('textbox', { name: /^Name/ })).toBeFocused();
  await addDialog.getByRole('textbox', { name: /^Name/ }).fill(name);
  await chooseColor(addDialog, 'Blue');
  await expect(addDialog.getByRole('radio', { name: 'Blue' })).toHaveAccessibleDescription(name);
  await expectNoAxeViolations(page);
  const added = categoryAdded(page, 'product-types');
  await addDialog.getByRole('button', { name: 'Save Product Type' }).click();
  await added;
  await expect(addDialog).toBeHidden();
  await expect(page.getByText('Product type added', { exact: true })).toBeVisible();
  await expect(page.getByText(`${name} is ready to use.`)).toBeVisible();
  await expect(add).toBeFocused();
  const row = rowFor(page, name);
  await expect(row).toHaveCount(1);
  await expect(row.locator('td[data-label="Status"]')).toContainText('Active');
  await expect(row.locator('td[data-label="Items"]')).toHaveText('0');

  // Rename and recolor it from its row.
  await press(page, row.getByRole('button', { name: `Edit ${name}` }));
  const editDialog = page.getByRole('dialog', { name: 'Edit Product Type' });
  await expect(editDialog).toBeVisible();
  const nameField = editDialog.getByRole('textbox', { name: /^Name/ });
  await expect(nameField).toHaveValue(name);
  await expect(editDialog.getByRole('radio', { name: 'Blue' })).toBeChecked();
  await nameField.fill(renamed);
  await chooseColor(editDialog, 'Plum');
  await editDialog.getByRole('button', { name: 'Save Changes' }).click();
  await expect(editDialog).toBeHidden();
  await expect(page.getByText('Product type updated', { exact: true })).toBeVisible();
  const renamedRow = rowFor(page, renamed);
  await expect(renamedRow).toHaveCount(1);
  await expect(renamedRow.getByRole('button', { name: `Edit ${renamed}` })).toBeFocused();

  // Retire it, use it again.
  await press(page, renamedRow.getByRole('button', { name: `Retire ${renamed}` }));
  await expect(renamedRow.locator('td[data-label="Status"]')).toContainText('Retired');
  await expect(renamedRow.getByRole('button', { name: `Use ${renamed} again` })).toBeFocused();
  await expect(page.getByText('Product type retired', { exact: true })).toBeVisible();
  await expect(page.getByText(`${renamed} no longer shows in the item form. Past items keep it.`)).toBeVisible();
  await press(page, renamedRow.getByRole('button', { name: `Use ${renamed} again` }));
  await expect(renamedRow.locator('td[data-label="Status"]')).toContainText('Active');
  await expect(page.getByText('Product type back in use', { exact: true })).toBeVisible();
  await expect(page.getByText(`${renamed} shows in the item form again.`)).toBeVisible();

  // Delete it: the confirmation names it, Cancel has focus, and the row leaves.
  await press(page, renamedRow.getByRole('button', { name: `Delete ${renamed}` }));
  const confirm = page.getByRole('dialog', { name: `Delete the ${renamed} product type?` });
  await expect(confirm).toBeVisible();
  await expect(
    confirm.getByText("No order item has ever used it, so it can be deleted. This can't be undone."),
  ).toBeVisible();
  await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expectNoAxeViolations(page);
  await confirm.getByRole('button', { name: 'Delete Product Type' }).click();
  await expect(confirm).toBeHidden();
  await expect(renamedRow).toHaveCount(0);
  await expect(page.getByText('Product type deleted', { exact: true })).toBeVisible();

  // The other tabs open on the tab in the URL, each with its own card.
  await page.getByRole('tab', { name: 'Payment Methods' }).click();
  await expect(page).toHaveURL(/\/admin\/settings\?tab=payment-methods$/);
  await expect(page.getByRole('table', { name: 'Payment methods' })).toBeVisible();
  await expect(page.locator('tbody td[data-label="Payments"]').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Order Expense Categories' }).click();
  await expect(page.getByRole('table', { name: 'Order expense categories' })).toBeVisible();
  await expect(rowFor(page, 'Others')).toContainText('Always listed last');
  await expect(rowFor(page, 'Others').getByRole('button')).toHaveCount(1);
  await expectNoAxeViolations(page);

  // The Company Expense Categories tab is the Phase 6 card.
  await page.getByRole('tab', { name: 'Company Expense Categories' }).click();
  await expect(page).toHaveURL(/\/admin\/settings\?tab=expense-categories$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Company Expense Categories' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Expense categories' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Category' })).toBeVisible();
  await expectNoAxeViolations(page);
});

test('@settings a used category and Others have no Delete, and a used category can only be retired', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const token = randomUUID().slice(0, 8);
  const manager = await createStaff(request, 'Manager');
  // Rent is used by this expense, whatever earlier runs left behind.
  await createExpense(request, {
    paidByUserId: manager.userId,
    recordedByUserId: manager.userId,
    date: manilaDate(-1),
    categoryId: RENT,
    description: `E2E settings ${token}`,
    amount: 55,
  });
  await signInAs(page, request, manager);
  await page.goto(COMPANY_TAB);
  await expect(page.getByRole('table', { name: 'Expense categories' })).toBeVisible();

  const rent = rowFor(page, 'Rent').first();
  await expect(rent.getByRole('button', { name: 'Edit Rent' })).toBeVisible();
  await expect(rent.getByRole('button', { name: 'Retire Rent' })).toBeVisible();
  await expect(rent.getByRole('button', { name: /^Delete / })).toHaveCount(0);
  expect(Number((await rent.locator('td[data-label="Expenses"]').textContent()) ?? '0')).toBeGreaterThan(0);

  const others = rowFor(page, 'Others');
  await expect(others.getByRole('button')).toHaveCount(1);
  await expect(others.getByRole('button', { name: 'Edit Others' })).toBeVisible();

  // Others may change color but not name: the name is read-only, with its hint, and focus opens on the color.
  await press(page, others.getByRole('button', { name: 'Edit Others' }));
  const dialog = page.getByRole('dialog', { name: 'Edit Category' });
  await expect(dialog.getByRole('textbox', { name: /^Name/ })).toHaveValue('Others');
  await expect(dialog.getByRole('textbox', { name: /^Name/ })).toHaveAttribute('readonly', '');
  await expect(dialog.getByText("The Others name can't change, so it always sorts last.")).toBeVisible();
  await expect(dialog.locator('input[name="tone"]:checked')).toBeFocused();
  await expectNoAxeViolations(page);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
});

test('@settings an Admin has no Settings item and is sent away from /admin/settings', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(90_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Admin'));

  await page.goto('/admin/settings');

  // The route's loader sends an Admin to /admin; the page never shows.
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toHaveCount(0);
  await expect(page.getByRole('table', { name: 'Expense categories' })).toHaveCount(0);

  await page.goto('/admin/sessions');
  await expect(page.getByRole('heading', { level: 1, name: 'Signed-in devices' })).toBeVisible();
  await expect(page.locator('nav[aria-label="Admin"] a', { hasText: 'Settings' })).toHaveCount(0);
  await expect(page.locator('nav[aria-label="Admin"] a', { hasText: 'Audit Log' })).toHaveCount(0);
});

test('@settings the page and its dialogs fit a 320 px phone: nothing scrolls sideways and the buttons stay in view', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  await signInAs(page, request, manager);
  await page.setViewportSize({ width: 320, height: 568 });
  // The first tab, Product Types: the tab strip scrolls inside itself, so the page does not scroll sideways.
  await page.goto('/admin/settings');
  await expect(page.getByRole('table', { name: 'Product types' })).toBeVisible();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expect(page.getByRole('button', { name: 'Add Product Type' })).toBeInViewport();
  await expectNoAxeViolations(page);

  await page.goto(COMPANY_TAB);
  await expect(page.getByRole('table', { name: 'Expense categories' })).toBeVisible();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  // The Add Category button sits under the hint at full width on a phone.
  await expect(page.getByRole('button', { name: 'Add Category' })).toBeInViewport();

  await press(page, page.getByRole('button', { name: 'Add Category' }));
  const dialog = page.getByRole('dialog', { name: 'Add Category' });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole('textbox', { name: /^Name/ })
    .fill(`E2E phone ${randomUUID().slice(0, 8)} ${'long name '.repeat(3)}`.slice(0, 40));
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  expect(
    await page.evaluate(
      `(() => { const panel = document.querySelector('[role="dialog"]'); return panel !== null && panel.scrollWidth <= panel.clientWidth; })()`,
    ),
  ).toBe(true);
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInViewport();
  await expect(dialog.getByRole('button', { name: 'Save Category' })).toBeInViewport();
  await expectNoAxeViolations(page);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
});

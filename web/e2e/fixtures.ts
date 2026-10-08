// RED placeholder: the shared E2E fixture is built in the GREEN step of plan 02-06 Task 1.
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

export { expect, test };

export async function expectNoAxeViolations(page: Page): Promise<void> {
  await Promise.resolve(page);
}

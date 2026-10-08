// Fixture self-tests (QUAL-04): each E2E guard must catch its finding in every engine. The deliberately bad pages exist
// only here, served by page.route under /__e2e-fixture/. Nothing is added to the app or the server. Each test takes
// (and so clears) the record, so the guard's own end-of-test check passes.
import type { Page } from '@playwright/test';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';

const FIXTURE = '/__e2e-fixture';

function html(body: string, head = ''): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>E2E fixture</title><link rel="icon" type="image/svg+xml" href="/mark.svg">${head}</head><body><main><h1>E2E fixture</h1>${body}</main></body></html>`;
}

// The page carries the real strict policy, copied from the host's own `/` response, so the browser enforces exactly
// what production sends.
async function strictCsp(page: Page): Promise<string> {
  const response = await page.request.get('/');
  const policy = response.headers()['content-security-policy'];
  expect(policy).toContain("script-src 'self'");
  return policy ?? '';
}

async function servePage(page: Page, name: string, body: string, head = ''): Promise<void> {
  const policy = await strictCsp(page);
  await page.route(`**${FIXTURE}/${name}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      headers: { 'Content-Security-Policy': policy },
      body: html(body, head),
    }),
  );
}

test('@fixture console error is caught', async ({ page, guard }) => {
  await servePage(page, 'console', '', `<script src="${FIXTURE}/console.js"></script>`);
  await page.route(`**${FIXTURE}/console.js`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/javascript; charset=utf-8',
      body: "console.error('e2e fixture: deliberate console error');",
    }),
  );

  await page.goto(`${FIXTURE}/console`);
  const record = await guard.take();

  const errors = record.console.filter((message) => message.startsWith('console.error: '));
  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain('e2e fixture: deliberate console error');
});

test('@fixture CSP violation is caught', async ({ page, guard }) => {
  await servePage(page, 'csp', "<script>document.title = 'inline script ran';</script>");

  await page.goto(`${FIXTURE}/csp`);
  const record = await guard.take();

  expect(await page.title()).toBe('E2E fixture');
  expect(record.cspViolations.map((violation) => violation.directive)).toContainEqual(
    expect.stringMatching(/^script-src/),
  );
});

test('@fixture axe violation is caught', async ({ page, guard }) => {
  await servePage(page, 'axe', '<img src="/mark.svg">');

  await page.goto(`${FIXTURE}/axe`);

  await expect(expectNoAxeViolations(page)).rejects.toThrow(/image-alt/);
  await guard.take();
});

test('@fixture failed response is caught', async ({ page, guard }) => {
  await servePage(page, 'missing', `<img src="${FIXTURE}/missing.png" alt="">`);
  await page.route(`**${FIXTURE}/missing.png`, (route) => route.fulfill({ status: 404, body: '' }));

  await page.goto(`${FIXTURE}/missing`);
  const record = await guard.take();

  expect(record.failedResponses).toContainEqual(
    expect.stringMatching(/^404 GET https:\/\/localhost:5199\/__e2e-fixture\/missing\.png$/),
  );
});

// Route-served static hosting for the look-equality proof (WEB-02, D-33, threat T-02-37). Both sides of the parity
// harness are fulfilled by Playwright's page.route from their dist folders on https origins, so the suite opens no
// port and needs no API host or database (CLAUDE.md shared machine). Every response carries the production
// Content-Security-Policy, read at run time from the server source, so the harness can never drift to a weaker policy
// than the one the app ships with. Nothing here bypasses the CSP.
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

/** The reference side (frozen approved spec). The implementation side (plan 02-14) uses https://app.parity.test. */
export const REFERENCE_ORIGIN = 'https://reference.parity.test';

/** The reference build output (git-ignored), written by visual/vite.reference.config.ts. */
export const REFERENCE_DIST = fileURLToPath(new URL('../.reference-dist', import.meta.url));

/** The C# file that owns the production policy (SEC-01). */
export const SECURITY_HEADERS_SOURCE = fileURLToPath(
  new URL('../../src/Csps.Server/Http/SecurityHeadersMiddleware.cs', import.meta.url),
);

const CSP_CONSTANT = /\bconst\s+string\s+StrictCsp\s*=\s*"([^"\\]+)"\s*;/;

/**
 * The `StrictCsp` constant of SecurityHeadersMiddleware, parsed from the C# source. Throws when the constant is missing
 * or is no longer one plain string literal, so a refactor of the server can never silently serve the harness without a
 * policy.
 */
export function readStrictCsp(sourcePath: string = SECURITY_HEADERS_SOURCE): string {
  const match = CSP_CONSTANT.exec(readFileSync(sourcePath, 'utf8'));
  const policy = match?.[1];
  if (policy === undefined) {
    throw new Error(`Could not read the StrictCsp constant (one plain string literal) from ${sourcePath}.`);
  }
  return policy;
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

/** The Content-Type for a served file, by extension; unknown extensions are served as opaque bytes. */
export function contentTypeFor(file: string): string {
  return CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * The file in `distDir` that answers a request path, or null for a 404. A path without a file extension is a page
 * path and gets index.html (the SPA fallback). A path that decodes to anything outside `distDir` is a 404, never a read.
 */
export function resolveDistFile(distDir: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const requested = path.posix.extname(decoded) === '' ? '/index.html' : decoded;
  const root = path.resolve(distDir);
  const file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(`${root}${path.sep}`)) {
    return null;
  }
  return existsSync(file) && statSync(file).isFile() ? file : null;
}

export interface RouteDistOptions {
  /** The https origin the page loads from, for example REFERENCE_ORIGIN. */
  readonly origin: string;
  /** The built folder to serve. */
  readonly distDir: string;
  /** The policy to send; defaults to the production StrictCsp. */
  readonly csp?: string;
}

/**
 * Serves `distDir` on `origin` for this page through page.route. Same-origin requests are fulfilled from disk with the
 * real CSP and `X-Content-Type-Options: nosniff`; any other request is aborted, so nothing reaches the network.
 */
export async function routeDist(page: Page, options: RouteDistOptions): Promise<void> {
  const { origin, distDir } = options;
  if (!existsSync(path.join(distDir, 'index.html'))) {
    throw new Error(`${distDir} has no index.html. Build it first: npm --prefix web run parity.`);
  }
  const headers = {
    'content-security-policy': options.csp ?? readStrictCsp(),
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
  };
  await page.route(
    () => true,
    async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) {
        await route.abort('blockedbyclient');
        return;
      }
      const file = resolveDistFile(distDir, url.pathname);
      if (file === null) {
        await route.fulfill({
          status: 404,
          headers: { ...headers, 'content-type': 'text/plain; charset=utf-8' },
          body: 'Not found',
        });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: { ...headers, 'content-type': contentTypeFor(file) },
        body: readFileSync(file),
      });
    },
  );
}

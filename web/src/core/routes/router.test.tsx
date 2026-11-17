// Lazy discovery of the admin and dev route tables (D-42): the public entry holds neither table, and the router asks for
// one on the first navigation under its first path segment.
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it, vi } from 'vitest';
import { collectConsole } from '@/test/consoleGuard';
import { ERROR_BOUNDARY_COPY } from './ErrorBoundary';
import { discoverRoutes, QUERY_ROUTE_ID, routeDiscovery, routes } from './router';

vi.setConfig({ testTimeout: 15_000 });

function Probe() {
  return <p>Probe page</p>;
}

const probeRoutes: RouteObject[] = [{ path: 'admin/probe', Component: Probe }];

/** Every route in the tree, depth first. */
function walk(tree: readonly RouteObject[]): RouteObject[] {
  return tree.flatMap((route) => [route, ...walk(route.children ?? [])]);
}

function openWith(load: () => Promise<RouteObject[]>, path: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [path],
    patchRoutesOnNavigation: routeDiscovery([{ segment: 'admin', load }]),
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe('the app route tree (D-42)', () => {
  it('holds no route whose path is or starts with admin or dev', () => {
    const offending = walk(routes)
      .map((route) => route.path)
      .filter((path) => path !== undefined && /^(admin|dev)(\/|$)/.test(path));
    expect(offending).toEqual([]);
  });

  it('holds one pathless route with the query route id, for the discovered tables to patch into', () => {
    const queryRoutes = walk(routes).filter((route) => route.id === QUERY_ROUTE_ID);
    expect(queryRoutes).toHaveLength(1);
    expect(queryRoutes[0]?.path).toBeUndefined();
  });
});

describe('routeDiscovery (D-42)', () => {
  it('loads the table once on the first navigation under its segment and renders its route', async () => {
    const load = vi.fn(() => Promise.resolve(probeRoutes));
    openWith(load, '/admin/probe');

    expect(await screen.findByText('Probe page', {}, { timeout: 10_000 })).toBeVisible();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it.each(['/', '/contact', '/privacy'])('never loads a table for the public path %s', async (path) => {
    const load = vi.fn(() => Promise.resolve(probeRoutes));
    openWith(load, path);

    expect(await screen.findByRole('main', {}, { timeout: 10_000 })).toBeVisible();
    expect(load).not.toHaveBeenCalled();
  });

  it('never loads a table for an unknown public path: it shows the public 404 page', async () => {
    const load = vi.fn(() => Promise.resolve(probeRoutes));
    openWith(load, '/no-such-page');

    expect(await screen.findByRole('heading', { level: 1, name: 'Out of bounds.' }, { timeout: 10_000 })).toBeVisible();
    expect(load).not.toHaveBeenCalled();
  });

  it('shows the admin error screen, with no public banner, when the table fails to load', async () => {
    const chunkError = new TypeError('Failed to fetch dynamically imported module: /assets/routes-gone.js');
    const load = vi.fn(() => Promise.reject(chunkError));
    openWith(load, '/admin/orders');

    const main = await screen.findByRole('main', {}, { timeout: 10_000 });
    expect(await within(main).findByRole('heading', { level: 2, name: ERROR_BOUNDARY_COPY.title })).toBeVisible();
    expect(within(main).getByText(ERROR_BOUNDARY_COPY.adminBody)).toBeInTheDocument();
    expect(within(main).getByRole('button', { name: ERROR_BOUNDARY_COPY.reload })).toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();

    const reports = collectConsole();
    expect(reports.length).toBeGreaterThan(0);
    for (const report of reports) {
      expect(report.args.some((argument) => argument === chunkError)).toBe(true);
    }
  });
});

describe('the app discoverRoutes in a build without dev routes (D-20, D-42)', () => {
  it.each(['/dev/components', '/dev/public'])('lets %s fall through to the public 404 page', async (path) => {
    const router = createMemoryRouter(routes, { initialEntries: [path], patchRoutesOnNavigation: discoverRoutes });
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Out of bounds.' }, { timeout: 10_000 })).toBeVisible();
  });
});

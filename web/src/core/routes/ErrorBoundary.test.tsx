import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { collectConsole } from '@/test/consoleGuard';
import { ERROR_BOUNDARY_COPY, RootErrorBoundary, RouteErrorBoundary } from './ErrorBoundary';
import { lazyRoute, routes } from './router';

const CRASH = new Error('Kaboom in a render');

function Crash(): never {
  throw CRASH;
}

/** A route module whose component crashes while rendering. */
const crashingModule = () => Promise.resolve({ Component: Crash });

interface TreeOptions {
  /** Replaces the layout route's fields (for example its lazy module). */
  readonly layout?: Partial<RouteObject>;
  /** Replaces the page route's fields. */
  readonly page?: Partial<RouteObject>;
}

/** The app's own route tree with the layout or page swapped for a failing one; every boundary stays as defined. */
function appTree({ layout, page }: TreeOptions): RouteObject[] {
  const root = routes[0];
  const layoutRoute = root?.children?.[0];
  const pageRoute = layoutRoute?.children?.[0];
  if (root === undefined || layoutRoute === undefined || pageRoute === undefined) {
    throw new Error('The app routes changed shape: expected root > layout > page.');
  }
  return [
    {
      ...root,
      children: [{ ...layoutRoute, ...layout, children: [{ ...pageRoute, ...page } as RouteObject] } as RouteObject],
    } as RouteObject,
  ];
}

async function renderTree(tree: RouteObject[], path = '/products') {
  const router = createMemoryRouter(tree, { initialEntries: [path] });
  const view = render(<RouterProvider router={router} />);
  // The first render in this file transforms the lazy route modules on demand; under the parallel full run that has
  // taken just over the default 1 s (plan 02-31), so the wait allows longer. A missing screen still fails.
  await screen.findByRole('heading', { name: ERROR_BOUNDARY_COPY.title }, { timeout: 5000 });
  return view;
}

/** Development error reports may only be about the provoked failure: React's and React Router's own dev output. */
function expectOnlyReportsOf(error: Error): void {
  const calls = collectConsole();
  for (const call of calls) {
    expect(call.args.some((argument) => argument === error)).toBe(true);
  }
}

function expectErrorScreen(region: HTMLElement): void {
  expect(within(region).getByRole('heading', { level: 2, name: 'Something went wrong' })).toBeInTheDocument();
  expect(within(region).getByText("This page couldn't load. Reload the page to try again.")).toBeInTheDocument();
  expect(within(region).getByRole('button', { name: 'Reload Page' })).toBeInTheDocument();
}

describe('the route error boundary (WEB-05)', () => {
  it('shows "Something went wrong" and "Reload Page" inside main when a page crashes, keeping the header and footer', async () => {
    await renderTree(appTree({ page: { lazy: crashingModule } }));

    expectErrorScreen(screen.getByRole('main'));
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expectOnlyReportsOf(CRASH);
  });

  it('shows the same screen when a page chunk fails to load (a deploy replaced it)', async () => {
    const chunkError = new TypeError('Failed to fetch dynamically imported module: /assets/Gone-abc123.js');
    await renderTree(appTree({ page: { lazy: lazyRoute(() => Promise.reject(chunkError)) } }));

    expectErrorScreen(screen.getByRole('main'));
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expectOnlyReportsOf(chunkError);
  });

  it('never shows the error text or stack to the visitor (CWE-209)', async () => {
    const { container } = await renderTree(appTree({ page: { lazy: crashingModule } }));
    expect(container).not.toHaveTextContent('Kaboom');
    collectConsole();
  });

  it('has no axe violations', async () => {
    const { container } = await renderTree(appTree({ page: { lazy: crashingModule } }));
    collectConsole();
    await expectNoAxeViolations(container);
  });

  it('"Reload Page" reloads the page', async () => {
    const reload = vi.fn();
    await renderTree(
      appTree({
        page: { lazy: crashingModule, ErrorBoundary: () => <RouteErrorBoundary reload={reload} /> },
      }),
    );
    collectConsole();

    await userEvent.click(screen.getByRole('button', { name: 'Reload Page' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('the root error boundary (WEB-05)', () => {
  it('renders a minimal Blush page root with the same content when the layout itself fails', async () => {
    const { container } = await renderTree(appTree({ layout: { lazy: crashingModule } }));

    const root = container.firstElementChild;
    expect(root).toHaveAttribute('data-theme', 'light');
    expect(root?.className.split(' ')).toEqual(expect.arrayContaining(['@container/pg', 'bg-bg', 'text-ink']));
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expectErrorScreen(screen.getByRole('main'));
    expectOnlyReportsOf(CRASH);
  });

  it('catches a layout chunk that fails to load', async () => {
    const chunkError = new TypeError('Failed to fetch dynamically imported module: /assets/PublicLayout-x.js');
    await renderTree(appTree({ layout: { lazy: lazyRoute(() => Promise.reject(chunkError)) } }));
    expectErrorScreen(screen.getByRole('main'));
    expectOnlyReportsOf(chunkError);
  });

  it('has no axe violations', async () => {
    const { container } = await renderTree(appTree({ layout: { lazy: crashingModule } }));
    collectConsole();
    await expectNoAxeViolations(container);
  });

  it('"Reload Page" reloads the page', async () => {
    const reload = vi.fn();
    const tree = appTree({ layout: { lazy: crashingModule } }).map((route) => ({
      ...route,
      ErrorBoundary: () => <RootErrorBoundary reload={reload} />,
    })) as RouteObject[];
    await renderTree(tree);
    collectConsole();

    await userEvent.click(screen.getByRole('button', { name: 'Reload Page' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('the boundaries in the route tree', () => {
  it('puts RootErrorBoundary on the root route and RouteErrorBoundary on the layout children', () => {
    const root = routes[0];
    expect(root?.ErrorBoundary).toBe(RootErrorBoundary);
    expect(root?.children?.[0]?.ErrorBoundary).toBeUndefined();
    for (const child of root?.children?.[0]?.children ?? []) {
      expect(child.ErrorBoundary).toBe(RouteErrorBoundary);
    }
  });

  it('lazyRoute passes a loaded module through and turns a failed load into a component that throws that error', async () => {
    const loaded = { Component: () => null };
    await expect(lazyRoute(() => Promise.resolve(loaded))()).resolves.toBe(loaded);

    const failure = new TypeError('Failed to fetch dynamically imported module: /assets/Gone-abc123.js');
    const failed = await lazyRoute(() => Promise.reject(failure))();
    const Component = failed.Component as () => never;
    expect(() => Component()).toThrow(failure);
  });

  it('re-renders from the React Compiler memo cache, and a new reload takes over (L-13)', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { container, rerender } = render(<RootErrorBoundary reload={first} />);
    const html = container.innerHTML;
    rerender(<RootErrorBoundary reload={first} />);
    expect(container.innerHTML).toBe(html);
    rerender(<RootErrorBoundary reload={second} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reload Page' }));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    rerender(<RouteErrorBoundary reload={first} />);
    rerender(<RouteErrorBoundary reload={first} />);
    rerender(<RouteErrorBoundary reload={second} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reload Page' }));
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('uses the Copywriting strings', () => {
    expect(ERROR_BOUNDARY_COPY).toEqual({
      title: 'Something went wrong',
      publicBody: "This page couldn't load. Reload the page to try again.",
      adminBody: "This screen couldn't load. Reload the page to try again. Your saved data is safe.",
      reload: 'Reload Page',
    });
  });
});

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createBrowserRouter,
  createMemoryRouter,
  MemoryRouter,
  Outlet,
  useOutletContext,
  type RouteObject,
} from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createListParams } from './createListParams';
import { literalParser, pageParser, pageSizeParser, searchParser } from './parsers';
import UrlStateLayout from './UrlStateLayout';

const useDemoParams = createListParams({
  page: pageParser,
  size: pageSizeParser,
  q: searchParser,
  status: literalParser(['all', 'ready', 'done'], 'all'),
});

function DemoList() {
  const [{ page, size, status }, { setPage, setFilter, setPageSize }] = useDemoParams();
  return (
    <div>
      <p>
        Page {page}, size {size}, status {status}
      </p>
      <button
        type="button"
        onClick={() => {
          setPage(page + 1);
        }}
      >
        Next page
      </button>
      <button
        type="button"
        onClick={() => {
          setPage(1);
        }}
      >
        First page
      </button>
      <button
        type="button"
        onClick={() => {
          setFilter('status', 'ready');
        }}
      >
        Ready only
      </button>
      <button
        type="button"
        onClick={() => {
          setFilter('status', 'done');
          setPageSize(50);
        }}
      >
        Done, 50 a page
      </button>
    </div>
  );
}

/** UrlStateLayout as the lazy, pathless layout route above a list route, as the app mounts it above the admin routes. */
const routes: RouteObject[] = [
  {
    HydrateFallback: () => null,
    children: [
      {
        lazy: async () => {
          const module = await import('./UrlStateLayout');
          return { Component: module.default };
        },
        children: [{ path: '/orders', Component: DemoList }],
      },
    ],
  },
];

async function renderApp() {
  const router = createBrowserRouter(routes);
  render(<RouterProvider router={router} />);
  await screen.findByText(/^Page /);
  return router;
}

// nuqs keeps `shallow: true` (WEB-10), so it writes the browser history directly and React Router's own location is
// not told (L-16): the browser location is what refresh, a bookmark and Back read, and it is what these tests assert.
describe('UrlStateLayout in a data router', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/orders');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('setPage(2) pushes ?page=2: window.location.search changes and history grows by one', async () => {
    await renderApp();
    const before = window.history.length;
    expect(screen.getByText('Page 1, size 20, status all')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(screen.getByText('Page 2, size 20, status all')).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.search).toBe('?page=2');
    });
    expect(window.history.length).toBe(before + 1);
  });

  it('a filter change replaces the entry (history length unchanged) and resets the page', async () => {
    window.history.replaceState(null, '', '/orders?page=3');
    await renderApp();
    const before = window.history.length;

    await userEvent.click(screen.getByRole('button', { name: 'Ready only' }));

    await waitFor(() => {
      expect(window.location.search).toBe('?status=ready');
    });
    expect(screen.getByText('Page 1, size 20, status ready')).toBeInTheDocument();
    expect(window.history.length).toBe(before);
  });

  it('two setters in the same tick produce one URL update', async () => {
    window.history.replaceState(null, '', '/orders?page=3');
    await renderApp();
    const pushState = vi.spyOn(window.history, 'pushState');
    const replaceState = vi.spyOn(window.history, 'replaceState');

    await userEvent.click(screen.getByRole('button', { name: 'Done, 50 a page' }));

    await waitFor(() => {
      expect(window.location.search).toBe('?size=50&status=done');
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(pushState).not.toHaveBeenCalled();
  });

  it('restores the previous page on Back', async () => {
    await renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => {
      expect(window.location.search).toBe('?page=2');
    });

    act(() => {
      window.history.back();
    });

    await waitFor(() => {
      expect(screen.getByText('Page 1, size 20, status all')).toBeInTheDocument();
    });
    expect(window.location.search).toBe('');
  });

  it('applies the shared key order and defaults: page leads, page 1 leaves the URL', async () => {
    window.history.replaceState(null, '', '/orders?status=done&page=3');
    await renderApp();
    expect(screen.getByText('Page 3, size 20, status done')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => {
      expect(window.location.search).toBe('?page=4&status=done');
    });

    await userEvent.click(screen.getByRole('button', { name: 'First page' }));
    await waitFor(() => {
      expect(window.location.search).toBe('?status=done');
    });
  });

  it('normalizes a hostile shared link once on arrival, without adding a history entry', async () => {
    window.history.replaceState(null, '', '/orders?status=bogus&size=9999&page=0&q=%20jersey');
    const before = window.history.length;
    await renderApp();
    expect(screen.getByText('Page 1, size 20, status all')).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.search).toBe('?q=jersey');
    });
    expect(window.history.length).toBe(before);
  });

  it('reads list params from a React Router navigation (a link from another screen)', async () => {
    const router = await renderApp();
    await act(async () => {
      await router.navigate('/orders?page=5&status=done');
    });
    expect(screen.getByText('Page 5, size 20, status done')).toBeInTheDocument();
    expect(window.location.search).toBe('?page=5&status=done');
  });

  it('adds no markup of its own, on first render or re-render', () => {
    const { container, rerender } = render(
      <MemoryRouter>
        <UrlStateLayout />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(
      <MemoryRouter>
        <UrlStateLayout />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('UrlStateLayout and the Outlet context of the layout above it', () => {
  it('hands that context on to the page below it, as the admin layout does with the theme (PROF-04)', async () => {
    function Parent() {
      return <Outlet context={{ theme: 'dark' }} />;
    }
    function Page() {
      const context = useOutletContext<{ theme: string }>();
      return <p>Theme {context.theme}</p>;
    }
    const router = createMemoryRouter(
      [{ Component: Parent, children: [{ Component: UrlStateLayout, children: [{ path: '/x', Component: Page }] }] }],
      { initialEntries: ['/x'] },
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByText('Theme dark')).toBeInTheDocument();
  });

  it('gives a page under no layout context no context, as before', async () => {
    function Page() {
      const context: unknown = useOutletContext();
      return <p>{context === undefined || context === null ? 'No context' : 'Some context'}</p>;
    }
    const router = createMemoryRouter([{ Component: UrlStateLayout, children: [{ path: '/x', Component: Page }] }], {
      initialEntries: ['/x'],
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByText('No context')).toBeInTheDocument();
  });
});

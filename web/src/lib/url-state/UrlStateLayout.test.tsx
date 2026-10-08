import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createBrowserRouter, MemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { createListParams } from './createListParams';
import { literalParser, pageSizeParser, parseAsPage } from './parsers';
import UrlStateLayout from './UrlStateLayout';

const useDemoParams = createListParams({
  page: parseAsPage,
  pageSize: pageSizeParser,
  status: literalParser(['all', 'active', 'done'], 'all'),
});

function DemoList() {
  const [{ page, status }, { setPage }] = useDemoParams();
  return (
    <div>
      <p>
        Page {page}, status {status}
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
    </div>
  );
}

/** UrlStateLayout as a pathless layout route above a list route, as plan 15 mounts it above the admin routes. */
function renderApp() {
  const router = createBrowserRouter([
    { Component: UrlStateLayout, children: [{ path: '/orders', Component: DemoList }] },
  ]);
  render(<RouterProvider router={router} />);
  return router;
}

// nuqs keeps `shallow: true` (WEB-10), so it writes the browser history directly and React Router's own location is
// not told: the browser location is what refresh, a bookmark and Back read, and it is what these tests assert.
describe('UrlStateLayout', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/orders');
  });

  it('gives the list hook a URL: setPage(2) pushes ?page=2 onto the browser history', async () => {
    renderApp();
    const before = window.history.length;
    expect(screen.getByText('Page 1, status all')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(screen.getByText('Page 2, status all')).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.search).toBe('?page=2');
    });
    expect(window.history.length).toBe(before + 1);
  });

  it('restores the previous page on Back', async () => {
    renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => {
      expect(window.location.search).toBe('?page=2');
    });

    act(() => {
      window.history.back();
    });

    await waitFor(() => {
      expect(screen.getByText('Page 1, status all')).toBeInTheDocument();
    });
    expect(window.location.search).toBe('');
  });

  it('applies the shared defaults and key order: page 1 leaves the URL, page leads the other keys', async () => {
    window.history.replaceState(null, '', '/orders?status=done&page=3');
    renderApp();
    expect(screen.getByText('Page 3, status done')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => {
      expect(window.location.search).toBe('?page=4&status=done');
    });

    await userEvent.click(screen.getByRole('button', { name: 'First page' }));
    await waitFor(() => {
      expect(window.location.search).toBe('?status=done');
    });
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

  it('reads list params from a React Router navigation (a link from another screen)', async () => {
    const router = renderApp();
    await act(async () => {
      await router.navigate('/orders?page=5&status=done');
    });
    expect(screen.getByText('Page 5, status done')).toBeInTheDocument();
    expect(window.location.search).toBe('?page=5&status=done');
  });

  it('normalizes an invalid shared link once on arrival', async () => {
    window.history.replaceState(null, '', '/orders?size=9999&page=0&status=bogus');
    renderApp();
    const before = window.history.length;
    expect(screen.getByText('Page 1, status all')).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.search).toBe('');
    });
    expect(window.history.length).toBe(before);
  });
});

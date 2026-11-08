import { renderHook, waitFor } from '@testing-library/react';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { useStaffMoneyParams } from '@/modules/admin/hooks/useStaffMoneyParams';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { sessionResponse } from '@/test/sessionFixtures';

// One person's money page keeps its view in the URL (WEB-10, D-31, D-42; plan 10-19): the page, the rows per page and, for a Manager only,
// Show deleted. These follow the My Money rules: defaults stay out of the URL, an invalid value falls back and is removed with one replace.
// The page has no tabs, so a stray `tab` is dropped with one replace that keeps the rest.

type UrlUpdateSpy = ReturnType<typeof vi.fn<OnUrlUpdateFunction>>;

const ADMIN_USER = {
  id: '6a0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
  email: 'lito@example.ph',
  firstName: 'Lito',
  lastName: 'Santos',
  role: 'Admin',
};

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
});

afterEach(() => {
  clearSession();
});

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

function renderParams(searchParams = '') {
  const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NuqsTestingAdapter
      searchParams={searchParams}
      onUrlUpdate={onUrlUpdate}
      defaultOptions={URL_STATE_DEFAULTS}
      processUrlSearchParams={orderSearchParams}
      hasMemory
    >
      {children}
    </NuqsTestingAdapter>
  );
  return { ...renderHook(() => useStaffMoneyParams(), { wrapper }), onUrlUpdate };
}

function updates(onUrlUpdate: UrlUpdateSpy): { history: string; query: string }[] {
  return onUrlUpdate.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

describe('reading', () => {
  it('reads page 1, 20 rows and no Show deleted, and writes nothing to the URL when there are no parameters', async () => {
    const { result, onUrlUpdate } = renderParams('');

    expect(result.current[0]).toEqual({ page: 1, size: 20, deleted: null });
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('holds only page, size and deleted: no tab, and never a name or an email key', () => {
    const { result } = renderParams('?q=Liza&from=2026-10-01');

    expect(Object.keys(result.current[0]).sort()).toEqual(['deleted', 'page', 'size']);
  });

  it('reads page=3, size=50 and deleted=true for a Manager and writes nothing', async () => {
    const { result, onUrlUpdate } = renderParams('?page=3&size=50&deleted=true');

    expect(result.current[0]).toEqual({ page: 3, size: 50, deleted: 'true' });
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('falls back from size=7 to 20 and removes it with one replace', async () => {
    const { result, onUrlUpdate } = renderParams('?size=7');

    expect(result.current[0].size).toBe(20);
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it.each([['?deleted=false'], ['?deleted=1'], ['?page=zero']])(
    'falls back from %s and removes it with one replace',
    async (search) => {
      const { result, onUrlUpdate } = renderParams(search);

      expect(result.current[0]).toEqual({ page: 1, size: 20, deleted: null });
      await waitFor(() => {
        expect(onUrlUpdate).toHaveBeenCalled();
      });
      await settle();
      expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
    },
  );
});

describe('the Manager-only value and the stray tab (D-31, D-42)', () => {
  it('drops a stray tab=staff with one replace and keeps the page and the rows per page', async () => {
    const { result, onUrlUpdate } = renderParams('?tab=staff&page=2&size=10');

    expect(result.current[0]).toEqual({ page: 2, size: 10, deleted: null });
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    const written = updates(onUrlUpdate);
    expect(written).toHaveLength(1);
    expect(written[0]?.history).toBe('replace');
    expect([...new URLSearchParams(written[0]?.query).entries()].sort()).toEqual([
      ['page', '2'],
      ['size', '10'],
    ]);
  });

  it('shows an Admin no Show deleted at once and removes deleted=true from the URL with one replace', async () => {
    clearSession();
    acceptSession(sessionResponse({ user: ADMIN_USER }));
    const { result, onUrlUpdate } = renderParams('?deleted=true&page=2');

    expect(result.current[0]).toEqual({ page: 2, size: 20, deleted: null });
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?page=2' }]);
  });
});

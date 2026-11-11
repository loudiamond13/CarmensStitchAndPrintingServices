import { renderHook, waitFor } from '@testing-library/react';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { orderSearchParams, URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { useCleanStaffMoneyUrl } from '@/modules/admin/hooks/useCleanStaffMoneyUrl';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { sessionResponse } from '@/test/sessionFixtures';

// One person's money page cleans its URL (WEB-10, D-31, D-42; plan 10-19), and only that: it returns nothing, because the Ledger card reads
// the page, the rows per page and Show deleted itself. Defaults stay out of the URL, an invalid value is removed with one replace, and the
// page has no tabs, so a stray `tab` is dropped with one replace that keeps the rest.

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

const hook: () => unknown = useCleanStaffMoneyUrl;

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
  return {
    ...renderHook(
      () => {
        const returned = hook();
        return returned;
      },
      { wrapper },
    ),
    onUrlUpdate,
  };
}

function updates(onUrlUpdate: UrlUpdateSpy): { history: string; query: string }[] {
  return onUrlUpdate.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

describe('cleaning', () => {
  it('writes nothing to the URL when there are no parameters', async () => {
    const { onUrlUpdate } = renderParams('');

    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('returns nothing: the side effect is its only job', () => {
    const { result } = renderParams('?q=Liza&from=2026-10-01');

    expect(result.current).toBeUndefined();
  });

  it('writes nothing for page=3, size=50 and deleted=true', async () => {
    const { onUrlUpdate } = renderParams('?page=3&size=50&deleted=true');

    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('falls back from size=7 to 20 and removes it with one replace', async () => {
    const { onUrlUpdate } = renderParams('?size=7');

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it.each([['?deleted=false'], ['?deleted=1'], ['?page=zero']])(
    'falls back from %s and removes it with one replace',
    async (search) => {
      const { onUrlUpdate } = renderParams(search);

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
    const { onUrlUpdate } = renderParams('?tab=staff&page=2&size=10');

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
    const { onUrlUpdate } = renderParams('?deleted=true&page=2');

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?page=2' }]);
  });
});

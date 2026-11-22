// usePrivacyContact (D-13, D-29): the email is read only when a legal page uses the hook, and never comes from the boot block.
import { renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '@/test/msw';
import { putBootBlock, resetPublicData, demoSite } from '@/test/publicFixtures';
import { usePrivacyContact } from './usePrivacyContact';

const ROUTE = '*/api/v1/public/privacy-contact';

afterEach(() => {
  resetPublicData();
});

describe('usePrivacyContact', () => {
  it('requests nothing until the hook is used', async () => {
    let requests = 0;
    server.use(
      http.get(ROUTE, () => {
        requests += 1;
        return Response.json({ email: 'shop-private@example.test' });
      }),
    );

    await import('./usePrivacyContact');

    expect(requests).toBe(0);
  });

  it('starts loading, then holds the email', async () => {
    server.use(http.get(ROUTE, () => Response.json({ email: 'shop-private@example.test' })));

    const { result } = renderHook(() => usePrivacyContact());

    expect(result.current.status).toBe('loading');
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'success', data: { email: 'shop-private@example.test' } });
    });
  });

  it('holds a null email when none is stored', async () => {
    server.use(http.get(ROUTE, () => Response.json({ email: null })));

    const { result } = renderHook(() => usePrivacyContact());

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'success', data: { email: null } });
    });
  });

  it('ignores the boot block and asks the API', async () => {
    server.use(http.get(ROUTE, () => Response.json({ email: 'shop-private@example.test' })));
    putBootBlock(demoSite);

    const { result } = renderHook(() => usePrivacyContact());

    expect(result.current.status).toBe('loading');
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
  });

  it('a failed read is an error with a retry', async () => {
    server.use(http.get(ROUTE, () => new Response(null, { status: 500 })));

    const { result } = renderHook(() => usePrivacyContact());

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
  });
});

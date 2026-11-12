// useSiteQuery (D-42): the first read comes from the boot block with no request; a page without the block reads the API.
import { renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '@/test/msw';
import { answerSite, demoSite, putBootBlock, resetPublicData, siteFailureHandler } from '@/test/publicFixtures';
import { useSiteQuery } from './useSiteQuery';

afterEach(() => {
  resetPublicData();
});

describe('useSiteQuery', () => {
  it('reads the boot block and sends no request for it', () => {
    let requests = 0;
    server.use(
      http.get('*/api/v1/public/site', () => {
        requests += 1;
        return new Response(null, { status: 500 });
      }),
    );
    putBootBlock(demoSite);

    const { result } = renderHook(() => useSiteQuery());

    expect(result.current).toEqual({ status: 'success', data: demoSite });
    expect(requests).toBe(0);
  });

  it('with no boot block, loads GET /api/v1/public/site', async () => {
    answerSite(demoSite);

    const { result } = renderHook(() => useSiteQuery());

    expect(result.current.status).toBe('loading');
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'success', data: demoSite });
    });
  });

  it('a failed read is an error with a retry', async () => {
    server.use(siteFailureHandler(404));

    const { result } = renderHook(() => useSiteQuery());

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
  });
});

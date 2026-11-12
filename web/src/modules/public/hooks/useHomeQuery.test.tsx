// useHomeQuery (D-42): the first read comes from the home boot key with no request; a page without it reads the API.
import { renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '@/test/msw';
import {
  answerHome,
  demoHome,
  demoSite,
  homeFailureHandler,
  putBootBlock,
  resetPublicData,
} from '@/test/publicFixtures';
import { useHomeQuery } from './useHomeQuery';

afterEach(() => {
  resetPublicData();
});

describe('useHomeQuery', () => {
  it('reads the home boot key and sends no request for it', () => {
    let requests = 0;
    server.use(
      http.get('*/api/v1/public/home', () => {
        requests += 1;
        return new Response(null, { status: 500 });
      }),
    );
    putBootBlock(demoSite, undefined, demoHome);

    const { result } = renderHook(() => useHomeQuery());

    expect(result.current).toEqual({ status: 'success', data: demoHome });
    expect(requests).toBe(0);
  });

  it('with no boot block, loads GET /api/v1/public/home', async () => {
    answerHome(demoHome);

    const { result } = renderHook(() => useHomeQuery());

    expect(result.current.status).toBe('loading');
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'success', data: demoHome });
    });
  });

  it('a boot block with only the site still loads the home data from the API', async () => {
    answerHome(demoHome);
    putBootBlock(demoSite);

    const { result } = renderHook(() => useHomeQuery());

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'success', data: demoHome });
    });
  });

  it('a failed read is an error with a retry', async () => {
    server.use(homeFailureHandler(500));

    const { result } = renderHook(() => useHomeQuery());

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
  });
});

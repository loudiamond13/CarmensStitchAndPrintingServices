// useProductLinesQuery (D-42): the first read comes from the productLines boot key with no request; a page without it
// reads the API.
import { renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '@/test/msw';
import {
  answerProductLines,
  demoLines,
  demoSite,
  productLinesFailureHandler,
  putBootBlock,
  resetPublicData,
} from '@/test/publicFixtures';
import { useProductLinesQuery } from './useProductLinesQuery';

afterEach(() => {
  resetPublicData();
});

describe('useProductLinesQuery', () => {
  it('reads the productLines boot key and sends no request for it', () => {
    let requests = 0;
    server.use(
      http.get('*/api/v1/public/product-lines', () => {
        requests += 1;
        return new Response(null, { status: 500 });
      }),
    );
    putBootBlock(demoSite, demoLines);

    const { result } = renderHook(() => useProductLinesQuery());

    expect(result.current).toEqual({ status: 'success', data: demoLines });
    expect(requests).toBe(0);
  });

  it('with no boot block, loads GET /api/v1/public/product-lines', async () => {
    answerProductLines(demoLines);

    const { result } = renderHook(() => useProductLinesQuery());

    expect(result.current.status).toBe('loading');
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'success', data: demoLines });
    });
  });

  it('a boot block with only the site still loads the lines from the API', async () => {
    answerProductLines(demoLines);
    putBootBlock(demoSite);

    const { result } = renderHook(() => useProductLinesQuery());

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'success', data: demoLines });
    });
  });

  it('a failed read is an error with a retry', async () => {
    server.use(productLinesFailureHandler(500));

    const { result } = renderHook(() => useProductLinesQuery());

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
  });
});

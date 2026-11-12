import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidatePublicContent } from '@/lib/public-data/publicResource';
import { createQueryClient } from '@/lib/query/queryClient';
import {
  productLineKey,
  productLinesKey,
  useCreateProductLine,
  useDeleteProductLine,
  useMoveProductLine,
  useProductLineListQuery,
  useProductLineQuery,
  useSetProductLineShown,
  useUpdateProductLine,
} from '@/modules/admin/hooks/useProductLineQueries';
import type { ProductLineRequest } from '@/modules/admin/services/productLinesService';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { server } from '@/test/msw';
import { sessionResponse } from '@/test/sessionFixtures';
import {
  demoLineDetail,
  LINE_IDS,
  lineVersionAfter,
  problemAnswer,
  productLinesBackend,
} from '@/test/siteContentFixtures';

vi.mock('@/lib/public-data/publicResource', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/public-data/publicResource')>()),
  invalidatePublicContent: vi.fn(),
}));

// The staff reads of the product lines and their writes (CONT-02, PUB-03; plan 11-20).

let queryClient: QueryClient;

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  clearSession();
  vi.mocked(invalidatePublicContent).mockClear();
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const polo = demoLineDetail('polo');

const body: ProductLineRequest = {
  title: polo.title,
  shortName: polo.shortName,
  number: polo.number,
  cardText: polo.cardText,
  description: polo.description,
  fabricText: polo.fabricText,
  collarText: polo.collarText,
  cutText: polo.cutText,
  namesText: polo.namesText,
  logosText: polo.logosText,
  startsAtPrice: 450,
  minimumQuantity: null,
  isActive: true,
  productTypeIds: [],
  version: polo.version,
};

describe('useProductLineListQuery and useProductLineQuery', () => {
  it('reads the list once under the product-lines key, every line in order', async () => {
    const backend = productLinesBackend();
    const { result } = renderHook(() => useProductLineListQuery(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.map((line) => line.shortName)).toEqual([
      'Basketball',
      'Volleyball',
      'Moto',
      'Long Sleeves',
      'Polo',
      'Custom',
    ]);
    expect(backend.listGets).toBe(1);
    expect(productLinesKey).toEqual(['product-lines']);
  });

  it('reads one line under its own key', async () => {
    const backend = productLinesBackend();
    const { result } = renderHook(() => useProductLineQuery(LINE_IDS.polo), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.title).toBe('Polo Shirts');
    expect(backend.gets).toBe(1);
    expect(productLineKey(LINE_IDS.polo)).toEqual(['product-lines', LINE_IDS.polo]);
  });

  it('asks for nothing when there is no id (a new line, or an id that is not one)', async () => {
    const backend = productLinesBackend();
    const { result } = renderHook(() => useProductLineQuery(null), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(result.current.fetchStatus).toBe('idle');
    expect(backend.gets).toBe(0);
  });

  it('reports a failed read as an error', async () => {
    server.use(http.get('*/api/v1/product-lines', () => problemAnswer(500)));
    const { result } = renderHook(() => useProductLineListQuery(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useUpdateProductLine', () => {
  it('saves with PUT, puts the answer in the line cache, reads the list again and clears the public data in this browser', async () => {
    const backend = productLinesBackend();
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useUpdateProductLine({ onSuccess }), { wrapper });

    await act(async () => {
      await result.current.submit({ id: LINE_IDS.polo, body });
    });

    expect(backend.puts).toEqual([{ id: LINE_IDS.polo, body }]);
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData<typeof polo>(productLineKey(LINE_IDS.polo))?.version).toBe(lineVersionAfter(1));
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(queryClient.getQueryState(productLinesKey)?.isInvalidated).toBe(true);
    });
  });

  it('on a stale save changes nothing in the cache, clears nothing and hands the failure on', async () => {
    productLinesBackend(undefined, { onPut: () => problemAnswer(409, { code: 'edit.stale' }) });
    queryClient.setQueryData(productLineKey(LINE_IDS.polo), polo);
    const onFailure = vi.fn();
    const { result } = renderHook(() => useUpdateProductLine({ onFailure }), { wrapper });

    await act(async () => {
      await result.current.submit({ id: LINE_IDS.polo, body });
    });

    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure.mock.calls[0]?.[1]).toMatchObject({ status: 409, code: 'edit.stale' });
    expect(queryClient.getQueryData(productLineKey(LINE_IDS.polo))).toEqual(polo);
    expect(invalidatePublicContent).not.toHaveBeenCalled();
  });
});

describe('useCreateProductLine', () => {
  it('adds with POST and one Idempotency-Key, puts the new line in its cache and clears the public data', async () => {
    const backend = productLinesBackend();
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useCreateProductLine({ onSuccess }), { wrapper });

    await act(async () => {
      await result.current.submit({ ...body, version: null });
    });

    expect(backend.posts).toHaveLength(1);
    expect(backend.posts[0]?.key).toMatch(/\S/);
    const made = onSuccess.mock.calls[0]?.[0] as typeof polo;
    expect(queryClient.getQueryData(productLineKey(made.id))).toEqual(made);
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });
});

describe('useMoveProductLine, useSetProductLineShown and useDeleteProductLine', () => {
  it('moves with the direction and one Idempotency-Key, then reads the list and clears the public data', async () => {
    const backend = productLinesBackend();
    const { result } = renderHook(() => useMoveProductLine(), { wrapper });

    await act(async () => {
      await result.current.submit({ id: LINE_IDS.volleyball, direction: 'up' });
    });

    expect(backend.moves).toHaveLength(1);
    expect(backend.moves[0]).toMatchObject({ id: LINE_IDS.volleyball, direction: 'up' });
    expect(backend.moves[0]?.key).toMatch(/\S/);
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });

  it('a second move of the same line the same way is a new move, not the same submission', async () => {
    const backend = productLinesBackend();
    const { result } = renderHook(() => useMoveProductLine(), { wrapper });

    await act(async () => {
      await result.current.submit({ id: LINE_IDS.moto, direction: 'up' });
    });
    await act(async () => {
      await result.current.submit({ id: LINE_IDS.moto, direction: 'up' });
    });

    expect(backend.moves).toHaveLength(2);
    expect(backend.moves[0]?.key).not.toBe(backend.moves[1]?.key);
  });

  it('hides and shows with their own routes and clears the public data each time', async () => {
    const backend = productLinesBackend();
    const { result } = renderHook(() => useSetProductLineShown(), { wrapper });

    await act(async () => {
      await result.current.submit({ id: LINE_IDS.polo, shown: false });
    });
    await act(async () => {
      await result.current.submit({ id: LINE_IDS.polo, shown: true });
    });

    expect(backend.hides).toEqual([LINE_IDS.polo]);
    expect(backend.shows).toEqual([LINE_IDS.polo]);
    expect(invalidatePublicContent).toHaveBeenCalledTimes(2);
  });

  it('deletes with DELETE and clears the public data; a 422 in use clears nothing and hands the failure on', async () => {
    const backend = productLinesBackend(undefined, {
      onDelete: (id) =>
        id === LINE_IDS.volleyball ? problemAnswer(422, { code: 'product-lines.in-use' }) : undefined,
    });
    const onFailure = vi.fn();
    const { result } = renderHook(() => useDeleteProductLine({ onFailure }), { wrapper });

    await act(async () => {
      await result.current.submit(LINE_IDS.polo);
    });
    expect(backend.deletes).toEqual([LINE_IDS.polo]);
    expect(invalidatePublicContent).toHaveBeenCalledOnce();

    await act(async () => {
      await result.current.submit(LINE_IDS.volleyball);
    });
    expect(onFailure.mock.calls[0]?.[1]).toMatchObject({ status: 422, code: 'product-lines.in-use' });
    expect(invalidatePublicContent).toHaveBeenCalledOnce();
  });
});

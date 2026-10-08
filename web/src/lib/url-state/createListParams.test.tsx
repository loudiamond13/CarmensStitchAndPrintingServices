import { renderHook, waitFor } from '@testing-library/react';
import { withNuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing';
import { describe, expect, it, vi } from 'vitest';
import { createListParams } from './createListParams';
import { literalParser, pageSizeParser, parseAsPage } from './parsers';

const useDemoParams = createListParams(
  {
    page: parseAsPage,
    pageSize: pageSizeParser,
    status: literalParser(['all', 'active', 'done'], 'all'),
  },
  { urlKeys: { pageSize: 'size' } },
);

/** Waits long enough for any queued nuqs URL update (rate limit 0 in the testing adapter) to flush. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

describe('createListParams: normalize once', () => {
  it('falls back to defaults for ?size=9999&page=0&status=bogus and removes them in one replace', async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const { result } = renderHook(() => useDemoParams(), {
      wrapper: withNuqsTestingAdapter({ searchParams: '?size=9999&page=0&status=bogus', onUrlUpdate, hasMemory: true }),
    });

    expect(result.current[0]).toEqual({ page: 1, pageSize: 20, status: 'all' });
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalledTimes(1);
    });
    await settle();
    expect(onUrlUpdate).toHaveBeenCalledTimes(1);
    const event = onUrlUpdate.mock.calls[0]?.[0];
    expect(event?.options.history).toBe('replace');
    expect(event?.queryString).toBe('');
  });
});

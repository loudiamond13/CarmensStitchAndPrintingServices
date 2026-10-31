import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useOrderAction } from '@/modules/admin/hooks/useOrderAction';

// One single-click order action (plan 08-14): a finished action must not make the next click on the same row a no-op (IN-07).

const target = { id: 'row-1' };

describe('useOrderAction generation', () => {
  it('sends the next click on the same row once the success work has finished', async () => {
    const send = vi.fn(() => Promise.resolve('done'));
    const { result } = renderHook(() => useOrderAction(send, () => Promise.resolve()));

    await act(async () => {
      await result.current.submit(target);
    });
    await act(async () => {
      await result.current.submit(target);
    });

    expect(send).toHaveBeenCalledTimes(2);
  });

  it('still moves on when the success work throws before it returns, and passes the throw on', async () => {
    const send = vi.fn(() => Promise.resolve('done'));
    const failure = new Error('navigation failed');
    const { result } = renderHook(() =>
      useOrderAction(send, () => {
        throw failure;
      }),
    );

    await act(async () => {
      await expect(result.current.submit(target)).rejects.toBe(failure);
    });
    await act(async () => {
      await expect(result.current.submit(target)).rejects.toBe(failure);
    });

    expect(send).toHaveBeenCalledTimes(2);
  });
});

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components';
import { createQueryClient } from '@/lib/query/queryClient';
import { useTransferAction } from '@/modules/admin/hooks/useTransferAction';
import type { HandoverBody, TransferBody } from '@/modules/admin/moneySchemas';
import { moneyService } from '@/modules/admin/services/moneyService';
import { JOMAR_ID, LIZA_ID, handoverSavedFixture, transferSavedFixture } from '@/test/moneyFixtures';

// The `send` seam of the transfer save (wave 11 IN-06): without it the body goes to the server (a transfer to create, a hand-over to
// handover); with it, only to `send`, which is how the Component Showcase's demo windows make no request.

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

const TRANSFER: TransferBody = { toUserId: LIZA_ID, amount: '2000.00', transferDate: '2026-10-08', note: null };
const HANDOVER: HandoverBody = { ...TRANSFER, fromUserId: JOMAR_ID };

function renderAction(options: Parameters<typeof useTransferAction>[0] = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
  return renderHook(() => useTransferAction(options), { wrapper });
}

describe('useTransferAction without send', () => {
  it('creates a transfer through the money service with the submission key', async () => {
    const create = vi.spyOn(moneyService, 'create').mockResolvedValue(transferSavedFixture());
    const handover = vi.spyOn(moneyService, 'handover');
    const onSaved = vi.fn();
    const { result } = renderAction({ onSaved });

    await act(async () => {
      await result.current.submit(TRANSFER);
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(TRANSFER, expect.any(String));
    expect(handover).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('records a body with a leaver as a hand-over', async () => {
    const handover = vi.spyOn(moneyService, 'handover').mockResolvedValue(handoverSavedFixture());
    const create = vi.spyOn(moneyService, 'create');
    const { result } = renderAction({ leaverName: 'Jomar Santos' });

    await act(async () => {
      await result.current.submit(HANDOVER);
    });

    expect(handover).toHaveBeenCalledWith(HANDOVER, expect.any(String));
    expect(create).not.toHaveBeenCalled();
  });
});

describe('useTransferAction with send', () => {
  it('gives the body to send and never calls the money service, and still raises the toast and closes', async () => {
    const create = vi.spyOn(moneyService, 'create');
    const handover = vi.spyOn(moneyService, 'handover');
    const send = vi.fn().mockResolvedValue(transferSavedFixture({ senderBalance: 6450 }));
    const onSaved = vi.fn();
    const { result } = renderAction({ send, onSaved });

    await act(async () => {
      await result.current.submit(TRANSFER);
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.any(String), TRANSFER);
    expect(create).not.toHaveBeenCalled();
    expect(handover).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Transfer recorded')).toBeInTheDocument();
  });

  it('sends a hand-over body to send as well', async () => {
    const handover = vi.spyOn(moneyService, 'handover');
    const send = vi.fn().mockResolvedValue(handoverSavedFixture());
    const { result } = renderAction({ send, leaverName: 'Jomar Santos' });

    await act(async () => {
      await result.current.submit(HANDOVER);
    });

    expect(send).toHaveBeenCalledWith(expect.any(String), HANDOVER);
    expect(handover).not.toHaveBeenCalled();
  });

  it('reports a refusal from send through onFailure and saves nothing', async () => {
    const create = vi.spyOn(moneyService, 'create');
    const send = vi.fn().mockRejectedValue(new Error('refused'));
    const onFailure = vi.fn();
    const onSaved = vi.fn();
    const { result } = renderAction({ send, onFailure, onSaved });

    await act(async () => {
      await result.current.submit(TRANSFER);
    });

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});

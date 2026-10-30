// The Orders view choice, grid or table (ORD-10, T-08-21; plan 08-11). The view shown is the URL's `view` when valid, else the
// stored choice when valid, else grid. Only the toggle writes: it puts the view in the URL (a replace, the page kept) and in
// localStorage. A visit with ?view=table never writes the storage. The stored choice is read once, when the page opens, so
// a choice made in another tab shows at the next visit only. The storage can throw (private mode): a failed read means grid
// and a failed write is ignored. The stored text is never handed to the URL parser, only compared with the two views.
import { useState } from 'react';
import type { OrderView, useOrdersListParams } from '@/modules/admin/hooks/useOrdersListParams';

export const ORDERS_VIEW_KEY = 'csps-orders-view';

export type OrdersView = OrderView;

function isView(value: unknown): value is OrdersView {
  return value === 'grid' || value === 'table';
}

/** The view to show: the URL's when valid, else the stored one when valid, else grid. Pure, so the matrix is a table test. */
export function resolveView(urlView: OrdersView | null, stored: string | null): OrdersView {
  if (urlView !== null) return urlView;
  return isView(stored) ? stored : 'grid';
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(ORDERS_VIEW_KEY);
  } catch {
    return null;
  }
}

function writeStored(view: OrdersView): void {
  try {
    window.localStorage.setItem(ORDERS_VIEW_KEY, view);
  } catch {
    // Private mode or a full store: the choice still shows through the URL.
  }
}

type Params = ReturnType<typeof useOrdersListParams>;

export function useOrdersView(
  values: Pick<Params[0], 'view'>,
  set: Pick<Params[1], 'setView'>,
): { view: OrdersView; setView: (view: OrdersView) => void } {
  const [stored, setStored] = useState(readStored);
  const view = resolveView(values.view, stored);

  const { setView: writeUrl } = set;
  const setView = (next: OrdersView): void => {
    if (next === view) return;
    writeUrl(next);
    writeStored(next);
    setStored(next);
  };

  return { view, setView };
}

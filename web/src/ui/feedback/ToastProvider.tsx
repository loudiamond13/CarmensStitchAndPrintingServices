// ToastProvider and useToast (App. D.3 "Toast queue", CSPS-UI-SPEC.md §6.5; UI-SPEC Interaction Contract "Toasts"):
// the toast layer and the hook screens use to raise toasts. The timing rules are the pure queue's (toastQueue.ts):
//   - D-04 / D-31 O-7: danger and warning toasts persist until closed; success and info leave after 4.5 s, and their
//     timers pause while the pointer is over the stack or focus is inside it (the layer's pointer and focus listeners
//     below, added with addEventListener: they only watch, so the layer is not a control and gets no role).
//   - D-31 O-5: the layer is always mounted, empty when there are no toasts, as the polite live region, so a screen
//     reader already knows it when the first toast arrives.
//   - Max 3, newest on top, persistent toasts protected when trimming (the queue).
// The layer renders where the provider is, inside the page root, never in a portal to <body> (spec §2.7, D-33), so it
// keeps `data-theme` and the `pg` container; the layouts place the provider inside the page root.
// SPEC-DEVIATION: D-04 useToast returns `{ show, dismiss }` (App. D.3 returned only the push function), because a
// persistent toast needs a way to be closed by the screen that raised it, for example once a retry succeeds.
// SPEC-DEVIATION: D-31 O-5 the layer is always rendered (App. D.3 mounted it only with toasts) and carries
// aria-live="polite"; with no toasts it has no size, so the resting look is unchanged.
// SPEC-DEVIATION: UI-WR-04 the layer is the ONLY live region: the toasts in it render with `announce={false}` (no
// role="status" / role="alert" of their own), because a live region nested in another is read twice by NVDA and JAWS.
// Every toast, danger included, is announced once, politely (the UI-SPEC's per-tone roles and the O-5 layer cannot
// both hold without the double reading; deferred-items.md records it for the owner).
import { createContext, use, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { toastLayerClasses } from './feedback.recipe';
import { Toast } from './Toast';
import { createToastQueue, type ToastInput, type ToastQueue } from './toastQueue';

export type { ToastItem } from './toastQueue';

/** What useToast returns. */
export interface ToastApi {
  /** Shows a toast on top of the stack and returns its id. */
  readonly show: (toast: ToastInput) => number;
  /** Closes the toast with that id (nothing happens when it is already gone). */
  readonly dismiss: (id: number) => void;
}

/** Outside a provider the hook does nothing, as App. D.3's default context does. */
const NO_TOASTS: ToastApi = { show: () => 0, dismiss: () => undefined };

const ToastContext = createContext<ToastApi>(NO_TOASTS);

/** The toast API of the nearest ToastProvider. */
export function useToast(): ToastApi {
  return use(ToastContext);
}

/** The browser clock and timers. */
function browserQueue(): ToastQueue {
  return createToastQueue({
    now: () => Date.now(),
    schedule: (callback, delayMs) => {
      const handle = window.setTimeout(callback, delayMs);
      return () => {
        window.clearTimeout(handle);
      };
    },
  });
}

export interface ToastProviderProps {
  children?: ReactNode;
  /** The queue to drive; tests inject one with their own clock. Read once, on the first render. */
  queue?: ToastQueue | undefined;
}

export function ToastProvider({ children, queue: injected }: ToastProviderProps) {
  const [queue] = useState(() => injected ?? browserQueue());
  const [api] = useState<ToastApi>(() => ({ show: queue.show, dismiss: queue.dismiss }));
  const { toasts } = useSyncExternalStore(queue.subscribe, queue.getSnapshot);
  const layerRef = useRef<HTMLDivElement>(null);
  const pointerInside = useRef(false);
  const focusInside = useRef(false);
  // UI-WR-05: where focus was before it entered the stack, so a Dismiss can hand it back.
  const focusBefore = useRef<HTMLElement | null>(null);

  // O-7: the clock stops while the pointer is over the stack or focus is inside it, and runs again when neither is.
  useEffect(() => {
    const layer = layerRef.current;
    if (layer === null) {
      return undefined;
    }
    const syncClock = () => {
      if (pointerInside.current || focusInside.current) {
        queue.pause();
      } else {
        queue.resume();
      }
    };
    const onPointerEnter = () => {
      pointerInside.current = true;
      syncClock();
    };
    const onPointerLeave = () => {
      pointerInside.current = false;
      syncClock();
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.relatedTarget instanceof HTMLElement && !layer.contains(event.relatedTarget)) {
        focusBefore.current = event.relatedTarget;
      }
      focusInside.current = true;
      syncClock();
    };
    const onFocusOut = (event: FocusEvent) => {
      focusInside.current = event.relatedTarget instanceof Node && layer.contains(event.relatedTarget);
      syncClock();
    };
    layer.addEventListener('pointerenter', onPointerEnter);
    layer.addEventListener('pointerleave', onPointerLeave);
    layer.addEventListener('focusin', onFocusIn);
    layer.addEventListener('focusout', onFocusOut);
    return () => {
      layer.removeEventListener('pointerenter', onPointerEnter);
      layer.removeEventListener('pointerleave', onPointerLeave);
      layer.removeEventListener('focusin', onFocusIn);
      layer.removeEventListener('focusout', onFocusOut);
    };
  }, [queue]);

  // An empty stack has no size, and a removed toast takes focus with it without a focusout in some browsers, so after
  // every change to the stack the focus flag is read again from the document (UI-WR-05: a stale flag kept the
  // remaining timed toasts paused for good), and once the last toast is gone the pointer is no longer over it.
  useEffect(() => {
    const layer = layerRef.current;
    focusInside.current = layer?.contains(document.activeElement) === true;
    if (toasts.length === 0) {
      pointerInside.current = false;
    }
    if (pointerInside.current || focusInside.current) {
      queue.pause();
    } else {
      queue.resume();
    }
  }, [toasts, queue]);

  /**
   * UI-WR-05: closes a toast from its Dismiss button. When focus is inside the stack it goes back to where it was
   * before the stack (WCAG 2.4.3), else to the next toast's Dismiss button, before the toast and its button go.
   */
  const close = (id: number) => {
    const layer = layerRef.current;
    if (layer?.contains(document.activeElement) === true) {
      const before = focusBefore.current;
      if (before?.isConnected === true) {
        before.focus();
      } else {
        const index = toasts.findIndex((toast) => toast.id === id);
        const next = layer.children.item(index + 1) ?? layer.children.item(index - 1);
        next?.querySelector<HTMLElement>('button[aria-label="Dismiss"]')?.focus();
      }
    }
    queue.dismiss(id);
  };

  return (
    <ToastContext value={api}>
      {children}
      <div ref={layerRef} className={toastLayerClasses} data-ui="s-toast-layer" aria-live="polite">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            tone={toast.tone}
            title={toast.title}
            message={toast.message}
            action={toast.action}
            announce={false}
            onClose={() => {
              close(toast.id);
            }}
          />
        ))}
      </div>
    </ToastContext>
  );
}

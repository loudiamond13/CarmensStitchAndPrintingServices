import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { ToastProvider, useToast, type ToastInput } from '@/components/feedback';
import { toastLayerClasses } from './feedback.recipe';
import { createToastQueue, type ToastQueue } from './toastQueue';

// ToastProvider and useToast (plan 02-21; D-04, D-31 O-5, O-7; UI-SPEC Interaction Contract "Toasts"), on real timers
// (L-24). Pausing is asserted through the queue's own paused state; the queue's timing rules are in toastQueue.test.ts.

/** A queue whose timers fire only when the test says so, so a test can expire a toast without waiting 4.5 s. */
function manualQueue(): { queue: ToastQueue; expireAll: () => void } {
  const timers = new Map<number, () => void>();
  let next = 0;
  const queue = createToastQueue({
    now: () => 0,
    schedule: (callback) => {
      next += 1;
      const handle = next;
      timers.set(handle, callback);
      return () => {
        timers.delete(handle);
      };
    },
  });
  return {
    queue,
    expireAll: () => {
      const callbacks = [...timers.values()];
      timers.clear();
      for (const callback of callbacks) {
        callback();
      }
    },
  };
}

/** Buttons that raise toasts through useToast, as a screen would. */
function Trigger({ toasts }: { toasts: readonly ToastInput[] }) {
  const toast = useToast();
  return (
    <>
      {toasts.map((input) => (
        <button key={input.title} type="button" onClick={() => toast.show(input)}>
          Show {input.title}
        </button>
      ))}
    </>
  );
}

function layerOf(container: HTMLElement): HTMLElement {
  const layer = container.querySelector('[data-ui="s-toast-layer"]');
  if (!(layer instanceof HTMLElement)) {
    throw new Error('The toast layer is not mounted.');
  }
  return layer;
}

/** The toast in the layer whose title is `title`. */
function toastIn(container: HTMLElement, title: string): HTMLElement {
  const toast = [...layerOf(container).children].find((item) => item.querySelector('strong')?.textContent === title);
  if (!(toast instanceof HTMLElement)) {
    throw new Error(`No toast titled "${title}".`);
  }
  return toast;
}

const PAYMENT: ToastInput = { tone: 'success', title: 'Payment added', message: 'Balance now ₱4,327.50' };
const SAVE_FAILED: ToastInput = {
  tone: 'danger',
  title: "Couldn't save order",
  message: "ORD-2026-0148 wasn't saved. Check your connection and try again.",
};

describe('ToastProvider', () => {
  it('keeps the toast layer mounted, empty, as the polite live region before any toast exists (O-5)', () => {
    const { container } = render(
      <ToastProvider>
        <p>Page</p>
      </ToastProvider>,
    );
    const layer = layerOf(container);

    expect(layer.childElementCount).toBe(0);
    expect(layer.getAttribute('aria-live')).toBe('polite');
    expect([...layer.classList].sort()).toEqual(toastLayerClasses.split(/\s+/).filter(Boolean).sort());
    expect(layer.previousElementSibling?.textContent).toBe('Page');
  });

  it('is the only live region: a toast inside it has no live role of its own, so it is announced once (UI-WR-04)', async () => {
    const user = userEvent.setup();
    const inputs: ToastInput[] = [PAYMENT, SAVE_FAILED, { tone: 'warning', title: 'Someone else changed this' }];
    const { container } = render(
      <ToastProvider>
        <Trigger toasts={inputs} />
      </ToastProvider>,
    );
    for (const input of inputs) {
      await user.click(screen.getByRole('button', { name: `Show ${input.title}` }));
    }
    const layer = layerOf(container);

    expect(layer.childElementCount).toBe(3);
    expect(layer.getAttribute('aria-live')).toBe('polite');
    expect(layer.querySelectorAll('[role="status"], [role="alert"], [role="log"], [aria-live]')).toHaveLength(0);
  });

  it('renders the layer where the provider is, never in a portal, so it keeps data-theme and the page container', () => {
    const { container } = render(
      <div data-theme="dark" data-testid="page-root">
        <ToastProvider>
          <p>Page</p>
        </ToastProvider>
      </div>,
    );

    expect(screen.getByTestId('page-root').contains(layerOf(container))).toBe(true);
  });

  it('shows a toast from useToast inside the layer, with its Dismiss button', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ToastProvider>
        <Trigger toasts={[PAYMENT]} />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Show Payment added' }));
    const toast = toastIn(container, 'Payment added');

    expect(layerOf(container).contains(toast)).toBe(true);
    expect(toast.textContent).toContain('Payment added');
    expect(toast.textContent).toContain('Balance now ₱4,327.50');
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
  });

  it('stacks newest on top, keeps at most 3, and protects the persistent danger toast when trimming (D-04)', async () => {
    const user = userEvent.setup();
    const inputs: ToastInput[] = [
      SAVE_FAILED,
      { tone: 'info', title: 'One' },
      { tone: 'info', title: 'Two' },
      { tone: 'info', title: 'Three' },
    ];
    const { container } = render(
      <ToastProvider>
        <Trigger toasts={inputs} />
      </ToastProvider>,
    );

    for (const input of inputs) {
      await user.click(screen.getByRole('button', { name: `Show ${input.title}` }));
    }
    const shown = [...layerOf(container).children].map((toast) => toast.querySelector('strong')?.textContent);

    expect(shown).toEqual(['Three', 'Two', "Couldn't save order"]);
  });

  it('closes a toast with its Dismiss button', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ToastProvider>
        <Trigger toasts={[SAVE_FAILED]} />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: "Show Couldn't save order" }));
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(layerOf(container).childElementCount).toBe(0);
  });

  it('removes a timed toast when its timer expires', async () => {
    const user = userEvent.setup();
    const { queue, expireAll } = manualQueue();
    const { container } = render(
      <ToastProvider queue={queue}>
        <Trigger toasts={[PAYMENT, SAVE_FAILED]} />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Show Payment added' }));
    await user.click(screen.getByRole('button', { name: "Show Couldn't save order" }));
    act(() => {
      expireAll();
    });

    expect(layerOf(container).childElementCount).toBe(1);
    expect(layerOf(container).textContent).not.toContain('Payment added');
    expect(layerOf(container).textContent).toContain("Couldn't save order");
  });

  it('pauses the timers while the pointer is over the stack and resumes when it leaves (O-7)', async () => {
    const user = userEvent.setup();
    const { queue } = manualQueue();
    const { container } = render(
      <ToastProvider queue={queue}>
        <Trigger toasts={[PAYMENT]} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Show Payment added' }));

    await user.hover(toastIn(container, 'Payment added'));
    expect(queue.getSnapshot().paused).toBe(true);

    await user.unhover(layerOf(container));
    expect(queue.getSnapshot().paused).toBe(false);
  });

  it('pauses the timers while focus is inside the stack, also when it moves between toasts (O-7, WCAG 2.2.1)', async () => {
    const user = userEvent.setup();
    const { queue } = manualQueue();
    render(
      <ToastProvider queue={queue}>
        <Trigger toasts={[PAYMENT, { tone: 'info', title: 'Not available yet' }]} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Show Payment added' }));
    await user.click(screen.getByRole('button', { name: 'Show Not available yet' }));
    const [first, second] = screen.getAllByRole('button', { name: 'Dismiss' });

    act(() => {
      first?.focus();
    });
    expect(queue.getSnapshot().paused).toBe(true);

    act(() => {
      second?.focus();
    });
    expect(queue.getSnapshot().paused).toBe(true);

    act(() => {
      screen.getByRole('button', { name: 'Show Payment added' }).focus();
    });
    expect(queue.getSnapshot().paused).toBe(false);
  });

  it('keeps the timers paused while either the pointer or focus is still in the stack', async () => {
    const user = userEvent.setup();
    const { queue } = manualQueue();
    const { container } = render(
      <ToastProvider queue={queue}>
        <Trigger toasts={[PAYMENT]} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Show Payment added' }));
    const layer = layerOf(container);

    await user.hover(layer);
    act(() => {
      screen.getByRole('button', { name: 'Dismiss' }).focus();
    });
    await user.unhover(layer);
    expect(queue.getSnapshot().paused).toBe(true);

    act(() => {
      screen.getByRole('button', { name: 'Show Payment added' }).focus();
    });
    expect(queue.getSnapshot().paused).toBe(false);
  });

  it('runs the clock again when the stack empties under the pointer and focus', async () => {
    const user = userEvent.setup();
    const { queue } = manualQueue();
    render(
      <ToastProvider queue={queue}>
        <Trigger toasts={[SAVE_FAILED, PAYMENT]} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: "Show Couldn't save order" }));

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(queue.getSnapshot().toasts).toEqual([]);
    expect(queue.getSnapshot().paused).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Show Payment added' }));
    expect(queue.getSnapshot().paused).toBe(false);
  });

  it('has no axe violations with toasts of every tone in the layer', async () => {
    const user = userEvent.setup();
    const inputs: ToastInput[] = [PAYMENT, SAVE_FAILED, { tone: 'warning', title: 'Someone else changed this' }];
    const { container } = render(
      <ToastProvider>
        <Trigger toasts={inputs} />
      </ToastProvider>,
    );
    for (const input of inputs) {
      await user.click(screen.getByRole('button', { name: `Show ${input.title}` }));
    }

    await expectNoAxeViolations(container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new children', () => {
    const { container, rerender } = render(
      <ToastProvider>
        <p>Page</p>
      </ToastProvider>,
    );
    const first = container.innerHTML;

    rerender(
      <ToastProvider>
        <p>Page</p>
      </ToastProvider>,
    );
    expect(container.innerHTML).toBe(first);

    rerender(
      <ToastProvider>
        <p>Other page</p>
      </ToastProvider>,
    );
    expect(layerOf(container).previousElementSibling?.textContent).toBe('Other page');
  });
});

// UI-WR-05: a Dismiss that takes focus away with its toast must neither drop focus to the body (WCAG 2.4.3) nor leave the
// "focus is inside" flag set, which kept the remaining timed toasts paused for good.
describe('ToastProvider focus after a dismiss (UI-WR-05)', () => {
  const INFO: ToastInput = { tone: 'info', title: 'Not available yet' };

  it('returns focus to where it was before the stack when a Dismiss is pressed, and runs the clock again', async () => {
    const user = userEvent.setup();
    const { queue } = manualQueue();
    render(
      <ToastProvider queue={queue}>
        <Trigger toasts={[PAYMENT, SAVE_FAILED]} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Show Payment added' }));
    const trigger = screen.getByRole('button', { name: "Show Couldn't save order" });
    await user.click(trigger);

    // Newest first: the danger toast's Dismiss is the first one after the triggers.
    await user.tab();
    const [dangerDismiss] = screen.getAllByRole('button', { name: 'Dismiss' });
    expect(dangerDismiss).toHaveFocus();
    expect(queue.getSnapshot().paused).toBe(true);

    await user.keyboard('{Enter}');
    expect(queue.getSnapshot().toasts.map((toast) => toast.title)).toEqual(['Payment added']);
    expect(trigger).toHaveFocus();
    expect(queue.getSnapshot().paused).toBe(false);
  });

  it('moves focus to the next toast when there is nowhere to go back to', async () => {
    const user = userEvent.setup();
    const { queue } = manualQueue();
    const { container } = render(
      <ToastProvider queue={queue}>
        <Trigger toasts={[INFO, SAVE_FAILED]} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Show Not available yet' }));
    await user.click(screen.getByRole('button', { name: "Show Couldn't save order" }));
    const dismissOf = (title: string) =>
      toastIn(container, title).querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]');

    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      dismissOf("Couldn't save order")?.focus();
    });
    await user.keyboard('{Enter}');

    expect(dismissOf('Not available yet')).toHaveFocus();
    expect(queue.getSnapshot().paused).toBe(true);
  });

  it('runs the clock again when a toast is closed by the screen while focus was on it', async () => {
    const user = userEvent.setup();
    const { queue } = manualQueue();
    let shown: number[] = [];
    function Screen() {
      const toast = useToast();
      return (
        <button
          type="button"
          onClick={() => {
            shown = [toast.show(PAYMENT), toast.show(SAVE_FAILED)];
          }}
        >
          Save
        </button>
      );
    }
    const { container } = render(
      <ToastProvider queue={queue}>
        <Screen />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    act(() => {
      toastIn(container, "Couldn't save order").querySelector<HTMLButtonElement>('button')?.focus();
    });
    expect(queue.getSnapshot().paused).toBe(true);

    act(() => {
      queue.dismiss(shown[1] ?? -1);
    });

    expect(queue.getSnapshot().toasts.map((toast) => toast.title)).toEqual(['Payment added']);
    expect(queue.getSnapshot().paused).toBe(false);
  });
});

describe('useToast', () => {
  it('returns show and dismiss; dismiss closes the toast that show returned', async () => {
    const user = userEvent.setup();
    let closeLast: (() => void) | undefined;
    function Screen() {
      const toast = useToast();
      return (
        <button
          type="button"
          onClick={() => {
            const id = toast.show(SAVE_FAILED);
            closeLast = () => {
              toast.dismiss(id);
            };
          }}
        >
          Save
        </button>
      );
    }
    const { container } = render(
      <ToastProvider>
        <Screen />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(toastIn(container, "Couldn't save order")).toBeTruthy();

    act(() => {
      closeLast?.();
    });
    expect(layerOf(container).childElementCount).toBe(0);
  });

  it('is a harmless no-op outside a ToastProvider, as App. D.3 is', async () => {
    const user = userEvent.setup();
    let shown: number | undefined;
    function Lonely() {
      const toast = useToast();
      return (
        <button
          type="button"
          onClick={() => {
            shown = toast.show(PAYMENT);
            toast.dismiss(shown);
          }}
        >
          Save
        </button>
      );
    }
    render(<Lonely />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(shown).toBe(0);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

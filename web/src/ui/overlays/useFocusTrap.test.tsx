import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { describe, expect, it } from 'vitest';
import { isTopFocusTrap, useFocusTrap } from './useFocusTrap';

// The ref-based focus trap behind Modal (WEB-02, A11Y-02, research Pitfall 9): initial focus, Tab and Shift+Tab wrap
// inside the container, focus that leaves comes back, and focus returns to the trigger when the trap ends. It adds no
// element of its own.

interface TrapProps {
  readonly children: ReactNode;
  readonly initial?: 'save';
}

function Trap({ children, initial }: TrapProps) {
  const container = useRef<HTMLDivElement>(null);
  const save = useRef<HTMLButtonElement>(null);
  useFocusTrap(container, initial === 'save' ? { initialFocus: save } : {});
  return (
    <div ref={container} data-testid="trap">
      {children}
      {initial === 'save' && (
        <button type="button" ref={save}>
          Save later
        </button>
      )}
    </div>
  );
}

function Harness({ children, initial }: TrapProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        Toggle
      </button>
      <button type="button">Outside</button>
      {open && (
        <Trap {...(initial === undefined ? {} : { initial })}>
          {children}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
            }}
          >
            Done
          </button>
        </Trap>
      )}
    </>
  );
}

function NoReturnPanel({ onShut }: { readonly onShut: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  useFocusTrap(container, { returnFocus: false });
  return (
    <div ref={container}>
      <button type="button" onClick={onShut}>
        Shut
      </button>
    </div>
  );
}

function NoReturn() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
      >
        Open
      </button>
      {open && (
        <NoReturnPanel
          onShut={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

const fields = (
  <>
    <button type="button">Close</button>
    <label>
      Amount
      <input />
    </label>
    <button type="button" disabled>
      Disabled
    </button>
  </>
);

async function openTrap(children: ReactNode, initial?: 'save') {
  const user = userEvent.setup();
  render(<Harness {...(initial === undefined ? {} : { initial })}>{children}</Harness>);
  await user.click(screen.getByRole('button', { name: 'Toggle' }));
  return user;
}

describe('useFocusTrap', () => {
  it('focuses the first field on activation, even when a button comes before it', async () => {
    await openTrap(fields);

    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveFocus();
  });

  it('focuses the first focusable element when there is no field', async () => {
    await openTrap(<button type="button">Close</button>);

    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('focuses the initialFocus element when one is given', async () => {
    await openTrap(fields, 'save');

    expect(screen.getByRole('button', { name: 'Save later' })).toHaveFocus();
  });

  it('wraps Tab from the last focusable element to the first (A11Y-02 adjacency edge)', async () => {
    const user = await openTrap(fields);
    screen.getByRole('button', { name: 'Done' }).focus();

    await user.tab();

    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('wraps Shift+Tab from the first focusable element to the last, skipping disabled ones', async () => {
    const user = await openTrap(fields);
    screen.getByRole('button', { name: 'Close' }).focus();

    await user.tab({ shift: true });

    expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();
  });

  it('lets Tab move normally between the elements inside', async () => {
    const user = await openTrap(fields);

    await user.tab();

    expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();
  });

  it('lets Shift+Tab move normally between the elements inside', async () => {
    const user = await openTrap(fields);

    await user.tab({ shift: true });

    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('returns focus nowhere when the trigger was not an HTML element', () => {
    function SvgTrigger({ open }: { readonly open: boolean }) {
      return (
        <>
          <svg tabIndex={0} data-testid="svg" aria-label="Chart" role="img" />
          {open && (
            <Trap>
              <button type="button">Inside</button>
            </Trap>
          )}
        </>
      );
    }
    const { rerender } = render(<SvgTrigger open={false} />);
    const svg = screen.getByTestId('svg');
    svg.focus();
    expect(svg).toHaveFocus();

    rerender(<SvgTrigger open />);
    expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus();
    rerender(<SvgTrigger open={false} />);

    expect(svg).not.toHaveFocus();
  });

  it('sends Tab to the first and Shift+Tab to the last element when focus has left everything (on the body)', async () => {
    const user = await openTrap(fields);
    const amount = screen.getByRole('textbox', { name: 'Amount' });

    amount.blur();
    expect(document.body).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

    screen.getByRole('button', { name: 'Close' }).blur();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();
  });

  it('sends Shift+Tab from the focused container itself to the last element', async () => {
    const user = await openTrap(fields);
    const trap = screen.getByTestId('trap');
    trap.tabIndex = -1;
    trap.focus();

    await user.tab({ shift: true });

    expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();
  });

  it('brings focus back inside when it moves to an element outside', async () => {
    await openTrap(fields);

    screen.getByRole('button', { name: 'Outside' }).focus();

    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('returns focus to the trigger when the trap ends', async () => {
    const user = await openTrap(fields);

    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.queryByTestId('trap')).toBeNull();
    expect(screen.getByRole('button', { name: 'Toggle' })).toHaveFocus();
  });

  it('focuses the container itself, made focusable with tabIndex -1, when nothing inside can take focus (A11Y-02 empty edge)', async () => {
    const user = userEvent.setup();
    function Empty() {
      const container = useRef<HTMLDivElement>(null);
      useFocusTrap(container);
      return (
        <div ref={container} data-testid="empty">
          <p>Nothing to press here.</p>
        </div>
      );
    }
    render(<Empty />);
    const container = screen.getByTestId('empty');

    expect(container).toHaveFocus();
    expect(container.tabIndex).toBe(-1);

    await user.tab();
    expect(container).toHaveFocus();
    await user.tab({ shift: true });
    expect(container).toHaveFocus();
  });

  it('keeps an existing tabindex on an empty container', () => {
    function Empty() {
      const container = useRef<HTMLDivElement>(null);
      useFocusTrap(container);
      return <div ref={container} tabIndex={-1} data-testid="empty" />;
    }
    render(<Empty />);

    expect(screen.getByTestId('empty')).toHaveFocus();
    expect(screen.getByTestId('empty').getAttribute('tabindex')).toBe('-1');
  });

  it('does nothing while inactive, and nothing when the ref holds no element', () => {
    function Inactive({ target }: { readonly target: RefObject<HTMLDivElement | null> }) {
      useFocusTrap(target, { active: false });
      return (
        <div ref={target}>
          <input aria-label="Name" />
        </div>
      );
    }
    function Detached() {
      const nothing = useRef<HTMLDivElement>(null);
      useFocusTrap(nothing);
      return <input aria-label="Other" />;
    }
    const target = { current: null };
    render(
      <>
        <Inactive target={target} />
        <Detached />
      </>,
    );

    expect(document.body).toHaveFocus();
  });

  it('does not return focus when returnFocus is false', async () => {
    const user = userEvent.setup();
    render(<NoReturn />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('button', { name: 'Shut' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Shut' }));

    expect(screen.getByRole('button', { name: 'Open' })).not.toHaveFocus();
  });
});

// UI-WR-02: overlays render in place (no portals), so a dialog opened from the phone drawer is a DOM sibling of the
// drawer, not a child. Only the newest active trap enforces focus; the ones below it wait until it ends.
function Layer({ name, children }: { readonly name: string; readonly children?: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  useFocusTrap(container);
  return (
    <div ref={container} data-testid={name}>
      <button type="button">{`${name} first`}</button>
      {children}
      <button type="button">{`${name} last`}</button>
    </div>
  );
}

function Stacked({ lower, upper }: { readonly lower: boolean; readonly upper: boolean }) {
  return (
    <>
      <button type="button">Page</button>
      {lower && (
        <Layer name="Drawer">
          <button type="button">Open dialog</button>
        </Layer>
      )}
      {upper && <Layer name="Dialog" />}
    </>
  );
}

describe('useFocusTrap with two traps open (UI-WR-02)', () => {
  it('lets the newest trap take and keep focus, even when it is a sibling of the older one', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Stacked lower upper={false} />);
    expect(screen.getByRole('button', { name: 'Drawer first' })).toHaveFocus();
    screen.getByRole('button', { name: 'Open dialog' }).focus();

    rerender(<Stacked lower upper />);
    expect(screen.getByRole('button', { name: 'Dialog first' })).toHaveFocus();
    expect(isTopFocusTrap(screen.getByTestId('Dialog'))).toBe(true);
    expect(isTopFocusTrap(screen.getByTestId('Drawer'))).toBe(false);
    expect(isTopFocusTrap(null)).toBe(false);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Dialog last' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Dialog first' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Dialog last' })).toHaveFocus();

    // Focus sent outside comes back to the top trap only.
    screen.getByRole('button', { name: 'Drawer last' }).focus();
    expect(screen.getByRole('button', { name: 'Dialog first' })).toHaveFocus();
  });

  it('hands focus back to the trigger in the trap below when the top trap ends, and that trap works again', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Stacked lower upper={false} />);
    screen.getByRole('button', { name: 'Open dialog' }).focus();
    rerender(<Stacked lower upper />);

    rerender(<Stacked lower upper={false} />);
    expect(screen.getByRole('button', { name: 'Open dialog' })).toHaveFocus();
    screen.getByRole('button', { name: 'Drawer last' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Drawer first' })).toHaveFocus();
    screen.getByRole('button', { name: 'Page' }).focus();
    expect(screen.getByRole('button', { name: 'Drawer first' })).toHaveFocus();
  });

  it('moves focus into the trap below when the top trap ends and its trigger is gone', () => {
    function Nested({ upper, trigger }: { readonly upper: boolean; readonly trigger: boolean }) {
      return (
        <>
          <Layer name="Drawer">{trigger && <button type="button">Open dialog</button>}</Layer>
          {upper && <Layer name="Dialog" />}
        </>
      );
    }
    const { rerender } = render(<Nested upper={false} trigger />);
    screen.getByRole('button', { name: 'Open dialog' }).focus();
    rerender(<Nested upper trigger />);
    rerender(<Nested upper trigger={false} />);

    rerender(<Nested upper={false} trigger={false} />);
    expect(screen.getByRole('button', { name: 'Drawer first' })).toHaveFocus();
  });

  it('leaves focus in the top trap when a trap below it ends first', () => {
    const { rerender } = render(<Stacked lower upper={false} />);
    rerender(<Stacked lower upper />);
    expect(screen.getByRole('button', { name: 'Dialog first' })).toHaveFocus();

    rerender(<Stacked lower={false} upper />);
    expect(screen.getByRole('button', { name: 'Dialog first' })).toHaveFocus();
    screen.getByRole('button', { name: 'Page' }).focus();
    expect(screen.getByRole('button', { name: 'Dialog first' })).toHaveFocus();
  });
});

// UI-WR-03: danger and warning toasts stay until closed (D-04, D-31 O-7), and a failed save inside a dialog is reported
// in one. The toast layer sits outside the dialog, so the trap lets Tab cycle through the dialog and then the toasts,
// and never pulls focus back out of the toast layer.
function DialogWithToast({ toasts, inertLayer = false }: { readonly toasts: boolean; readonly inertLayer?: boolean }) {
  const layer = (
    <div data-ui="s-toast-layer">
      {toasts && (
        <div>
          <button type="button">Try again</button>
          <button type="button" aria-label="Dismiss" />
        </div>
      )}
    </div>
  );
  return (
    <>
      <button type="button">Page</button>
      <Layer name="Dialog" />
      {inertLayer ? <div inert>{layer}</div> : layer}
    </>
  );
}

describe('useFocusTrap and the toast layer (UI-WR-03)', () => {
  it('Tabs from the dialog into the toasts and back, both ways', async () => {
    const user = userEvent.setup();
    render(<DialogWithToast toasts />);
    expect(screen.getByRole('button', { name: 'Dialog first' })).toHaveFocus();

    screen.getByRole('button', { name: 'Dialog last' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Try again' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Dialog first' })).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Try again' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Dialog last' })).toHaveFocus();
  });

  it('leaves focus on a toast it was sent to, and still pulls focus back from the rest of the page', () => {
    render(<DialogWithToast toasts />);

    screen.getByRole('button', { name: 'Dismiss' }).focus();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveFocus();

    screen.getByRole('button', { name: 'Page' }).focus();
    expect(screen.getByRole('button', { name: 'Dialog first' })).toHaveFocus();
  });

  it('keeps the plain wrap when no toast can take focus, or the layer is inert', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DialogWithToast toasts={false} />);
    screen.getByRole('button', { name: 'Dialog last' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Dialog first' })).toHaveFocus();

    rerender(<DialogWithToast toasts inertLayer />);
    screen.getByRole('button', { name: 'Dialog first' }).focus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Dialog last' })).toHaveFocus();
  });
});

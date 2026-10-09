import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { describe, expect, it } from 'vitest';
import { useFocusTrap } from './useFocusTrap';

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

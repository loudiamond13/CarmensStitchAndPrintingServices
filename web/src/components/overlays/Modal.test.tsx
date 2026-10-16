import { createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scenarios as overlayScenarios } from '@/dev/scenarios/groups/overlays';
import { expectNoAxeViolations } from '@/test/axe';
import { Button } from '@/components/actions';
import { iconButtonClasses } from '@/components/feedback';
import { Field } from '@/components/forms';
import { Modal, Overlay, useBodyScrollLock, type ModalProps } from '@/components/overlays';
import {
  bodyScrollLockClass,
  modalBodyClasses,
  modalClasses,
  modalDescriptionClasses,
  modalFootClasses,
  modalHeadClasses,
  modalTitleClasses,
  overlayClasses,
  overlayRegionClasses,
} from './overlays.recipe';

// The converted App. D.3 Modal (plan 02-22, CSPS-UI-SPEC.md §6.5, WEB-02 fix, research Pitfall 9): a real dialog with a
// ref-based focus trap, Esc and scrim close (not while loading), focus return and a class-toggle body scroll lock. The
// look is proven by the parity suite (`--grep @overlays`); these tests pin the markup, the semantics and the scenarios.

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean).sort();
}

function classTokens(element: Element | null | undefined): string[] {
  return [...(element?.classList ?? [])].sort();
}

/** The first element child, or a thrown error (so a missing element fails the test plainly). */
function firstChild(parent: Element): Element {
  const child = parent.firstElementChild;
  if (child === null) {
    throw new Error('Expected a first element child.');
  }
  return child;
}

/** A full press on the target: mousedown, mouseup and click, all with the same init (button, position). */
function pressAndRelease(target: Element, init?: MouseEventInit): void {
  fireEvent.mouseDown(target, init);
  fireEvent.mouseUp(target, init);
  fireEvent.click(target, init);
}

afterEach(() => {
  document.body.className = '';
});

function AddPayment(props: Partial<ModalProps>) {
  return (
    <Modal
      title="Add Payment"
      description="ORD-2026-0148 · Brgy. San Roque Ballers"
      footer={
        <>
          <Button>Cancel</Button>
          <Button variant="primary" icon="check">
            Add Payment
          </Button>
        </>
      }
      {...props}
    >
      <Field label="Amount" prefix="₱" inputMode="decimal" />
    </Modal>
  );
}

/** A trigger that opens the modal and a close handler that shuts it, like a screen would. */
function Screen({ loading = false }: { readonly loading?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        Add Payment
      </Button>
      <AddPayment
        open={open}
        loading={loading}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}

async function openScreen(loading = false) {
  const user = userEvent.setup();
  render(<Screen loading={loading} />);
  await user.click(screen.getByRole('button', { name: 'Add Payment' }));
  return user;
}

describe('Modal (App. D.3, WEB-02)', () => {
  it('renders the App. D.3 markup: scrim, dialog, head with title, description and Close, body and footer', () => {
    const { container } = render(<AddPayment onClose={vi.fn()} />);
    const overlay = container.firstElementChild;
    const dialog = overlay?.firstElementChild;
    const [head, body, foot] = [...(dialog?.children ?? [])];
    const [titles, close] = [...(head?.children ?? [])];

    expect(overlay?.localName).toBe('div');
    expect(classTokens(overlay)).toEqual(tokens(overlayClasses({ variant: 'center', inline: false })));
    expect(classTokens(dialog)).toEqual(tokens(modalClasses({ variant: 'center', inline: false })));
    expect(head?.localName).toBe('header');
    expect(classTokens(head)).toEqual(tokens(modalHeadClasses));
    expect(titles?.localName).toBe('div');
    expect(titles?.firstElementChild?.localName).toBe('h2');
    expect(classTokens(titles?.firstElementChild)).toEqual(tokens(modalTitleClasses));
    expect(classTokens(titles?.lastElementChild)).toEqual(tokens(modalDescriptionClasses));
    expect(close?.localName).toBe('button');
    expect(close?.getAttribute('type')).toBe('button');
    expect(classTokens(close)).toEqual(tokens(iconButtonClasses));
    expect(close?.querySelector('svg')?.getAttribute('width')).toBe('20');
    expect(classTokens(body)).toEqual(tokens(modalBodyClasses));
    expect(foot?.localName).toBe('footer');
    expect(classTokens(foot)).toEqual(tokens(modalFootClasses));
  });

  it('is a modal dialog named by its title and described by its description', () => {
    render(<AddPayment onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Add Payment' });

    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBeNull();
    const heading = screen.getByRole('heading', { level: 2, name: 'Add Payment' });
    expect(dialog.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(dialog).toHaveAccessibleDescription('ORD-2026-0148 · Brgy. San Roque Ballers');
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeVisible();
  });

  it('leaves out the description, the Close button and the footer when none is given', () => {
    render(<Modal title="Plain">Body text</Modal>);
    const dialog = screen.getByRole('dialog', { name: 'Plain' });

    expect(dialog.getAttribute('aria-describedby')).toBeNull();
    expect(dialog.querySelector('p')).toBeNull();
    expect(within(dialog).queryByRole('button')).toBeNull();
    expect(dialog.querySelector('footer')).toBeNull();
    expect(dialog.children).toHaveLength(2);
  });

  it('renders nothing while closed', () => {
    const { container } = render(<AddPayment open={false} onClose={vi.fn()} />);

    expect(container.childElementCount).toBe(0);
    expect(document.body.classList.contains(bodyScrollLockClass)).toBe(false);
  });

  it('renders the slide-over and inline variants with their looks', () => {
    const { container, rerender } = render(<AddPayment variant="slideover" />);
    let overlay = container.firstElementChild;

    expect(classTokens(overlay)).toEqual(tokens(overlayClasses({ variant: 'slideover', inline: false })));
    expect(classTokens(overlay?.firstElementChild)).toEqual(
      tokens(modalClasses({ variant: 'slideover', inline: false })),
    );

    rerender(<AddPayment inline />);
    overlay = container.firstElementChild;
    expect(classTokens(overlay)).toEqual(tokens(overlayClasses({ variant: 'center', inline: true })));
    expect(classTokens(overlay?.firstElementChild)).toEqual(tokens(modalClasses({ variant: 'center', inline: true })));
  });

  it('closes on Esc', () => {
    const onClose = vi.fn();
    render(<AddPayment onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    const onClose = vi.fn();
    render(<AddPayment onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on a press and click on the scrim, but not on one inside the dialog', () => {
    const onClose = vi.fn();
    const { container } = render(<AddPayment onClose={onClose} />);

    pressAndRelease(screen.getByRole('dialog'));
    pressAndRelease(screen.getByRole('textbox', { name: 'Amount' }));
    expect(onClose).not.toHaveBeenCalled();

    pressAndRelease(firstChild(container));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the Close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AddPayment onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores Esc, the scrim and the Close button while loading', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<AddPayment onClose={onClose} loading />);

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.mouseDown(firstChild(container));
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Esc again once loading ends', () => {
    const onClose = vi.fn();
    const { rerender } = render(<AddPayment onClose={onClose} loading />);
    rerender(<AddPayment onClose={onClose} loading={false} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does nothing on Esc or the scrim without an onClose', () => {
    const { container } = render(<AddPayment />);

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.mouseDown(firstChild(container));

    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('moves focus to the first field on open and returns it to the trigger on close', async () => {
    const user = await openScreen();

    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add Payment' })).toHaveFocus();
  });

  it('traps Tab and Shift+Tab inside the dialog', async () => {
    const user = await openScreen();
    const dialog = screen.getByRole('dialog');

    await user.tab();
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Add Payment' })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(dialog).getByRole('button', { name: 'Add Payment' })).toHaveFocus();
  });

  it('focuses the initialFocus element when one is given', () => {
    function WithInitial() {
      const later = useRef<HTMLButtonElement>(null);
      return (
        <Modal title="Pick" initialFocus={later} footer={<Button ref={later}>Later</Button>}>
          <Field label="Name" />
        </Modal>
      );
    }
    render(<WithInitial />);

    expect(screen.getByRole('button', { name: 'Later' })).toHaveFocus();
  });

  it('focuses the dialog itself when nothing inside can take focus', () => {
    render(<Modal title="Read only">Nothing to press.</Modal>);

    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('locks body scroll with the overflow-hidden class while open, and only with the class', () => {
    const { rerender, unmount } = render(<AddPayment />);

    expect(bodyScrollLockClass).toBe('overflow-hidden');
    expect(document.body.classList.contains('overflow-hidden')).toBe(true);
    expect(document.body.getAttribute('style')).toBeNull();

    rerender(<AddPayment open={false} />);
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);

    rerender(<AddPayment />);
    expect(document.body.classList.contains('overflow-hidden')).toBe(true);
    unmount();
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
  });

  it('leaves body scroll alone when the lock is not active', () => {
    function Idle() {
      useBodyScrollLock(false);
      return <p>Idle</p>;
    }
    render(<Idle />);

    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
  });

  it('keeps the lock until the last of two open dialogs closes', () => {
    const first = render(<AddPayment />);
    const second = render(<AddPayment title="Second" />);

    first.unmount();
    expect(document.body.classList.contains('overflow-hidden')).toBe(true);
    second.unmount();
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
  });

  it('renders inside its parent, never in a portal', () => {
    const { container } = render(
      <section aria-label="Page">
        <AddPayment />
      </section>,
    );

    expect(container.querySelector('section [role="dialog"]')).not.toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(<AddPayment onClose={vi.fn()} />);

    await expectNoAxeViolations(container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const onClose = vi.fn();
    const { rerender } = render(<AddPayment onClose={onClose} />);
    rerender(<AddPayment onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Add Payment' })).toBeVisible();

    rerender(<AddPayment onClose={onClose} title="Add Discount" description="Applied to the subtotal" />);
    expect(screen.getByRole('dialog', { name: 'Add Discount' })).toHaveAccessibleDescription('Applied to the subtotal');
  });
});

// UI-WR-01: a confirm opened from an edit dialog (a child-row delete) is a second dialog on top of the first. One Esc
// closes the top one only, so the edit form under it keeps its input.
function EditWithConfirm({ onEditClose }: { readonly onEditClose: () => void }) {
  const [confirming, setConfirming] = useState(true);
  return (
    <>
      <Modal title="Edit Order" onClose={onEditClose}>
        <Field label="Team" defaultValue="Thunder Riders" />
      </Modal>
      {confirming && (
        <Modal
          title="Delete payment?"
          onClose={() => {
            setConfirming(false);
          }}
        >
          <Button>Delete Payment</Button>
        </Modal>
      )}
    </>
  );
}

describe('Modal with another dialog open (UI-WR-01)', () => {
  it('closes only the dialog on top on Esc; the next Esc closes the one under it', async () => {
    const user = userEvent.setup();
    const onEditClose = vi.fn();
    render(<EditWithConfirm onEditClose={onEditClose} />);
    expect(screen.getAllByRole('dialog')).toHaveLength(2);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Delete payment?' })).toBeNull();
    expect(onEditClose).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Team' })).toHaveValue('Thunder Riders');

    await user.keyboard('{Escape}');
    expect(onEditClose).toHaveBeenCalledTimes(1);
  });

  it('leaves an Esc that something else already handled alone', () => {
    const onClose = vi.fn();
    render(<AddPayment onClose={onClose} />);

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    event.preventDefault();
    window.dispatchEvent(event);
    expect(onClose).not.toHaveBeenCalled();

    const fresh = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    window.dispatchEvent(fresh);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fresh.defaultPrevented).toBe(true);
  });
});

describe('Modal makes the page behind it inert (R2-10)', () => {
  function Page({ open, inline = false }: { open: boolean; inline?: boolean }) {
    return (
      <div>
        <main data-testid="page">
          <button type="button">Behind</button>
        </main>
        <div data-ui="s-toast-layer" data-testid="toasts" />
        <AddPayment open={open} inline={inline} onClose={vi.fn()} />
      </div>
    );
  }

  it('marks the page inert while open, keeps the toast layer live and restores the page on close', () => {
    const { rerender } = render(<Page open />);

    expect(screen.getByTestId('page')).toHaveAttribute('inert');
    expect(screen.getByTestId('toasts')).not.toHaveAttribute('inert');
    expect(screen.getByRole('dialog', { name: 'Add Payment' })).not.toHaveAttribute('inert');

    rerender(<Page open={false} />);

    expect(screen.getByTestId('page')).not.toHaveAttribute('inert');
  });

  it('returns focus to the trigger on close even though the page was inert', async () => {
    function Opener() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <main>
            <button
              type="button"
              onClick={() => {
                setOpen(true);
              }}
            >
              Open
            </button>
          </main>
          <AddPayment
            open={open}
            onClose={() => {
              setOpen(false);
            }}
          />
        </div>
      );
    }
    const user = userEvent.setup();
    render(<Opener />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);
    expect(trigger.closest('main')).toHaveAttribute('inert');

    await user.keyboard('{Escape}');

    expect(trigger.closest('main')).not.toHaveAttribute('inert');
    expect(trigger).toHaveFocus();
  });

  it('leaves the page alone for an inline dialog in an Overlay region (a static mock-up)', () => {
    render(<Page open inline />);

    expect(screen.getByTestId('page')).not.toHaveAttribute('inert');
  });

  it('keeps the page inert until the last of two stacked dialogs closes', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <main data-testid="page">Page</main>
        <EditWithConfirm onEditClose={vi.fn()} />
      </div>,
    );
    expect(screen.getByTestId('page')).toHaveAttribute('inert');
    expect(screen.getByRole('dialog', { name: 'Delete payment?' })).not.toHaveAttribute('inert');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Delete payment?' })).toBeNull();
    expect(screen.getByTestId('page')).toHaveAttribute('inert');
    expect(screen.getByRole('dialog', { name: 'Edit Order' })).not.toHaveAttribute('inert');
  });
});

describe('Overlay (App. C .s-overlay)', () => {
  it('is the data-ui="s-overlay" region with the App. C look, holding an inline Modal', () => {
    const { container } = render(
      <Overlay>
        <AddPayment inline onClose={vi.fn()} />
      </Overlay>,
    );
    const region = container.firstElementChild;

    expect(region?.getAttribute('data-ui')).toBe('s-overlay');
    expect(classTokens(region)).toEqual(tokens(overlayRegionClasses));
    expect(region?.firstElementChild?.firstElementChild?.getAttribute('role')).toBe('dialog');
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new children', () => {
    const { container, rerender } = render(<Overlay>first</Overlay>);
    rerender(<Overlay>first</Overlay>);
    expect(container.textContent).toBe('first');

    rerender(<Overlay>second</Overlay>);
    expect(container.textContent).toBe('second');
  });

  it('closes an inline Modal on a press and click on the region scrim', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Overlay>
        <AddPayment inline onClose={onClose} />
      </Overlay>,
    );

    pressAndRelease(firstChild(container));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not treat another parent as a scrim', () => {
    const onClose = vi.fn();
    const { container } = render(
      <div data-testid="plain">
        <AddPayment inline onClose={onClose} />
      </div>,
    );

    fireEvent.mouseDown(firstChild(container));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <Overlay>
        <AddPayment inline onClose={vi.fn()} />
      </Overlay>,
    );

    await expectNoAxeViolations(container);
  });
});

// D-42 (owner, 2026-10-13, UAT G-2-199): on a short window the Overlay region scrolls. A press on an element's own
// scrollbar fires mousedown on that element, so without a guard dragging the backdrop's scrollbar would close the dialog
// and lose the typed confirm text. jsdom has no layout, so each test states the scrim's geometry: a 1015x400 box whose
// client area is 1000 wide (a 15px vertical scrollbar on the right) or 385 tall (a 15px horizontal one at the bottom).
interface ScrimGeometry {
  readonly clientWidth: number;
  readonly clientHeight: number;
  readonly scrollWidth: number;
  readonly scrollHeight: number;
}

function stubGeometry(scrim: Element, geometry: ScrimGeometry): void {
  for (const [property, value] of Object.entries({ ...geometry, clientLeft: 0, clientTop: 0 })) {
    Object.defineProperty(scrim, property, { configurable: true, value });
  }
  vi.spyOn(scrim, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1015, 400));
}

/** Overflows downwards, so the right-hand 15px of the box is the vertical scrollbar. */
const OVERFLOWING: ScrimGeometry = { clientWidth: 1000, clientHeight: 400, scrollWidth: 1000, scrollHeight: 600 };

describe("scrim presses on the backdrop's own scrollbar (D-42)", () => {
  function renderInRegion(onClose: () => void): Element {
    const { container } = render(
      <Overlay>
        <AddPayment inline onClose={onClose} />
      </Overlay>,
    );
    return firstChild(container);
  }

  it('ignores a press on the vertical scrollbar of an overflowing region, and still closes on the scrim', () => {
    const onClose = vi.fn();
    const region = renderInRegion(onClose);
    stubGeometry(region, OVERFLOWING);

    pressAndRelease(region, { clientX: 1005, clientY: 100 });
    expect(onClose).not.toHaveBeenCalled();

    pressAndRelease(region, { clientX: 500, clientY: 100 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a press at the right edge when the region does not overflow (no scrollbar there, it is scrim)', () => {
    const onClose = vi.fn();
    const region = renderInRegion(onClose);
    stubGeometry(region, { clientWidth: 1000, clientHeight: 400, scrollWidth: 1000, scrollHeight: 400 });

    pressAndRelease(region, { clientX: 1005, clientY: 100 });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores a press on the horizontal scrollbar of a region that overflows sideways only', () => {
    const onClose = vi.fn();
    const region = renderInRegion(onClose);
    stubGeometry(region, { clientWidth: 1000, clientHeight: 385, scrollWidth: 1200, scrollHeight: 385 });

    pressAndRelease(region, { clientX: 500, clientY: 395 });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("gives the fixed Modal's own scrim the same guard", () => {
    const onClose = vi.fn();
    const { container } = render(<AddPayment onClose={onClose} />);
    const scrim = firstChild(container);
    stubGeometry(scrim, OVERFLOWING);

    pressAndRelease(scrim, { clientX: 1005, clientY: 100 });
    expect(onClose).not.toHaveBeenCalled();

    pressAndRelease(scrim, { clientX: 500, clientY: 100 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// D-42 / G-2-199 (review WR-01): overlay scrollbars take no layout space (macOS with a trackpad, ChromeOS), so the
// geometry above cannot tell a press on them from a press on the scrim. The scrim therefore closes only on a click that
// follows a press on the scrim, with the backdrop at the same scroll position as at that press: a drag on the scrollbar
// scrolled it. jsdom does not scroll, so each test sets the positions the engine would report.
/** Overflows downwards with an overlay scrollbar: the client area is the whole 1015px box. */
const OVERLAY_SCROLLBAR: ScrimGeometry = { clientWidth: 1015, clientHeight: 400, scrollWidth: 1015, scrollHeight: 600 };

function setScroll(scrim: Element, top: number, left: number): void {
  Object.defineProperty(scrim, 'scrollTop', { configurable: true, value: top });
  Object.defineProperty(scrim, 'scrollLeft', { configurable: true, value: left });
}

describe('scrim close rule: only a press and click on the scrim that does not scroll it closes (D-42, G-2-199)', () => {
  function renderInRegion(onClose: () => void): Element {
    const { container } = render(
      <Overlay>
        <AddPayment inline onClose={onClose} />
      </Overlay>,
    );
    return firstChild(container);
  }

  it('keeps the dialog open after a drag on an overlay scrollbar that scrolled the backdrop', () => {
    const onClose = vi.fn();
    const region = renderInRegion(onClose);
    stubGeometry(region, OVERLAY_SCROLLBAR);

    fireEvent.mouseDown(region, { clientX: 1011, clientY: 120 });
    setScroll(region, 105, 0);
    fireEvent.mouseUp(region, { clientX: 1011, clientY: 300 });
    fireEvent.click(region, { clientX: 1011, clientY: 300 });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('counts a sideways scroll during the press as a scroll too', () => {
    const onClose = vi.fn();
    const region = renderInRegion(onClose);
    stubGeometry(region, { ...OVERLAY_SCROLLBAR, scrollWidth: 1200 });

    fireEvent.mouseDown(region, { clientX: 500, clientY: 200 });
    setScroll(region, 0, 40);
    fireEvent.click(region, { clientX: 500, clientY: 200 });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('never closes on a press alone; the click that follows it closes', () => {
    const onClose = vi.fn();
    const region = renderInRegion(onClose);

    fireEvent.mouseDown(region, { clientX: 500, clientY: 100 });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseUp(region, { clientX: 500, clientY: 100 });
    fireEvent.click(region, { clientX: 500, clientY: 100 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('lets a later press replace an earlier one, so a press inside the dialog never closes it', () => {
    const onClose = vi.fn();
    const region = renderInRegion(onClose);

    fireEvent.mouseDown(region, { clientX: 500, clientY: 100 });
    fireEvent.mouseDown(screen.getByRole('textbox', { name: 'Amount' }));
    fireEvent.click(region, { clientX: 500, clientY: 100 });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on a press and click that did not scroll the backdrop', () => {
    const onClose = vi.fn();
    const region = renderInRegion(onClose);
    stubGeometry(region, OVERFLOWING);

    pressAndRelease(region, { clientX: 500, clientY: 100 });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('counts the first scrollbar column as scrollbar and the scrim just left of it as scrim', () => {
    const onClose = vi.fn();
    const region = renderInRegion(onClose);
    stubGeometry(region, OVERFLOWING);

    pressAndRelease(region, { clientX: 1000, clientY: 100 });
    expect(onClose).not.toHaveBeenCalled();

    pressAndRelease(region, { clientX: 999.5, clientY: 100 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("gives the fixed Modal's own scrim the same rule", () => {
    const onClose = vi.fn();
    const { container } = render(<AddPayment onClose={onClose} />);
    const scrim = firstChild(container);
    stubGeometry(scrim, OVERLAY_SCROLLBAR);

    fireEvent.mouseDown(scrim, { clientX: 1011, clientY: 120 });
    setScroll(scrim, 105, 0);
    fireEvent.mouseUp(scrim, { clientX: 1011, clientY: 300 });
    fireEvent.click(scrim, { clientX: 1011, clientY: 300 });
    expect(onClose).not.toHaveBeenCalled();

    pressAndRelease(scrim, { clientX: 500, clientY: 100 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Review WR-01: a middle press starts autoscroll on Windows and a right press opens the context menu; neither is a
  // press on the dark area.
  it.each([1, 2])('never closes on a press with mouse button %i; a primary press and click then closes', (button) => {
    const onClose = vi.fn();
    const region = renderInRegion(onClose);
    const at = { button, clientX: 500, clientY: 100 };

    fireEvent.mouseDown(region, at);
    fireEvent.mouseUp(region, at);
    fireEvent.click(region, at);
    if (button === 2) {
      fireEvent.contextMenu(region, at);
    }
    expect(onClose).not.toHaveBeenCalled();

    pressAndRelease(region, { clientX: 500, clientY: 100 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // On Linux a middle press pastes the X11 selection into the focused field wherever the press lands, so the dark area
  // cancels the default of a middle press (down and up). A primary press, and a middle press inside the dialog, are left alone.
  it.each([
    ['mouseDown', 1],
    ['mouseUp', 1],
  ] as const)('cancels the default of %s with button %i on the dark area', (type, button) => {
    const region = renderInRegion(vi.fn());
    const event = createEvent[type](region, { button });

    fireEvent(region, event);

    expect(event.defaultPrevented).toBe(true);
  });

  it.each([
    ['mouseDown', 0],
    ['mouseUp', 0],
    ['mouseDown', 2],
    ['mouseUp', 2],
  ] as const)('leaves the default of %s with button %i on the dark area alone', (type, button) => {
    const region = renderInRegion(vi.fn());
    const event = createEvent[type](region, { button });

    fireEvent(region, event);

    expect(event.defaultPrevented).toBe(false);
  });

  it.each(['mouseDown', 'mouseUp'] as const)('leaves a middle %s inside the dialog alone', (type) => {
    renderInRegion(vi.fn());
    const event = createEvent[type](screen.getByRole('dialog'), { button: 1 });

    fireEvent(screen.getByRole('dialog'), event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('never closes on a primary press followed by a click with another button', () => {
    const onClose = vi.fn();
    const region = renderInRegion(onClose);

    fireEvent.mouseDown(region, { clientX: 500, clientY: 100 });
    fireEvent.click(region, { button: 1, clientX: 500, clientY: 100 });

    expect(onClose).not.toHaveBeenCalled();
  });

  // The trap returns focus without scrolling (review WR-01, plan 02-43), so every scroll between the press and the click
  // is a scroll gesture: no re-read at a focus move and no timing window (review WR-02).
  it('counts a scroll during the press as a scroll, even with a focus move inside it (review WR-02)', () => {
    const onClose = vi.fn();
    const region = renderInRegion(onClose);
    stubGeometry(region, OVERFLOWING);

    fireEvent.mouseDown(region, { clientX: 500, clientY: 100 });
    setScroll(region, 40, 0);
    fireEvent.focusIn(screen.getByRole('button', { name: 'Close' }));
    fireEvent.mouseUp(region, { clientX: 500, clientY: 100 });
    fireEvent.click(region, { clientX: 500, clientY: 100 });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('still counts a scroll after that focus move as a scroll', () => {
    const onClose = vi.fn();
    const region = renderInRegion(onClose);
    stubGeometry(region, OVERFLOWING);

    fireEvent.mouseDown(region, { clientX: 500, clientY: 100 });
    fireEvent.focusIn(screen.getByRole('button', { name: 'Close' }));
    setScroll(region, 60, 0);
    fireEvent.click(region, { clientX: 500, clientY: 100 });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('counts a scroll a task after a focus move as a scroll too: no timing window (review WR-02)', () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      const region = renderInRegion(onClose);
      stubGeometry(region, OVERFLOWING);
      setScroll(region, 105, 0);

      fireEvent.mouseDown(region, { clientX: 20, clientY: 210 });
      fireEvent.focusIn(screen.getByRole('button', { name: 'Close' }));
      setScroll(region, 0, 0);
      vi.advanceTimersByTime(0);
      fireEvent.mouseUp(region, { clientX: 20, clientY: 210 });
      fireEvent.click(region, { clientX: 20, clientY: 210 });

      expect(onClose).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a press and click on the scrim while loading, and closes on one once loading ends', () => {
    const onClose = vi.fn();
    const { container, rerender } = render(
      <Overlay>
        <AddPayment inline loading onClose={onClose} />
      </Overlay>,
    );
    const region = firstChild(container);

    pressAndRelease(region, { clientX: 500, clientY: 100 });
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <Overlay>
        <AddPayment inline loading={false} onClose={onClose} />
      </Overlay>,
    );
    pressAndRelease(region, { clientX: 500, clientY: 100 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not treat a press and click on another parent as a scrim press', () => {
    const onClose = vi.fn();
    const { container } = render(
      <div data-testid="plain">
        <AddPayment inline onClose={onClose} />
      </div>,
    );

    pressAndRelease(firstChild(container), { clientX: 500, clientY: 100 });

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('a press on the dark area that moves focus to the page (review WR-01, plan 02-43)', () => {
  function renderInMain(onClose: () => void): { main: HTMLElement; amount: HTMLElement } {
    render(
      <main tabIndex={-1} data-testid="main">
        <Overlay>
          <AddPayment inline onClose={onClose} />
        </Overlay>
      </main>,
    );
    const amount = screen.getByRole('textbox', { name: 'Amount' });
    expect(amount).toHaveFocus();
    return { main: screen.getByTestId('main'), amount };
  }

  it('keeps the caret in the field and the dialog open after a right press that focuses main', () => {
    const onClose = vi.fn();
    const { main, amount } = renderInMain(onClose);
    const region = firstChild(main);
    const focus = vi.spyOn(amount, 'focus');
    const at = { button: 2, clientX: 500, clientY: 100 };

    fireEvent.mouseDown(region, at);
    main.focus();
    fireEvent.mouseUp(region, at);
    fireEvent.click(region, at);
    fireEvent.contextMenu(region, at);

    expect(amount).toHaveFocus();
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('has the field focused again, without scrolling, before the click of a primary press that focuses main, and then closes', () => {
    const onClose = vi.fn();
    const { main, amount } = renderInMain(onClose);
    const region = firstChild(main);
    const focus = vi.spyOn(amount, 'focus');
    const at = { clientX: 500, clientY: 100 };

    fireEvent.mouseDown(region, at);
    main.focus();
    expect(amount).toHaveFocus();
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    fireEvent.mouseUp(region, at);
    fireEvent.click(region, at);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('overlay scenarios (the overlays parity group)', () => {
  const byId = new Map(overlayScenarios.map((scenario) => [scenario.id, scenario]));

  it('declares the Add Payment modal and the slide-over as viewport frames with the reduced-motion pass', () => {
    for (const id of ['modal-add-payment', 'modal-slideover']) {
      const scenario = byId.get(id);
      expect(scenario?.frame, id).toBe('viewport');
      expect(scenario?.themes, id).toEqual(['light', 'dark']);
      expect(scenario?.responsive, id).toBe(true);
      expect(scenario?.passes, id).toEqual(['motion']);
      expect(scenario?.parity, id).toBe(true);
      expect(scenario?.node.component, id).toBe('OpenedDialog');
    }
  });

  it('gives the Add Payment modal its title, a Field and two buttons', () => {
    const modal = byId.get('modal-add-payment')?.node.props?.children;

    expect(modal).toMatchObject({ component: 'Modal', props: { title: 'Add Payment' } });
    expect(JSON.stringify(modal)).toContain('"component":"Field"');
    expect(JSON.stringify(modal).match(/"component":"Button"/g)).toHaveLength(2);
  });

  it('renders the slide-over variant', () => {
    expect(byId.get('modal-slideover')?.node.props?.children).toMatchObject({
      component: 'Modal',
      props: { variant: 'slideover' },
    });
  });
});

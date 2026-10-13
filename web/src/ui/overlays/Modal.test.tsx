import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scenarios as overlayScenarios } from '@/dev/scenarios/groups/overlays';
import { expectNoAxeViolations } from '@/test/axe';
import { Button } from '@/ui/actions';
import { iconButtonClasses } from '@/ui/feedback';
import { Field } from '@/ui/forms';
import { Modal, Overlay, useBodyScrollLock, type ModalProps } from '@/ui/overlays';
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

  it('closes on a mousedown on the scrim, but not on one inside the dialog', () => {
    const onClose = vi.fn();
    const { container } = render(<AddPayment onClose={onClose} />);

    fireEvent.mouseDown(screen.getByRole('dialog'));
    fireEvent.mouseDown(screen.getByRole('textbox', { name: 'Amount' }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(firstChild(container));
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

  it('closes an inline Modal on a mousedown on the region scrim', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Overlay>
        <AddPayment inline onClose={onClose} />
      </Overlay>,
    );

    fireEvent.mouseDown(firstChild(container));

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

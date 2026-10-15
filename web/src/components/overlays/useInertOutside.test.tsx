import { render, screen } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { useInertOutside } from './useInertOutside';

// R2-10: while a dialog is open everything outside it is inert, except the toast layer; closing restores exactly the
// previous state, and dialogs can nest.

function Dialog({ name, active = true, children }: { name: string; active?: boolean; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useInertOutside(ref, active);
  return (
    <div ref={ref} role="dialog" aria-label={name} data-testid={name}>
      {children}
    </div>
  );
}

function isInert(testId: string): boolean {
  return screen.getByTestId(testId).hasAttribute('inert');
}

function Page({ children, dialog = true }: { children?: ReactNode; dialog?: boolean }) {
  return (
    <div data-testid="root">
      <header data-testid="header">Header</header>
      <div data-testid="frame">
        <main data-testid="main">Main</main>
      </div>
      <div data-ui="s-toast-layer" data-testid="toasts">
        <button type="button">Dismiss</button>
      </div>
      <div data-testid="holder">
        <p data-testid="beside">Beside the dialog</p>
        {dialog && <Dialog name="first">{children}</Dialog>}
      </div>
    </div>
  );
}

describe('useInertOutside (R2-10)', () => {
  it('marks every sibling along the path from the dialog up to the page root inert, and nothing on the path', () => {
    render(<Page />);

    for (const id of ['header', 'frame', 'beside']) {
      expect(isInert(id), id).toBe(true);
    }
    for (const id of ['first', 'holder', 'root']) {
      expect(isInert(id), id).toBe(false);
    }
  });

  it('leaves the toast layer live', () => {
    render(<Page />);

    expect(isInert('toasts')).toBe(false);
  });

  it('keeps a toast layer that sits inside a sibling subtree live and marks the rest of that subtree', () => {
    render(
      <div data-testid="root">
        <section data-testid="shell">
          <p data-testid="shell-text">Text</p>
          <div data-ui="s-toast-layer" data-testid="nested-toasts" />
        </section>
        <Dialog name="first" />
      </div>,
    );

    expect(isInert('shell')).toBe(false);
    expect(isInert('shell-text')).toBe(true);
    expect(isInert('nested-toasts')).toBe(false);
  });

  it('removes inert when the dialog goes away, restoring the previous state', () => {
    const { rerender } = render(<Page />);
    expect(isInert('frame')).toBe(true);

    rerender(<Page dialog={false} />);

    for (const id of ['header', 'frame', 'beside', 'holder', 'root']) {
      expect(isInert(id), id).toBe(false);
    }
  });

  it('removes inert from the page when the hook turns inactive', () => {
    const { rerender } = render(
      <div>
        <p data-testid="page">Page</p>
        <Dialog name="first" active />
      </div>,
    );
    expect(isInert('page')).toBe(true);

    rerender(
      <div>
        <p data-testid="page">Page</p>
        <Dialog name="first" active={false} />
      </div>,
    );

    expect(isInert('page')).toBe(false);
  });

  it('does nothing while inactive', () => {
    render(
      <div>
        <p data-testid="page">Page</p>
        <Dialog name="first" active={false} />
      </div>,
    );

    expect(isInert('page')).toBe(false);
  });

  it('keeps an element that was already inert inert after the dialog closes', () => {
    const { rerender } = render(
      <div>
        <p data-testid="locked" inert>
          Already inert
        </p>
        <p data-testid="page">Page</p>
        <Dialog name="first" />
      </div>,
    );
    expect(isInert('locked')).toBe(true);
    expect(isInert('page')).toBe(true);

    rerender(
      <div>
        <p data-testid="locked" inert>
          Already inert
        </p>
        <p data-testid="page">Page</p>
      </div>,
    );

    expect(isInert('locked')).toBe(true);
    expect(isInert('page')).toBe(false);
  });

  it('nests: the second dialog marks the first inert, and closing it restores the first dialog, then the page', () => {
    function Stack({ second, first }: { first: boolean; second: boolean }) {
      return (
        <div>
          <p data-testid="page">Page</p>
          {first && <Dialog name="first" />}
          {second && <Dialog name="second" />}
        </div>
      );
    }
    const { rerender } = render(<Stack first second={false} />);
    expect(isInert('page')).toBe(true);
    expect(isInert('first')).toBe(false);

    rerender(<Stack first second />);
    expect(isInert('page')).toBe(true);
    expect(isInert('first')).toBe(true);
    expect(isInert('second')).toBe(false);

    rerender(<Stack first second={false} />);
    expect(isInert('first')).toBe(false);
    expect(isInert('page')).toBe(true);

    rerender(<Stack first={false} second={false} />);
    expect(isInert('page')).toBe(false);
  });

  it('keeps the page inert when the older of two dialogs closes first', () => {
    function Stack({ first, second }: { first: boolean; second: boolean }) {
      return (
        <div>
          <p data-testid="page">Page</p>
          {first && <Dialog name="first" />}
          {second && <Dialog name="second" />}
        </div>
      );
    }
    const { rerender } = render(<Stack first second />);

    rerender(<Stack first={false} second />);

    expect(isInert('page')).toBe(true);
    expect(isInert('second')).toBe(false);

    rerender(<Stack first={false} second={false} />);
    expect(isInert('page')).toBe(false);
  });
});

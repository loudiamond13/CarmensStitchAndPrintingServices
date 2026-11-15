import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePresence } from './usePresence';

// usePresence keeps a closing node mounted until its exit animation ends (D-38, D-39). jsdom runs no animation, so the
// computed animation name is mocked per test; with no animation the node must go at once.

function mockAnimationName(name: string): void {
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({ animationName: name } as CSSStyleDeclaration);
}

/** Renders the hook and attaches a node to its ref, as React does for the element that carries it. */
function setup(initialOpen: boolean) {
  const node = document.createElement('div');
  const child = document.createElement('span');
  node.append(child);
  const view = renderHook(({ open }) => usePresence(open), { initialProps: { open: initialOpen } });
  act(() => {
    view.result.current.ref(node);
  });
  return { ...view, node, child };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('usePresence', () => {
  it('is mounted and open while open', () => {
    const { result } = setup(true);

    expect(result.current.mounted).toBe(true);
    expect(result.current.state).toBe('open');
  });

  it('is not mounted when it starts closed', () => {
    const { result } = renderHook(() => usePresence(false));

    expect(result.current.mounted).toBe(false);
    expect(result.current.state).toBe('closed');
  });

  it.each(['none', ''])('unmounts in the same commit when the node has no animation (%j)', (name) => {
    mockAnimationName(name);
    const { result, rerender } = setup(true);

    rerender({ open: false });

    expect(result.current.mounted).toBe(false);
    expect(result.current.state).toBe('closed');
  });

  it('stays mounted as closed until the node ends its own animation', () => {
    mockAnimationName('csp-rise-out');
    const { result, rerender, node } = setup(true);

    rerender({ open: false });
    expect(result.current.mounted).toBe(true);
    expect(result.current.state).toBe('closed');

    act(() => {
      node.dispatchEvent(new Event('animationend'));
    });
    expect(result.current.mounted).toBe(false);
  });

  it('ignores an animationend that bubbles up from a child', () => {
    mockAnimationName('csp-rise-out');
    const { result, rerender, child } = setup(true);

    rerender({ open: false });
    act(() => {
      child.dispatchEvent(new Event('animationend', { bubbles: true }));
    });

    expect(result.current.mounted).toBe(true);
  });

  it('unmounts after the 300 ms fallback when no animationend arrives', () => {
    mockAnimationName('csp-rise-out');
    const { result, rerender } = setup(true);

    rerender({ open: false });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current.mounted).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.mounted).toBe(false);
  });

  it('cancels the unmount when it reopens during the close animation', () => {
    mockAnimationName('csp-rise-out');
    const { result, rerender, node } = setup(true);

    rerender({ open: false });
    rerender({ open: true });
    act(() => {
      vi.advanceTimersByTime(400);
      node.dispatchEvent(new Event('animationend'));
    });

    expect(result.current.mounted).toBe(true);
    expect(result.current.state).toBe('open');
  });

  it('mounts again when it opens after being closed', () => {
    mockAnimationName('none');
    const { result, rerender } = setup(true);

    rerender({ open: false });
    expect(result.current.mounted).toBe(false);

    rerender({ open: true });
    expect(result.current.mounted).toBe(true);
    expect(result.current.state).toBe('open');
  });

  it('unmounts at once when the node is gone', () => {
    mockAnimationName('csp-rise-out');
    const { result, rerender } = setup(true);

    act(() => {
      result.current.ref(null);
    });
    rerender({ open: false });

    expect(result.current.mounted).toBe(false);
  });
});

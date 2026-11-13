import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useSwipe } from './useSwipe';

// useSwipe (UI-SPEC G2 "Swipe", C-35): a horizontal pointer move of at least 48px that is more horizontal than vertical.

interface TargetProps {
  onLeft: () => void;
  onRight: () => void;
  onClick?: () => void;
}

function Target({ onLeft, onRight, onClick }: TargetProps) {
  const ref = useRef<HTMLDivElement>(null);
  useSwipe(ref, { onLeft, onRight, minDistance: 48 });
  return (
    <div ref={ref} data-testid="zone">
      <button
        type="button"
        onClick={() => {
          onClick?.();
        }}
      >
        Inside
      </button>
    </div>
  );
}

/** A pointer drag from (0, 0) by (dx, dy) on the element. */
function drag(element: Element, dx: number, dy: number, pointerId = 1) {
  fireEvent.pointerDown(element, { pointerId, isPrimary: true, clientX: 200, clientY: 200 });
  fireEvent.pointerUp(element, { pointerId, isPrimary: true, clientX: 200 + dx, clientY: 200 + dy });
}

function setup(onClick?: () => void) {
  const onLeft = vi.fn();
  const onRight = vi.fn();
  render(<Target onLeft={onLeft} onRight={onRight} {...(onClick === undefined ? {} : { onClick })} />);
  return { onLeft, onRight, zone: screen.getByTestId('zone') };
}

describe('useSwipe (GAL-02, C-35)', () => {
  it('calls onLeft for a 60px move to the left with 10px of vertical drift', () => {
    const { onLeft, onRight, zone } = setup();
    drag(zone, -60, 10);
    expect(onLeft).toHaveBeenCalledTimes(1);
    expect(onRight).not.toHaveBeenCalled();
  });

  it('calls onRight for a 60px move to the right', () => {
    const { onLeft, onRight, zone } = setup();
    drag(zone, 60, -10);
    expect(onRight).toHaveBeenCalledTimes(1);
    expect(onLeft).not.toHaveBeenCalled();
  });

  it('does nothing for a 40px move, which is under the 48px minimum', () => {
    const { onLeft, onRight, zone } = setup();
    drag(zone, -40, 0);
    drag(zone, 40, 0);
    expect(onLeft).not.toHaveBeenCalled();
    expect(onRight).not.toHaveBeenCalled();
  });

  it('moves at exactly 48px', () => {
    const { onLeft, zone } = setup();
    drag(zone, -48, 0);
    expect(onLeft).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a 60px move with 80px of vertical travel (more vertical than horizontal)', () => {
    const { onLeft, onRight, zone } = setup();
    drag(zone, -60, 80);
    drag(zone, 60, -80);
    expect(onLeft).not.toHaveBeenCalled();
    expect(onRight).not.toHaveBeenCalled();
  });

  it('does nothing when the pointer is cancelled, and a pointer up for another pointer does not finish the move', () => {
    const { onLeft, zone } = setup();
    fireEvent.pointerDown(zone, { pointerId: 1, isPrimary: true, clientX: 200, clientY: 200 });
    fireEvent.pointerCancel(zone, { pointerId: 1 });
    fireEvent.pointerUp(zone, { pointerId: 1, isPrimary: true, clientX: 100, clientY: 200 });
    fireEvent.pointerDown(zone, { pointerId: 1, isPrimary: true, clientX: 200, clientY: 200 });
    fireEvent.pointerUp(zone, { pointerId: 2, isPrimary: true, clientX: 100, clientY: 200 });
    expect(onLeft).not.toHaveBeenCalled();
  });

  it('swallows the click that follows a swipe, but not a plain tap', () => {
    const onClick = vi.fn();
    const { zone } = setup(onClick);
    const inside = screen.getByRole('button', { name: 'Inside' });

    drag(inside, -60, 0);
    fireEvent.click(inside);
    expect(onClick).not.toHaveBeenCalled();

    drag(inside, 2, 1);
    fireEvent.click(inside);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(zone).toBeInTheDocument();
  });

  it('stops listening when it unmounts', () => {
    const onLeft = vi.fn();
    const { unmount } = render(<Target onLeft={onLeft} onRight={vi.fn()} />);
    const zone = screen.getByTestId('zone');
    unmount();
    drag(zone, -60, 0);
    expect(onLeft).not.toHaveBeenCalled();
  });
});

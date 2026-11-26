import { render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';

// The setup gives findBy and waitFor 5 seconds, so a slow lazy chunk or answer on a busy machine is not a failure (review G7A-WR-01).

function Late() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setShown(true);
    }, 1500);
    return () => {
      clearTimeout(timer);
    };
  }, []);
  return shown ? <p>Arrived</p> : null;
}

describe('the async wait of the test setup', () => {
  it('waits longer than the Testing Library default of 1 second', async () => {
    render(<Late />);

    expect(await screen.findByText('Arrived')).toBeInTheDocument();
  });
});

// UI-SPEC "UI Considerations" (error | Form submit): after a failed save, focus moves to the first invalid field, so
// keyboard and screen-reader users land on the message that needs them.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { focusFirstInvalid } from './focusFirstInvalid';

describe('focusFirstInvalid', () => {
  it('focuses the first aria-invalid="true" control in DOM order and returns true', () => {
    render(
      <form aria-label="Payment">
        <label>
          Order
          <input name="order" aria-invalid="false" />
        </label>
        <label>
          Amount
          <input name="amount" aria-invalid="true" />
        </label>
        <label>
          Method
          <select name="method" aria-invalid="true">
            <option>Cash</option>
          </select>
        </label>
      </form>,
    );

    const moved = focusFirstInvalid(screen.getByRole('form', { name: 'Payment' }));

    expect(moved).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Amount' })).toHaveFocus();
  });

  it('looks only inside the given root', () => {
    render(
      <>
        <input aria-label="Outside" aria-invalid="true" />
        <section aria-label="Dialog body">
          <textarea aria-label="Note" aria-invalid="true" />
        </section>
      </>,
    );

    expect(focusFirstInvalid(screen.getByRole('region', { name: 'Dialog body' }))).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveFocus();
  });

  it('returns false and leaves focus where it was when nothing is invalid', () => {
    render(
      <form aria-label="Payment">
        <input aria-label="Amount" aria-invalid="false" />
        <button type="submit">Save Payment</button>
      </form>,
    );
    const save = screen.getByRole('button', { name: 'Save Payment' });
    save.focus();

    expect(focusFirstInvalid(screen.getByRole('form', { name: 'Payment' }))).toBe(false);
    expect(save).toHaveFocus();
  });
});

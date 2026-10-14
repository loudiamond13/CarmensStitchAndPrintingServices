import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { expectNoAxeViolations } from '@/test/axe';
import { EmptyValue, STATES_COPY } from '@/components/states';

// EmptyValue (OR-4, owner 2026-10-14): the empty-value marker is an icon, never a dash character. axe on real timers.

const DASHES = new RegExp('[-\\u2012-\\u2015]');

function tokens(classes: string | null | undefined): string[] {
  return (classes ?? '').split(/\s+/).filter(Boolean).sort();
}

describe('EmptyValue', () => {
  it('draws one hidden minus icon and the visually hidden text "Not set"', () => {
    const { container } = render(<EmptyValue />);
    const svgs = container.querySelectorAll('svg');

    expect(svgs).toHaveLength(1);
    const svg = svgs[0];
    expect(svg?.classList).toContain('lucide');
    expect(svg?.classList).toContain('lucide-minus');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('height', '16');
    const hidden = container.querySelector('span span');
    expect(hidden?.textContent).toBe('Not set');
    expect(tokens(hidden?.className)).toEqual(tokens(srOnlyClasses));
    expect(STATES_COPY.emptyValue).toBe('Not set');
  });

  it('reads as "Not set", with no hyphen or long dash', () => {
    const { container } = render(<EmptyValue />);

    expect(container.textContent).toBe('Not set');
    expect(container.textContent).not.toMatch(DASHES);
  });

  it('has no axe violations in a table cell or inline in a paragraph (A11Y-01)', async () => {
    const cell = render(
      <table>
        <caption>Users</caption>
        <thead>
          <tr>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <EmptyValue />
            </td>
          </tr>
        </tbody>
      </table>,
    );
    await expectNoAxeViolations(cell.container);
    const inline = render(
      <p>
        Due <EmptyValue />
      </p>,
    );
    await expectNoAxeViolations(inline.container);
  });
});

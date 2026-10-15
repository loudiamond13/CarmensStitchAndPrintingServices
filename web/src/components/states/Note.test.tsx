import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { Note } from '@/components/states';

// Note (SPEC-GAP, plan 04-26; UI-SPEC "Note"): the App. C `.s-note` look with an 18px icon, optionally a live status.

function tokens(classes: string | null | undefined): string[] {
  return (classes ?? '').split(/\s+/).filter(Boolean).sort();
}

// App. C `.s-note`: flex, gap 8px, padding 12px, radius 8, --surface-2, 13px/18px, --ink-muted.
const NOTE = 'flex items-start gap-2 rounded-sm bg-surface-2 p-3 text-[13px] leading-[18px] text-ink-muted';

describe('Note', () => {
  it('is the .s-note look with an 18px icon hidden from assistive technology, then the text', () => {
    const { container } = render(<Note icon="shield-check">Staff only.</Note>);

    const note = container.firstElementChild;
    expect(tokens(note?.className)).toEqual(tokens(NOTE));
    const icon = note?.firstElementChild;
    expect(icon?.tagName.toLowerCase()).toBe('svg');
    expect(icon).toHaveClass('lucide-shield-check');
    expect(icon).toHaveAttribute('width', '18');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(note).toHaveTextContent('Staff only.');
  });

  it.each([
    ['info', 'lucide-info'],
    ['circle-check', 'lucide-circle-check'],
  ] as const)('draws the %s icon', (icon, className) => {
    const { container } = render(<Note icon={icon}>Text</Note>);

    expect(container.querySelector('svg')).toHaveClass(className);
  });

  it('has no role without live, and is a status with live', () => {
    const { rerender } = render(<Note icon="info">Plain</Note>);
    expect(screen.queryByRole('status')).toBeNull();

    rerender(
      <Note icon="info" live>
        Your session ended. Sign in again.
      </Note>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Your session ended. Sign in again.');
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <Note icon="circle-check" live>
        You&apos;ve signed out.
      </Note>,
    );

    await expectNoAxeViolations(container);
  });
});

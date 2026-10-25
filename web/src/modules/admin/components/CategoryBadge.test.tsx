import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { badgeToneClasses } from '@/components/status/status.recipe';
import { CATEGORY_TONES } from '@/components/status';
import { expectNoAxeViolations } from '@/test/axe';
import { CategoryBadge } from './CategoryBadge';

// CategoryBadge (D-08, D-13): one look for a category everywhere, in the tone the server stores for it.

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean);
}

function hasTone(badge: HTMLElement, tone: keyof typeof badgeToneClasses): boolean {
  return tokens(badgeToneClasses[tone]).every((token) => tokens(badge.className).includes(token));
}

describe('CategoryBadge', () => {
  it.each(CATEGORY_TONES)('shows the name in the stored %s tone', (tone) => {
    render(<CategoryBadge category={{ name: 'Rent', tone }} />);

    const badge = screen.getByText('Rent');
    expect(hasTone(badge, tone)).toBe(true);
  });

  it.each(['danger', 'solid', 'bogus', ''])('shows an unknown tone (%j) as neutral', (tone) => {
    render(<CategoryBadge category={{ name: 'Mystery', tone }} />);

    const badge = screen.getByText('Mystery');
    expect(hasTone(badge, 'neutral')).toBe(true);
    expect(hasTone(badge, 'accent')).toBe(false);
  });

  it('shows a retired category the same way: "retired" belongs to the filter and the picker only (D-11)', () => {
    render(<CategoryBadge category={{ name: 'Rent', tone: 'accent', retired: true }} />);

    const badge = screen.getByText('Rent');
    expect(hasTone(badge, 'accent')).toBe(true);
    expect(screen.queryByText(/retired/i)).toBeNull();
  });

  it('renders markup in a name as text', () => {
    render(<CategoryBadge category={{ name: '<i>Taxes</i>', tone: 'info' }} />);

    expect(screen.getByText('<i>Taxes</i>')).toBeVisible();
    expect(document.querySelector('i')).toBeNull();
  });

  it('wraps a 40-character name inside its cell instead of widening it', () => {
    const name = 'Government contributions and permits ok';
    render(<CategoryBadge category={{ name, tone: 'info' }} />);

    const badge = screen.getByText(name);
    expect(tokens(badge.className)).toContain('wrap-anywhere');
  });

  it('has no axe violations in any tone', async () => {
    const { container } = render(
      <ul>
        {CATEGORY_TONES.map((tone) => (
          <li key={tone}>
            <CategoryBadge category={{ name: `Category ${tone}`, tone }} />
          </li>
        ))}
      </ul>,
    );

    await expectNoAxeViolations(container);
  });
});

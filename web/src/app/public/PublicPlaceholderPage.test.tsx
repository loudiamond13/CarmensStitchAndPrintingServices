import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { PublicPlaceholderPage } from './PublicPlaceholderPage';

describe('PublicPlaceholderPage (D-21)', () => {
  it('renders exactly one h1, named "Site update in progress."', () => {
    render(<PublicPlaceholderPage />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAccessibleName('Site update in progress.');
  });

  it('tells visitors how to order while the site is being rebuilt', () => {
    render(<PublicPlaceholderPage />);
    expect(screen.getByText(/To order now, message us on Messenger or call the shop/)).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<PublicPlaceholderPage />);
    await expectNoAxeViolations(container);
  });
});

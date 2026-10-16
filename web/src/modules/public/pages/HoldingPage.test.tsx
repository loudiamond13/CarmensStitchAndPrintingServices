import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { HOLDING_PAGE } from '../copy';
import { HoldingPage } from './HoldingPage';

// Values the owner gave on 2026-10-16 (plan 03-09, Task 1). A change here is an owner decision.
const HEADING = 'New website on the way.';

describe('HoldingPage (D-17)', () => {
  it('renders exactly one h1, named with the approved heading', () => {
    render(<HoldingPage />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAccessibleName(HEADING);
  });

  it('shows the shop name, the new-website line, the address and the hours', () => {
    render(<HoldingPage />);
    expect(screen.getByText("Carmen's Stitch & Printing Services")).toBeInTheDocument();
    expect(
      screen.getByText('Our new website is almost ready. To order now, call the shop or message us on Facebook.'),
    ).toBeInTheDocument();
    expect(screen.getByText('D7 Dagohoy St., Poblacion, Carmen, Agusan Del Norte')).toBeInTheDocument();
    expect(screen.getByText('Mon-Sat · 9:00 AM - 6:00 PM')).toBeInTheDocument();
  });

  it('links the phone with a tel: link in international form and shows it readably', () => {
    render(<HoldingPage />);
    const phone = screen.getByRole('link', { name: '0976 287 1938' });
    expect(phone).toHaveAttribute('href', 'tel:+639762871938');
  });

  it('links the Facebook page over https and keeps the opener to itself', () => {
    render(<HoldingPage />);
    const facebook = screen.getByRole('link', { name: /Facebook/ });
    expect(facebook).toHaveAttribute('href', 'https://www.facebook.com/csptailoring2025');
    expect(facebook.getAttribute('rel')?.split(' ').sort()).toEqual(['noopener', 'noreferrer']);
  });

  it('shows no placeholder or invented fact (T-03-38): no brackets, no # link, no long dash', () => {
    const { container } = render(<HoldingPage />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/[[\]]/);
    expect(text).not.toMatch(/[–—]/);
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toBe('#');
      expect(link.getAttribute('href')).toMatch(/^(tel:\+63|https:\/\/)/);
    }
    expect(HOLDING_PAGE.phone.href).toMatch(/^tel:\+63/);
  });

  it('is its own light page root with one main landmark and no style attribute (T-03-40)', () => {
    const { container } = render(<HoldingPage />);
    const root = container.firstElementChild;
    expect(root).toHaveAttribute('data-theme', 'light');
    expect(root).toHaveClass('@container/pg');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(container.querySelector('[style]')).toBeNull();
  });

  it('keeps every link at least 44 px tall (min-h-11)', () => {
    render(<HoldingPage />);
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveClass('min-h-11');
    }
  });

  it('re-renders from the React Compiler memo cache with the same output (L-13)', () => {
    const { container, rerender } = render(<HoldingPage />);
    const first = container.innerHTML;
    rerender(<HoldingPage />);
    expect(container.innerHTML).toBe(first);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('has no axe violations', async () => {
    const { container } = render(<HoldingPage />);
    await expectNoAxeViolations(container);
  });
});

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePageTitle } from './usePageTitle';

function Page({ title }: { title: string }) {
  usePageTitle(title);
  return null;
}

describe('usePageTitle (PUB-04: the client sets the same title the server sends)', () => {
  it('sets the products title', () => {
    render(<Page title="Products and Prices · CSPS" />);
    expect(document.title).toBe('Products and Prices · CSPS');
  });

  it('sets the 404 title', () => {
    render(<Page title="Page Not Found · CSPS" />);
    expect(document.title).toBe('Page Not Found · CSPS');
  });

  it('follows a changed title', () => {
    const { rerender } = render(<Page title="Our Work · Gallery · CSPS" />);
    expect(document.title).toBe('Our Work · Gallery · CSPS');
    rerender(<Page title="Contact Us and Get a Quote · CSPS" />);
    expect(document.title).toBe('Contact Us and Get a Quote · CSPS');
  });
});

// ProductArticle's Get a Quote link (UI-SPEC Q4, D-24, T-11-44): it names the line in ?product= only when the key is safe.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { makeLine } from '@/test/publicFixtures';
import { ProductArticle } from './ProductArticle';

function renderArticle(key: string) {
  render(
    <MemoryRouter>
      <ProductArticle line={makeLine({ key, title: 'Basketball Jerseys' })} index={0} total={1} />
    </MemoryRouter>,
  );
  return screen.getByRole('link', { name: 'Get a Quote' });
}

describe('ProductArticle Get a Quote (Q4)', () => {
  it('goes to /contact?product={line key}', () => {
    expect(renderArticle('basketball-jerseys')).toHaveAttribute('href', '/contact?product=basketball-jerseys');
  });

  it('goes to plain /contact when the key fails the allow-list', () => {
    expect(renderArticle('../../admin')).toHaveAttribute('href', '/contact');
  });
});

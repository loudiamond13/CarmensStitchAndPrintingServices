// The Home page parts (UI-SPEC H1, App. E.1; PUB-01, PUB-02, CONT-03, D-34, D-36): the category grid, the hero drawing,
// Why CSPS, the testimonial row and the final call to action.
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { demoHome, homeOneLine, makeHomeLine, photoFor, makeLine } from '@/test/publicFixtures';
import { CategoryGrid } from './CategoryGrid';

describe('CategoryGrid (PUB-02, D-34)', () => {
  function renderGrid(lines = demoHome.lines) {
    return render(
      <MemoryRouter>
        <CategoryGrid lines={lines} />
      </MemoryRouter>,
    );
  }

  it('shows the eyebrow, the h2 "Pick your kit." and the lead with the line count in words', () => {
    renderGrid();

    expect(screen.getByText('What we make')).toBeInTheDocument();
    const heading = screen.getByRole('heading', { level: 2, name: 'Pick your kit.' });
    expect(heading.querySelector('em')).toHaveTextContent('kit.');
    expect(
      screen.getByText('Six ways to suit up, every one fully customizable, from fabric to the last digit on the back.'),
    ).toBeInTheDocument();
  });

  it('with one line the lead reads "One way to suit up, ..."', () => {
    renderGrid(homeOneLine.lines);

    expect(
      screen.getByText('One way to suit up, fully customizable, from fabric to the last digit on the back.'),
    ).toBeInTheDocument();
  });

  it('has the "All products" link to /products', () => {
    renderGrid();

    expect(screen.getByRole('link', { name: 'All products' })).toHaveAttribute('href', '/products');
  });

  it('shows one card per line in order with the title, the card text and the number, each linking to /products#key', () => {
    renderGrid();

    const titles = screen.getAllByRole('heading', { level: 3 }).map((title) => title.textContent);
    expect(titles).toEqual([
      'Basketball Jerseys',
      'Volleyball Jerseys',
      'Moto Riding Jerseys',
      'Long Sleeves',
      'Polo Shirts',
      'Custom Designs',
    ]);
    const cards = screen.getAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('/products#'));
    expect(cards.map((card) => card.getAttribute('href'))).toEqual([
      '/products#basketball',
      '/products#volleyball',
      '/products#moto',
      '/products#longsleeves',
      '/products#polo',
      '/products#custom',
    ]);
    const first = within(screen.getByRole('link', { name: /Basketball Jerseys/ }));
    expect(
      first.getByText('Full sublimation tops and shorts, any colorway, names and numbers included.'),
    ).toBeInTheDocument();
    expect(first.getByRole('img', { name: 'No image yet' })).toHaveTextContent('23');
  });

  it('draws the Main photo of a line that has one, with its own srcSet, and the placeholder for the others', () => {
    const photo = photoFor('card');
    const lines = [
      makeHomeLine(makeLine({ key: 'basketball', title: 'Basketball Jerseys', number: '23' }), { cardPhoto: photo }),
      makeHomeLine(makeLine({ key: 'polo', title: 'Polo Shirts', number: '03' })),
    ];
    const { container } = renderGrid(lines);

    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0]?.getAttribute('srcset')).toBe(photo.srcSet);
    expect(screen.getAllByRole('img', { name: 'No image yet' })).toHaveLength(1);
  });

  it('sends a line whose key is not a safe key to /products instead of building an address from it', () => {
    renderGrid([makeHomeLine(makeLine({ key: 'basketball' }), { key: 'Bad Key' })]);

    expect(screen.getByRole('link', { name: /Sample Jerseys/ })).toHaveAttribute('href', '/products');
  });

  it('has no axe violations', async () => {
    const { container } = renderGrid();

    await expectNoAxeViolations(container);
  });
});

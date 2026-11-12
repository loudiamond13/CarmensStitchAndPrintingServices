// The Products page parts (UI-SPEC P1, App. E.2; PUB-01, PUB-02, D-02, D-04, D-07, D-19, D-32): the article, its media and
// price line, the anchor pills, the buttons and the help card.
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { demoLine, demoLines, lineWithPhotos, makeLine, type PublicProductLineFixture } from '@/test/publicFixtures';
import { AnchorPills } from './AnchorPills';
import { PriceLine } from './PriceLine';
import { ProductArticle } from './ProductArticle';
import { ProductMedia } from './ProductMedia';

const BASKETBALL = demoLine('basketball');

function renderArticle(line: PublicProductLineFixture, index = 0, total = 6) {
  return render(
    <MemoryRouter>
      <ProductArticle line={line} index={index} total={total} />
    </MemoryRouter>,
  );
}

describe('ProductArticle (PUB-01, PUB-02, D-07)', () => {
  it('is an article named by its h2, with the line key as its id', () => {
    renderArticle(BASKETBALL);

    const article = screen.getByRole('article', { name: 'Basketball Jerseys' });
    expect(article).toHaveAttribute('id', 'basketball');
    expect(within(article).getByRole('heading', { level: 2, name: 'Basketball Jerseys' })).toBeInTheDocument();
  });

  it('shows the number as "01 / 06", hidden from assistive technology, and the description', () => {
    renderArticle(BASKETBALL, 0, 6);

    const number = screen.getByText('01 / 06');
    expect(number).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText(BASKETBALL.description)).toBeInTheDocument();
  });

  it('counts the position and the total in two digits, and a single line reads "01 / 01"', () => {
    const { unmount } = renderArticle(BASKETBALL, 5, 6);
    expect(screen.getByText('06 / 06')).toBeInTheDocument();
    unmount();
    renderArticle(BASKETBALL, 0, 1);
    expect(screen.getByText('01 / 01')).toBeInTheDocument();
  });

  it('flips the even articles (the second, fourth and sixth)', () => {
    const { unmount } = renderArticle(BASKETBALL, 0);
    expect(screen.getByRole('article')).not.toHaveAttribute('data-flip');
    unmount();
    renderArticle(BASKETBALL, 1);
    expect(screen.getByRole('article')).toHaveAttribute('data-flip', 'true');
  });

  it('shows "What you can customize" and the five cards in their fixed order with their icons and texts', () => {
    renderArticle(BASKETBALL);

    expect(screen.getByRole('heading', { level: 3, name: 'What you can customize' })).toBeInTheDocument();
    const titles = screen.getAllByRole('heading', { level: 4 });
    expect(titles.map((title) => title.textContent)).toEqual([
      'Fabric',
      'Collar style',
      'Cut & fit',
      'Names & numbers',
      'Logos & sponsors',
    ]);
    const icons = ['layout-grid', 'shirt', 'ruler', 'zap', 'palette'];
    titles.forEach((title, position) => {
      expect(title.querySelector(`svg.lucide-${icons[position] ?? ''}`)).not.toBeNull();
    });
    const texts = [
      BASKETBALL.customize.fabric,
      BASKETBALL.customize.collar,
      BASKETBALL.customize.cut,
      BASKETBALL.customize.names,
      BASKETBALL.customize.logos,
    ];
    titles.forEach((title, position) => {
      expect(title.nextElementSibling).toHaveTextContent(texts[position] ?? '');
    });
  });

  it('shows the price line from the server value and the minimum', () => {
    renderArticle(BASKETBALL);

    expect(screen.getByText('Starts at')).toBeInTheDocument();
    expect(screen.getByText('₱650.00')).toBeInTheDocument();
    expect(screen.getByText(/^\/ pc/)).toHaveTextContent('/ pc · min. 10 pcs');
  });

  it('has no axe violations', async () => {
    const { container } = renderArticle(BASKETBALL);
    await expectNoAxeViolations(container);
  });
});

describe('PriceLine (D-04)', () => {
  it('with a price and a minimum of 10 reads "Starts at ₱650.00 / pc · min. 10 pcs"', () => {
    const { container } = render(<PriceLine price={650} minimum={10} />);

    expect(container).toHaveTextContent('Starts at₱650.00/ pc · min. 10 pcs');
    expect(screen.getByText('₱650.00').tagName).toBe('STRONG');
  });

  it('writes the server price with centavos and thousands, and takes a string price', () => {
    render(<PriceLine price="1250.5" minimum={null} />);

    expect(screen.getByText('₱1,250.50')).toBeInTheDocument();
  });

  it('with a minimum of 1 says "min. 1 pc"', () => {
    render(<PriceLine price={450} minimum={1} />);

    expect(screen.getByText(/^\/ pc/)).toHaveTextContent('/ pc · min. 1 pc');
    expect(screen.queryByText(/pcs/)).toBeNull();
  });

  it('with a price and no minimum leaves the minimum part out', () => {
    render(<PriceLine price={650} minimum={null} />);

    expect(screen.getByText('/ pc')).toBeInTheDocument();
    expect(screen.queryByText(/min\./)).toBeNull();
  });

  it('with no price shows "Message us for a price" and no "Starts at" or "/ pc"', () => {
    const { container } = render(<PriceLine price={null} minimum={null} />);

    expect(screen.getByText('Message us for a price').tagName).toBe('STRONG');
    expect(container).not.toHaveTextContent('Starts at');
    expect(container).not.toHaveTextContent('/ pc');
    expect(container).not.toHaveTextContent('min.');
  });

  it('with no price but a minimum keeps the minimum part', () => {
    const { container } = render(<PriceLine price={null} minimum={5} />);

    expect(container).toHaveTextContent('Message us for a price · min. 5 pcs');
  });
});

describe('ProductMedia (D-02)', () => {
  it('with no photos draws the jersey and the two labelled placeholders', () => {
    const { container } = render(<ProductMedia line={BASKETBALL} />);

    expect(container.querySelector('svg[viewBox="0 0 400 480"]')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('img', { name: 'Back view (no image yet)' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Fabric detail (no image yet)' })).toBeInTheDocument();
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('draws the sleeve jersey for a sleeve line, in the line number', () => {
    const { container } = render(
      <ProductMedia line={makeLine({ key: 'moto', title: 'Moto', number: '07', placeholderArt: 'moto' })} />,
    );

    expect(container.querySelector('svg text')).toHaveTextContent('07');
    expect(container.querySelector('svg text')).toHaveAttribute('font-size', '130');
  });

  it('with photos shows them with the front, back and fabric alts and no drawing', () => {
    const { container } = render(<ProductMedia line={lineWithPhotos} />);

    expect(screen.getByAltText('Basketball Jerseys, front')).toHaveAttribute(
      'src',
      'https://res.cloudinary.com/sample-cloud/image/upload/main-800.jpg',
    );
    expect(screen.getByAltText('Basketball Jerseys, back view')).toBeInTheDocument();
    expect(screen.getByAltText('Basketball Jerseys, fabric detail')).toBeInTheDocument();
    expect(container.querySelector('svg[viewBox="0 0 400 480"]')).toBeNull();
  });

  it('a photo with its srcSet and the product sizes lets the browser choose the delivered size', () => {
    render(<ProductMedia line={lineWithPhotos} />);

    const large = screen.getByAltText('Basketball Jerseys, front');
    expect(large).toHaveAttribute('srcset', expect.stringContaining('400w'));
    expect(large).toHaveAttribute('sizes', expect.stringContaining('400px'));
    expect(screen.getByAltText('Basketball Jerseys, back view')).toHaveAttribute(
      'sizes',
      expect.stringContaining('200px'),
    );
  });

  it('mixes a photo and a placeholder when only one slot has a photo', () => {
    const line = makeLine({
      key: 'polo',
      title: 'Polo Shirts',
      placeholderArt: 'polo',
      photos: { main: lineWithPhotos.photos.main, back: null, fabric: null },
    });
    const { container } = render(<ProductMedia line={line} />);

    expect(screen.getByAltText('Polo Shirts, front')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Back view (no image yet)' })).toBeInTheDocument();
    expect(container.querySelector('svg[viewBox="0 0 400 480"]')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(<ProductMedia line={BASKETBALL} />);
    await expectNoAxeViolations(container);
  });
});

describe('AnchorPills (D-32)', () => {
  function renderPills(lines: readonly PublicProductLineFixture[]) {
    return render(
      <MemoryRouter>
        <AnchorPills lines={lines} />
      </MemoryRouter>,
    );
  }

  it('is a nav named "Product lines" with one link per line to #key, in display order', () => {
    renderPills(demoLines.lines);

    const nav = screen.getByRole('navigation', { name: 'Product lines' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(demoLines.lines.map((line) => line.title));
    expect(links.map((link) => link.getAttribute('href'))).toEqual(demoLines.lines.map((line) => `#${line.key}`));
  });

  it('makes every pill 44px tall (min-h-11) so a thumb can hit it', () => {
    renderPills(demoLines.lines);

    for (const link of screen.getAllByRole('link')) {
      expect(link.className.split(' ')).toContain('min-h-11');
    }
  });

  it('gives a key that fails the allow-list no link', () => {
    renderPills([
      makeLine({ key: 'Bad Key', title: 'Bad one' }),
      makeLine({ key: 'javascript:alert(1)', title: 'Script one' }),
      makeLine({ key: 'polo', title: 'Polo Shirts' }),
    ]);

    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#polo']);
  });

  it('draws nothing when no key is safe', () => {
    const { container } = renderPills([makeLine({ key: 'Bad Key' })]);

    expect(container).toBeEmptyDOMElement();
  });

  it('has no axe violations', async () => {
    const { container } = renderPills(demoLines.lines);
    await expectNoAxeViolations(container);
  });
});

describe('ProductArticle buttons (D-19)', () => {
  it('"Get a Quote" goes to /contact', () => {
    renderArticle(BASKETBALL);

    expect(screen.getByRole('link', { name: 'Get a Quote' })).toHaveAttribute('href', '/contact');
  });

  it('shows "See basketball work" to the gallery filter when the line has gallery items', () => {
    renderArticle(BASKETBALL);

    expect(screen.getByRole('link', { name: 'See basketball work' })).toHaveAttribute(
      'href',
      '/gallery?category=basketball',
    );
  });

  it('puts the short name in lower case in the button text', () => {
    renderArticle(
      makeLine({ key: 'longsleeves', title: 'Long Sleeves', shortName: 'Long Sleeves', hasGalleryItems: true }),
    );

    expect(screen.getByRole('link', { name: 'See long sleeves work' })).toHaveAttribute(
      'href',
      '/gallery?category=longsleeves',
    );
  });

  it('leaves "See work" out when the line has no gallery item', () => {
    renderArticle(demoLine('volleyball'));

    expect(screen.getByRole('link', { name: 'Get a Quote' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^See .* work$/ })).toBeNull();
  });

  it('leaves "See work" out when the key fails the allow-list', () => {
    renderArticle(makeLine({ key: 'Bad Key', title: 'Bad one', shortName: 'Bad', hasGalleryItems: true }));

    expect(screen.queryByRole('link', { name: /^See .* work$/ })).toBeNull();
  });
});

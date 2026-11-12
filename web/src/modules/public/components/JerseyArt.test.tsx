// JerseyArt (UI-SPEC P1, spec 7.2 and 7.5): the drawn tank and long-sleeve jerseys, decorative, with the colors as SVG
// fill attributes (strict CSP: no style attribute).
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { artFor, JerseyArt } from './JerseyArt';

const TANK_BODY =
  'M118,18 C150,74 250,74 282,18 L332,18 C332,108 356,148 384,160 L384,470 L16,470 L16,160 C44,148 68,108 68,18 Z';
const SLEEVE_BODY =
  'M140,26 C165,64 235,64 260,26 L340,52 L398,250 L340,268 L320,190 L320,470 L80,470 L80,190 L60,268 L2,250 L60,52 Z';

describe('JerseyArt', () => {
  it('draws the tank with the body, band, collar stroke and number in the given colors', () => {
    const { container } = render(<JerseyArt shape="tank" c1="#111111" c2="#222222" c3="#333333" number="23" />);
    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('viewBox', '0 0 400 480');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    const paths = [...container.querySelectorAll('path')];
    expect(paths.map((path) => path.getAttribute('d'))).toEqual([
      TANK_BODY,
      'M16,250 L384,170 L384,210 L16,290 Z',
      'M118,18 C150,74 250,74 282,18',
    ]);
    expect(paths[0]).toHaveAttribute('fill', '#111111');
    expect(paths[1]).toHaveAttribute('fill', '#222222');
    expect(paths[2]).toHaveAttribute('stroke', '#222222');
    expect(paths[2]).toHaveAttribute('stroke-width', '10');
    const number = container.querySelector('text');
    expect(number).toHaveTextContent('23');
    expect(number).toHaveAttribute('fill', '#333333');
    expect(number).toHaveAttribute('font-size', '150');
  });

  it('draws the long sleeve with its own body, two panels, the c3 collar and a 130 number', () => {
    const { container } = render(<JerseyArt shape="sleeve" c1="#111111" c2="#222222" c3="#333333" number="07" />);
    const paths = [...container.querySelectorAll('path')];

    expect(paths.map((path) => path.getAttribute('d'))).toEqual([
      SLEEVE_BODY,
      'M60,52 L140,26 L170,120 L2,250 Z',
      'M340,52 L260,26 L230,120 L398,250 Z',
      'M140,26 C165,64 235,64 260,26',
    ]);
    expect(paths[0]).toHaveAttribute('fill', '#111111');
    expect(paths[1]).toHaveAttribute('fill', '#222222');
    expect(paths[2]).toHaveAttribute('fill', '#222222');
    expect(paths[3]).toHaveAttribute('stroke', '#333333');
    expect(container.querySelector('text')).toHaveAttribute('font-size', '130');
  });

  it('is decorative and carries no style attribute anywhere', () => {
    const { container } = render(<JerseyArt shape="tank" c1="#111111" c2="#222222" c3="#333333" number="1" />);

    expect(container.querySelectorAll('[style]')).toHaveLength(0);
    expect(container.querySelector('[role="img"]')).toBeNull();
  });
});

describe('artFor', () => {
  it.each([
    ['basketball', 'tank', '#572e2b', '#ff6600', '#ff6600'],
    ['volleyball', 'tank', '#7a1430', '#ffffff', '#ffffff'],
    ['moto', 'sleeve', '#1d3b8f', '#f2f2ef', '#ffb547'],
    ['longSleeves', 'sleeve', '#0e2a24', '#3fe0b8', '#f3f4f0'],
    ['polo', 'sleeve', '#f2f2ef', '#121411', '#121411'],
    ['custom', 'tank', '#24282d', '#b9a7ff', '#ff6600'],
  ])('gives %s its spec shape and colors', (name, shape, c1, c2, c3) => {
    expect(artFor(name)).toEqual({ shape, c1, c2, c3 });
  });

  it('falls back to the custom drawing for a name it does not know', () => {
    expect(artFor('something-new')).toEqual(artFor('custom'));
  });
});

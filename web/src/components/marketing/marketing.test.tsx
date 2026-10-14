import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import {
  CATEGORY_BASKETBALL,
  ORDERING_STEPS,
  scenarios as marketingScenarios,
  TESTIMONIAL_JUAN,
} from '@/dev/scenarios/groups/marketing';
import { expectNoAxeViolations } from '@/test/axe';
import { CategoryCard, ProcessSteps, TestimonialCard, type ProcessStep } from '@/components/marketing';
import {
  bylineClasses,
  bylineNameClasses,
  bylineTeamClasses,
  categoryBodyClasses,
  categoryCardClasses,
  categoryDescriptionClasses,
  categoryImageClasses,
  categoryLinkClasses,
  categoryLinkIconClasses,
  categoryMediaClasses,
  categoryPlaceholderClasses,
  categoryTitleClasses,
  quoteClasses,
  starOnClasses,
  starsClasses,
  stepClasses,
  stepDescriptionClasses,
  stepIconClasses,
  stepNumberClasses,
  stepsClasses,
  stepTitleClasses,
  testimonialClasses,
} from './marketing.recipe';

// The converted App. D.3 marketing components (plan 02-25, CSPS-UI-SPEC.md §6.7, §8.1): CategoryCard, ProcessSteps and
// TestimonialCard, in Blush only (D-14). The look is proven by the parity suite (`--grep @marketing`); these tests pin
// the markup, the names (D-31 O-2: the star rating is a named image) and the scenario set it compares.

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean).sort();
}

/** True when the element carries every token of the class list. */
function hasClasses(element: Element | null | undefined, classes: string): boolean {
  const own = new Set(element?.classList ?? []);
  return tokens(classes).length > 0 && tokens(classes).every((token) => own.has(token));
}

function inRouter(children: ReactNode) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

const byId = new Map(marketingScenarios.map((scenario) => [scenario.id, scenario]));

/** Renders a marketing scenario exactly as the parity page does: through the implementation kit, in a router. */
function renderCase(id: string) {
  const scenario = byId.get(id);
  if (scenario === undefined) {
    throw new Error(`No marketing scenario "${id}".`);
  }
  return render(inRouter(renderNode(kit, scenario.node, scenario.handlers ?? [])));
}

const basketball = CATEGORY_BASKETBALL as unknown as { title: string; description: string; number: string };
const steps = ORDERING_STEPS as unknown as ProcessStep[];
const juan = TESTIMONIAL_JUAN as unknown as { quote: string; name: string; team: string };

describe('CategoryCard (App. D.3)', () => {
  it('is one in-app link to the products page, named by its content', () => {
    render(inRouter(<CategoryCard {...basketball} />));
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/products');
    expect(link.dataset.discover).toBe('true');
    expect(hasClasses(link, categoryCardClasses)).toBe(true);
    expect(link.classList.contains('group/cat')).toBe(true);
    expect(link.textContent).toContain('Basketball Jerseys');
    expect(link.textContent).toContain('Customize');
  });

  it('shows the chip-less placeholder with the outlined number, then the title, the description and "Customize"', () => {
    render(inRouter(<CategoryCard {...basketball} />));
    const link = screen.getByRole('link');
    const [media, body] = [...link.children];
    expect(hasClasses(media, categoryMediaClasses)).toBe(true);
    const placeholder = within(media as HTMLElement).getByRole('img', { name: 'No image yet' });
    expect(hasClasses(placeholder, categoryPlaceholderClasses)).toBe(true);
    expect(placeholder.textContent).toBe('23');
    expect(hasClasses(body, categoryBodyClasses)).toBe(true);
    const title = screen.getByRole('heading', { level: 3, name: 'Basketball Jerseys' });
    expect(hasClasses(title, categoryTitleClasses)).toBe(true);
    const description = screen.getByText(basketball.description);
    expect(description.tagName).toBe('P');
    expect(hasClasses(description, categoryDescriptionClasses)).toBe(true);
    const customize = screen.getByText('Customize');
    expect(hasClasses(customize, categoryLinkClasses)).toBe(true);
    expect(hasClasses(customize.querySelector('svg'), categoryLinkIconClasses)).toBe(true);
  });

  it('shows a decorative photo when it has one, and links where it is told', () => {
    const { container } = render(
      inRouter(<CategoryCard title="Polo Shirts" description="Polos." image="/img/polo.webp" href="/products/polo" />),
    );
    const photo = container.querySelector('img');
    expect(photo?.getAttribute('alt')).toBe('');
    expect(photo?.getAttribute('src')).toBe('/img/polo.webp');
    expect(hasClasses(photo, categoryImageClasses)).toBe(true);
    expect(screen.queryByRole('img', { name: 'No image yet' })).toBeNull();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/products/polo');
  });

  it('renders the same markup again for the same props, and the new card for new props', () => {
    const { container, rerender } = render(inRouter(<CategoryCard {...basketball} />));
    const first = container.innerHTML;
    rerender(inRouter(<CategoryCard {...basketball} />));
    expect(container.innerHTML).toBe(first);
    rerender(inRouter(<CategoryCard title="Custom Designs" description="Bring a sketch." number="00" />));
    expect(screen.getByRole('heading', { name: 'Custom Designs' })).toBeDefined();
  });
});

describe('ProcessSteps (App. D.3)', () => {
  it('is an ordered list of the steps, each with its two-digit numeral, icon, title and description', () => {
    const { container } = render(<ProcessSteps steps={steps} />);
    const list = screen.getByRole('list');
    expect(list.tagName).toBe('OL');
    expect(hasClasses(list, stepsClasses)).toBe(true);
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    items.forEach((item, index) => {
      expect(hasClasses(item, stepClasses)).toBe(true);
      const numeral = item.firstElementChild;
      expect(numeral?.textContent).toBe(`0${String(index + 1)}`);
      expect(numeral?.getAttribute('aria-hidden')).toBe('true');
      expect(hasClasses(numeral, stepNumberClasses)).toBe(true);
      const icon = item.children[1];
      expect(hasClasses(icon, stepIconClasses)).toBe(true);
      expect(icon?.querySelector('svg')?.getAttribute('width')).toBe('22');
      const title = within(item).getByRole('heading', { level: 3 });
      expect(title.textContent).toBe(steps[index]?.title);
      expect(hasClasses(title, stepTitleClasses)).toBe(true);
      const description = item.lastElementChild;
      expect(description?.textContent).toBe(steps[index]?.description);
      expect(hasClasses(description, stepDescriptionClasses)).toBe(true);
    });
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(4);
  });

  it('leaves out the icon of a step that has none', () => {
    render(<ProcessSteps steps={[{ title: 'Measure', description: 'We take sizes.' }]} />);
    const item = screen.getByRole('listitem');
    expect(item.querySelector('svg')).toBeNull();
    expect(item.children).toHaveLength(3);
  });

  it('renders the same markup again for the same steps, and the new list for new steps', () => {
    const { container, rerender } = render(<ProcessSteps steps={steps} />);
    const first = container.innerHTML;
    rerender(<ProcessSteps steps={steps} />);
    expect(container.innerHTML).toBe(first);
    rerender(<ProcessSteps steps={steps.slice(0, 2)} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});

describe('TestimonialCard (App. D.3, D-31 O-2)', () => {
  it('names the star rating as one image (O-2) and fills as many stars as the rating', () => {
    render(<TestimonialCard {...juan} />);
    const stars = screen.getByRole('img', { name: '5 out of 5' });
    expect(hasClasses(stars, starsClasses)).toBe(true);
    const icons = stars.querySelectorAll('svg');
    expect(icons).toHaveLength(5);
    expect([...icons].every((icon) => hasClasses(icon, starOnClasses))).toBe(true);
    expect([...icons].every((icon) => icon.getAttribute('width') === '16')).toBe(true);
  });

  it('leaves the stars above the rating empty', () => {
    render(<TestimonialCard {...juan} rating={3} />);
    const stars = screen.getByRole('img', { name: '3 out of 5' });
    const filled = [...stars.querySelectorAll('svg')].map((icon) => hasClasses(icon, starOnClasses));
    expect(filled).toEqual([true, true, true, false, false]);
  });

  it('is a figure: the quote in a blockquote with curly quote marks, then the avatar, name and team', () => {
    const { container } = render(<TestimonialCard {...juan} />);
    const figure = screen.getByRole('figure');
    expect(hasClasses(figure, testimonialClasses)).toBe(true);
    const quote = container.querySelector('blockquote');
    expect(quote?.textContent).toBe(juan.quote);
    expect(hasClasses(quote, quoteClasses)).toBe(true);
    expect(quote?.className).toContain("before:content-['“']");
    expect(quote?.className).toContain("after:content-['”']");
    const byline = container.querySelector('figcaption');
    if (!(byline instanceof HTMLElement)) {
      throw new Error('No figcaption.');
    }
    expect(hasClasses(byline, bylineClasses)).toBe(true);
    const avatar = within(byline).getByRole('img', { name: 'Juan Dela Cruz' });
    expect(avatar.textContent).toBe('JD');
    const name = within(byline).getByText('Juan Dela Cruz', { selector: 'strong' });
    expect(hasClasses(name, bylineNameClasses)).toBe(true);
    const team = within(byline).getByText('Captain, Brgy. San Roque Ballers');
    expect(hasClasses(team, bylineTeamClasses)).toBe(true);
  });

  it('renders the same markup again for the same props, and the new card for new props', () => {
    const { container, rerender } = render(<TestimonialCard {...juan} />);
    const first = container.innerHTML;
    rerender(<TestimonialCard {...juan} />);
    expect(container.innerHTML).toBe(first);
    rerender(<TestimonialCard quote="Great." name="Mark Villanueva" team="Tondo Riders MC" rating={4} />);
    expect(screen.getByRole('img', { name: '4 out of 5' })).toBeDefined();
  });
});

describe('Marketing scenarios and axe', () => {
  it('lists the marketing cases the parity suite compares (Blush only, D-14)', () => {
    expect(marketingScenarios.map((s) => [s.id, s.states.join('+'), s.responsive])).toEqual([
      ['category-card', 'rest+hover', false],
      ['process-steps', 'rest', true],
      ['testimonial-card', 'rest', false],
      ['testimonial-card-rating-4', 'rest', false],
    ]);
    expect(marketingScenarios.every((s) => s.group === 'marketing' && s.parity && s.themes.join() === 'light')).toBe(
      true,
    );
  });

  it.each(['category-card', 'process-steps', 'testimonial-card', 'testimonial-card-rating-4'])(
    '%s renders through the kit with no axe violations',
    async (id) => {
      const { container } = renderCase(id);
      expect(container.querySelector('[role="alert"]')).toBeNull();
      await expectNoAxeViolations(container);
    },
  );
});

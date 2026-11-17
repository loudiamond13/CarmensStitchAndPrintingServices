// SPEC-GAP: LEGAL-04, D-10, D-11, D-13, D-29. The Accessibility Statement at /accessibility: the five L5 sections in order and the
// shop's contact lines from the site facts and the privacy contact read (UI-SPEC L1 item 3, L5).
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { describe, expect, it } from 'vitest';
import { routes } from '@/core/routes/router';
import { expectNoAxeViolations } from '@/test/axe';

/** The real route tree at /accessibility, settled once the contact lines are on screen. */
async function renderAccessibility() {
  const router = createMemoryRouter(routes, { initialEntries: ['/accessibility'] });
  const view = render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Accessibility statement.' }, { timeout: 15_000 });
  return view;
}

describe('AccessibilityPage at /accessibility (LEGAL-04)', { timeout: 20_000 }, () => {
  it('shows one h1 and the five sections in order', async () => {
    await renderAccessibility();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const names = (await screen.findAllByRole('heading', { level: 2 })).map((heading) => heading.textContent);
    expect(names).toEqual(['Our goal', 'What we do', 'Known limits', 'Tell us about a problem', 'How we check']);
  });

  it('names WCAG 2.2 level AA as the goal and the two known limits', async () => {
    await renderAccessibility();
    expect(await screen.findByText(/WCAG 2\.2 level AA/)).toBeInTheDocument();
    expect(screen.getByText(/map comes from Google/)).toBeInTheDocument();
    expect(screen.getByText(/photo descriptions are short/)).toBeInTheDocument();
  });

  it('promises no reply time: the draft says "We\'ll reply as soon as we can."', async () => {
    await renderAccessibility();
    expect(await screen.findByText('Tell us the page and what went wrong.')).toBeInTheDocument();
    expect(screen.getByText("We'll reply as soon as we can.")).toBeInTheDocument();
    expect(screen.queryByText(/working days|within \d+ /)).not.toBeInTheDocument();
  });

  it('shows the email as a mailto link, Messenger and the main phone as a tel link', async () => {
    await renderAccessibility();
    const section = (await screen.findByRole('heading', { level: 2, name: 'Tell us about a problem' })).closest(
      'section',
    );
    if (section === null) {
      throw new Error('The "Tell us about a problem" heading is not inside a section.');
    }
    const scope = within(section);
    expect(await scope.findByRole('link', { name: 'shop-private@example.test' })).toHaveAttribute(
      'href',
      'mailto:shop-private@example.test',
    );
    const messenger = scope.getByRole('link', { name: /^Message us on Messenger/ });
    expect(messenger).toHaveAttribute('href', 'https://m.me/cspsdemo');
    expect(messenger).toHaveAttribute('target', '_blank');
    expect(messenger).toHaveAttribute('rel', 'noopener noreferrer');
    expect(scope.getByRole('link', { name: '0917 123 4567' })).toHaveAttribute('href', 'tel:+639171234567');
  });

  it('has zero axe violations', async () => {
    const { container } = await renderAccessibility();
    await screen.findByRole('link', { name: 'shop-private@example.test' });
    await expectNoAxeViolations(container);
  });
});

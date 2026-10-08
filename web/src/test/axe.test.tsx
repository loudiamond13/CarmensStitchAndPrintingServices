// Proves the in-house component axe helper (D-18, A11Y-01): WCAG 2.0/2.1/2.2 A and AA tags, an empty container is
// rejected instead of passing (A11Y-01 empty edge), and violations are sorted by rule id then target, so the same
// failure always prints the same text (A11Y-01 ordering edge). axe always runs on real timers (L-24).
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from './axe';
import { AXE_TAGS } from './axeTags';

async function failureMessage(container: Element): Promise<string> {
  const reason: unknown = await expectNoAxeViolations(container).then(
    () => 'resolved',
    (error: unknown) => error,
  );
  if (!(reason instanceof Error)) {
    throw new Error(`expected a rejection with an Error, got ${String(reason)}`);
  }
  return reason.message;
}

describe('expectNoAxeViolations', () => {
  it('runs the WCAG 2.0, 2.1 and 2.2 A and AA tags', () => {
    expect(AXE_TAGS).toEqual(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
  });

  it('rejects an image without alt text with a message starting image-alt:', async () => {
    // eslint-disable-next-line jsx-a11y-x/alt-text -- deliberate violation the helper must report
    const { container } = render(<img src="a.png" />);
    expect(await failureMessage(container)).toMatch(/^image-alt: /);
  });

  it('lists violations sorted by rule id and then by target', async () => {
    const { container } = render(
      <div>
        {/* eslint-disable-next-line jsx-a11y-x/alt-text -- deliberate violation */}
        <img id="b" src="b.png" />
        <button id="c" type="button" />
        {/* eslint-disable-next-line jsx-a11y-x/alt-text -- deliberate violation */}
        <img id="a" src="a.png" />
      </div>,
    );
    expect((await failureMessage(container)).split('\n')).toEqual(['button-name: #c', 'image-alt: #a, #b']);
  });

  it('rejects an empty container, so an empty render never counts as a pass', async () => {
    const { container } = render(<div />);
    const empty = container.firstElementChild;
    expect(empty).not.toBeNull();
    expect(await failureMessage(empty ?? container)).toBe('axe needs rendered content: the container is empty.');
  });

  it('resolves for a labelled button', async () => {
    const { container } = render(<button type="button">Save order</button>);
    await expect(expectNoAxeViolations(container)).resolves.toBeUndefined();
  });

  it('resolves for an image with alt text', async () => {
    const { container } = render(<img src="a.png" alt="Shop logo" />);
    await expect(expectNoAxeViolations(container)).resolves.toBeUndefined();
  });
});

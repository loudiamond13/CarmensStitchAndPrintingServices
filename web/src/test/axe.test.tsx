import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from './axe';
import { AXE_TAGS } from './axeTags';

describe('expectNoAxeViolations', () => {
  it('runs the WCAG 2.0, 2.1 and 2.2 A and AA tags', () => {
    expect(AXE_TAGS).toEqual(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
  });

  it('rejects an image without alt text', async () => {
    // eslint-disable-next-line jsx-a11y-x/alt-text -- a deliberate violation the helper must report
    const { container } = render(<img src="a.png" />);
    await expect(expectNoAxeViolations(container)).rejects.toThrow('image-alt');
  });

  it('resolves for an image with alt text', async () => {
    const { container } = render(<img src="a.png" alt="Shop logo" />);
    await expect(expectNoAxeViolations(container)).resolves.toBeUndefined();
  });

  it('rejects an empty container, so an empty render never counts as a pass', async () => {
    await expect(expectNoAxeViolations(document.createElement('div'))).rejects.toThrow('axe ran on an empty container');
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
    const error = await expectNoAxeViolations(container).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(Error);
    const lines = (error as Error).message.split('\n').slice(1);
    expect(lines).toEqual(['button-name: #c', 'image-alt: #a, #b']);
  });

  it('can switch off a named rule for one call', async () => {
    // eslint-disable-next-line jsx-a11y-x/alt-text -- a deliberate violation the helper must report
    const { container } = render(<img src="a.png" />);
    await expect(expectNoAxeViolations(container, { disableRules: ['image-alt'] })).resolves.toBeUndefined();
  });
});

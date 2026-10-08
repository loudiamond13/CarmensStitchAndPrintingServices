// In-house component-level axe helper over axe-core 4.13 (D-18, research Pattern 4). A plain async function, no
// custom matcher. axe hangs on fake timers, so call it only on real timers (L-24).
import axe from 'axe-core';
import { AXE_TAGS } from './axeTags';

function selectorText(target: axe.UnlabelledFrameSelector): string {
  return target.map((part) => (Array.isArray(part) ? part.join(' >>> ') : part)).join(' ');
}

/**
 * Runs axe over `container` with the WCAG 2.0, 2.1 and 2.2 A and AA tags and rejects on any violation. jsdom has no
 * layout or canvas, so the colour-contrast rule is off here only; the page-level Playwright check keeps it on.
 *
 * - An empty container rejects: an empty render must never count as a pass (A11Y-01 empty edge).
 * - The rejection message is one `<rule id>: <targets>` line per violation, sorted by rule id and then by target, so
 *   the same failure always prints the same text (A11Y-01 ordering edge).
 */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  if (container.childElementCount === 0) {
    throw new Error('axe needs rendered content: the container is empty.');
  }
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: [...AXE_TAGS] },
    rules: { 'color-contrast': { enabled: false } },
  });
  const lines = results.violations
    .map((violation) => ({
      id: violation.id,
      targets: violation.nodes.map((node) => selectorText(node.target)).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id) || (a.targets[0] ?? '').localeCompare(b.targets[0] ?? ''))
    .map((violation) => `${violation.id}: ${violation.targets.join(', ')}`);
  if (lines.length > 0) {
    throw new Error(lines.join('\n'));
  }
}

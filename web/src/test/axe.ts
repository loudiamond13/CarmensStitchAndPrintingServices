// In-house component-level axe helper over axe-core (D-18, research Pattern 4). A plain function, no matcher.
import axe from 'axe-core';
import { AXE_TAGS } from './axeTags';

export interface AxeHelperOptions {
  /** Rule ids to switch off for this one call, each with a recorded reason at the call site. */
  readonly disableRules?: readonly string[];
}

function selectorText(target: axe.UnlabelledFrameSelector): string {
  return target.map((part) => (Array.isArray(part) ? part.join(' >>> ') : part)).join(' ');
}

/**
 * Runs axe over `container` with the WCAG 2.0, 2.1 and 2.2 A and AA tags and rejects on any violation. jsdom has no
 * layout or canvas, so the contrast rule is off here only; the page-level Playwright check keeps it on. The message
 * lists one `<rule id>: <targets>` line per violation, sorted by rule id and then by target, so the same failure
 * always prints the same text.
 */
export async function expectNoAxeViolations(container: Element, options: AxeHelperOptions = {}): Promise<void> {
  if (container.childElementCount === 0) {
    throw new Error('axe ran on an empty container');
  }
  const rules: axe.RuleObject = { 'color-contrast': { enabled: false } };
  for (const id of options.disableRules ?? []) {
    rules[id] = { enabled: false };
  }
  const results = await axe.run(container, { runOnly: { type: 'tag', values: [...AXE_TAGS] }, rules });
  const lines = results.violations
    .map((violation) => ({
      id: violation.id,
      targets: violation.nodes.map((node) => selectorText(node.target)).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id) || (a.targets[0] ?? '').localeCompare(b.targets[0] ?? ''))
    .map((violation) => `${violation.id}: ${violation.targets.join(', ')}`);
  if (lines.length > 0) {
    throw new Error(`axe found ${String(lines.length)} violation(s):\n${lines.join('\n')}`);
  }
}

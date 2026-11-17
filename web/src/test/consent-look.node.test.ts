// @vitest-environment node
// Gates for the cookie bar's height token (12-UI-SPEC "New design token", WCAG 2.4.11): --spacing-consent-bar is 92px, and
// PublicLayout raises it to 204px at 767px and below. Both numbers are the sum of the bar's own parts, read from its recipe
// and the button recipe, so a change to the bar that is not matched in the token fails here. A node test, like
// public-look.node.test.ts, because it reads app.css and the layout source with node:fs.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buttonClasses } from '../components/actions/button.recipe';
import { barClasses, buttonsClasses, innerClasses, textClasses } from '../modules/public/components/consent.recipe';

const srcDir = fileURLToPath(new URL('../', import.meta.url));
const appCss = readFileSync(join(srcDir, 'ui', 'app.css'), 'utf8');
const layoutSource = readFileSync(join(srcDir, 'layouts', 'PublicLayout.tsx'), 'utf8');

/** The 4px step number of a utility such as `pt-4` or `gap-2`, times 4. */
function steps(classes: string, utility: string): number {
  const match = new RegExp(`(?<![\\w-])${utility}-(\\d+)(?![\\w-])`).exec(classes);
  expect(match, `${utility} in ${classes}`).not.toBeNull();
  return 4 * Number(match?.[1]);
}

const top = steps(barClasses, 'pt');
const bottom = Number(/pb-\[calc\((\d+)px\+env\(safe-area-inset-bottom\)\)\]/.exec(barClasses)?.[1]);
const threeLines = 3 * steps(textClasses, 'leading');
const button = steps(buttonClasses({ variant: 'secondary', size: 'md' }), 'h');

describe('the cookie bar height token (12-UI-SPEC)', () => {
  it('is 92px above 767px: 16 above, three text lines of 20, 16 below', () => {
    const token = /--spacing-consent-bar:\s*(\d+)px;/.exec(appCss);
    expect(token).not.toBeNull();
    expect(Number(token?.[1])).toBe(top + threeLines + bottom);
    expect(top + threeLines + bottom).toBe(92);
  });

  it('is 204px at 767px and below: the text, 16, two 44px button rows 8 apart, 16 below', () => {
    const phone = /vp-lt-md:\[:root:has\(&\)\]:\[--spacing-consent-bar:(\d+)px\]/.exec(layoutSource);
    expect(phone).not.toBeNull();
    const total =
      top + threeLines + steps(innerClasses, 'gap') + button + steps(buttonsClasses, 'gap') + button + bottom;
    expect(Number(phone?.[1])).toBe(total);
    expect(total).toBe(204);
  });

  it('keeps the 1px top rule out of the height: it is a shadow, not a border', () => {
    expect(barClasses.split(/\s+/)).not.toContain('border-t');
    expect(barClasses).toContain('[box-shadow:0_-1px_0_var(--line),var(--shadow-3)]');
  });
});

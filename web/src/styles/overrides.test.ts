// @vitest-environment node
// A11Y-04, PERF-03, WEB-09: the owner's WCAG rulings (02-CONTEXT D-01, D-02, D-03, D-05) are applied in overrides.css,
// each rule names its decision ID, and a scan fails if faded text reappears in any stylesheet or TSX style object.
// Plain-text parsing on purpose: no CSS library (no new packages in Phase 2 plan 05).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesUrl = new URL('./', import.meta.url);
const srcUrl = new URL('../', import.meta.url);
const indexHtmlUrl = new URL('../../index.html', import.meta.url);

interface CssRule {
  /** Selector list, normalized: whitespace collapsed, attribute-value quotes removed, keyframes prefixed. */
  selectors: string[];
  /** Enclosing at-rule preludes, outermost first (for example `@container pg (max-width: 767px)`). */
  context: string[];
  declarations: [property: string, value: string][];
  /** Comment text written right before the rule, or before its enclosing at-rule. */
  comment: string;
}

function normalizeSelector(selector: string): string {
  return selector.replace(/\s+/g, ' ').replace(/["']/g, '').trim();
}

function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';
  for (const char of text) {
    if (quote !== null) {
      if (char === quote) {
        quote = null;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(' || char === '[') {
      depth += 1;
    } else if (char === ')' || char === ']') {
      depth -= 1;
    } else if (char === separator && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

function parseDeclarations(body: string): [string, string][] {
  return splitTopLevel(body, ';').flatMap((declaration): [string, string][] => {
    const colon = declaration.indexOf(':');
    if (colon < 0) {
      return [];
    }
    return [
      [
        declaration.slice(0, colon).trim().toLowerCase(),
        declaration
          .slice(colon + 1)
          .replace(/\s+/g, ' ')
          .trim(),
      ],
    ];
  });
}

/** A small CSS rule reader: enough for the design stylesheets (no nesting inside style rules). */
function parseCss(source: string): CssRule[] {
  const rules: CssRule[] = [];
  let index = 0;

  const skipComment = (): string | null => {
    if (!source.startsWith('/*', index)) {
      return null;
    }
    const end = source.indexOf('*/', index + 2);
    const text = source.slice(index + 2, end < 0 ? source.length : end);
    index = end < 0 ? source.length : end + 2;
    return text;
  };

  const readBody = (): string => {
    let body = '';
    while (index < source.length) {
      if (skipComment() !== null) {
        continue;
      }
      const char = source.charAt(index);
      index += 1;
      if (char === '}') {
        return body;
      }
      body += char;
    }
    return body;
  };

  const parseBlock = (context: string[], inheritedComment: string, keyframes: string | null): void => {
    let prelude = '';
    let comment = '';
    while (index < source.length) {
      const commentText = skipComment();
      if (commentText !== null) {
        comment += `${commentText}\n`;
        continue;
      }
      const char = source.charAt(index);
      index += 1;
      if (char === '}') {
        return;
      }
      if (char === ';') {
        prelude = '';
        continue;
      }
      if (char !== '{') {
        prelude += char;
        continue;
      }
      const head = prelude.replace(/\s+/g, ' ').trim();
      const lead = comment.length > 0 ? comment : inheritedComment;
      prelude = '';
      comment = '';
      if (/^@(media|container|supports|layer)\b/.test(head)) {
        parseBlock([...context, head], lead, null);
      } else if (/^@(-webkit-)?keyframes\b/.test(head)) {
        parseBlock([...context, head], lead, head);
      } else {
        const selectors = splitTopLevel(head, ',').map(normalizeSelector);
        rules.push({
          selectors: keyframes === null ? selectors : selectors.map((selector) => `${keyframes} ${selector}`),
          context,
          declarations: parseDeclarations(readBody()),
          comment: lead,
        });
      }
    }
  };

  parseBlock([], '', null);
  return rules;
}

function readStyle(name: string): string {
  const url = new URL(name, stylesUrl);
  return existsSync(url) ? readFileSync(url, 'utf8') : '';
}

const overridesSource = (): string => readStyle('overrides.css');
const overrideRules = (): CssRule[] => parseCss(overridesSource());

function value(rule: CssRule, property: string): string | undefined {
  return rule.declarations.findLast(([name]) => name === property)?.[1];
}

/** Rules in overrides.css whose selector list contains the selector, optionally inside the given at-rule. */
function overridesFor(selector: string, context: string[] = []): CssRule[] {
  const wanted = normalizeSelector(selector);
  return overrideRules().filter(
    (rule) => rule.selectors.includes(wanted) && rule.context.join(' | ') === context.join(' | '),
  );
}

/** Equal as written, or as numbers (Prettier may print .45 as 0.45). */
function sameValue(actual: string | undefined, expected: string): boolean {
  if (actual === undefined) {
    return false;
  }
  return actual === expected || (!Number.isNaN(Number(expected)) && Number(actual) === Number(expected));
}

function expectRule(selector: string, property: string, expected: string, id: string, context: string[] = []): void {
  const matching = overridesFor(selector, context).filter((rule) => sameValue(value(rule, property), expected));
  expect(matching.length, `${selector} { ${property}: ${expected} } in ${context.join(' ') || 'top level'}`).toBe(1);
  expect(matching[0]?.comment ?? '', `${selector} names ${id}`).toContain(id);
}

const PHONE = ['@container pg (max-width: 767px)'];

describe('overrides.css owner rulings (A11Y-04)', () => {
  it('is unlayered, so every override wins over the layered verbatim CSS (ordering edge)', () => {
    const source = overridesSource();
    expect(source.length).toBeGreaterThan(0);
    expect(source).not.toMatch(/@layer\b/);
    expect(source).not.toMatch(/!important/);
  });

  it('D-01 (C-34): phone text-entry fields compute to 16px, desktop and tablet keep 14px', () => {
    for (const selector of [
      '.csp-search input',
      '.s-search-box input',
      '.s-toolbar .csp-input',
      '.s-item .csp-input',
    ]) {
      expectRule(selector, 'font-size', '16px', 'D-01', PHONE);
      expect(overridesFor(selector), `${selector} has no unconditional override`).toHaveLength(0);
    }
  });

  it('D-02 (C-35): inactive table rows and phone cards use --surface-2 and no opacity', () => {
    expectRule('.s-rt tbody tr.is-inactive > td', 'background', 'var(--surface-2)', 'D-02');
    expectRule('.s-rt tbody tr.is-inactive', 'background', 'var(--surface-2)', 'D-02', PHONE);
    for (const rule of overrideRules().filter((r) => r.selectors.some((s) => s.includes('is-inactive')))) {
      expect(value(rule, 'opacity')).toBeUndefined();
    }
  });

  it('D-02: dimmed .is-zero cascade tiles stay dimmed by colour only', () => {
    const components = parseCss(readStyle('components.css'));
    const zero = components.filter((rule) => rule.selectors.some((s) => s.includes('.is-zero')));
    expect(zero.map((rule) => value(rule, 'color'))).toContain('var(--ink-subtle)');
    for (const rule of [...zero, ...overrideRules().filter((r) => r.selectors.some((s) => s.includes('.is-zero')))]) {
      expect(value(rule, 'opacity')).toBeUndefined();
    }
  });

  it('D-03 (C-35): selected tab, current site link, sidebar item and tab-bar item are bold in both themes', () => {
    for (const selector of ['.csp-tab.is-on', '.csp-site-link.is-on', '.csp-nav.is-on', '.s-tab-i.is-on']) {
      expectRule(selector, 'font-weight', '700', 'D-03');
    }
    const themed = overrideRules().filter((rule) => rule.selectors.some((s) => s.includes('data-theme')));
    expect(themed).toHaveLength(0);
  });

  it('D-03: unselected siblings keep the designed weight 600', () => {
    const components = parseCss(readStyle('components.css'));
    for (const selector of ['.csp-tab', '.csp-site-link', '.csp-nav']) {
      const base = components.find((rule) => rule.selectors.includes(selector) && value(rule, 'font-weight'));
      expect(base === undefined ? undefined : value(base, 'font-weight'), selector).toBe('600');
      expect(overridesFor(selector), `${selector} weight untouched`).toHaveLength(0);
    }
  });

  it('D-03: the checkbox has a 2px --ink border, an accent fill when checked and an --on-accent pseudo-element tick', () => {
    const box = '.s-check input[type=checkbox]';
    expectRule(box, 'appearance', 'none', 'D-03');
    expectRule(box, 'width', '20px', 'D-03');
    expectRule(box, 'height', '20px', 'D-03');
    expectRule(box, 'border', '2px solid var(--ink)', 'D-03');
    expectRule(box, 'border-radius', 'var(--radius-xs)', 'D-03');
    expectRule(box, 'background', 'var(--surface-2)', 'D-03');
    expectRule(`${box}:checked`, 'background', 'var(--accent)', 'D-03');
    const tick = overrideRules().filter((rule) =>
      rule.selectors.some((s) => s === `${box}:checked::before` || s === `${box}:checked::after`),
    );
    expect(tick).toHaveLength(1);
    const declarations = tick[0]?.declarations ?? [];
    expect(declarations.some(([, v]) => v.includes('var(--on-accent)'))).toBe(true);
    expect(declarations.some(([, v]) => v.includes('url('))).toBe(false);
    expect(tick[0]?.comment ?? '').toContain('D-03');
    expectRule(`${box}:focus-visible`, 'outline', '2px solid var(--focus)', 'D-03');
  });

  it('D-05 (C-35): thumb grip and actions show on keyboard focus and always on touch devices', () => {
    expectRule('.csp-thumb:focus-within .csp-thumb-grip', 'opacity', '1', 'D-05');
    expectRule('.csp-thumb-grip', 'opacity', '1', 'D-05', ['@media (hover: none)']);
    expectRule('.csp-thumb-actions', 'opacity', '1', 'D-05', ['@media (hover: none)']);
  });

  it('WEB-09: a pending button (aria-disabled) looks exactly like a disabled one', () => {
    const disabled = parseCss(readStyle('components.css')).find((rule) => rule.selectors.includes('.csp-btn:disabled'));
    expect(sameValue(disabled === undefined ? undefined : value(disabled, 'opacity'), '.45')).toBe(true);
    expectRule('.csp-btn[aria-disabled="true"]', 'opacity', '.45', 'WEB-09');
    expectRule('.csp-btn[aria-disabled="true"]', 'cursor', 'not-allowed', 'WEB-09');
  });

  it('WEB-09: a pending button ignores the hover and press styles a disabled one never gets', () => {
    const components = parseCss(readStyle('components.css'));
    const interactive = components.flatMap((rule) =>
      rule.selectors.flatMap((selector) => {
        const match = /^(\.csp-btn(?:-[\w-]+)?):(hover|active):not\(:disabled\)$/.exec(selector);
        return match === null ? [] : [{ base: match[1] ?? '', state: match[2] ?? '', rule }];
      }),
    );
    expect(interactive.length).toBeGreaterThanOrEqual(6);
    for (const { base, state, rule } of interactive) {
      const baseRule = components.find((candidate) => candidate.selectors.includes(base));
      for (const [property] of rule.declarations) {
        const resting = (baseRule === undefined ? undefined : value(baseRule, property)) ?? 'none';
        expectRule(`${base}[aria-disabled="true"]:${state}`, property, resting, 'WEB-09');
      }
    }
  });
});

/**
 * The only selectors that may set opacity below 1 (D-02 rule: no text-bearing element is faded). Each entry says why
 * it is not faded readable text.
 */
const OPACITY_ALLOW_LIST: Record<string, string> = {
  '.csp-btn:disabled': 'An inactive control: WCAG 1.4.3 exempts text in inactive user interface components.',
  '.csp-btn[aria-disabled=true]': 'The WEB-09 pending button is an inactive control too (same WCAG 1.4.3 exemption).',
  '.csp-thumb-grip': 'An icon-only drag grip, hidden until hover; D-05 reveals it on focus and on touch devices.',
  '.csp-thumb-actions': 'Icon-only image actions, hidden until hover; D-05 reveals them on focus and touch devices.',
  '.csp-skel': 'Skeleton shimmer: an aria-hidden loading placeholder with no text.',
  '@keyframes csp-shimmer from': 'Skeleton shimmer frame: no text.',
  '@keyframes csp-shimmer to': 'Skeleton shimmer frame: no text.',
  '@keyframes csp-fade from':
    'The first frame of a 0.2 s entry animation, not a resting state (reduced motion is handled by O-6).',
  '@keyframes csp-rise from':
    'The first frame of a 0.2 s entry animation, not a resting state (reduced motion is handled by O-6).',
  '@keyframes csp-slide from':
    'The first frame of a 0.2 s entry animation, not a resting state (reduced motion is handled by O-6).',
  '.s-profile-stripe': 'A decorative orange parallelogram (aria-hidden) with no text.',
  '.s-login-num': 'A decorative outline numeral (transparent fill, stroke only): pure decoration, exempt from 1.4.3.',
};

function opacityValue(raw: string): number {
  const text = raw.replace(/!important/, '').trim();
  return text.endsWith('%') ? Number.parseFloat(text) / 100 : Number(text);
}

/** Selectors in overrides.css reset to full opacity under the D-02 rule, at the top level. */
function neutralized(): Set<string> {
  return new Set(
    overrideRules()
      .filter((rule) => rule.context.length === 0 && value(rule, 'opacity') === '1' && rule.comment.includes('D-02'))
      .flatMap((rule) => rule.selectors),
  );
}

function listFiles(url: URL, filter: (name: string) => boolean): URL[] {
  return readdirSync(url, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return entry.name === '__reference__' ? [] : listFiles(new URL(`${entry.name}/`, url), filter);
    }
    return filter(entry.name) ? [new URL(entry.name, url)] : [];
  });
}

describe('no faded text (D-02 rule, A11Y-04 empty edge)', () => {
  it('reads every web stylesheet', () => {
    const names = listFiles(stylesUrl, (name) => name.endsWith('.css')).map((url) => url.pathname.split('/').pop());
    expect(names).toEqual(expect.arrayContaining(['components.css', 'screens.css', 'overrides.css', 'spec-gaps.css']));
  });

  it('sets opacity below 1 only on allow-listed selectors, or on selectors overrides.css resets to 1 (D-02)', () => {
    const reset = neutralized();
    const offenders: string[] = [];
    for (const url of listFiles(stylesUrl, (name) => name.endsWith('.css'))) {
      for (const rule of parseCss(readFileSync(url, 'utf8'))) {
        const opacity = value(rule, 'opacity');
        if (opacity === undefined || opacityValue(opacity) >= 1) {
          continue;
        }
        for (const selector of rule.selectors) {
          if (!(selector in OPACITY_ALLOW_LIST) && !reset.has(selector)) {
            offenders.push(`${url.pathname.split('/').pop() ?? ''}: ${selector} { opacity: ${opacity} }`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('resets the verbatim faded text to full opacity in overrides.css, each rule naming D-02', () => {
    const reset = neutralized();
    for (const selector of [
      '.csp-input::placeholder',
      '.csp-nav-tag',
      '.s-cut-accent .s-lead',
      '.s-pill-count',
      '.s-bigbtn span',
    ]) {
      expect(reset.has(selector), selector).toBe(true);
    }
  });

  it('gives every allow-list entry a reason', () => {
    for (const [selector, reason] of Object.entries(OPACITY_ALLOW_LIST)) {
      expect(reason.length, selector).toBeGreaterThan(20);
    }
  });

  it('finds no opacity below 1 in any TSX style object (excluding __reference__ and tests)', () => {
    const offenders = listFiles(srcUrl, (name) => name.endsWith('.tsx') && !name.endsWith('.test.tsx')).flatMap((url) =>
      [...readFileSync(url, 'utf8').matchAll(/\bopacity\s*:\s*['"]?(\d*\.?\d+%?)/g)]
        .filter((match) => opacityValue(match[1] ?? '1') < 1)
        .map((match) => `${url.pathname}: ${match[0]}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe('page zoom and tokens', () => {
  it('index.html keeps pinch zoom: no maximum-scale and no user-scalable (D-01)', () => {
    const html = readFileSync(indexHtmlUrl, 'utf8');
    const viewport = /<meta\s+name="viewport"\s+content="([^"]*)"/.exec(html);
    expect(viewport?.[1]).toBe('width=device-width, initial-scale=1');
    expect(html).not.toMatch(/maximum-scale|user-scalable/);
  });

  it.each(['overrides.css', 'spec-gaps.css'])('%s uses tokens only (no hex colours)', (name) => {
    const source = readStyle(name);
    expect(source.length).toBeGreaterThan(0);
    expect(source.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('spec-gaps.css wraps every rule in @layer components', () => {
    const source = readStyle('spec-gaps.css');
    expect(source).toMatch(/@layer components\s*\{/);
    for (const rule of parseCss(source)) {
      expect(rule.context[0]).toBe('@layer components');
    }
  });
});

function unquote(text: string): string {
  return text.replace(/["']/g, '').trim();
}

function fontFace(family: string): CssRule | undefined {
  return overrideRules().find(
    (rule) => rule.selectors.includes('@font-face') && unquote(value(rule, 'font-family') ?? '') === family,
  );
}

function fontStack(rule: CssRule | undefined, property: string): string[] {
  return splitTopLevel((rule === undefined ? undefined : value(rule, property)) ?? '', ',').map(unquote);
}

describe('PERF-05 metric-matched fallback fonts', () => {
  it.each([
    ['Archivo Fallback', ['local(Arial)']],
    ['Barlow Condensed Fallback', ['local(Arial Narrow)', 'local(Arial)']],
  ])('declares the %s face with computed size-adjust, ascent, descent and line-gap overrides', (family, sources) => {
    const face = fontFace(family);
    expect(face, family).toBeDefined();
    expect(face?.comment ?? '').toContain('PERF-05');
    expect(fontStack(face, 'src')).toEqual(sources);
    for (const descriptor of ['size-adjust', 'ascent-override', 'descent-override', 'line-gap-override']) {
      expect(face === undefined ? undefined : value(face, descriptor), `${family} ${descriptor}`).toMatch(
        /^\d+(\.\d+)?%$/,
      );
    }
  });

  it('keeps ₱ (U+20B1) out of the Barlow fallback, so it falls through to Archivo Variable (Pitfall 17)', () => {
    const face = fontFace('Barlow Condensed Fallback');
    expect(face === undefined ? undefined : value(face, 'unicode-range')).toBe('U+0000-20B0, U+20B2-10FFFF');
    expect(overridesSource().split('U+0000-20B0, U+20B2-10FFFF')).toHaveLength(2);
  });

  it('inserts each fallback right after its brand family, on the selector tokens.css uses, keeping the rest', () => {
    const tokens = parseCss(readStyle('tokens.css')).filter((rule) =>
      rule.declarations.some(([name]) => name === '--font-sans'),
    );
    expect(tokens).toHaveLength(1);
    const verbatim = tokens[0];
    const selector = verbatim?.selectors.join(', ') ?? '';
    const override = overrideRules().find(
      (rule) => rule.context.length === 0 && rule.selectors.join(', ') === selector && value(rule, '--font-sans'),
    );
    expect(override?.comment ?? '').toContain('PERF-05');
    const [sansBrand, ...sansRest] = fontStack(verbatim, '--font-sans');
    const [displayBrand, ...displayRest] = fontStack(verbatim, '--font-display');
    expect(sansBrand).toBe('Archivo Variable');
    expect(displayBrand).toBe('Barlow Condensed');
    expect(fontStack(override, '--font-sans')).toEqual(['Archivo Variable', 'Archivo Fallback', ...sansRest]);
    expect(fontStack(override, '--font-display')).toEqual([
      'Barlow Condensed',
      'Barlow Condensed Fallback',
      'Archivo Variable',
      ...displayRest.filter((family) => family !== 'Archivo Variable'),
    ]);
    expect(displayRest[0]).toBe('Archivo Variable');
  });
});

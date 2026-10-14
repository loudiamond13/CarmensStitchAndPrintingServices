// @vitest-environment node
// Stylesheet contract (D-33, WEB-02, T-02-16): web/src/ui holds exactly app.css and base.css, and they hold only
// the token theme, the custom variants, @keyframes, @font-face and the global element rules. Any class selector,
// @utility or @apply fails here. The files are read with fs, because Vitest stubs CSS imports (research Pitfall 32).
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesDir = new URL('./', import.meta.url);
const readStylesheet = (name: string): string => readFileSync(new URL(name, stylesDir), 'utf8');

type StylesheetName = 'app.css' | 'base.css';

/** One at-rule or selector block found by the tokenizer, with the preludes of the blocks around it. */
interface CssBlock {
  readonly type: 'at-rule' | 'rule';
  /** The at-rule name without `@` (`theme`, `import`), or the selector text of a rule. */
  readonly name: string;
  /** Everything before the `{` or `;`, whitespace collapsed. */
  readonly prelude: string;
  /** Preludes of the enclosing blocks, outermost first. */
  readonly parents: readonly string[];
  readonly line: number;
}

/** Splits a stylesheet into at-rules and selector blocks (comments stripped, braces walked). */
export function parseCssBlocks(text: string): CssBlock[] {
  // Comments become spaces of the same length (newlines kept), so line numbers stay true.
  const source = text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
  const blocks: CssBlock[] = [];
  const stack: string[] = [];
  let buffer = '';
  let bufferStart = -1;
  let quote = '';
  let parenDepth = 0;
  let line = 1;
  let bufferLine = 1;

  const collapse = (value: string): string => value.replace(/\s+/g, ' ').trim();
  const push = (prelude: string): void => {
    if (prelude.startsWith('@')) {
      const name = /^@([\w-]+)/.exec(prelude)?.[1] ?? prelude;
      blocks.push({ type: 'at-rule', name, prelude, parents: [...stack], line: bufferLine });
    } else {
      blocks.push({ type: 'rule', name: prelude, prelude, parents: [...stack], line: bufferLine });
    }
  };
  const reset = (): void => {
    buffer = '';
    bufferStart = -1;
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source.charAt(index);
    if (char === '\n') {
      line += 1;
    }
    if (bufferStart === -1 && !/\s/.test(char)) {
      bufferStart = index;
      bufferLine = line;
    }
    if (quote !== '') {
      buffer += char;
      if (char === '\\') {
        index += 1;
        buffer += source.charAt(index);
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      buffer += char;
      continue;
    }
    if (char === '(' || char === ')') {
      parenDepth += char === '(' ? 1 : -1;
      buffer += char;
      continue;
    }
    if (parenDepth > 0) {
      buffer += char;
      continue;
    }
    if (char === '{') {
      const prelude = collapse(buffer);
      push(prelude);
      stack.push(prelude);
      reset();
    } else if (char === ';' || char === '}') {
      // A statement: a block-less at-rule is kept; a declaration (`color: red`) is not a block.
      const statement = collapse(buffer);
      if (statement.startsWith('@')) {
        push(statement);
      }
      reset();
      if (char === '}') {
        stack.pop();
      }
    } else {
      buffer += char;
    }
  }
  return blocks;
}

/** A selector with whitespace collapsed and attribute quotes dropped, so `[data-theme="dark"]` = `[data-theme=dark]`. */
const normalizeSelector = (selector: string): string =>
  selector
    .replace(/["']/g, '')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

/** base.css selectors outside @media (UI-SPEC Tailwind Contract, "What stays in CSS"). */
const baseSelectors = new Set(
  [
    ':root',
    '[data-theme="light"]',
    '[data-theme="dark"]',
    ':root, [data-theme="light"]',
    'body',
    ':focus-visible',
    'main[tabindex="-1"]:focus',
  ].map(normalizeSelector),
);
const reducedMotion = '@media (prefers-reduced-motion: reduce)';
const keyframeStep = /^(?:from|to|\d+(?:\.\d+)?%)(?:, (?:from|to|\d+(?:\.\d+)?%))*$/;
const tailwindEntry = /^@import "tailwindcss" source\("(?:\.\.\/){1,2}src"\)$/;
const baseImport = '@import "./base.css" layer(base)';

/** The reason an at-rule is not allowed in this file, or undefined when it is. */
function atRuleError(file: StylesheetName, block: CssBlock): string | undefined {
  const parent = block.parents.at(-1);
  const topLevel = block.parents.length === 0;
  if (file === 'app.css') {
    switch (block.name) {
      case 'import':
        return topLevel && (tailwindEntry.test(block.prelude) || block.prelude === baseImport)
          ? undefined
          : 'only the Tailwind entry and the base.css layer import are allowed';
      case 'source':
        return topLevel && /^@source not "[^"]+"$/.test(block.prelude)
          ? undefined
          : 'only `@source not "…"` is allowed';
      case 'custom-variant':
        return topLevel ? undefined : '@custom-variant must be top level';
      case 'theme':
        return topLevel && (block.prelude === '@theme' || block.prelude === '@theme inline')
          ? undefined
          : 'only top-level @theme and @theme inline are allowed';
      case 'keyframes':
        return parent === '@theme' ? undefined : '@keyframes must sit inside @theme';
      default:
        return 'not an allowed at-rule (D-33)';
    }
  }
  if (block.name === 'font-face') {
    return topLevel ? undefined : '@font-face must be top level';
  }
  if (block.name === 'media') {
    return topLevel && block.prelude === reducedMotion ? undefined : 'the only allowed @media is reduced motion';
  }
  return 'not an allowed at-rule (D-33)';
}

/** The reason a selector block is not allowed in this file, or undefined when it is. */
function ruleError(file: StylesheetName, block: CssBlock): string | undefined {
  const parent = block.parents.at(-1);
  if (parent?.startsWith('@keyframes ') === true) {
    return keyframeStep.test(normalizeSelector(block.name)) ? undefined : 'only keyframe steps may sit in @keyframes';
  }
  if (file === 'app.css') {
    return 'app.css holds only at-rules, never a selector block (D-33: no class selectors)';
  }
  if (block.parents.length === 1 && parent === reducedMotion) {
    return block.name === '*' ? undefined : 'only `*` may sit in the reduced-motion @media';
  }
  if (block.parents.length === 0 && baseSelectors.has(normalizeSelector(block.name))) {
    return undefined;
  }
  return 'not an allowed base.css selector (D-33: no class selectors)';
}

/** Every contract violation in one stylesheet, each naming the offending at-rule or selector. */
function contractErrors(file: StylesheetName, text: string): string[] {
  const errors: string[] = [];
  // Blocks come in document order, so everything deeper than a rejected block until the next block at its depth or
  // shallower is inside it; it is reported once, not once per child.
  let rejectedDepth = Number.POSITIVE_INFINITY;
  for (const block of parseCssBlocks(text)) {
    const depth = block.parents.length;
    if (depth > rejectedDepth) {
      continue;
    }
    rejectedDepth = Number.POSITIVE_INFINITY;
    const reason = block.type === 'at-rule' ? atRuleError(file, block) : ruleError(file, block);
    if (reason !== undefined) {
      errors.push(`${file}:${String(block.line)} \`${block.prelude}\`: ${reason}`);
      rejectedDepth = depth;
    }
  }
  return errors;
}

describe('web/src/ui', () => {
  it('holds exactly app.css and base.css', () => {
    const stylesheets = readdirSync(stylesDir)
      .filter((name) => name.endsWith('.css'))
      .sort();
    expect(stylesheets).toEqual(['app.css', 'base.css']);
  });
});

describe('parseCssBlocks', () => {
  it('returns at-rules and selectors with comments stripped and nesting recorded', () => {
    const blocks = parseCssBlocks(
      [
        '/* .hidden { color: red } */',
        '@import "tailwindcss" source("../../src");',
        '@theme {',
        '  --spacing: 4px;',
        '  @keyframes spin {',
        '    to {',
        '      transform: rotate(360deg);',
        '    }',
        '  }',
        '}',
        ':root,',
        '[data-theme="light"] {',
        '  --bg: #f6dfd1;',
        '}',
      ].join('\n'),
    );
    expect(blocks).toEqual([
      { type: 'at-rule', name: 'import', prelude: '@import "tailwindcss" source("../../src")', parents: [], line: 2 },
      { type: 'at-rule', name: 'theme', prelude: '@theme', parents: [], line: 3 },
      { type: 'at-rule', name: 'keyframes', prelude: '@keyframes spin', parents: ['@theme'], line: 5 },
      { type: 'rule', name: 'to', prelude: 'to', parents: ['@theme', '@keyframes spin'], line: 6 },
      {
        type: 'rule',
        name: ':root, [data-theme="light"]',
        prelude: ':root, [data-theme="light"]',
        parents: [],
        line: 11,
      },
    ]);
  });

  it('ignores braces and semicolons inside strings and parentheses', () => {
    const blocks = parseCssBlocks('@custom-variant x (&:where([data-a="{;}"]));\n@font-face { src: url(a;b) }');
    expect(blocks.map((block) => block.name)).toEqual(['custom-variant', 'font-face']);
  });
});

describe('the real stylesheets', () => {
  it('app.css holds only allowed at-rules', () => {
    expect(contractErrors('app.css', readStylesheet('app.css'))).toEqual([]);
  });

  it('base.css holds only the token blocks, @font-face and the global element rules', () => {
    expect(contractErrors('base.css', readStylesheet('base.css'))).toEqual([]);
  });

  it('app.css carries the Tailwind entry, a base.css import and the theme (so the checks above are not vacuous)', () => {
    const names = parseCssBlocks(readStylesheet('app.css')).map((block) => block.prelude);
    expect(names).toContain('@import "tailwindcss" source("../../src")');
    expect(names).toContain('@import "./base.css" layer(base)');
    expect(names).toContain('@theme');
    expect(names).toContain('@theme inline');
  });
});

describe('contract violations', () => {
  it('rejects a class selector in base.css and names it', () => {
    const errors = contractErrors('base.css', '.csp-btn { color: red }');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('.csp-btn');
  });

  it('rejects a class selector nested in an allowed block', () => {
    const errors = contractErrors('base.css', 'body { margin: 0; .x { color: red } }');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('.x');
  });

  it('rejects any plain selector block in app.css', () => {
    const errors = contractErrors('app.css', 'body { margin: 0 }');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('body');
  });

  it('rejects @apply', () => {
    const errors = contractErrors('base.css', 'body { @apply p-4; }');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('@apply');
  });

  it('rejects @utility', () => {
    const errors = contractErrors('app.css', '@utility tab {}');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('@utility');
  });

  it('rejects @layer, @plugin and @variant', () => {
    expect(contractErrors('app.css', '@layer components { }')).toHaveLength(1);
    expect(contractErrors('app.css', '@plugin "x";')).toHaveLength(1);
    expect(contractErrors('base.css', 'body { @variant dark { color: red } }')).toHaveLength(1);
  });

  it('rejects an @media other than reduced motion, and a * rule outside it', () => {
    expect(contractErrors('base.css', '@media (max-width: 767px) { body { margin: 0 } }')).toHaveLength(1);
    expect(contractErrors('base.css', '* { color: red }')).toHaveLength(1);
    expect(contractErrors('base.css', '@media (prefers-reduced-motion: reduce) { * { transition: none } }')).toEqual(
      [],
    );
  });

  it('rejects @keyframes outside @theme and a non-step selector inside them', () => {
    expect(contractErrors('app.css', '@keyframes x { to { opacity: 1 } }')).toHaveLength(1);
    expect(contractErrors('app.css', '@theme { @keyframes x { .a { opacity: 1 } } }')).toHaveLength(1);
    expect(contractErrors('app.css', '@theme { @keyframes x { from, 50% { opacity: 0 } to { opacity: 1 } } }')).toEqual(
      [],
    );
  });

  it('accepts only the Tailwind entry and the base.css layer import', () => {
    expect(contractErrors('app.css', '@import "tailwindcss" source("../src");')).toEqual([]);
    expect(contractErrors('app.css', '@import "./overrides.css";')).toHaveLength(1);
    expect(contractErrors('app.css', '@import "tailwindcss";')).toHaveLength(1);
    expect(contractErrors('base.css', '@import "./base.css" layer(base);')).toHaveLength(1);
  });

  it('accepts only negated @source entries', () => {
    expect(contractErrors('app.css', '@source not "../../src/test";')).toEqual([]);
    expect(contractErrors('app.css', '@source "../../visual";')).toHaveLength(1);
  });

  it('accepts @theme and @theme inline only', () => {
    expect(contractErrors('app.css', '@theme { --spacing: 4px; } @theme inline { --color-bg: var(--bg); }')).toEqual(
      [],
    );
    expect(contractErrors('app.css', '@theme static { --spacing: 4px; }')).toHaveLength(1);
  });

  it('matches the data-theme selectors with or without quotes', () => {
    expect(contractErrors('base.css', '[data-theme=dark] { --bg: #000; }')).toEqual([]);
    expect(contractErrors('base.css', '[data-theme="dark"] { --bg: #000; }')).toEqual([]);
    expect(contractErrors('base.css', '[data-theme="sepia"] { --bg: #000; }')).toHaveLength(1);
  });

  it('accepts @font-face in base.css only', () => {
    expect(contractErrors('base.css', '@font-face { font-family: "Archivo Fallback"; src: local("Arial"); }')).toEqual(
      [],
    );
    expect(contractErrors('app.css', '@font-face { font-family: "X"; src: local("Arial"); }')).toHaveLength(1);
  });
});

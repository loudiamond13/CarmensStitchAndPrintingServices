// The computed-style half of the look-equality proof (WEB-02, D-33, threat T-02-39). For one `[data-case]` frame on each
// side, collectCase walks the subtree in DOM order (skipping `display: none` subtrees, adding `::before`/`::after` when
// they have content) and reads VISUAL_PROPERTIES plus each element's box relative to the case root. normalizeRecord
// applies the fixed list of allowed normalizations (UI-SPEC "Look-Equality Proof"; nothing else may be normalized), and
// diffCases reports every remaining difference. Attributes are recorded for the report only and never compared.
//
// The walker runs in the page through page.evaluate, so it is self-contained (no closure over this module) and reads the
// DOM through the small structural types below: the node TS program has no DOM library.
import type { Page } from '@playwright/test';

/** The computed properties compared on every element and pseudo-element (about 80). */
export const VISUAL_PROPERTIES = Object.freeze([
  // Box model and position
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
  'float',
  'box-sizing',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  // Borders and radii
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  // Outline
  'outline-width',
  'outline-style',
  'outline-color',
  'outline-offset',
  // Paint
  'color',
  'background-color',
  'background-image',
  'background-size',
  'background-position',
  'background-repeat',
  'background-clip',
  'box-shadow',
  'opacity',
  'visibility',
  'filter',
  'backdrop-filter',
  'clip-path',
  'mix-blend-mode',
  // Typography
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-align',
  'text-transform',
  'text-decoration-line',
  'text-decoration-style',
  'text-decoration-color',
  'text-decoration-thickness',
  'text-underline-offset',
  'text-overflow',
  'white-space',
  'vertical-align',
  '-webkit-font-smoothing',
  // Flex and grid
  'flex-direction',
  'flex-wrap',
  'justify-content',
  'justify-items',
  'align-items',
  'align-content',
  'align-self',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'order',
  'row-gap',
  'column-gap',
  'grid-template-columns',
  'grid-template-rows',
  'grid-column-start',
  'grid-column-end',
  'grid-row-start',
  'grid-row-end',
  // Overflow, interaction, containers
  'overflow-x',
  'overflow-y',
  'cursor',
  'pointer-events',
  'appearance',
  'container-type',
  'container-name',
  'aspect-ratio',
  'object-fit',
  'list-style-type',
  'content',
  // Motion (transition lists are collapsed by normalizeRecord)
  'transition-property',
  'transition-duration',
  'transition-timing-function',
  'transition-delay',
  'animation-name',
  'animation-duration',
  'animation-timing-function',
  'animation-iteration-count',
  // Transforms: recorded, then dropped by normalizeRecord (compared by box and pixels)
  'transform',
  'translate',
  'rotate',
  'scale',
  // SVG paint (icon wrappers)
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
] as const);

/** Compared by their effect (the element box and the pixels), never by the property text (v4 individual transforms). */
export const TRANSFORM_PROPERTIES: readonly string[] = Object.freeze(['transform', 'translate', 'rotate', 'scale']);

/** Boxes are equal when every edge is within this many CSS pixels. */
export const BOX_TOLERANCE = 0.01;

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type Pseudo = '' | '::before' | '::after';

export interface ElementRecord {
  /** Child-index path from the case root: `0` is the root, `0/1` its second element child. */
  readonly path: string;
  /** The tag chain, for reading a report: `div>button>span`. */
  readonly tags: string;
  readonly tag: string;
  readonly pseudo: Pseudo;
  /** The border box relative to the case root; null for pseudo-elements. */
  readonly box: Box | null;
  readonly styles: Readonly<Record<string, string>>;
  /** An icon wrapper (`<svg>` with the masked viewBox): compared as a wrapper, its drawing skipped (D-32). */
  readonly icon: boolean;
  /** For the report only; never compared. */
  readonly attributes: Readonly<Record<string, string>>;
}

export interface CaseRecord {
  readonly elements: readonly ElementRecord[];
}

export interface Difference {
  readonly path: string;
  readonly kind: 'structure' | 'style' | 'box';
  readonly property: string;
  readonly reference: string;
  readonly impl: string;
}

interface CollectArgs {
  readonly selector: string;
  readonly properties: readonly string[];
  readonly iconViewBox: string | null;
}

// The few DOM shapes the walker touches (the node TS program has no DOM library).
interface BrowserRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}
interface BrowserStyle {
  getPropertyValue(property: string): string;
}
interface BrowserElement {
  readonly localName: string;
  readonly children: ArrayLike<BrowserElement>;
  readonly attributes: ArrayLike<{ readonly name: string; readonly value: string }>;
  getAttribute(name: string): string | null;
  getBoundingClientRect(): BrowserRect;
}
interface BrowserScope {
  readonly document: { querySelector(selector: string): BrowserElement | null };
  getComputedStyle(element: BrowserElement, pseudo?: string): BrowserStyle;
}

/** Runs in the page. Self-contained: Playwright sends its source text, so it may not use anything from this module. */
function collectInPage({ selector, properties, iconViewBox }: CollectArgs): CaseRecord | null {
  const scope = globalThis as unknown as BrowserScope;
  const root = scope.document.querySelector(selector);
  if (root === null) {
    return null;
  }
  const origin = root.getBoundingClientRect();
  const elements: ElementRecord[] = [];
  const read = (style: BrowserStyle): Record<string, string> => {
    const styles: Record<string, string> = {};
    for (const property of properties) {
      styles[property] = style.getPropertyValue(property);
    }
    return styles;
  };
  const visit = (element: BrowserElement, path: string, tags: string): void => {
    const style = scope.getComputedStyle(element);
    if (style.getPropertyValue('display') === 'none') {
      return;
    }
    const rect = element.getBoundingClientRect();
    const attributes: Record<string, string> = {};
    for (const attribute of Array.from(element.attributes)) {
      attributes[attribute.name] = attribute.value;
    }
    elements.push({
      path,
      tags,
      tag: element.localName,
      pseudo: '',
      box: { x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height },
      styles: read(style),
      icon: element.localName === 'svg' && iconViewBox !== null && element.getAttribute('viewBox') === iconViewBox,
      attributes,
    });
    for (const pseudo of ['::before', '::after'] as const) {
      const pseudoStyle = scope.getComputedStyle(element, pseudo);
      const content = pseudoStyle.getPropertyValue('content');
      if (content !== '' && content !== 'none' && content !== 'normal') {
        elements.push({
          path,
          tags,
          tag: element.localName,
          pseudo,
          box: null,
          styles: read(pseudoStyle),
          icon: false,
          attributes: {},
        });
      }
    }
    Array.from(element.children).forEach((child, index) => {
      visit(child, `${path}/${String(index)}`, `${tags}>${child.localName}`);
    });
  };
  visit(root, '0', root.localName);
  return { elements };
}

export interface CollectOptions {
  /** Icon wrappers with this viewBox are marked `icon` (their drawing is dropped by normalizeRecord). */
  readonly iconViewBox?: string | null;
}

/** Reads the case frame matching `selector` on `page`. Throws when nothing matches. */
export async function collectCase(page: Page, selector: string, options: CollectOptions = {}): Promise<CaseRecord> {
  const record = await page.evaluate(collectInPage, {
    selector,
    properties: [...VISUAL_PROPERTIES],
    iconViewBox: options.iconViewBox ?? null,
  });
  if (record === null) {
    throw new Error(`No case frame matches ${selector}.`);
  }
  return record;
}

/** Splits a computed list value at its top-level commas (a cubic-bezier() keeps its own commas). */
export function splitList(value: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    }
    if (char === ',' && depth === 0) {
      items.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  items.push(current.trim());
  return items;
}

/** A list whose entries are all the same collapses to one entry: `0.15s, 0.15s` → `0.15s`. */
function collapseRepeats(value: string): string {
  const items = splitList(value);
  const [first] = items;
  return first !== undefined && items.every((item) => item === first) ? first : value;
}

function normalizeStyles(styles: Readonly<Record<string, string>>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [property, value] of Object.entries(styles)) {
    if (TRANSFORM_PROPERTIES.includes(property)) {
      continue;
    }
    result[property] = property.startsWith('transition-') ? collapseRepeats(value) : value;
  }
  return result;
}

/** Applies the allowed normalizations (and nothing else) to one side's record. */
export function normalizeRecord(record: CaseRecord): CaseRecord {
  return {
    elements: record.elements.map((element) => ({ ...element, styles: normalizeStyles(element.styles) })),
  };
}

function label(element: ElementRecord): string {
  return `${element.path}${element.pseudo} (${element.tags}${element.pseudo})`;
}

function compareBoxes(path: string, reference: Box, impl: Box): Difference[] {
  const differences: Difference[] = [];
  for (const edge of ['x', 'y', 'width', 'height'] as const) {
    if (Math.abs(reference[edge] - impl[edge]) > BOX_TOLERANCE) {
      differences.push({
        path,
        kind: 'box',
        property: edge,
        reference: reference[edge].toFixed(2),
        impl: impl[edge].toFixed(2),
      });
    }
  }
  return differences;
}

/**
 * Pairs the two normalized records element by element in DOM order and returns every difference: a different shape
 * (a missing, extra or reordered element stops the pairing there), a different tag, any differing property, and any box
 * edge more than BOX_TOLERANCE apart.
 */
export function diffCases(reference: CaseRecord, impl: CaseRecord): Difference[] {
  const differences: Difference[] = [];
  const count = Math.max(reference.elements.length, impl.elements.length);
  for (let index = 0; index < count; index += 1) {
    const left = reference.elements[index];
    const right = impl.elements[index];
    if (left === undefined || right === undefined) {
      const reference = left === undefined ? '(none)' : label(left);
      const implementation = right === undefined ? '(none)' : label(right);
      differences.push({
        path: left === undefined ? implementation : reference,
        kind: 'structure',
        property: 'element',
        reference,
        impl: implementation,
      });
      break;
    }
    if (left.path !== right.path || left.pseudo !== right.pseudo) {
      differences.push({
        path: label(left),
        kind: 'structure',
        property: 'order',
        reference: label(left),
        impl: label(right),
      });
      break;
    }
    const path = label(left);
    if (left.tag !== right.tag) {
      differences.push({ path, kind: 'structure', property: 'tag', reference: left.tag, impl: right.tag });
    }
    const properties = new Set([...Object.keys(left.styles), ...Object.keys(right.styles)]);
    for (const property of properties) {
      const a = left.styles[property] ?? '(unset)';
      const b = right.styles[property] ?? '(unset)';
      if (a !== b) {
        differences.push({ path, kind: 'style', property, reference: a, impl: b });
      }
    }
    if (left.box !== null && right.box !== null) {
      differences.push(...compareBoxes(path, left.box, right.box));
    }
  }
  return differences;
}

/** One readable line per difference, for test failure messages. */
export function formatDifferences(differences: readonly Difference[]): string[] {
  return differences.map(
    (difference) =>
      `${difference.path} ${difference.kind} ${difference.property}: reference ${difference.reference} | implementation ${difference.impl}`,
  );
}

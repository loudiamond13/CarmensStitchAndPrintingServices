// WEB-02, D-12, D-28: canonical form of rendered markup for the differential DOM test (research Pattern 3). It hides
// only the differences the owner accepted:
// - React useId values (:r1:, «r1», _r_1_ and the server _R_…_ forms), mapped to placeholders by order of first use,
//   so an id and the labels that point at it still have to agree;
// - the lucide and lucide-<name> classes that lucide-react 1.52.0 adds to every icon svg (D-28);
// - the svg xmlns attribute (React sets it from JSX, an innerHTML string parses it as a namespace);
// - attribute order;
// - the inner drawing of an svg with class csp-icon (D-12: the owner approves icon drawings in a separate review).
// Tags, every other attribute and its value, class order, text and whitespace all still count.
const USE_ID = /:[rR][0-9a-zA-Z]+:|«[rR][0-9a-zA-Z]+»|_[rR]_[0-9a-zA-Z]+_/g;
const LUCIDE_CLASS = /^lucide(?:-.+)?$/;

type IdMap = Map<string, string>;

function mapIds(value: string, ids: IdMap): string {
  return value.replace(USE_ID, (found) => {
    let placeholder = ids.get(found);
    if (placeholder === undefined) {
      placeholder = `«id${String(ids.size + 1)}»`;
      ids.set(found, placeholder);
    }
    return placeholder;
  });
}

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

function attributesOf(element: Element, ids: IdMap): string[] {
  const isSvg = element.localName === 'svg';
  const result: string[] = [];
  for (const attribute of Array.from(element.attributes)) {
    if (isSvg && attribute.name === 'xmlns') {
      continue;
    }
    let value = attribute.value;
    if (isSvg && attribute.name === 'class') {
      value = value
        .split(/\s+/)
        .filter((token) => token !== '' && !LUCIDE_CLASS.test(token))
        .join(' ');
      if (value === '') {
        continue;
      }
    }
    result.push(`${attribute.name}="${escapeAttribute(mapIds(value, ids))}"`);
  }
  return result.sort();
}

function isIcon(element: Element): boolean {
  return element.localName === 'svg' && element.classList.contains('csp-icon');
}

function serialize(node: Node, depth: number, ids: IdMap, out: string[]): void {
  const indent = '  '.repeat(depth);
  if (node.nodeType === Node.TEXT_NODE) {
    out.push(`${indent}${JSON.stringify(node.textContent ?? '')}`);
    return;
  }
  if (node.nodeType === Node.COMMENT_NODE) {
    out.push(`${indent}<!--${node.textContent ?? ''}-->`);
    return;
  }
  if (!(node instanceof Element)) {
    return;
  }
  const attributes = attributesOf(node, ids);
  const open = attributes.length > 0 ? `<${node.localName} ${attributes.join(' ')}>` : `<${node.localName}>`;
  out.push(`${indent}${open}`);
  if (isIcon(node)) {
    out.push(`${indent}  <!-- icon drawing (D-12) -->`);
  } else {
    for (const child of Array.from(node.childNodes)) {
      serialize(child, depth + 1, ids, out);
    }
  }
  out.push(`${indent}</${node.localName}>`);
}

/** Canonical, one-node-per-line form of an HTML fragment (see the header for what is hidden). */
export function normalizeDom(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  const ids: IdMap = new Map();
  const out: string[] = [];
  for (const child of Array.from(template.content.childNodes)) {
    serialize(child, 0, ids, out);
  }
  return out.join('\n');
}

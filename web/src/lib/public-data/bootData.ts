// The server's boot block (`<script type="application/json" id="csps-boot">`): the public data the shell already carries.
// It is parsed once; a missing or damaged block reads as no data, so the page falls back to the API.
export type BootKey = 'site' | 'productLines' | 'home';

type BootBlock = Readonly<Record<string, unknown>>;

/** `undefined` until the document was read; `null` when it held no usable block. */
let block: BootBlock | null | undefined;

function parseBlock(): BootBlock | null {
  const text = document.getElementById('csps-boot')?.textContent;
  if (text === undefined) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as BootBlock) : null;
  } catch {
    return null;
  }
}

/** Reads one part of the boot block, or undefined when the block or the part is missing. The caller knows the shape. */
export function readBootData(key: BootKey): unknown {
  block ??= parseBlock();
  return block === null ? undefined : block[key];
}

/** Forgets the parsed block, so the next read looks at the document again. */
export function resetBootData(): void {
  block = undefined;
}

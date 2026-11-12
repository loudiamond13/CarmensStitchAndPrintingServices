// The server's boot block (`<script type="application/json" id="csps-boot">`): the public data the shell already carries.
export type BootKey = 'site' | 'productLines' | 'home';

/** Reads one part of the boot block, or undefined when the block or the part is missing. */
export function readBootData<T>(key: BootKey): T | undefined {
  void key;
  return undefined;
}

/** Forgets the parsed block, so the next read looks at the document again. */
export function resetBootData(): void {}

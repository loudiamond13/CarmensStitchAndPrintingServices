// The class-string marker (D-33, WEB-02). `tw('…')` returns its argument unchanged; it exists so the tools that read
// class strings by call name find them outside a className attribute: Prettier sorts the classes
// (prettier-plugin-tailwindcss), ESLint checks them (eslint-plugin-better-tailwindcss and the D-33 syntax bans on
// template literals and `+`), and the class gate (scripts/class-gate.mjs) compiles every token against the CSPS theme.
// Pass one complete literal only; a class name built at run time produces no CSS (T-02-82).

/** Marks a complete class-name literal for Prettier, lint and the class gate. Returns it unchanged. */
export function tw(classes: string): string {
  return classes;
}

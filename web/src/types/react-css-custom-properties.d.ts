// React's CSSProperties type has no CSS custom properties. Under the strict CSP, a React `style` may set only custom
// properties (`--ratio`, `--sk-w`, …), which a utility then reads (UI-SPEC "Inline style rule", D-33); lint rejects any
// other style key (eslint.config.mjs). This lets those custom properties type-check without a cast.
import 'react';

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style -- an augmentation must merge into the interface
  interface CSSProperties {
    [customProperty: `--${string}`]: string | number | undefined;
  }
}

# Styling the web app: Tailwind utilities and the CSPS tokens

*Created: 2026-10-08T10:38:41-05:00 · Updated: 2026-10-13T09:10:00-05:00*

This page explains how to style anything in `web/` (decision D-33, requirement WEB-02). It is written for every later phase. The short version: **all styling is Tailwind utility classes in the markup, built only from the CSPS tokens.** No hand-written CSS rules, no inline styles, and no colour or size picked by eye. Two automated gates enforce this, so a mistake fails the tests instead of quietly changing the look.

The binding source is `.planning/phases/02-web-foundation-design-system/02-UI-SPEC.md` (section "Tailwind Contract"). Where this page and the UI spec disagree, the UI spec wins.

## 1. What CSS is allowed to hold

There are exactly two stylesheets, both in `web/src/styles/`:

| File | What it holds |
|---|---|
| `app.css` | The Tailwind entry (`@import "tailwindcss" source("../../src")`), the `@source not …` lines that keep tests out of the scan, the `base.css` layer import, the custom variants (`@custom-variant`), and the token theme (`@theme`, `@theme inline`, with the `@keyframes` inside `@theme`). Nothing else: no selector blocks at all. |
| `base.css` | The token custom properties for each theme (`:root, [data-theme="light"]`, `[data-theme="dark"]`, the `:root` layout tokens), `@font-face` for the font fallbacks, and the global element rules: `body`, `:focus-visible`, the reduced-motion `*` rule inside `@media (prefers-reduced-motion: reduce)`, and `main[tabindex="-1"]:focus`. |

Never add a class selector (`.x { … }`), `@utility`, `@apply`, `@layer`, `@plugin`, another `@media`, or a third stylesheet. The **stylesheet-contract test** (`web/src/styles/stylesheet-contract.node.test.ts`) fails on any of them and names the offending selector or at-rule.

Note the source path: `app.css` lives in `web/src/styles/`, so the app source folder is `../../src`. The older research skeleton wrote `../src`, which would point at a folder that doesn't exist.

## 2. Tokens come only through `@theme`

The theme starts with `--*: initial`, which removes **every** Tailwind default: the colour palette, radii, shadows, font sizes and weights. So `bg-blue-500`, `rounded-xl`, `shadow-lg`, `text-gray-600` and `text-sm` produce **no CSS at all, with no error**. That silent failure is why the class gate exists (see section 6).

What you can use:

- **Colours:** the 37 App. A.2 names only, plus `transparent` and `current`. Examples: `bg-surface`, `bg-surface-2`, `text-ink`, `text-ink-muted`, `border-line-strong`, `text-accent-ink`. They read the live token, so they switch with `data-theme`.
- **Spacing:** the 4px step in px, so `p-4` is 16px and `gap-2` is 8px.
- **Weights:** `font-normal` (400), `font-medium` (500), `font-semibold` (600), `font-button` (650), `font-bold` (700), `font-heavy` (800).
- **Radii:** `rounded-xs`, `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-pill`.
- **Shadows:** `shadow-level-1`, `shadow-level-2`, `shadow-level-3`.
- **Fonts:** `font-sans`, `font-display`.
- **Animations:** `animate-csp-spin`, `animate-csp-fade`, `animate-csp-rise`, `animate-csp-slide`, `animate-csp-shimmer`.
- **Layout and z-index tokens:** read them with the var shorthand, never copy the number: `w-(--sidebar-width)`, `h-(--header-height)`, `z-(--z-overlay)`, `max-w-(--container-max)`.
- **Font sizes and line heights** have no scale. Copy the spec value exactly: `text-[15px]`, `leading-5`, `leading-[.88]`. Never round to the "nearest" Tailwind value.

**No colour literals in a class.** A hex value (`bg-[#ff6600]`), `rgb(` or `oklch(` inside a class token fails the gates. If the spec uses a colour outside the tokens, add it as a named theme token with the same value first.

## 3. Utilities in the markup

Put the utilities on the element, in `className`:

```tsx
<p className="max-w-[560px] text-[18px] leading-[28px] text-ink-muted pg-phone:text-[16px]">…</p>
```

Rules from the UI spec that trip people up:

- **Exact shorthands.** A multi-layer shadow is an arbitrary property, `[box-shadow:0_6px_20px_-10px_var(--primary)]`, never `shadow-[…]`. Copy `color-mix` as written, `bg-[color-mix(in_srgb,var(--bg)_82%,transparent)]`, never an opacity modifier such as `bg-bg/82` (that mixes in oklab). An order-sensitive transform is `[transform:…]`, never `scale-*` plus `translate-*`.
- **No arbitrary shorthand next to its longhands** (`[font:…]`, `[border:…]`, `[background:…]`, `[transition:…]`, `[animation:…]`).
- **Transitions always carry a duration and easing:** `transition-[background-color,border-color,color] duration-150 ease-[ease]`. A bare `transition` has zero duration under the cleared theme.
- **State comes from the attribute that already states it:** `aria-selected:`, `aria-[current=page]:`, `aria-invalid:`, `aria-disabled:`, `data-*:`.
- **Class names are complete literals.** `'bg-' + tone` or `` `bg-${tone}` `` produce no CSS, because Tailwind finds classes by reading the source text. Lint bans template literals and `+` inside `className`, `clsx(…)` and `tw(…)`. Use a map of full strings instead.
- **No opacity on text (D-02).** Nothing that shows text may sit below opacity 1. Inactive or dimmed states use colour tokens (`bg-surface-2`, `text-ink-subtle`). The only opacity utilities allowed are `disabled:opacity-45` and `aria-disabled:opacity-45` (any file), and the ImageUploader thumb's `opacity-0` with its reveal variants `group-hover/thumb:opacity-100`, `group-focus-within/thumb:opacity-100` and `no-hover:opacity-100` (only in `src/ui/media/ImageUploader*`). A new entry in that allow-list (`web/scripts/class-gate.config.mjs`) needs a decision ID in its comment.

## 4. Recipes: shared looks as maps of complete tokens

A component with variants keeps its classes in a recipe file next to it, named `*.recipe.ts`. A recipe is a set of **module-level `as const` maps of complete class tokens**, each string wrapped in `tw('…')`, joined with `clsx`:

```ts
// web/src/ui/button.recipe.ts
import clsx from 'clsx';
import { tw } from '@/ui/tw';

export type ButtonSize = 'sm' | 'md' | 'lg';

const base = tw('inline-flex items-center justify-center gap-2 rounded-sm border font-button disabled:opacity-45');
const size = {
  sm: tw('h-9 px-3 text-[14px]'),
  md: tw('h-11 px-5 text-[15px]'),
  lg: tw('h-13 px-6 text-[16px]'),
} as const satisfies Record<ButtonSize, string>;

export const buttonClasses = (o: { size: ButtonSize; className?: string }) => clsx(base, size[o.size], o.className);
```

- `tw()` returns its argument unchanged. It exists so Prettier sorts the classes and ESLint checks them (both read `tw(…)` calls by name). The helper itself arrives in plan 02-40.
- **Every string literal in a `*.recipe.ts` file is treated as class tokens** by the class gate. Keep other strings (labels, comparisons such as `size === 'sm'`) out of recipe files; put that logic in the component.
- **Axes set disjoint properties.** The base never sets a property that a variant or a size also sets, so no merge library is needed (none is installed, by decision). Lint reports two utilities that set the same property under the same variant in one class list.
- **Shared looks share a recipe.** `Button`, `ButtonLink` and `SkipLink` all use `buttonClasses()`.
- **`className` passthrough is layout glue only** (margin, width, grid or flex placement). Feature code never restyles a primitive; it asks for a new prop instead.

## 5. Context and dynamic values

- **Context ("this component inside that region")** comes from (a) a prop, when the parent renders the child itself (`<Field density="toolbar">`), or (b) a `data-ui` marker on the region plus an `in-data-[ui=s-toolbar]:…` utility on the child.
- **Parent state to child** uses a named group: `group/nav` on the parent, `group-aria-[current=page]/nav:hidden` on the child.
- **Dynamic, continuous values** go only through a CSS custom property in `style`, read by a utility:

  ```tsx
  <span style={{ '--sk-w': width }} className="block w-(--sk-w)" />
  ```

  `style` may set **only** `--*` properties. `style="…"`, `cssText` and `setAttribute('style', …)` are banned, because the strict CSP blocks inline style attributes. A finite set of values (such as column alignment) is a class map, not a custom property.

## 6. Custom variants, and the built-ins you must not use

The spec's breakpoints and states are exact query texts, defined once in `app.css`:

| Variant | Emits |
|---|---|
| `dark:` | `&:where([data-theme="dark"], [data-theme="dark"] *)` |
| `hover:` | a plain `:hover` (no `(hover: hover)` wrapper, so the spec's hover also applies on touch) |
| `pg-phone:` | `@container pg (max-width: 767px)` |
| `pg-tablet:` | `@container pg (min-width: 768px) and (max-width: 1023px)` |
| `pg-md-up:` | `@container pg (min-width: 768px)` |
| `pg-lt-lg:` | `@container pg (max-width: 1023px)` |
| `pg-lt-xl:` | `@container pg (max-width: 1279px)` |
| `pg-xs:` | `@container pg (max-width: 420px)` |
| `vp-lt-sm:` | `@media (max-width: 639px)` |
| `vp-lt-md:` | `@media (max-width: 767px)` |
| `vp-xs:` | `@media (max-width: 420px)` |
| `no-hover:` | `@media (hover: none)` |

The `pg-*` variants need an ancestor with `@container/pg` (the page root). A 767px page gets the phone rule and a 768px page gets the tablet rule; there is no off-by-one gap.

**Allowed built-ins:** `sm:`, `md:`, `lg:`, `xl:` (exact `min-width`), `motion-reduce:`, `focus-visible:`, `focus-within:`, `active:`, `disabled:`, `not-disabled:`, `aria-*:`, `data-*:`, `group-*/<name>:`, `peer-*:`, `in-data-[…]:`, `before:`/`after:`, `placeholder:`, `first:`/`last:`/`nth-*:`, `checked:`.

**Banned built-ins:** `max-*:`, `@max-*`, `@min-*` and the `@md`-style container variants (off by one, or nested differently from the spec), `enabled:` (it doesn't match links, so a link button loses its hover; use `not-disabled:`), and `prefers-color-scheme` dark mode (the theme follows `data-theme`).

## 7. The gates and how to run them

| Gate | What it catches | Where |
|---|---|---|
| Stylesheet contract | A third stylesheet, a class selector, `@utility`, `@apply`, any construct outside section 1 | `web/src/styles/stylesheet-contract.node.test.ts` |
| Class gate | A class token that compiles to no CSS (a cleared default such as `bg-blue-500`, or a typo such as `hover:bg-surfce`), a colour literal in a token, an `opacity-*` token outside the D-02 allow-list; also checks that the custom variants emit the exact query text | `web/scripts/class-gate.mjs` (library), `web/scripts/class-gate.config.mjs` (allow-list), `web/scripts/tailwind-classes.test.ts` (runs it over every `src/**/*.{ts,tsx}` file except tests and `src/test`) |
| ESLint (`eslint-plugin-better-tailwindcss` and syntax bans) | Unknown and conflicting classes, colour literals and banned variants in `className`/`clsx`/`tw`, template or `+` class names, `style` other than `--*`, `cssText`, `setAttribute('style')`, stylesheet imports | `web/eslint.config.mjs` |
| Prettier (`prettier-plugin-tailwindcss`) | Class order in `className`, `clsx(…)` and `tw(…)` | `web/.prettierrc.json` |
| Parity harness | Any visible difference from the approved design | later plan in this phase |

The class gate collects tokens from `className` string literals (including both branches of a `? :`), the arguments of `clsx(…)` and `tw(…)` (strings, arrays, object keys, conditionals), and every string literal in a `*.recipe.ts` file. A variable in one of those positions is followed too: a `const` of the same file through its initializer, and an imported one (through `@/` paths and barrels) to the src module that declares it, where its tokens are checked and reported (TOOL-WR-06). It compiles each token against the real `app.css` with Tailwind's own `compile()`, so it sees exactly what the build sees. The `group` and `peer` marker classes (`group/nav`, `group/thumb`) emit no CSS by design and are accepted. To run the gate on its own, outside Vitest: `node web/scripts/class-gate.mjs` (it prints each finding and exits 1 when there is one).

Run them from the repository root:

```powershell
npm --prefix web run test -- --run src/styles/stylesheet-contract.node.test.ts scripts/tailwind-classes.test.ts
npm --prefix web run lint
npm --prefix web run verify    # the full web gate: typecheck, lint, format, tests with coverage, build
```

When the class gate fails, the message names the file, the line, the token and the reason (`unknown`, `colour-literal` or `opacity`). Fix the token; don't widen the allow-list unless the owner has made a recorded decision.

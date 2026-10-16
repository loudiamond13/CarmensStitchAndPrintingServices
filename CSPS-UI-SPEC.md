# CSPS — UI Implementation Spec (strict)
*Created: 2026-10-07T17:17:38-05:00 · Updated: 2026-10-15T16:21:29-05:00*

**Carmen's Stitch & Printing Services** — public website + staff admin
Spec version 1.1 · Oct 6, 2026 · **Target stack: React + TypeScript + Tailwind CSS v4 (Vite)**
Source: the approved "CSPS Website & Admin" design canvas and the "CSPS" design system

---

## 0. Read this first (instructions for the implementing agent)

You are implementing an **already-approved visual design**. Your job is to reproduce it exactly, not to redesign it.

**Hard rules**

1. **Do not invent styles.** Every color, font, size, radius, shadow, spacing value, breakpoint and class name is defined in this file. If a value isn't here, take it from the verbatim source in the appendices. Never use framework defaults: Tailwind's default palette, radii and shadows are removed from the theme (§2.4), and no component library (MUI, shadcn, Bootstrap…) may be added.
2. **Use the provided CSS through Tailwind.** Appendices A–C hold the exact stylesheets the approved design renders with, already prepared for Tailwind v4. Copy them **unchanged** and wire them up through `globals.css` (Appendix A.2). Build markup with their `.csp-*` / `.s-*` class names. Tailwind utilities are for layout glue and token-based one-offs only (§2.3), never for restyling a designed element.
3. **Use the provided TypeScript components.** Appendix D is the typed React source of every design-system component (`Button`, `OrderCard`, `ConfirmDialog`…) and of the order math. Copy it into the project. Keep the DOM structure, class names, props and copy. Extend it only by adding props, never by changing the output markup.
4. **Use the reference pages.** Appendix E is the markup of every approved screen. Translate it to TSX (§2.9). Section order, copy, class names and data shown must match.
5. **Copy is part of the design.** Use the exact strings in this spec (headings, button labels, helper text, toasts, errors). Placeholders in square brackets like `[0917 000 0000]` are for the owner to fill in later. Keep them as config values, not hard-coded fakes.
6. **Only these deviations are allowed** (they exist because the mockups were drawn in fixed-size frames). §2.10 lists them; nothing else may change.
7. If something is genuinely unspecified (for example, a screen the mockups don't show), compose it from existing components and patterns in this file. Leave a `// SPEC-GAP:` comment so the owner can review it.

**Precedence when two sources disagree:** Appendix source (A–E) › tables in this file › prose in this file.

**Brand name:** write **CSPS** in UI and headings. Write **Carmen's Stitch & Printing Services** in full in footers, legal text and the logo tagline. The logo reads **[C]SPS**: the icon mark *is* the letter C, followed by the typed letters "SPS".

---

## 1. Product overview

Two faces share one design language.

**Public site.** Warm, loud and mobile-first; most visitors arrive on a phone from Facebook. It uses only the **Blush** theme.

**Admin.** Calm and data-first, for staff. It has the **Blush** theme (default) and an **Espresso** dark theme the user can toggle. It works on desktop, tablet and phone.

### 1.1 Routes (suggested — keep the screens, adjust paths to the project's router)

| Route | Screen | Mockup source (Appendix E) |
|---|---|---|
| `/` | Home | `Main` |
| `/products` | Products | `Products` |
| `/gallery` | Gallery + lightbox | `Gallery` |
| `/contact` | Contact / Get a Quote | `Contact` |
| `/admin/login` | Staff sign in | `Login` |
| `/admin` | Dashboard | `Dashboard` |
| `/admin/orders` | Orders (grid ⇄ table) | `Orders`, `OrdersStates` |
| `/admin/orders/new` | Create order | `OrderForm` |
| `/admin/orders/:id` | Order detail | `OrderDetail` |
| `/admin/orders/:id/edit` | Edit order (same screen as create, title "Edit Order", fields prefilled) | `OrderForm` |
| `/admin/expenses` | Company Expenses | `Expenses` |
| `/admin/users` | Users (**Manager only**) | `Users` |
| `/admin/profile` | My Profile | `Profile` |

### 1.2 Roles

| Role | Can |
|---|---|
| **Admin** | Everything in orders (and their items, payments, discounts, expenses, images), company expenses, own profile. |
| **Manager** | Everything Admin can, **plus** the Users screen: add, edit, change role, deactivate or activate, delete users. |

- The **Users** nav item and route exist only for Managers. The sidebar shows a small "Manager" tag on that item.
- Non-managers who hit `/admin/users` are redirected to `/admin`.
- A user can't deactivate or delete their own account: hide those two buttons on their own row.

---

## 2. Technical setup — React + TypeScript + Tailwind CSS

### 2.1 Stack (verified)

The reference setup below was built, type-checked (`tsc --strict`), unit-tested and screenshot-checked against the mockups in light and dark themes at 1440, 820 and 390 px.

| Package | Version tested | Role |
|---|---|---|
| `react`, `react-dom` | 19.3 | UI |
| `typescript` | 7.0 | strict mode |
| `vite` + `@vitejs/plugin-react` | 8.3 / 6.1 | build |
| `tailwindcss` + `@tailwindcss/vite` | 4.3 | utilities, preflight, theme mapped to CSPS tokens |
| `react-router` | 8.4 | routes in §1.1 |
| `clsx` | 2.1 | class joining |
| `@fontsource/barlow-condensed` | 5.3 | display font (600, 700, 800, 800 italic) |
| `@fontsource-variable/archivo` | 5.3 | UI font (variable 100–900, includes the ₱ glyph in its latin-ext subset) |
| `vitest` | 5.0 | tests for the order math |

```bash
npm i react react-dom react-router clsx @fontsource/barlow-condensed @fontsource-variable/archivo
npm i -D typescript vite @vitejs/plugin-react tailwindcss @tailwindcss/vite @types/react @types/react-dom vitest
```

If the project already pins other major versions, keep them. Everything here only needs React ≥ 18, TypeScript ≥ 5 and Tailwind v4. (Tailwind v3 would need a `tailwind.config` translation of §2.4; prefer v4.)

### 2.2 Files to create (all verbatim from the appendices)

```
index.html                     ← Appendix D.7 (favicon = /mark.svg)
public/mark.svg                ← Appendix F
vite.config.ts                 ← Appendix D.7
tsconfig.json                  ← Appendix D.7 (strict)
src/main.tsx                   ← Appendix D.6 (font imports + globals.css)
src/app/RouterLink.tsx         ← Appendix D.6 (React Router adapter for LinkProvider)
src/styles/globals.css         ← Appendix A.2 (Tailwind entry: layers + @theme mapped to tokens)
src/styles/tokens.css          ← Appendix A   (design tokens, both themes, type utility classes)
src/styles/compat.css          ← Appendix A.3 (restores 2 browser defaults preflight removes)
src/styles/components.css      ← Appendix B   (all .csp-* component styles — unchanged)
src/styles/screens.css         ← Appendix C   (all .s-* page layout + responsive rules)
src/lib/csps.ts                ← Appendix D.1 (domain types, formatPeso/formatDate, order math, option lists)
src/lib/csps.test.ts           ← Appendix D.2 (must pass)
src/ui/index.tsx               ← Appendix D.3 (every design-system component, typed)
src/ui/icons.ts                ← Appendix D.5 (Lucide v0.460.0 icon nodes, typed IconName)
src/ui/mark.ts                 ← Appendix D.4 (the mark's inner SVG)
src/pages/public/*.tsx         ← build from Appendix E (Home, Products, Gallery, Contact)
src/pages/admin/*.tsx          ← build from Appendix E (Login, Dashboard, Orders, OrderForm, OrderDetail, Expenses, Users, Profile)
src/layouts/PublicLayout.tsx   ← .s-page[data-theme=light] + SiteHeader + <Outlet/> + footer
src/layouts/AdminLayout.tsx    ← .s-page[data-theme] + .s-admin shell (§8.1) + ToastProvider + auth/role guard
```

Suggested path alias: `@/` → `src/`.

### 2.3 How the CSS is organised (don't change this)

`globals.css` (Appendix A.2) is the only stylesheet imported by the app:

```css
@import "tailwindcss";                                 /* theme + preflight + utilities */
@import "./tokens.css"     layer(base);
@import "./compat.css"     layer(base);
@import "./components.css" layer(components);
@import "./screens.css"    layer(components);
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
@theme inline { … CSPS tokens only … }
```

- **The CSPS classes own the look.** Every component and page style is a `.csp-*` or `.s-*` class from Appendices B and C. Build markup with those class names exactly as Appendix E does.
- **Tailwind's preflight is compatible.** Every screen's computed styles and every component preview were diffed with and without preflight. The only differences that mattered were two browser defaults, which `compat.css` restores:
  - `<dl class="s-hours">` and `<dl class="s-meta">` keep their 1em block margins.
  - The search inputs keep their 1px / 2px padding.
- **Utilities come after components in the cascade**, so they can add layout glue (`mt-6`, `grid gap-4`, `sr-only`, `hidden md:flex`) where the mockups used an inline `style="…"`.

**Tailwind rules**

| ✅ Allowed | ❌ Not allowed |
|---|---|
| Replacing an inline `style="display:flex; gap:16px"` from Appendix E with `flex gap-4` (same values) | Restyling a `.csp-*` / `.s-*` element with utilities (colors, radius, font, padding that differ from the class) |
| Token utilities: `bg-surface`, `text-ink-muted`, `border-line`, `text-accent-ink`, `rounded-md`, `shadow-level-1`, `font-display` | Any Tailwind default palette or scale: `bg-blue-500`, `text-gray-600`, `rounded-xl`, `shadow-lg`. These are **removed** from the theme and won't compile. |
| `dark:` variant (follows `data-theme="dark"`) | `prefers-color-scheme`-based dark mode |
| Arbitrary values only to transcribe an exact inline style from Appendix E (e.g. `max-w-[640px]`) | Arbitrary hex colors (`bg-[#ff6600]`) — use a token utility |
| Viewport breakpoints `sm` 640, `md` 768, `lg` 1024, `xl` 1280 for glue | Re-implementing responsive behaviour that `screens.css` already handles with container queries |

- Inline styles from Appendix E may stay as React `style={{…}}` objects; converting them to equivalent utilities is optional.
- Either way, the rendered values must be identical.

### 2.4 Tailwind theme = CSPS tokens

The `@theme inline` block in Appendix A.2:

- **Clears** Tailwind's default colors, font families, radii and shadows (`--color-*: initial`, etc.).
- **Maps** the CSPS tokens into Tailwind. Because it's `inline`, every utility reads the live CSS variable, so it switches with `data-theme`:
  - colors: `bg`, `surface`, `surface-2`, `surface-3`, `nav-bg`, `nav-ink`, `sand`, `line`, `line-strong`, `ink`, `ink-muted`, `ink-subtle`, `primary`, `primary-hover`, `on-primary`, `accent`, `accent-hover`, `on-accent`, `accent-ink`, `accent-soft`, `accent-line`, `focus`, `danger(-soft)`, `on-danger`, `success(-soft)`, `warning(-soft)`, `info(-soft)`, `mockup(-soft)`, `neutral-soft`, `chart-income`, `chart-expense`, `scrim`, `link`, `transparent`, `current`
  - fonts: `font-display`, `font-sans`
  - radii: `rounded-xs` 4 · `rounded-sm` 8 · `rounded-md` 12 · `rounded-lg` 18 · `rounded-pill`
  - shadows: `shadow-level-1/2/3`, mapped to the themed `--shadow-1/2/3`
- **Spacing** keeps Tailwind's default 4px step, which already equals the CSPS scale (`p-4` = 16px = `--space-4`, `gap-6` = 24px, `py-24` = 96px).

### 2.5 Fonts

- Imported in `main.tsx` from @fontsource (self-hosted, `font-display: swap`):
  - `@fontsource/barlow-condensed/600.css`, `700.css`, `800.css`, `800-italic.css`
  - `@fontsource-variable/archivo`
- The family name of the variable Archivo package is **"Archivo Variable"**, so the React edition of `tokens.css` (Appendix A) uses:
  - `--font-display: "Barlow Condensed", "Archivo Variable", "Arial Narrow", sans-serif`
  - `--font-sans: "Archivo Variable", system-ui, -apple-system, "Segoe UI", sans-serif`
- This is the **only** token change from the approved file; it renders identically.
- Verify that `document.fonts.check('16px "Archivo Variable"', '₱')` returns `true`.

### 2.6 Icons

- `src/ui/icons.ts` holds the exact Lucide v0.460.0 node data for the 57 icons the design uses (list below).
- It exports a typed `IconName` union, so `<Icon name="trahs-2" />` is a compile error.
- Render icons only through `<Icon name size />`. Don't add `lucide-react`; if an icon is missing, add its node data from Lucide v0.460.0 to `icons.ts`.

`plus, x, eye, eye-off, search, trash-2, pencil, cloud-upload, image, grip-vertical, chevron-down, chevron-left, chevron-right, layout-dashboard, clipboard-list, receipt, users, user-round, log-out, menu, phone, message-circle, mail, map-pin, clock, check, circle-check, triangle-alert, info, layout-grid, list, filter, calendar, arrow-right, arrow-up-right, star, shirt, scissors, palette, zap, truck, wallet, trending-up, trending-down, quote, package, ellipsis, sun, moon, loader-circle, lock, panel-left-close, panel-left-open, shield-check, ruler, printer`

Sizes used: 14, 16, 18, 20, 22, 24, 26, 28.

### 2.7 Theming

- Every page renders inside `<div className="s-page" data-theme={theme}>`. That element also provides the `pg` container that all responsive rules in `screens.css` query.
- `data-theme="light"` is **Blush** (default; also `:root`). `data-theme="dark"` is **Espresso**.
- The public layout always uses `light`.
- The admin layout:
  - keeps `theme` in state, initialised from `localStorage['csps-theme']`, default `light`;
  - passes `theme` and `onToggleTheme` to `<Topbar>`;
  - doesn't follow `prefers-color-scheme`.
- **Anything rendered in a portal must also sit inside an element with `data-theme`** (and inside `.s-page` if it uses `.s-*` responsive rules). That covers toasts, modals and lightboxes. The simplest way is to render them inside the layout's `.s-page`, as `ToastProvider` does when placed there.

### 2.8 React integration notes (all already in Appendix D)

- **Links.** Wrap the app (inside `<BrowserRouter>`) in `<LinkProvider component={RouterLink}>`. `RouterLink` (Appendix D.6) is a tiny adapter that renders React Router's `<Link to>`, which outputs the same plain `<a>`. `SiteHeader`, `Sidebar`, `CategoryCard` and `ButtonLink` then use client-side routing.
  - Mockup `<a class="csp-btn csp-btn-primary csp-btn-md" href="…">` becomes `<ButtonLink variant="primary" to="…">`.
  - Other mockup `<a href="X.dc.html">` become `<UiLink to="/route">` with the same className.
- **Toasts.** Put `<ToastProvider>` inside the layout's `.s-page`. In components, call `const toast = useToast(); toast({ tone: 'success', title: 'Payment added', message: 'Balance now ₱4,327.50' })`. Toasts auto-dismiss after 4.5s, stack newest on top, max 3.
- **Modals.** Render as in the mockups: `{open && <div className="s-overlay"><Modal inline … /></div>}`. In this edition `.s-overlay`, `.s-lightbox` and `.s-toast-layer` are `position: fixed`. Lock body scroll while one is open (`document.body.style.overflow = 'hidden'`).
- **Order math.** Import everything from `@/lib/csps` (`orderTotals`, `formatPeso`, `formatDate`, `discountAmount`, `cascadeSentence`, `orderNumber`, the option lists and the domain types).
  - **Never re-implement the formulas inline.**
  - `npx vitest run` must pass `csps.test.ts`, which asserts the ORD-2026-0148 figures.
- **IDs.** Field ids come from React `useId()`.
- **Forms.** `Field`, `Select` and `PasswordField` accept all native input props (`value`, `onChange`, `name`, `autoComplete`…). Use them controlled, with any form library, but keep their markup.

### 2.9 Translating Appendix E markup to TSX

| Mockup markup | TSX |
|---|---|
| `<x-import component-from-global-scope="CSP.KpiCard" label="Active orders" value="{{k.active}}" money="{{no}}" icon="clipboard-list">` | `<KpiCard label="Active orders" value={18} money={false} icon="clipboard-list" />` |
| kebab props `icon-right`, `default-value`, `on-change`, `show-strength`, `confirm-text`, `confirm-label`, `delta-label` | `iconRight`, `defaultValue`, `onChange`, `showStrength`, `confirmText`, `confirmLabel`, `deltaLabel` |
| `class="…"`, `for="…"`, `colspan`, `onClick="{{fn}}"` | `className`, `htmlFor`, `colSpan`, `onClick={fn}` |
| `style="display: flex; gap: 16px"` | `style={{ display: 'flex', gap: 16 }}` or `className="flex gap-4"` |
| `<sc-for list="{{rows}}" as="r">…</sc-for>` | `{rows.map((r) => …)}` with a stable `key` |
| `<sc-if value="{{x}}">…</sc-if>` | `{x && …}` |
| `{{n18}}`, `{{yes}}`, `{{no}}` | `18`, `true`, `false` |
| the `renderVals()` / `this.state` logic in each page's script | component state + data from the API; the copy, validation and toast strings must stay exactly as written there |
| `href="Orders.dc.html"` | `to="/admin/orders"` (route table §1.1) |
| `<a class="csp-btn csp-btn-secondary csp-btn-md" href="Orders.dc.html">View Orders</a>` | `<ButtonLink to="/admin/orders">View Orders</ButtonLink>` |
| `<div class="s-page" data-theme="{{theme}}">` + `.s-admin` shell | provided once by `AdminLayout`; pages render only what is inside `<main class="s-body">` |

**Example — Dashboard header and KPI row, translated from Appendix E.6:**

```tsx
import { ButtonLink, KpiCard, formatDate } from '@/ui';

const greeting = (d: Date) => (d.getHours() < 12 ? 'Good morning' : d.getHours() < 18 ? 'Good afternoon' : 'Good evening');
const weekday = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long' }); // pass `today` already in Asia/Manila time

export function DashboardHeader({ firstName, today }: { firstName: string; today: Date }) {
  return (
    <>
      <div className="s-ph">
        <div className="s-ph-title">
          <h1>{greeting(today)}, {firstName}</h1>
          <p>{weekday(today)}, {formatDate(today)} · Here's how the shop is doing this month.</p>
        </div>
        <div className="s-ph-actions">
          <ButtonLink to="/admin/orders">View Orders</ButtonLink>
          <ButtonLink variant="primary" to="/admin/orders/new" icon="plus">New Order</ButtonLink>
        </div>
      </div>
      <div className="s-kpis">
        <KpiCard label="Active orders" value={18} money={false} icon="clipboard-list" hint="4 due this week" />
        <KpiCard label="Total receivables" value={84260} icon="wallet" hint="Unpaid balances, all active orders" />
        <KpiCard label="Collected · Oct" value={126450} icon="trending-up" delta={12} deltaLabel="vs Sep, same day" />
        <KpiCard label="Company expenses · Oct" value={38226.95} icon="receipt" hint="7 entries · top: Rent" />
      </div>
    </>
  );
}
```

### 2.10 Allowed production adaptations (the ONLY deviations)

1. **Fixed overlays.** `.s-overlay`, `.s-lightbox` and `.s-toast-layer` are `position: fixed`; this is already done in the Appendix C edition. Lock body scroll while one is open.
2. **Container queries stay.** Responsive rules stay as `@container pg (…)` on `.s-page`. Don't convert them to `@media` or to Tailwind breakpoint utilities.
3. **Modals render inline inside `.s-overlay`,** exactly as the mockups do: scrim `var(--scrim)`, modal top-aligned 140px down on desktop, bottom sheet on phones.
4. **Links** become router links (§2.8).
5. **Placeholder imagery.** Where no photo exists, use `MediaPlaceholder` and the jersey SVG illustrations (§7.5) exactly as drawn. Real photos fill the same box with `object-fit: cover`.
6. **Mobile admin navigation drawer.** The topbar `menu` button (phones only) opens the full `Sidebar` as a 248px left drawer over a `var(--scrim)` overlay. It closes on scrim click, Esc or navigation. Mark it `// SPEC-GAP: mobile nav drawer`.
7. **Fonts and preflight compat** (§2.3, §2.5): the "Archivo Variable" family name and the `compat.css` restores.

---

## 3. Design tokens

Every token is a CSS custom property defined in Appendix A. Reference tokens with `var(--name)`; never hard-code their hex in component CSS. The only exceptions are the brand-fixed hexes inside the logo mark, the jersey illustrations and the lightbox chrome, which are already in the verbatim CSS and markup.

### 3.1 Color — Blush (light, default) and Espresso (dark)

| Token | Blush | Espresso | Use |
|---|---|---|---|
| `--bg` | `#f6dfd1` | `#1a100f` | Page background |
| `--surface` | `#fbebe2` | `#241614` | Cards, tables, toolbar |
| `--surface-2` | `#f1e1d7` | `#2f1e1b` | Inputs, hover rows, placeholders |
| `--surface-3` | `#fff6f0` | `#382623` | Floating: modals, toasts, popovers |
| `--nav-bg` | `#d4bbab` | `#130b0a` | Admin sidebar (Taupe) |
| `--nav-ink` | `#572e2b` | `#d4bbab` | Sidebar text |
| `--sand` | `#e9b88f` | `#5a3a2c` | Decorative slabs only — never text |
| `--line` | `#e3c6b7` | `#3f2b28` | Hairlines, card borders |
| `--line-strong` | `#9a6c60` | `#8f6c62` | Control borders (3:1) |
| `--ink` | `#3b1f1c` | `#f6dfd1` | Primary text |
| `--ink-muted` | `#6b443c` | `#d0b2a4` | Secondary text |
| `--ink-subtle` | `#7a5248` | `#b39385` | Helper / footer text |
| `--primary` | `#572e2b` | `#f6dfd1` | Primary buttons, selected nav (Maroon) |
| `--primary-hover` | `#6f3b37` | `#ffeee4` | |
| `--on-primary` | `#f6dfd1` | `#572e2b` | Text on primary |
| `--accent` | `#ff6600` | `#ff6a1a` | Brand orange **fill** |
| `--accent-hover` | `#ff7a24` | `#ff8340` | |
| `--on-accent` | `#1f0f0d` | `#1a100f` | Text on orange (never white) |
| `--accent-ink` | `#a33f00` | `#ff8a4c` | Orange as **text**: links, eyebrows, order numbers |
| `--accent-soft` | `#fcd9c2` | `#3d2014` | Soft orange ground |
| `--accent-line` | `#c24e00` | `#ff6a1a` | Orange rules, active markers, skewed dashes |
| `--focus` | `#572e2b` | `#ff8a4c` | Focus ring |
| `--danger` / `--danger-soft` / `--on-danger` | `#b3261e` / `#f9d6cf` / `#fff6f0` | `#ff7b6b` / `#3a1714` / `#1a100f` | |
| `--success` / `--success-soft` | `#1b6a51` / `#d3eadf` | `#6fd1ad` / `#12302a` | |
| `--warning` / `--warning-soft` | `#855400` / `#f6e2b8` | `#f2b65c` / `#3a2a10` | |
| `--info` / `--info-soft` | `#285787` / `#dbe5f0` | `#8ab9ea` / `#142838` | |
| `--mockup` / `--mockup-soft` | `#6a3780` / `#eedcf0` | `#d3a8e6` / `#2e1d38` | Plum, for "Mockup" status |
| `--neutral-soft` | `#ead1c4` | `#34221f` | Neutral badge ground |
| `--chart-income` | `#d45500` | `#ff6a1a` | Income bars |
| `--chart-expense` | `#572e2b` | `#d4bbab` | Expense bars |
| `--scrim` | `#3b1f1ccc` | `#000000b8` | Modal backdrop |

**Aliases (both themes):**

| Alias | Points to |
|---|---|
| `--status-pending` | `var(--ink-muted)` |
| `--status-mockup` | `var(--mockup)` |
| `--status-production` | `var(--warning)` |
| `--status-ready` | `var(--info)` |
| `--status-completed` | `var(--success)` |
| `--status-cancelled` | `var(--danger)` |
| `--link` | `var(--accent-ink)` |

**Color rules**

- One maroon **primary** button per view, at most.
- Orange is an energy **fill**: logo bar, hero slab, active-tab underline, cover tag, KPI icon tile, income bars, final CTA band. Text on orange is `--on-accent`. When orange must be text, use `--accent-ink`.
- Status colors are cool and separate from the warm brand colors. Every status also has a **word** (and usually an icon or dot); color is never the only signal.
- Every text pair passes WCAG 4.5:1 and every control border passes 3:1 in both themes. Don't introduce new pairs.

### 3.2 Shadows

| Token | Blush | Espresso |
|---|---|---|
| `--shadow-1` | `0 1px 2px 0 #3b1f1c14, 0 1px 3px 0 #3b1f1c0d` | `0 1px 0 0 #ffffff0a inset, 0 1px 2px 0 #00000066` |
| `--shadow-2` | `0 12px 28px -10px #3b1f1c33` | `0 12px 32px -8px #000000b3` |
| `--shadow-3` | `0 24px 56px -16px #3b1f1c4d` | `0 24px 64px -12px #000000cc` |

Uses: cards `shadow-1`; hero tag and map pin `shadow-2`; modals and toasts `shadow-3`.

### 3.3 Typography

| Style | Family | Size / line-height | Weight | Extras | Phone (≤767) |
|---|---|---|---|---|---|
| display-hero (`.s-h1`) | display | 96 / .88 | 800 **italic** | −0.01em, UPPERCASE, `em` → `--accent-ink` | 56 (52 ≤420; inner-page head 52) |
| inner page H1 (`.s-pagehead .s-h1`) | display | 80 / .88 | 800 italic | UPPERCASE | 52 |
| tablet hero (`.s-h1` at ≤1023) | | 76 | | | |
| display-lg (`.s-h2`) | display | 48 / 1 | 800 | UPPERCASE, `em` → `--accent-ink`, not italic | 36 |
| display-md (`.s-title`) | display | 32 / 1.05 | 700 | | |
| display-sm | display | 22 / 1.1 | 700 | card titles | |
| admin page title (`.s-ph-title h1`) | display | 34 / 1.05 | 700 | sentence/Title case, **not** uppercase | 30 (tablet and phone) |
| stat / KPI value | display | 40 / 1 (clamp 26–40) | 700 | tabular nums | 24 at ≤420 |
| eyebrow (`.s-eyebrow`) | display | 14 / 1.15 | 700 | .16em, UPPERCASE, `--accent-ink`, preceded by a 24×3 skewed `--accent-line` dash | |
| body-lg / lead (`.s-lead`) | sans | 18 / 28 | 400 | `--ink-muted`, max-width 560 | 16 / 24 |
| body | sans | 16 / 24 | 400 | | |
| body-sm (`.s-small`) | sans | 14 / 20 | 400 | | |
| label (`.csp-label`) | sans | 14 / 20 | 600 | | |
| button | sans | 15 / 20 | 650 | .01em | |
| caption (`.s-cap`) | sans | 12 / 16 | 500 | `--ink-muted` | |
| overline (`.csp-overline`) | sans | 11 / 16 | 700 | .12em, UPPERCASE | |

**Casing**

- Public headlines and eyebrows are UPPERCASE.
- Buttons, nav, tabs and admin page titles are Title Case ("Get a Quote", "Add Payment", "Company Expenses").
- Body, labels, helper text and toasts are sentence case.

### 3.4 Spacing, radius, layout, z-index

| Group | Values |
|---|---|
| Space | `--space-1` 4 · `-2` 8 · `-3` 12 · `-4` 16 · `-5` 20 · `-6` 24 · `-8` 32 · `-12` 48 · `-16` 64 · `-24` 96 (px) |
| Radius | `--radius-xs` 4 · `-sm` 8 · `-md` 12 · `-lg` 18 · `-pill` 999 |

| Layout token | Value |
|---|---|
| `--container-max` | 1200 |
| `--header-height` | 64 (56 on phones) |
| `--sidebar-width` | 248 |
| `--sidebar-collapsed` | 72 |
| `--topbar-height` | 64 |
| `--slideover-width` | 480 |
| `--cut-angle` | 48 (32 on phones) |

Z-index: `--z-header` 40, `--z-overlay` 80, `--z-toast` 100.

### 3.5 Breakpoints (page width, via `@container pg`)

| Name | Width | Summary |
|---|---|---|
| Phone | ≤ 767 | Single column; admin sidebar hidden and replaced by bottom tab bar; tables become stacked cards; modals become bottom sheets. |
| Tablet | 768 – 1023 | Admin sidebar becomes a 72px icon rail; 2-column grids; detail summary moves to the top. |
| Small desktop | 1024 – 1279 | Orders 3 cols, Why 3 cols, gallery 3 cols, detail side 320px. |
| Desktop | ≥ 1280 | Full layouts as drawn at 1440. |

Mockup frame widths: desktop **1440**, tablet **820**, phone **390**. Match those screenshots at those widths.

---

## 4. Brand: logo and mark

### 4.1 The mark

- A 512×512 orange tile (`#ff6600`, corner radius 118) carrying a **stitched C**: a maroon ring open on the right, with a blush running stitch.
- A cream **needle** threads diagonally through the C; the ring passes over the needle at the lower left.
- Verbatim SVG in Appendix F.
- The ring color reads `var(--csp-mark-ring, #572e2b)` and the stitch `var(--csp-mark-stitch, #f6dfd1)`. In dark theme components.css sets ring `#1a100f` and stitch `#ff6a1a`.
- Don't redraw, recolor (other than these two variables), rotate or stretch it.

### 4.2 The logo lockup: [C]SPS

`Logo` (Appendix D) renders, left to right:

1. The **mark**, standing in for the letter **C**, sized to cap height. Class `.csp-logo-c`: `.784em` square, `margin-bottom: .15em`.
2. **"SPS"** in Barlow Condensed 800 italic (`.csp-logo-mark`), color `--ink`, line-height .8. Under it sits an orange skewed underline bar (`.csp-logo-slash`: height .085em, `--accent`, `skewX(-18deg)`).
3. An optional **tagline**, "CARMEN'S STITCH / & PRINTING SERVICES" on two lines (Archivo 700, uppercase, .16em tracking). It's preceded by an orange skewed slash.

Props: `size` sm/md/lg, `tagline` (default true), `variant` full/mark/wordmark.

| Size | Letter size | Tagline size | Mark px (variant="mark") |
|---|---|---|---|
| `sm` | 32px | 9px | 36 |
| `md` | 50px | 11px | 56 |
| `lg` | 92px | 15px | 104 |

**Where each is used**

| Place | Logo |
|---|---|
| Public header | `Logo size="sm"` with tagline (tagline 8px, .12em on phones) |
| Public footer (Home, Products) | `Logo size="md"` (phone: letters 40px, tagline 9.5px, gap 10) |
| Footer base row (Gallery, Contact) | `Logo size="sm"` |
| Login brand panel | `Logo size="lg"` (phone: letters 56px, tagline 9.5px, gap 12) |
| Admin sidebar, expanded | `Logo size="sm" tagline={false}` |
| Admin sidebar, collapsed / tablet rail | mark only, 36×36 |

- `aria-label` on the logo: "CSPS — Carmen's Stitch & Printing Services".
- Static SVG lockups for print and social (horizontal, horizontal-reverse, stacked, wordmark, mark, mark-dark) exist in the design system's Logos group. They aren't needed for the web UI, which uses the live `Logo` component.
- Favicon and app icon: `mark.svg`.

---

## 5. Visual motifs (use exactly where the mockups do)

| Motif | Class / implementation | Where |
|---|---|---|
| **Dot mesh** | `.s-mesh` / `.csp-mesh`: 6px grid of 1px dots in `color-mix(var(--ink) 9%)` | Hero, page heads, "How ordering works", media placeholders, login brand panel |
| **Diagonal cut sections** | `.s-cut`: `--surface` band clipped `polygon(0 var(--cut-angle), 100% 0, 100% calc(100% − cut), 0 100%)`, negative margins so bands overlap | Home: categories, how-it-works; final CTA (`.s-cut-accent`, top cut only) |
| **Orange slab** | Absolutely positioned `--accent` block clipped to a parallelogram (`.s-hero-slab`), with a `--sand` slab behind it (`.s-hero-slab2`) | Home hero art |
| **Login slab + bands** | `.s-login-slab` and `.s-login-bands` (repeating −14° `--on-accent` stripes on the lower half) | Login brand panel |
| **Profile stripe** | `.s-profile-stripe`: orange parallelogram plus −72° stripes, right edge of profile header | My Profile |
| **Outlined numerals** | Huge Barlow 800 italic, `color: transparent`, `-webkit-text-stroke: 2px var(--line)` (hero "23", 260px) or `--line-strong` at 50% opacity (login "C", 300px) | Hero, login |
| **Dashed rule** | `border-top: 2px dashed var(--line)` — used for `tfoot` top borders, footer base, status total, items footer, product dividers. The separate `.csp-stitch` rule is a gradient (`--line-strong`, 8px on / 6px off) | Throughout |
| **Skewed dash** | 24×3 `--accent-line` bar, `skewX(-18deg)`, before every eyebrow; also the logo slash | Throughout |
| **Jersey illustrations** | Inline SVG tank and long-sleeve silhouettes with team colors and numbers (§7.5) | Home hero, strip, products, gallery |

---

## 6. Components (Appendix D is the source of truth)

Each component below lists its anatomy and the visual facts that matter. The CSS for all of them is in Appendix B.

### 6.1 Actions

**Button** (`.csp-btn .csp-btn-{variant} .csp-btn-{size}`)

| Size | Height | Icon size |
|---|---|---|
| sm | 36 | 16 |
| md | 44 | 18 |
| lg | 52 | 18 |

- Radius `--radius-sm`; weight 650; text 14px (sm), 15px (md), 16px (lg).
- Variants:
  - `primary`: `--primary` fill, `--on-primary` text.
  - `secondary`: transparent with a 1px `--line-strong` border, `--ink` text.
  - `ghost`: `--ink-muted` text, no border.
  - `danger`: `--danger` fill, `--on-danger` text.
  - `ghost-danger`: ghost that turns `--danger-soft` / `--danger` on hover.
- Props: `icon` (left), `iconRight`, `loading` (swaps the left icon for a spinning `loader-circle`, sets `aria-busy`, disables), `block` (full width). With no children it renders as a square icon button.

**Public link-buttons** (`.s-a-btn`)

- Height 52, padding 0 24, 16px / 650.
- Variants: `.s-a-primary` (maroon fill), `.s-a-secondary` (outline), `.s-a-dark` and `.s-a-ghost` (used only on the orange CTA band).

**Icon buttons**

- `.csp-iconbtn` is used inside components.
- `.s-iconbtn` is used in tables: 36×36, `--ink-muted`; hover `--surface-2`; `.is-danger` hovers `--danger-soft` / `--danger`.

### 6.2 Status and identity

**Badge** (`.csp-badge-{tone}`)

- Height 24, radius 4, 12px / 600.
- Tones: neutral, accent, success, warning, info, mockup, danger, solid.
- Optional leading dot or 14px icon.

**StatusBadge** always renders Badge with a dot:

| Status key | Label | Tone |
|---|---|---|
| `pending` | Pending | neutral |
| `mockup` | Mockup | mockup (plum) |
| `production` | In Production | warning (amber) |
| `ready` | Ready | info (blue) |
| `completed` | Completed | success (green) |
| `cancelled` | Cancelled | danger (red) |

**Payment method badges**

| Method | Tone |
|---|---|
| GCash | info |
| Maya | success |
| Cash | neutral |
| Bank Transfer | mockup |

**Company expense category badges**

| Category | Tone |
|---|---|
| Rent | accent |
| Utilities | info |
| Salaries | mockup |
| Supplies | warning |
| Equipment | success |
| Maintenance, Others | neutral |

**Order expense category badges:** neutral.

**Avatar**: initials (first letters of the first two words), circle, font-size `max(10, round(size × .38))`. Sizes used: 24, 32, 36, 40, 72.

### 6.3 Forms

- **Field**: label (`.csp-label`, required → " *"), then `.csp-control`, then a message.
  - Control: 44px tall, `--surface-2` background, 1px `--line-strong` border, radius 8, 16px text.
  - Focus: border plus 1px ring in `--focus`.
  - Prefix slot (`₱` or `%`) via `.has-prefix`.
  - `multiline` renders a textarea.
  - Hint is a `.csp-msg` in `--ink-muted`.
  - Error: the field gets `.is-invalid` and shows `.csp-msg-error` in `--danger` with a 14px `triangle-alert` icon. The input gets `aria-invalid` and `aria-describedby`.
- **PasswordField**: a Field with an eye / eye-off toggle button (`aria-label` "Show password" / "Hide password", `aria-pressed`).
  - `showStrength` adds a 4-bar meter plus a label (Weak / Fair / Good / Strong). Empty state reads "Use 8+ characters with a number and a symbol".
  - Scoring is in `passwordStrength()` (Appendix D).
- **Select**: a native `<select>` styled as a control, with a `chevron-down` overlay and an optional placeholder option.
- **SegmentedControl**: `role="radiogroup"`; buttons are `role="radio"`; the selected one gets `.is-on`. Icon-only options carry `aria-label` and `title`.
- **Tabs**: `role="tablist"`; tabs show a count chip; the active tab has an orange underline.
- **ImageUploader**:
  - Dashed drop zone: `cloud-upload` 28; "Drag images here or **browse**"; hint "JPG, PNG or WEBP · up to 10 MB each · {n}/{max}" (max 12).
  - Below it, a thumbnail grid.
  - The **first thumbnail is the cover**: orange "Cover" tag; the thumbnail gets `.is-cover`.
  - Thumbnails reorder by native drag (grip icon top-left).
  - Hover actions: star ("Make cover image", moves it to index 0; not shown on the cover itself) and x ("Remove {name}").
  - Actions are always visible on touch devices.
  - Accepts `image/*` only.

### 6.4 Data display

**Money**: `formatPeso()` in a tabular-nums span.

**KpiCard** (`.csp-card.csp-kpi`)
- Overline label, plus a 32px icon tile (`--accent-soft` / `--accent-ink`) top-right.
- Value in display 700 at `clamp(26px, 15cqi, 40px)`.
- Footer: delta chip (trending-up green / trending-down red, "12%") and a hint text.
- `loading` shows a 70% × 36 skeleton.

**OrderTotals**

- Rows, in order: **Total**, **Total Discount** (shown negative), **Total Paid** (shown negative).
- Then the balance block:
  - **Due**: `.csp-balance.is-due` (warning-soft ground), overline "BALANCE DUE", big peso value.
  - **Fully paid** (total > 0 and balance ≤ 0): `.is-paid` (success-soft), overline "BALANCE", `circle-check` plus "Fully Paid".
- `variant="panel"` adds, below a dashed rule: **Order Expenses**, **Estimated Profit** (bold; red `.is-neg` if negative) and the note "Profit = Total − Discount − Expenses. Internal only."
- `variant="card"` is the compact version used inside OrderCard (no expenses or profit).

**OrderCard** (`.csp-card.csp-order-card`), top to bottom:

1. Media button, 16:10, showing the cover image or a MediaPlaceholder. StatusBadge top-left; image-count chip (`image` icon + n) top-right when there's more than one image. `aria-label` "View order {number}".
2. Head row: order number (display, `--accent-ink`, tracked), then "{qty} pcs" on the right.
3. Team name (display 22px), or the customer name when there's no team.
4. Customer line (only when a team exists).
5. Dates: `calendar` + order date; `clock` + "Due {date}" (`.is-overdue` → danger color when overdue).
6. OrderTotals `variant="card"`.
7. Footer actions: ghost sm `eye` "View", ghost sm `pencil` "Edit", ghost-danger icon-only `trash-2` (`aria-label` "Delete order {number}").

**DataTable**: header 12px uppercase `--ink-muted`; supports loading (4 skeleton rows), error row and empty row. The pages use the `.s-rt` responsive table (§8.4) directly.

**IncomeExpenseChart**

- SVG 640×220; grouped bars per month (income `--chart-income`, expenses `--chart-expense`), bar width ≤ 18, 4px rounded tops.
- 3 gridlines (0, ½, max) with tick labels in "₱{n}k" form. The axis top is the max value rounded up to a 1-significant-digit step: with the demo data (max 145,900) the ticks read "₱0", "₱100k", "₱200k".
- Legend: "Income (payments)", "Expenses (company + orders)".
- Hover highlights the month column and shows a tooltip: month; "Income ₱…"; "Expenses ₱…"; "Net ₱…".
- Range control is a SegmentedControl "6M | 12M".

### 6.5 Overlays and feedback

**Modal**

- `.csp-modal`: `--surface-3`, radius 18, `--shadow-3`.
- Head: title (display) plus optional description plus a close `x`. Then body, then footer (Cancel = secondary, Save = primary with `check` icon).
- Esc closes; clicking the scrim closes.
- ≤639px: bottom sheet (top corners rounded, full width; footer buttons share the width).
- Variant `slideover` is a right panel `--slideover-width` (480) wide, full height — used for Add/Edit User.

**ConfirmDialog**

- Danger icon tile plus message.
- When `counts` are given, a **cascade box** (`.csp-cascade`: `--danger-soft` with a dashed danger border) shows:
  - The sentence from `cascadeSentence()`, e.g. "This will also delete 5 items, 2 payments, 1 discount, 3 expenses, and 4 images."
  - A **5-tile tally** (items · payments · discounts · expenses · images). Zero-count tiles are dimmed (`.is-zero`); 3 columns on phones.
  - "This can't be undone."
- Optional **type-to-confirm** field: label "Type **ORD-2026-0148** to confirm". The confirm button stays disabled until the trimmed text matches exactly.
- Footer: Cancel (secondary) + danger button with `trash-2` (label e.g. "Delete Order").

**Toast** (`.csp-toast-{tone}`)

- `--surface-3` card with a stitched left edge in the tone color; icon (success `circle-check`, danger/warning `triangle-alert`, info `info`); bold title plus message; dismiss `x`.
- `role="status"` (`alert` for danger).
- Stack top-right, under the topbar (`.s-toast-layer`, 380px wide). On phones it sits full width above the tab bar.
- **Auto-dismiss after 4.5s.**

**EmptyState**: 64px icon tile (`--accent-soft` / `--accent-ink`, radius 12, rotated −6° with the icon counter-rotated), title (display), message, one action.

**Skeleton**: `.csp-skel`, a shimmering `--surface-2` block.

**Banner** (`.s-banner.is-danger`): inline error with an icon, a bold line and a muted line, plus an optional action.

### 6.6 Navigation

**SiteHeader** (public)

- Sticky; background `color-mix(var(--bg) 82%)` + `backdrop-filter: blur(14px)`; height 64 (56 on phones); inner max-width 1200.
- Contents: Logo sm (link home) · nav links Home / Products / Gallery / Contact · primary sm "Get a Quote" with `arrow-right`.
- Active link: `aria-current="page"` and a skewed orange underline.
- **<768**: links and CTA hide; a burger (`menu` ⇄ `x`, `aria-expanded`) opens a drawer under the header. The drawer has big links, each with an `arrow-right`, plus a block primary "Get a Quote".

**Sidebar** (admin)

- `--nav-bg` (Taupe), width 248 (collapsed 72), sticky full height.
- Top: Logo sm without tagline, plus a collapse button (`panel-left-close` / `panel-left-open`).
- Nav items (44px, `--nav-ink`, 20px icons):

  | Item | Icon | Note |
  |---|---|---|
  | Dashboard | `layout-dashboard` | |
  | Orders | `clipboard-list` | |
  | Company Expenses | `receipt` | |
  | Users | `users` | Manager only, shows a "Manager" tag |
  | My Profile | `user-round` | |

- Active item: `--primary` background, `--on-primary` text, and a 4px `--accent` marker bar just outside its left edge (`left: -12px`, inset 10px top and bottom).
- Footer: user chip (avatar 32, name, role) and Logout (`log-out`).
- Collapsed: icons only, with `title` tooltips.

**Topbar** (admin)

- Height 64, sticky, `--surface` with a bottom hairline.
- Contents, left to right:
  1. (Phone only) `menu` button, "Open navigation".
  2. Search field: `search` icon, placeholder "Search orders, customers, teams…", `/` kbd hint. Height 40, grows.
  3. Right side: theme toggle (`moon` in light / `sun` in dark; `aria-label` "Switch to dark mode" / "Switch to light mode").
  4. User menu button: avatar 32 + name + role + `chevron-down`. Name and role hide on phones.
- Pressing `/` focuses search.
- The user menu (not drawn) opens a small `--surface-3` popover with "My Profile" and "Logout" (`// SPEC-GAP`).

**Admin bottom tab bar** (`.s-tabbar`, phones only)

- 4 equal items, icon 22 + 11px label: Dashboard, Orders, Expenses, Profile. On the Users screen the 4th item reads **Users**.
- Active item: `--ink` text, `--accent-ink` icon, and a 24×3 orange bar above it.
- Sticky to the bottom; background `color-mix(var(--surface) 94%)` with blur.

### 6.7 Marketing

- **CategoryCard**: 4:5 media (photo or MediaPlaceholder with a big number); body has a title (display), description and a "Customize" link with `arrow-up-right`. The whole card is a link. On phones the description hides and the title is 20px.
- **ProcessSteps**: ordered list of steps. Each step has a 2-digit italic numeral ("01"), a bare 22px icon top-right in `--ink-muted` (no tile), a title and a description. Grid: 1 column, 2 at ≥640, 4 at ≥1024.
- **TestimonialCard**: 5 stars (16px; filled stars in `--accent-ink`, empty in `--line-strong`), the quote, then a figcaption with avatar 40, name and team.
- **MediaPlaceholder**: `--surface-2` + mesh at the given ratio, optional giant outlined number, and a label chip ("{label} (no image yet)").

---

## 7. Page layouts — Public site

Every public page is built the same way:

- Wrapper: `<div class="s-page" data-theme="light">`
- `SiteHeader` with the `active` link set.
- The sections listed below.
- The footer.

`.s-wrap` = max-width 1200, side padding 24 (16 on phones). `.s-sec` = 96px vertical padding (48 on phones).

### 7.1 Home (`/`) — Appendix E · Main

Sections in order:

**1. Hero** (`section.s-hero.s-mesh`)

- Two-column grid `1.1fr .9fr`, gap 48, vertically centered. One column at ≤1023.
- Copy column (gap 24):
  - Eyebrow "Custom sublimation · Philippines"
  - H1 "Built for the *whole team.*" — the `em` part is in `--accent-ink`
  - Lead: "Full-sublimation basketball, volleyball and moto jerseys — names, numbers and logos printed edge to edge. Send us your idea and we'll send back a mockup."
  - Buttons: primary "Get a Quote →" (to Contact), secondary "View Our Work" (to Gallery)
  - Chips (32px, `--surface`, icon in `--accent-ink`): `printer` "Full sublimation", `shirt` "Names & numbers", `users` "Team orders welcome"
- Art column (`.s-hero-art`, 1:1), stacked back to front:
  - Outlined "23" at 260px, top-right
  - Sand slab
  - Orange slab
  - Maroon jersey SVG with drop shadow (exact SVG in Appendix E · Main)
  - Floating tag card bottom-left (`--surface-3`, `shadow-2`): caption "Recent order", **"BRGY. SAN ROQUE BALLERS"**, caption "17-piece set · mockup to pickup"
- Phone: outlined number 160px; padding 32 top, 96 bottom.

**2. Categories** (`section.s-cut`)

- Head row: eyebrow "What we make"; H2 "Pick your *kit.*"; lead "Six ways to suit up — every one fully customizable, from fabric to the last digit on the back."
- Right side of the head row: link "All products →".
- Grid `.s-cats`: 3 columns, gap 24 (2 at ≤1023 and on phones, gap 12). Six CategoryCards:

  | # | Title | Description |
  |---|---|---|
  | 23 | Basketball Jerseys | Full sublimation tops and shorts, any colorway, names and numbers included. |
  | 11 | Volleyball Jerseys | Lightweight, stretch-fit cuts for indoor and beach teams. |
  | 07 | Moto Riding Jerseys | Breathable long-sleeve riding tops with club crests and sponsor logos. |
  | 14 | Long Sleeves | Warm-ups, shooting shirts and dri-fit long sleeves for training days. |
  | 03 | Polo Shirts | Sublimated or plain polos for coaches, staff, events and offices. |
  | 00 | Custom Designs | Bring a sketch or just an idea — our artists build the full design. |

**3. Why CSPS** (`.s-sec`)

- Eyebrow "Why CSPS"; H2 "Made to *move.* Made to last."
- Grid `.s-why`: 5 columns (3 at ≤1279; 1 on phones, where each item becomes a horizontal row with a 44px icon).
- Each item: a 48px icon tile (`--accent-soft` / `--accent-ink`, rotated −6°), H3 (display 22, uppercase), a 14px muted paragraph.

  | Icon | Title | Text |
  |---|---|---|
  | `printer` | Full sublimation | Ink is dyed into the fabric, not printed on top — no cracking, peeling or fading after washes. |
  | `shirt` | Names & numbers | Every piece personalized. Send the lineup and sizes; we handle the layout. |
  | `users` | Team orders | From a five-player barkada to a full liga, kids to 4XL, in one order. |
  | `scissors` | Quality stitching | Reinforced seams and clean hems, finished in-house by our tailoring team. |
  | `clock` | Fast turnaround | Mockups in [24 hours]; production starts as soon as the downpayment is in. |

**4. How ordering works** (`section.s-cut.s-mesh`)

- Eyebrow "How ordering works"; H2 "Idea to jersey in *four steps.*"
- ProcessSteps:

  | Step | Title | Icon | Description |
  |---|---|---|---|
  | 01 | Send your design | `message-circle` | Message us your logo, colors or just an idea. Sketches welcome. |
  | 02 | Approve the mockup | `palette` | We send a digital mockup. Revise until every detail is right. |
  | 03 | Downpayment & production | `printer` | Pay the downpayment via GCash, Maya or bank transfer and we start printing. |
  | 04 | Pickup or delivery | `truck` | Settle the balance, then pick up in-store or get it delivered. |

**5. Recent work** (`.s-sec`)

- Eyebrow "Fresh off the press"; H2 "Recent *work.*"; link "View gallery →".
- Strip `.s-strip`: horizontal scroll with snap; columns `minmax(240px, 1fr)` (72% wide on phones); scrollbar hidden.
- 4:5 tiles: placeholder plus jersey SVG (scales 1.04 on hover) plus a bottom gradient caption (team in display 20 uppercase; "kind · pcs" in 12px).
- Tiles (tank = sleeveless jersey silhouette, sleeve = long-sleeve silhouette):

  | Team | Caption | No. | Shape | Colors |
  |---|---|---|---|---|
  | Brgy. San Roque Ballers | Basketball · 17 pcs | 23 | tank | #572e2b / #ff6600 / #ff6600 |
  | Tondo Riders MC | Moto riding · 20 pcs | 07 | sleeve | #1d3b8f / #f2f2ef / #ffb547 |
  | Lady Spikers QC | Volleyball · 14 pcs | 11 | tank | #7a1430 / #fff / #fff |
  | Marikina Moto Club | Long sleeves · 30 pcs | 88 | sleeve | #0e2a24 / #3fe0b8 / #f3f4f0 |
  | Kabataan Liga ng Pasig | Basketball · 12 pcs | 05 | tank | #f2f2ef / #e04a2f / #121411 |
  | Batangas Bikers Brotherhood | Moto riding · 25 pcs | 45 | sleeve | #121411 / #e04a2f / #f3f4f0 |

**6. Testimonials** (`.s-sec`, no top padding)

- Eyebrow "From the court and the road"; H2 "Teams that *suit up* with us."
- 3 columns (2 at ≤1023). On phones: a horizontal snap carousel with 86% wide cards.

  | Quote | Name | Team |
  |---|---|---|
  | "Seventeen pieces, names and numbers perfect, and ready before our liga opener. Colors are sharper than our old supplier." | Juan Dela Cruz | Captain, Brgy. San Roque Ballers |
  | "Our ride jerseys survived a full Baguio loop in the rain and still look new. The whole MC is ordering again." | Mark Villanueva | Tondo Riders MC |
  | "Sizes ran true for the whole team and the names didn't fade after a full season of washing. Sulit na sulit." | Kristine Mendoza | Coach, Lady Spikers QC |

**7. Final CTA** (`section.s-cut.s-cut-accent`, top cut only, no bottom margin)

- Orange band, `--on-accent` text.
- Left: H2 at 64px / .95, "Got a team? Let's suit them up."; lead "Send your design, logo or rough idea. We'll reply with a mockup and a quote."
- Right: `.s-a-dark` "Get a Quote →" and `.s-a-ghost` with `message-circle` "Message us on Messenger".

**8. Footer** (`footer.s-foot`)

- Grid `1.4fr 1fr 1fr 1fr`, gap 32 (2 columns at ≤1023; 1 on phones).
- Column 1: Logo md; text "Custom tailoring and full-sublimation printing for teams, leagues and riding groups."; social squares FB / IG / TT (44px, `aria-label` "CSPS on Facebook" and so on).
- Column 2, **SHOP**: Products, Gallery, Get a Quote.
- Column 3, **VISIT**: `map-pin` "[Shop address], [City], Philippines"; `clock` "Mon–Sat · 9:00 AM – 6:00 PM".
- Column 4, **CONTACT**: `phone` "[0917 000 0000]"; `message-circle` "Message us on Messenger"; `mail` "[hello@yourdomain.ph]".
- Base row (dashed top border, 12px `--ink-subtle`): "© 2026 Carmen's Stitch & Printing Services. All rights reserved." on the left; **Staff Login** link (`lock` 14) on the right, which goes to `/admin/login`.
- Phone: footer gets 96px bottom padding.

### 7.2 Products (`/products`) — Appendix E · Products

1. **Page head** (`.s-pagehead.s-mesh`)
   - Breadcrumb "Home / Products"
   - Eyebrow "Products & services"
   - H1 (80px) "Every kit, *your way.*"
   - Lead "Six product lines, all printed by full sublimation and finished by our tailors. Pick a base, then make every detail yours."
2. **Sticky anchor pills** (`.s-anchors`)
   - Sticks under the header (`top: var(--header-height)`; 56 on phones).
   - Blurred `--bg` background; horizontally scrollable.
   - One `.s-pill` (40px) per product; each links to `#id`.
3. **Product articles** (`article.s-prod`, 6 of them, separated by dashed rules)
   - Grid `1.1fr .9fr`; even items get `.is-flip` (media on the right). One column at ≤1023, media first.
   - **Media** (`.s-prod-media`, 5:4): a 2fr/1fr grid.
     - Large left cell spans 2 rows: placeholder + jersey SVG.
     - Two small cells: MediaPlaceholder "Back view" (with number) and "Fabric detail".
     - Phone: the large cell spans 2 columns at 4:3; the small cells are 1:1 side by side.
   - **Copy** (gap 20):
     - Product number "0N / 06" (italic display 20, `--accent-ink`)
     - H2 title
     - Lead
     - Eyebrow "What you can customize"
     - 2-column grid of option cards (`.s-custom-item`: icon + bold 14 title + 13px muted text). The 5th card is full width. One column on phones.
     - Price line: "Starts at **[YOUR PRICE]** / pc · min. [X] pcs"
     - Buttons: primary "Get a Quote →" and secondary "See {short} work"
   - Option card titles and icons, always in this order: `layout-grid` Fabric · `shirt` Collar style · `ruler` Cut & fit · `zap` Names & numbers · `palette` Logos & sponsors (wide).
   - Data per product (id · title · short · no. · shape · colors · description · 5 option texts):

     | id | Title | Short | No. | Shape / colors | Description |
     |---|---|---|---|---|---|
     | basketball | Basketball Jerseys | basketball | 23 | tank #572e2b/#ff6600/#ff6600 | Game-ready tops and shorts, printed edge to edge in any colorway. Built for full-court runs and summer liga heat. |
     | volleyball | Volleyball Jerseys | volleyball | 11 | tank #7a1430/#fff/#fff | Light, stretchy and quick-drying for every dig and spike — indoor or beach. |
     | moto | Moto Riding Jerseys | moto | 07 | sleeve #1d3b8f/#f2f2ef/#ffb547 | Long-sleeve riding tops that breathe on long hauls and keep your club's colors loud on the road. |
     | longsleeves | Long Sleeves | long sleeve | 14 | sleeve #0e2a24/#3fe0b8/#f3f4f0 | Warm-ups, shooting shirts and everyday dri-fit long sleeves for training days and team events. |
     | polo | Polo Shirts | polo | 03 | sleeve #f2f2ef/#121411/#121411 | Clean polos for coaches, staff, reunions and company events — sublimated or plain. |
     | custom | Custom Designs | custom | 00 | tank #24282d/#b9a7ff/#ff6600 | Have only an idea or a phone photo? Our artists build the full design from scratch and send you a mockup. |

     Option texts (Fabric · Collar · Cut · Names · Logos):

     | Product | Fabric | Collar style | Cut & fit | Names & numbers | Logos & sponsors |
     |---|---|---|---|---|---|
     | basketball | Dri-fit mesh, aircool or spandex blend | V-neck, round or layered | Standard, slim, women's fit and kids | Any font — front, back and shorts | Team crest, sponsors and barangay seal in full color |
     | volleyball | Aircool micro-eyelet or spandex | Round, V-neck or mandarin | Sleeveless, cap sleeve or short sleeve | Libero colorway option included | Club crest and sponsors, front and back |
     | moto | Breathable mesh or UV-protect knit | Crew, zip-neck or mandarin | Racing fit or relaxed, thumb loops optional | Rider name, club rank, plate number on sleeve | Club crest, chapter name and sponsor patches |
     | longsleeves | Dri-fit, cotton-spandex or UV-protect | Crew, hooded or quarter-zip | Regular, athletic or raglan | Names on back or sleeve | Printed or embroidered logos |
     | polo | Honeycomb piqué, dri-fit piqué or cotton | Classic, mandarin or tipped | Men's, women's and unisex | Embroidered or printed name on chest | Embroidered or sublimated logos |
     | custom | Any of our fabrics | Any collar we offer | Our patterns, or match a sample you send | Full roster from a spreadsheet | We redraw and vectorize logos from a photo |
4. **Help card** (`.s-sec` > `.s-card`, padding 40, radius 18)
   - Eyebrow "Not sure what to pick?"
   - H2 (40px) "Tell us the sport. We'll suggest the rest."
   - Buttons: primary "Get a Quote", secondary with `message-circle` "Message us"
5. **Footer** — same as Home, except the Contact column has phone and Messenger only.

### 7.3 Gallery (`/gallery`) — Appendix E · Gallery

1. **Page head**: crumbs "Home / Gallery"; eyebrow "Our work"; H1 "Worn on *court & road.*"; lead "Real orders from barangay leagues, school teams, riding clubs and offices. Tap any piece to see it up close." (Bottom padding 48.)
2. **Filter bar**
   - Sticky `.s-anchors` with `role="toolbar"` and `aria-label` "Filter by category".
   - Pill buttons with counts: All 16 · Basketball 4 · Volleyball 3 · Moto 3 · Long Sleeves 2 · Polo 2 · Custom 2.
   - Selected pill: `.is-on` (maroon fill) and `aria-pressed="true"`.
   - Filtering closes the lightbox.
3. **Masonry** (`.s-masonry`)
   - CSS columns: 4 (3 at ≤1279; 2 on phones, gap 12).
   - Each tile is a `<button class="s-mtile">` (`cursor: zoom-in`, `aria-label` "Open {team}, {cat}") at the item's own aspect ratio, with a jersey SVG and a caption.
   - Below the masonry: a centered secondary link "Want one like these? Get a Quote".
4. **Lightbox** (`.s-lightbox`)
   - Espresso scrim at 94%; `role="dialog"`, `aria-modal`.
   - Top row: position "3 / 16" and a close button (44px).
   - Stage: prev and next buttons (56px circles; hidden on phones, where you swipe), then the 4:3 image area (radius 18, max-height 680).
   - Caption row: team (display 30 uppercase) and "{cat} · {pcs} · {note}", plus a primary button "Get a quote for something like this".
   - Prev and next wrap around within the current filter. Keyboard: Esc closes; ← and → navigate.
5. **Footer**: base row only — Logo sm, "© 2026 Carmen's Stitch & Printing Services", Staff Login.

Gallery data (team · category · pcs · no. · shape · c1/c2/c3 · ratio · note):

| Team | Category | Pcs | No. | Shape | c1 / c2 / c3 | Ratio | Note |
|---|---|---|---|---|---|---|---|
| Brgy. San Roque Ballers | Basketball | 17 | 23 | t | #572e2b / #ff6600 / #ff6600 | 4/5 | Dri-fit mesh, V-neck |
| Tondo Riders MC | Moto | 20 | 07 | s | #1d3b8f / #f2f2ef / #ffb547 | 1/1 | Zip-neck, thumb loops |
| Lady Spikers QC | Volleyball | 14 | 11 | t | #7a1430 / #ffffff / #ffffff | 3/4 | Aircool, cap sleeve |
| Marikina Moto Club | Long Sleeves | 30 | 88 | s | #0e2a24 / #3fe0b8 / #f3f4f0 | 4/5 | UV-protect knit |
| St. Jude Parish Youth | Polo | 40 | 03 | s | #f2f2ef / #1d3b8f / #1d3b8f | 1/1 | Honeycomb piqué, embroidered crest |
| Kabataan Liga ng Pasig | Basketball | 12 | 05 | t | #f2f2ef / #e04a2f / #121411 | 4/3 | Reversible set |
| Batangas Bikers Brotherhood | Moto | 25 | 45 | s | #121411 / #e04a2f / #f3f4f0 | 3/4 | Racing fit |
| Cainta Thunder | Basketball | 15 | 32 | t | #ffb547 / #121411 / #121411 | 1/1 | Layered collar |
| UP Diliman Org League | Volleyball | 12 | 09 | t | #0b64a3 / #ff6600 / #ffffff | 4/5 | Spandex, mandarin collar |
| Laguna Trail Runners | Long Sleeves | 24 | 21 | s | #ff6600 / #121411 / #121411 | 1/1 | Quarter-zip |
| Reyes Family Reunion | Custom | 36 | 26 | t | #5b3fc4 / #ffb547 / #ffffff | 4/3 | Custom illustration |
| Sampaloc Spikers | Volleyball | 14 | 17 | t | #24282d / #ff6f61 / #ff6f61 | 3/4 | Libero colorway |
| Antipolo Riders Club | Moto | 18 | 99 | s | #7a1430 / #121411 / #ffb547 | 4/5 | Breathable mesh |
| BPO Fun Run 2026 | Polo | 60 | 01 | s | #121411 / #ff6600 / #ff6600 | 1/1 | Dri-fit piqué |
| Mandaluyong Masters | Basketball | 10 | 50 | t | #0e2a24 / #ffffff / #3fe0b8 | 4/5 | Slim cut |
| Barkada Cup 3x3 | Custom | 8 | 3X | t | #ff6f61 / #121411 / #121411 | 3/4 | Hand-drawn logo, vectorized |

When real photos are uploaded, the tile shows the photo (`object-fit: cover`) at its natural ratio instead of the SVG.

### 7.4 Contact / Get a Quote (`/contact`) — Appendix E · Contact

1. **Page head**: crumbs "Home / Contact"; eyebrow "Get a quote"; H1 "Let's build *your kit.*"; lead "Tell us about your team and what you need. We reply with a mockup and price — usually the same day. Faster? Message us on Messenger."
2. **Two-column section** (`.s-contact`, `1.35fr .9fr`, gap 32; one column at ≤1023)

   **Left: inquiry form** (`form.s-formcard`, padding 32, radius 18; padding 20, radius 12 on phones)
   - Title "Inquiry form" (`.s-title`); caption "Fields marked * are required."
   - Grid `.s-formgrid` (2 columns, gap 20/16; 1 column on phones):

     | Field | Required | Type | Placeholder / options | Hint |
     |---|---|---|---|---|
     | Your name | ✓ | text, `autocomplete="name"` | "Juan Dela Cruz" | |
     | Team / organization | | text | "Brgy. San Roque Ballers" | |
     | Contact number | ✓ | tel | "0917 123 4567" | "We'll text or call about your mockup." |
     | Email | | email | "you@gmail.com" | |
     | Product type | | select | Basketball Jersey, Volleyball Jersey, Moto Riding Jersey, Long Sleeves, Polo Shirt, Custom Design, Not sure yet; placeholder "Choose a product" | |
     | Quantity (estimate) | | select | 1–9 pcs, 10–20 pcs, 21–50 pcs, 51–100 pcs, 100+ pcs; placeholder "How many pieces?" | |
     | Message | | textarea, full width | "Colors, sport, deadline, sizes, anything you have in mind…" | |
     | Reference design (optional) | | full-width dashed drop zone (`.csp-drop`) | "Drop your logo, sketch or photo — or browse"; hint "JPG, PNG, PDF or AI · up to 10 MB each"; multiple | |

   - Footer row: caption "By sending, you agree we may contact you about this inquiry. We never share your details." (max 340) and primary lg "Send Inquiry →".
   - Validation (on submit): name required → "Enter your name."; contact number required and must be a PH mobile (09xx xxx xxxx / +63) → "Enter a mobile number, like 0917 123 4567."; email optional but valid → "Enter a valid email, like name@gmail.com".
   - Success: replace the form body with a success EmptyState: `circle-check` icon, title "Inquiry sent", message "Thanks! We'll message you with a mockup and quote, usually the same day.", secondary "Send another". Also fire a success toast.

   **Right: aside** (`.s-side`, gap 16)
   - Big orange button `.s-bigbtn.is-primary`: `message-circle` 26 in a dark tile; **"MESSAGE US ON MESSENGER"**; "Fastest reply · send photos of your design"; `arrow-up-right`. Links to the Messenger URL.
   - Big outline button: `phone` 24; **"CALL [0917 000 0000]"**; "Mon–Sat, 9:00 AM – 6:00 PM"; links to `tel:`.
   - Hours card (`.s-infocard`): title "BUSINESS HOURS" (display 20) plus an "Open now" pill (green dot), computed from the hours below in Asia/Manila time. When closed it shows "Closed now" in `--ink-muted`.

     | Day | Hours |
     |---|---|
     | Monday – Friday | 9:00 AM – 6:00 PM |
     | Saturday | 9:00 AM – 5:00 PM |
     | Sunday & holidays | Closed |

   - Map (`.s-map`, 16:10): stylized SVG roads plus an orange pin with a `shirt` icon. Label card: **"CSPS Shop"**, "[Street address], [City]", and a "Directions ↗" link (Google Maps URL from config). It may be swapped for an embedded map at the same size and radius.
3. **Footer**: base row only (as on Gallery).
4. **Phone-only sticky bar** (`.s-mbar`): 2 columns — primary "Messenger" (`message-circle`) and secondary "Call us" (`phone`), 48px tall, blurred `--bg`, top hairline.

### 7.5 Jersey illustrations (reuse verbatim)

Two silhouettes, both `viewBox="0 0 400 480"`, filled with three colors: c1 body, c2 trim/panel, c3 number.

**Tank (basketball/volleyball)**
- Body path `M118,18 C150,74 250,74 282,18 L332,18 C332,108 356,148 384,160 L384,470 L16,470 L16,160 C44,148 68,108 68,18 Z`
- Diagonal band `M16,250 L384,170 L384,210 L16,290 Z` (c2)
- Collar stroke c2 width 10
- Number: Barlow Condensed 800 italic, 150px, at (200,330), c3

**Long sleeve** — exact paths are in Appendix E · Main (`sc-if value="{{t.sleeve}}"`). Number 130px.

**Hero jersey (Home only)** — maroon body; mesh pattern; orange stripes and collar; dark hem; "SAN ROQUE" wordmark; number "23" at 190px with a dark stroke. Copy it verbatim from Appendix E · Main.

---

## 8. Page layouts — Admin

### 8.1 Admin shell

```
<div class="s-page" data-theme="light|dark">
  <div class="s-admin">                      flex row, min-height 100%
    <div class="s-admin-side"><Sidebar/></div>   248px, sticky; hidden ≤767; 72px rail 768–1023
    <div class="s-admin-main">                flex column
      <Topbar/>                               sticky top, z 20
      <main class="s-body">…</main>           padding 32 32 48; gap 24; max-width 1440
      <nav class="s-tabbar">…</nav>           phones only
    </div>
  </div>
  [overlays: .s-overlay modal/confirm, .s-lightbox, .s-toast-layer]
</div>
```

**Page header** (`.s-ph`): a flex row, wrapping, aligned to the bottom.

- Left (`.s-ph-title`):
  - Optional back link (`.s-back`: `chevron-left` 16 + 13px/600 muted, e.g. "Orders")
  - H1 (display 700, 34px)
  - A 14px muted subline
- Right (`.s-ph-actions`): buttons. On phones the actions take the full width and their buttons share it equally.

**Tablet (768–1023)**

- Sidebar becomes a rail: logo shows only the 36px mark; labels, tags, user chip and the collapse button are hidden; nav items are 52px wide and centered; the active marker sits at −8px.
- Body padding 24 24 48; H1 30px; topbar padding 0 20; search unlimited width.

**Phone (≤767)**

- Sidebar hidden; topbar shows the menu button; user name and kbd hint hidden.
- Body padding 20 16 32, gap 20; H1 30px.
- The bottom tab bar is visible.

**Logout** (Sidebar footer, phone drawer, user menu; owner ruling 2026-10-15)

- Success: the server ends this device's session; the app clears the local session, tells other open tabs and opens `/admin/login` with "You've signed out.".
- Failure (no connection, timeout, rate limit, server error, or a save race that fails again after one retry): the person stays signed in on the same page; nothing is cleared, other tabs are not told, no notice is shown, and a danger toast (stays until closed) reads **"We couldn’t sign you out."** / "Check your connection and try again.". Pressing Logout again retries.

### 8.2 Login (`/admin/login`) — Appendix E · Login

Grid `1.1fr 1fr`, min-height 100% of the viewport (`100dvh` in production; the mockup frame is 960 tall). One column on ≤1023, with the brand panel on top.

**Brand panel** (`.s-login-brand.s-mesh`, `--surface`, right hairline)

- Orange slab + stripe bands bottom-right.
- Outlined "C" (300px) at left 48 / bottom 18%.
- Logo lg at the top.
- Bottom: eyebrow "Staff area" and a quote in display 800 40px uppercase: "Orders, payments and expenses — all in one place."
- Phone: padding 24 16, min-height 200, bottom hairline; quote hidden; "C" at 160px on the right; slab 60% × 80%.

**Form column** (centered, card max-width 420, gap 20)

- Eyebrow "CSPS Admin"; H1 (display 800 44 uppercase; 36 on phones) "Sign in"; muted text "Use the email and password your manager set up for you."
- *Error state:* a danger banner (`role="alert"`) with `triangle-alert`: **"Email or password is incorrect."** / "Check for typos, or ask your manager to reset your password."
- Fields:
  - Email (`autocomplete="username"`; mockup value "paolo.garcia@gmail.com")
  - PasswordField "Password" (`autocomplete="current-password"`)
- Row: checkbox "Keep me signed in" (20px, `accent-color: var(--accent)`, checked by default) and the link "Forgot password?" (shows info toast "Ask a Manager to reset your password." — `// SPEC-GAP`).
- Primary lg block button "Sign In →". *Loading state:* label "Signing in", spinner, disabled.
- Note (`.s-note`, `shield-check`): "Staff only. Customer orders are placed through the public site or Messenger."
- Back link: `chevron-left` "Back to the CSPS website" → `/`.

Deactivated users get the same error banner with the copy "This account is deactivated." / "Ask a Manager to reactivate it."

### 8.3 Dashboard (`/admin`) — Appendix E · Dashboard

**Header**
- H1 "Good {morning|afternoon|evening}, {firstName}" (before 12:00 morning, before 18:00 afternoon, otherwise evening; Asia/Manila).
- Subline "{Weekday}, {Oct 6, 2026} · Here's how the shop is doing this month."
- Actions: secondary "View Orders", primary `plus` "New Order".

**KPI row** (`.s-kpis`: 4 columns, gap 16; 2×2 on tablet and phones; on phones padding 16 and icons hidden)

| Label | Value | Icon | Foot |
|---|---|---|---|
| Active orders | count, not money (18) | `clipboard-list` | "{n} due this week" |
| Total receivables | Σ balance of active orders (₱84,260.00) | `wallet` | "Unpaid balances, all active orders" |
| Collected · {Mon} | Σ payments dated this month (₱126,450.00) | `trending-up` | delta % vs the same day last month (+12%) and "vs Sep, same day" |
| Company expenses · {Mon} | Σ company expenses this month (₱38,226.95) | `receipt` | "{n} entries · top: {category}" |

**Second row** (`.s-dash`, `2fr 1fr`; one column ≤1023)

- Card "Income vs. expenses", sub "Last 6 months", SegmentedControl 6M | 12M, then IncomeExpenseChart.
  - Income = payments received per month.
  - Expenses = company expenses + order expenses per month.
- Card "Orders by status", sub "Open orders + completed this month".
  - One row per status (`.s-status-row`: badge 128px | bar | count). Phone column widths are 116px | 1fr | 28px.
  - Bar fill = count ÷ largest count, colored `var(--status-*)`.
  - Footer (dashed top border): "Active (Pending → Ready)" and **"{n} orders"**.

**Recent orders card**: "Recent orders" / "Newest first"; link "All orders →".

- Table `.s-rt` columns: Order (order-number link) · Customer / team (bold title, plus a muted sub that reads the customer name, or "Walk-in customer" when there's no team) · Status · Due (muted; overdue in `--danger` with " · overdue") · Total (right) · Balance (right; display 17px, or the green "✓ Fully Paid") · Actions (`eye` → detail).
- Shows the latest 6 orders.

### 8.4 Responsive table pattern (`.s-rt`) — used on every admin list

**Desktop**
- Bordered `--surface` wrapper, radius 12, horizontal scroll if needed.
- Headers: 12px / 700 / .06em uppercase, muted.
- Cells padded 12 16, with hairline row dividers.
- Hovered row: `--surface-2`.
- Money cells use `.r.m` (right-aligned, tabular, 600, nowrap).
- `tfoot` has a dashed top border and 700 weight.

**Tablet**: columns kept, `min-width: 680px`, horizontal scroll inside the wrapper.

**Phone (≤767)**: each row becomes a **card** (`--surface`, 1px line, radius 12, padding 12 16, margin-bottom 12).

- `td.is-lead` becomes the card title, with a bottom hairline and right padding 88px for the actions.
- Every other `td` becomes a flex row: its `data-label` on the left (11px / 700 / .1em uppercase, muted) and the value on the right.
- `td.is-acts` is pinned top-right.
- `tfoot` becomes a `--surface-2` card.
- **Every `td` must carry `data-label`.**

### 8.5 Orders (`/admin/orders`) — Appendix E · Orders, OrdersStates

**Header**: H1 "Orders"; subline "{n} orders in the last 90 days · {active} active"; primary `plus` "New Order".

**Toolbar** (`.s-toolbar`, `--surface` card, padding 16, gap 12, items aligned to the bottom; small 12px labels; 40px controls):

| Control | Options | Default |
|---|---|---|
| Search | placeholder "Order no., customer or team"; flex 1 1 260 | |
| Status | Active + recent, All statuses, Pending, Mockup, In Production, Ready, Completed, Cancelled | Active + recent |
| Order date | Last 30 days, Last 90 days, This month, Custom range… | Last 90 days |
| Product type | the 6 product types; placeholder "All products" | |
| Sort by | Due date (soonest), Newest first, Balance (highest), Total (highest) | Due date (soonest) |
| View | SegmentedControl, pushed right: `layout-grid` "Grid view" / `list` "Table view", icon only | Grid |

- Persist the view choice in `localStorage` key `csps-orders-view`.
- Tablet: search takes its own full row; filters share the next row.
- Phone: toolbar padding 12; fields flex 1 1 140; the view switch sits on its own full-width row.

**Result bar** (13px muted): "Showing **{n}** orders · sorted by {sort}"; then one removable filter chip per non-default filter (`.s-filter-chip`, `--accent-soft` / `--accent-ink`, 28px, with an `x` button labelled "Clear status filter").

**Grid view** (`.s-orders`): OrderCards, 4 columns, gap 20 (3 ≤1279; 2 ≤1023; 1 on phones).

**Table view** columns:
1. Order: 44px thumbnail + order-number link (`is-lead`)
2. Customer / team
3. Status
4. Ordered (muted)
5. Due (overdue red)
6. Total
7. Discount: "−₱…" muted, or "—"
8. Paid: "−₱…" muted, or "—"
9. Balance: display 17, or "✓ Fully Paid"
10. Actions: `eye` View · `pencil` Edit · `trash-2` Delete (danger hover)

**Delete from the list**: opens the cascade ConfirmDialog (§9.3). On confirm, the order is removed and a success toast fires: **"Order {number} deleted"** / "Its items, payments, discounts, expenses and images were removed."

**States** (OrdersStates mockup)

- **Empty (first use)**: EmptyState `clipboard-list`, "No orders yet", "Create your first order to start tracking items, payments and balances.", primary `plus` "New Order".
- **No matches**: EmptyState `search`, "No matches", "No orders match "{query}" with status {status}. Try another search or clear the filters.", secondary "Clear Filters".
- **Loading**: 4 skeleton cards in the card layout. Each has a 180px media block, then 40% × 14, 75% × 22, 55% × 14 and full × 56 skeletons. Table view uses 4 skeleton rows. `aria-busy="true"`.
- **Load error**: danger banner `triangle-alert`, **"Couldn't load orders."** / "Check your internet connection. Your data is safe — nothing was changed.", secondary sm "Try Again".
- **Save error toast**: danger "Couldn't save order" / "{number} wasn't saved. Check your connection and try again."

### 8.6 Create / Edit Order (`/admin/orders/new`, `/admin/orders/:id/edit`) — Appendix E · OrderForm

**Header**: back link "Orders"; H1 "New Order" (or "Edit Order"); subline "Customer, dates, images and items. Payments, discounts and expenses are added on the order page after saving."

**Layout** (`.s-form-layout`): main column + 320px aside (one column ≤1023, with the aside after the main column).

**Main column cards** (each `.s-card`: header with H2 display 22 and a 13px muted sub; body padding 20):

1. **Customer details** / "Who the order is for". 2-column grid:

   | Field | Notes |
   |---|---|
   | Customer name | required |
   | Team / organization | hint "Shown as the order title" |
   | Contact number | required, tel |
   | Email | email; invalid → "Enter a valid email, like name@gmail.com" |
   | Address (optional) | full width; placeholder "For delivery — street, barangay, city" |

2. **Order details** / "Dates and current stage":

   | Field | Notes |
   |---|---|
   | Order date | required, date, default today |
   | Due date | required, date; hint "{n} days from order date"; must be ≥ order date → error "Due date can't be before the order date." |
   | Status | select: Pending / Mockup / In Production / Ready / Completed / Cancelled; default Pending |
   | (empty cell) | |
   | Notes | full-width textarea |

3. **Images** / "Mockups and reference photos. Drag to reorder — the first image is the cover on the Orders list." Contains the ImageUploader.

4. **Order items** / "Add as many lines as you need — sizes and variants can share a line." Secondary sm `plus` "Add Item" in the card header.
   - Item grid (`.s-item`), 7 columns:

     | Column | Desktop width | Content |
     |---|---|---|
     | Product type | 180 | select of the 6 types |
     | Description | 1.6fr | placeholder "e.g. Jersey top, sublimated" |
     | Size / variant | 96 | placeholder "S–XL" |
     | Qty | 76 | right-aligned, numeric |
     | Unit price | 120 | ₱ prefix, right-aligned |
     | Line total | 112 | bold, tabular, right |
     | Remove | 40 | `trash-2` danger icon button, "Remove item {n}" |

   - Above 1023 a column header row (`.s-item-head`, 11px uppercase muted) is shown. At ≤1279 the widths are 150 / 1.4fr / 80 / 64 / 104 / 100 / 36. Controls are 40px tall, 14px text.
   - **Tablet**: the header row hides; each item is a 6-column grid with inline labels. Type spans 3, description 3, size 2, qty 1, price 2, total 1; the remove button sits top-right.
   - **Phone**: a 4-column grid, padding 16. Type spans 3, remove in column 4; description full; size, qty, price and total span 2 each.
   - Empty: `.s-inline-empty` "No items yet. Add at least one to save the order." with ghost "+ Add Item".
   - Footer (dashed top border): "{pcs} pcs across {n} line items" on the left; overline "ITEMS SUBTOTAL" + display 24 value on the right.
   - Totals recompute live on every keystroke.

**Aside — Summary card** / "Updates as you edit items":
- `.s-meta` list: Status (StatusBadge), Due (formatted date), Line items, Pieces.
- A `.csp-balance.is-due` block with overline "TOTAL" and the live subtotal.
- Note `info`: "Balance = Total − Discounts − Payments. Record the downpayment after saving."

**Sticky save bar** (`.s-savebar`, bottom of the main column, blurred `--surface`, top hairline):
- Left caption: state text, e.g. "1 field needs attention · unsaved changes", "Unsaved changes" or "All changes saved".
- Right: secondary "Cancel" and primary `check` "Save Order".
- On phones the caption takes the full width and the buttons split the row.

**Save rules**
- Validate all fields. At least one item is required, each with a description, qty ≥ 1 and price ≥ 0.
- On error: scroll to the first invalid field and update the savebar caption count.
- On success: go to the order's detail page and show toast "Order saved" / "{number} · {team or customer}".
- **Order numbers** are generated on create as `ORD-{YYYY}-{NNNN}`, sequential per year, zero-padded.
- Leaving with unsaved changes prompts with ConfirmDialog: title "Discard changes?", confirm label "Discard" (`// SPEC-GAP`).

### 8.7 Order Detail (`/admin/orders/:id`) — Appendix E · OrderDetail

**Header**
- Back link "Orders".
- H1 = order number (in `--accent-ink`, .02em tracking) + StatusBadge.
- Subline: **{Team}** · {Customer} · Ordered {date} · Due {date} ({n} days left | overdue by {n} days).
- Actions: secondary `pencil` "Edit" (→ edit route); ghost-danger with a `--line-strong` border, `trash-2` "Delete".

**Layout** (`.s-detail`): main + 360px sticky side (320 at ≤1279; one column ≤1023). The side sticks at `top: topbar + 24`.

**Main**

1. **Image gallery** (`.s-gallery`, height 360; 300 on tablet)
   - Grid 2fr/1fr/1fr × 2 rows. The first image spans 2 rows and carries a solid badge "COVER".
   - Then up to 3 more images; the last cell is a dashed "Manage images" tile (`cloud-upload`) linking to edit.
   - Clicking an image opens the lightbox: "{i} / {n} · {filename}", prev/next, Esc.
   - Phone: a 5-column grid; the cover is full width at 200px; the others are 64px thumbs; "Manage images" becomes icon only.
   - Over 4 images: the 4th cell shows a `.s-more` overlay "+{n}".
2. **Tabbed card** (`.s-card.s-tabcard`). Tabs show counts: **Items {n} · Payments {n} · Discounts {n} · Expenses {n}**. Each tab panel has a header (`.s-tabbar-h`: H3 display 20, a caption, and a primary sm `plus` "Add {Thing}") and then an `.s-rt` table with a `tfoot`.

   | Tab | Caption | Columns | tfoot |
   |---|---|---|---|
   | Items | "Quantity × unit price. Changes update the total instantly." | Product (bold) · Description · Size (muted) · Qty · Unit price · Line total · actions | "Items subtotal · {pcs} pcs" + total |
   | Payments | "Downpayments and settlements. Balance due: **₱…**" | Date (bold) · Method (badge) · Reference no. (tabular) · Notes (muted) · Amount · actions | "Total paid" |
   | Discounts | "Percentages apply to the items total." | Reason (bold) · Type (badge "Percentage" / "Fixed amount") · Value ("5%" or ₱) · Amount (−₱) · actions | "Total discount" |
   | Expenses | "Internal costs for this order — not shown to the customer." | Date · Category (badge) · Description · Amount · actions | "Order expenses" |

   - Row actions: `pencil` Edit, `trash-2` Delete (danger).
   - Empty tab: `.s-inline-empty`, e.g. "No payments recorded yet." with a ghost "+ Add Payment". The other tabs follow the same pattern: "No discounts yet." / "No expenses recorded yet." / "No items yet."

**Side**
1. **OrderTotals** `variant="panel"` (§6.4), always visible and updating live.
2. **Customer card**: header "Customer" + "Edit" link.
   - `.s-meta` rows (icon + label → value, right-aligned): `user-round` Name, `users` Team, `phone` Contact, `mail` Email, `map-pin` Address.
   - Then a `.s-note` with `info` and the order notes.

**Tablet**: the side moves **above** the main column (`order: -1`) as a 2-column grid: totals on the left, customer on the right. Then the gallery, then the tabs.

**Phone**: everything stacks — header, gallery, tabs (tables as cards), totals, customer.

**Add/Edit modals.** The title is "Add {Thing}" or "Edit {Thing}"; the description is "{number} · {team}"; the CTA is "Save {Thing}". The fields use `.csp-form-grid` (2 columns; 1 at ≤639):

| Thing | Fields | Live helper | Validation errors (banner at the top of the modal) |
|---|---|---|---|
| **Item** | Product type (select) · Size / variant (placeholder "S–XL") · Description (wide; "e.g. Jersey top, sublimated") · Quantity · Unit price (₱) | "Line total: ₱…" under unit price | "Add a short description." · "Quantity must be at least 1." |
| **Payment** | Date (default today) · Amount (₱) · Method (Cash / GCash / Maya / Bank Transfer; default GCash) · Reference number ("GCash / Maya / bank ref.") · Notes (wide, "Optional") | "Balance due: ₱…" under amount | "Enter an amount greater than ₱0.00." |
| **Discount** | Description / reason (wide; "e.g. Barangay league discount") · Type (SegmentedControl "Fixed ₱" / "Percent %"; default Fixed) · Value (prefix ₱ or %) | "Computed amount: ₱…" | "Add a reason for the discount." · "Enter a discount value." · "A percentage can't be more than 100%." |
| **Expense** | Date · Category (Fabric / Ink & paper / Outsourcing / Labor / Delivery / Others) · Description (wide; "e.g. Dri-fit mesh, 45 yds") · Amount (₱) | — | "Enter an amount greater than ₱0.00." |

- **After saving**: close the modal, switch to that tab and toast "{Thing} added" (or "{Thing} updated"). The message reads "Balance now ₱…", or "Order is now fully paid." when the balance reaches 0.
- **Deleting a child row**: ConfirmDialog with title "Delete {label}?", where the label is e.g. `item "Shorts — matching colorway"` or `payment of ₱2,000.00`; message "This removes it from {number} and updates the totals right away."; confirm "Delete {Thing}". Then toast "{Thing} deleted" / "Balance now ₱…".
- **Deleting the order**: §9.3. After confirming, the mockup stays on the page and shows a danger banner at the top of the body: `trash-2`, **"{number} was deleted."** / "Its {n} items, payments, discounts, expenses and images were removed.", plus a secondary sm "Back to Orders" button. It also shows the toast **"Order {number} deleted"** / "Removed with all its items, payments, discounts, expenses and images." In production, navigate to Orders and show the same toast; the banner covers the case where navigation is delayed. Mark it `// SPEC-GAP: post-delete navigation`.

### 8.8 Company Expenses (`/admin/expenses`) — Appendix E · Expenses

**Header**: H1 "Company Expenses"; subline "General business costs — rent, bills, payroll, supplies. Costs for a specific order go inside that order."; primary `plus` "Add Expense".

**KPI row** (`.s-g3`: 3 columns; 2 on tablet; 1 on phones)

| Label | Value | Icon | Foot |
|---|---|---|---|
| This month · Oct | ₱38,226.95 | `receipt` | "{n} entries so far" |
| Last month · Sep | ₱71,904.20 | `calendar` | "Full month" |
| Top category · Oct | category name as the value, e.g. "Rent" | `trending-up` | "₱18,000.00 · 47% of this month" |

**Toolbar**: Search ("Description or staff name") · Category select (placeholder "All categories") · From (date) · To (date). The default range is the last 30 days.

**Table** columns: Date (bold, lead) · Category (badge, tone per §6.2) · Description · Amount · Recorded by (avatar 24 + name) · actions (Edit, Delete). The `tfoot` reads "{n} expenses · {from} – {to}" with the shown total. Rows sort newest first.

**Empty**: EmptyState `receipt`, "No expenses recorded", "Log rent, bills, payroll and supplies here to see monthly totals and where the money goes.", primary "Add Expense".

**Add/Edit modal**
- Title "Add Expense" / "Edit Expense"; description "A general business cost, not tied to any order."
- Fields:
  - Date
  - Category: Rent / Utilities / Salaries / Supplies / Equipment / Maintenance / Others
  - Description (full width, placeholder "e.g. Meralco bill — October")
  - Amount (₱)
  - Recorded by: read-only. Dashed transparent control showing avatar 24 and "{name} (you)".
- Inline errors under the fields after the first save attempt: "Add a short description so others know what this was for." · "Enter an amount greater than ₱0.00."
- CTA "Save Expense" / "Save Changes". Toast "Expense added" (or "Expense updated") / "₱… · {category}".

**Delete**: ConfirmDialog with title `Delete "{desc}" (₱…)?`, message "This expense will be removed from company records and monthly totals.", confirm "Delete Expense". Toast "Expense deleted" / "{desc}".

### 8.9 Users (`/admin/users`, Manager only) — Appendix E · Users

**Header**: H1 "Users" + Badge accent `shield-check` "Manager only"; subline "Who can sign in to CSPS Admin. Admins manage orders and expenses; Managers can also manage users."; primary `plus` "Add User".

**Toolbar**: Search ("Name or email") · Role (Admin / Manager; placeholder "All roles") · Status (Active / Inactive; placeholder "All statuses").

**Table** columns:
1. User: avatar 36 + bold name + sub "You" or the role
2. Email
3. Role: badge (Manager = accent, Admin = neutral)
4. Status: badge with dot (Active = success, Inactive = neutral). Inactive rows render at 72% opacity.
5. Created (muted)
6. Actions: `pencil` Edit; `lock` "Deactivate {first}" (or `shield-check` "Activate {first}"); `trash-2` Delete. Toggle and Delete are hidden on your own row.

Caption below the table: "You can't deactivate or delete your own account. Deactivated users can't sign in, but their records stay on orders and expenses."

**Add/Edit User slide-over** (right panel 480px, full height; full screen on phones)

- Title "Add User" / "Edit User".
- Description "They can sign in right away with a temporary password." / "Update details or change their role."
- Fields:
  - First name · Last name
  - Email (full width): hint "They'll use this to sign in."; error "Enter a valid email, like name@gmail.com"
  - Role: SegmentedControl with labels — `user-round` Admin / `shield-check` Manager. Hint underneath:
    - Admin: "Admins manage orders and company expenses."
    - Manager: "Managers can do everything Admins can, plus add, edit and remove users."
  - Create only: PasswordField "Temporary password" with the strength meter (prefill a generated value like `Csp-tahi-4821`); hint "Share it privately. They'll be asked to change it on first sign-in."
- CTA "Create User" / "Save Changes".
- Toasts:
  - "User created" or "User updated" / "{first last} · {role}"
  - "User deactivated" / "{name} can no longer sign in."
  - "User activated" / "{name} can sign in again."

**Delete**: ConfirmDialog with title "Delete {first last}?", message "They won't be able to sign in. Orders and expenses they recorded stay, under their name. If they might come back, deactivate instead.", confirm "Delete User". Toast "User deleted" / "{name}".

### 8.10 My Profile (`/admin/profile`) — Appendix E · Profile

`main.s-body` max-width 1120.

1. **Profile header card** (`.s-profile-head`, padding 24): orange striped `.s-profile-stripe` at the right edge (320px; 220 tablet; 140 phone); avatar 72 with a 3px `--accent-line` ring; H1 (display 34) "{First Last}" + role badge (accent `shield-check` "Manager", or neutral "Admin"); muted line "{email} · Member since {date}".
2. **Two cards** (`.s-cards2`: 2 columns; stacked on tablet and phones):
   - **Personal Information** / "Shown on orders and expenses you record."
     - Fields: First name · Last name · Email (full width; hint "You sign in with this email."; invalid → "Enter a valid email, like name@gmail.com").
     - Card footer: primary `check` "Save Changes". Toast "Changes saved" / "Your name and email are updated."
   - **Change Password** / "Use 8+ characters with a number and a symbol."
     - Fields: Current password · New password (with strength meter) · Confirm new password (mismatch error "Passwords don't match.").
     - Footer: primary `lock` "Update Password".
     - Errors: danger toast "Password not updated" / "The confirmation doesn't match the new password." (or "Your current password is incorrect.").
     - Success: toast "Password updated" / "Use your new password next time you sign in."

---

## 9. Data model, calculations and rules

### 9.1 Entities

The **Order is the parent**. Items, payments, discounts, order expenses and images exist **only inside an order** (foreign key `order_id`, `ON DELETE CASCADE`).

```
Order          id, number "ORD-2026-0148", customer_name*, team_name?, contact_number*, email?, address?,
               order_date*, due_date*, status* (pending|mockup|production|ready|completed|cancelled),
               notes?, created_by (User), created_at, updated_at
OrderItem      id, order_id*, product_type* (one of 6), description*, size_variant?, quantity* (int ≥1),
               unit_price* (decimal ≥0), position
Payment        id, order_id*, date*, amount* (>0), method* (Cash|GCash|Maya|Bank Transfer), reference_no?, notes?, recorded_by
Discount       id, order_id*, reason*, type* (fixed|percentage), value* (>0; percentage ≤100)
OrderExpense   id, order_id*, date*, category* (Fabric|Ink & paper|Outsourcing|Labor|Delivery|Others), description, amount* (>0), recorded_by
OrderImage     id, order_id*, file_url, file_name, position (0 = cover)
CompanyExpense id, date*, category* (Rent|Utilities|Salaries|Supplies|Equipment|Maintenance|Others), description*, amount* (>0), recorded_by*
User           id, first_name*, last_name, email* (unique), role* (admin|manager), active (bool), password_hash, must_change_password, created_at
Inquiry        id, name*, team?, contact_number*, email?, product_type?, quantity_range?, message?, files[], created_at   (public form)
```

Money is stored as a decimal with 2 places (or integer centavos). Never use floats in the database.

### 9.2 Formulas (exactly these, everywhere an order appears)

```
Total            = Σ (item.quantity × item.unit_price)
discountAmount   = fixed → value ; percentage → Total × value / 100   (percentages apply to the items Total)
Total Discount   = Σ discountAmount
Total Paid       = Σ payment.amount
Balance          = Total − Total Discount − Total Paid
Order Expenses   = Σ order_expense.amount
Estimated Profit = Total − Total Discount − Order Expenses       (internal only)
Fully Paid       = Total > 0 AND Balance ≤ 0
```

- Round every aggregate to 2 decimals (`Math.round(n × 100) / 100`).
- Reference implementation: `orderTotals()` and `discountAmount()` in Appendix D.
- Compute on the server for persisted values and on the client for live previews; both must use these rules.

Dashboard aggregates:

| Figure | Definition |
|---|---|
| Active orders | status ∈ {pending, mockup, production, ready} |
| Receivables | Σ max(Balance, 0) over active orders |
| Collected · Month | Σ payments with date in the current month |
| Chart income | payments per month |
| Chart expenses | company expenses + order expenses per month |

### 9.3 Cascade delete (core rule)

Deleting an order deletes all of its items, payments, discounts, expenses and images, including image files in storage. The confirmation **must show the counts**:

- **Title**: "Delete order {number}?"
- **Message**: "{Team} · {Customer}. The order will be permanently deleted along with everything inside it."
- **Cascade box**: "This will also delete 5 items, 2 payments, 1 discount, 3 expenses, and 4 images." (use `cascadeSentence()`), then the 5 count tiles, then "This can't be undone."
- **Type-to-confirm**: the user must type the order number exactly.
- **Button**: danger "Delete Order".

Do the delete in **one transaction**.

### 9.4 Formatting

| Value | Format | Function |
|---|---|---|
| Money | `₱12,450.00` (en-PH grouping, always 2 decimals); negatives `−₱732.50` with a true minus sign U+2212 | `formatPeso()` |
| Dates | `Oct 6, 2026`; never numeric dates in UI | `formatDate()` |
| Empty | `—` (em dash) | |
| Quantities | "24 pcs" | |
| Phones | `0917 123 4567` | |
| Order numbers | `ORD-YYYY-NNNN` | |
| Time zone | Asia/Manila for "today", greetings, open-now and month boundaries | |

### 9.5 Lists used in selects

- Product types: Basketball Jersey · Volleyball Jersey · Moto Riding Jersey · Long Sleeves · Polo Shirt · Custom Design
- Payment methods: Cash · GCash · Maya · Bank Transfer
- Company expense categories: Rent · Utilities · Salaries · Supplies · Equipment · Maintenance · Others
- Order expense categories: Fabric · Ink & paper · Outsourcing · Labor · Delivery · Others
- Statuses: Pending · Mockup · In Production · Ready · Completed · Cancelled

---

## 10. Interaction rules

- **Modals**:
  - Open with focus on the first field.
  - Trap focus.
  - Esc and scrim click close (unless saving).
  - Return focus to the trigger on close.
  - Saving shows the primary button's `loading` state.
- **Validation**:
  - Validate on submit, then live once the user has tried to save.
  - Field errors go under the field (`.csp-msg-error`); modal-level errors go in a danger banner at the top of the modal body.
  - Error copy always says how to fix the problem.
- **Toasts**:
  - Title = the fact; message = the consequence (e.g. "Payment added" / "Balance now ₱4,327.50" after a ₱5,000 payment on ORD-2026-0148).
  - Auto-dismiss after 4.5s; can be dismissed manually; at most 3 stacked, newest on top.
- **Optimistic updates** are fine for child records, but totals must reflect server values after the response. On failure, revert and show a danger toast.
- **Live totals**: the item forms, discount modal, payment modal and OrderTotals panel recompute on every input change.
- **Hover and motion**:
  - Transitions are 0.2s ease. Tiles scale 1.04 over 0.4s; big contact buttons lift 2px.
  - The spinner rotates 0.8s.
  - `prefers-reduced-motion` sets all transitions to 0 and slows the spinner (already in components.css).
- **Keyboard shortcuts**: `/` focuses topbar search. In the lightbox, ← and → navigate and Esc closes.
- **Sticky elements**:
  - public header
  - product/gallery pills
  - admin topbar
  - order-detail summary side (desktop)
  - order-form save bar
  - phone tab bar
  - Contact phone action bar

---

## 11. Accessibility (must pass)

- **Landmarks**: one `<main>` per page; `nav` elements carry an `aria-label` ("Main", "Mobile", "Admin", "Breadcrumb").
- **Focus**: `:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px }` stays on every interactive element.
- **Names**: icon-only buttons always have an `aria-label` (see the labels in this spec and Appendix E). Decorative icons are `aria-hidden`.
- **Touch targets**: 44px minimum (table icon buttons are 36px with spacing; on phones they sit in the card's top-right).
- **Status**: always carries text, never color alone.
- **Forms**: inputs have labels; errors are linked with `aria-describedby`; invalid fields have `aria-invalid`.
- **Dynamic content**:
  - Toasts use `role="status"`, or `alert` for danger.
  - The cascade box uses `role="alert"`.
  - The strength meter is `aria-live="polite"`.
- **Tables**: real `<table>`. Action column headers use the visually hidden class `.csp-sr`. Every `td` has `data-label` for the phone layout.
- **Contrast**: don't add colors; all token pairs pass AA.

---

## 12. Seed data (use for development, demos and visual QA)

### 12.1 Users

| Name | Email | Role | Status | Created |
|---|---|---|---|---|
| Carmen Reyes | carmen.reyes.csp@gmail.com | Manager | Active | Jan 12, 2026 |
| Paolo Garcia | paolo.garcia@gmail.com | Admin | Active | Feb 3, 2026 |
| Liza Mercado | lizamercado09@gmail.com | Admin | Active | Mar 18, 2026 |
| Rhea Villanueva | rhea.villanueva@gmail.com | Manager | Active | Jun 21, 2026 |
| Jomar Santos | jomar.santos@yahoo.com | Admin | **Inactive** | Apr 2, 2026 |

The logged-in user in all admin mockups is **Carmen Reyes (Manager)**.

### 12.2 Orders

| Number | Team | Customer | Status | Ordered | Due | Items (qty × price) | Discounts | Payments | Order expenses | Images |
|---|---|---|---|---|---|---|---|---|---|---|
| ORD-2026-0148 | Brgy. San Roque Ballers | Juan Dela Cruz | production | 2026-09-28 | 2026-10-14 | 15×650, 15×300, 2×550, 15×420, 1×800 | 5% "Barangay league discount" | 10,000 GCash; 2,000 Cash | 3,825; 1,640; 600 | 4 |
| ORD-2026-0151 | Tondo Riders MC | Mark Villanueva | ready | 2026-09-30 | 2026-10-10 | 20×1150 | ₱500 fixed | 12,000; 10,500 | 7,200; 2,100 | 2 |
| ORD-2026-0153 | — | Angelica Santos | mockup (**overdue**) | 2026-10-03 | 2026-10-05 | 12×780 | — | 3,000 | — | 0 |
| ORD-2026-0155 | Lady Spikers QC | Kristine Mendoza | pending | 2026-10-05 | 2026-10-24 | 14×720 | — | — | — | 1 |
| ORD-2026-0157 | St. Jude Parish Youth | Liza Cruz | production | 2026-10-01 | 2026-10-17 | 40×450 | — | 9,000 | 6,400 | 3 |
| ORD-2026-0159 | Batangas Bikers Brotherhood | Carlo Reyes | mockup | 2026-10-06 | 2026-10-27 | 25×1150 | — | 5,000 | — | 2 |
| ORD-2026-0142 | Marikina Moto Club | Ramon Bautista | completed | 2026-09-12 | 2026-09-30 | 30×690 | ₱1,000 fixed | 10,000; 9,700 | 8,900 | 5 |
| ORD-2026-0139 | Kabataan Liga ng Pasig | Jessa Ramos | cancelled | 2026-09-08 | 2026-09-25 | 10×850 | — | — | — | 1 |

**ORD-2026-0148 in full** (the Order Detail mockup):

- Contact 0917 123 4567 · juan.dc@gmail.com · Brgy. San Roque, Marikina City
- Notes: "V-neck, black and volt. Captain wants names in caps. Coach polos need embroidered logo."
- Items:

  | Product | Description | Size | Qty × price |
  |---|---|---|---|
  | Basketball Jersey | Jersey top — sublimated, names & numbers | S–XL | 15 × ₱650 |
  | Basketball Jersey | Shorts — matching colorway | S–XL | 15 × ₱300 |
  | Polo Shirt | Coach polo, embroidered logo | L | 2 × ₱550 |
  | Long Sleeves | Warm-up shooting shirt | S–XL | 15 × ₱420 |
  | Custom Design | Team logo redraw & vector cleanup | — | 1 × ₱800 |

- Payments:
  - Sep 28, 2026 · GCash · ref 9012 345 678901 · "50% downpayment" · ₱10,000.00
  - Oct 3, 2026 · Cash · — · "For 2 added coach polos" · ₱2,000.00
- Discount: "Barangay league discount", percentage, 5%
- Expenses:
  - Oct 1 · Fabric · "Dri-fit mesh, 45 yds" · ₱3,825.00
  - Oct 2 · Ink & paper · "Sublimation ink + transfer paper" · ₱1,640.00
  - Oct 4 · Outsourcing · "Embroidery — coach polos" · ₱600.00
- Images: front-mockup.png (cover), back-mockup.png, shorts.png, reference.jpg
- **Expected figures** (use as a test):

  | Figure | Value |
  |---|---|
  | Total | ₱22,450.00 |
  | Total Discount | −₱1,122.50 |
  | Total Paid | −₱12,000.00 |
  | **Balance Due** | **₱9,327.50** |
  | Order Expenses | ₱6,065.00 |
  | Estimated Profit | ₱15,262.50 |

- Cascade sentence: "This will also delete 5 items, 2 payments, 1 discount, 3 expenses, and 4 images."

**ORD-2026-0151** must render **"Fully Paid"**: 23,000 − 500 − 22,500 = 0.

### 12.3 Company expenses

| Date | Category | Description | Amount | Recorded by |
|---|---|---|---|---|
| Oct 6, 2026 | Supplies | Plotter cutting blades (3 pcs) | 640.00 | Paolo Garcia |
| Oct 5 | Utilities | Meralco bill — September | 8,642.35 | Carmen Reyes |
| Oct 5 | Utilities | Maynilad water bill — September | 1,215.60 | Carmen Reyes |
| Oct 4 | Utilities | Converge fiber internet — October | 1,899.00 | Liza Mercado |
| Oct 3 | Supplies | Sublimation ink, 4 × 1L (CMYK) | 5,480.00 | Paolo Garcia |
| Oct 2 | Maintenance | Heat press service & new silicone pad | 2,350.00 | Paolo Garcia |
| Oct 1 | Rent | Shop rent — October | 18,000.00 | Carmen Reyes |
| Sep 30 | Salaries | Payroll, Sep 16–30 (4 staff) | 24,000.00 | Carmen Reyes |
| Sep 26 | Equipment | Thread trimmer & cutting mat | 1,850.00 | Liza Mercado |

- October total ₱38,226.95.
- Top category Rent: ₱18,000.00, 47%.
- September (full month) total for the KPI: ₱71,904.20.

### 12.4 Dashboard demo values

| Figure | Value |
|---|---|
| Active orders | 18 (4 due this week) |
| Receivables | ₱84,260.00 |
| Collected Oct | ₱126,450.00 (+12% vs Sep) |
| Expenses Oct | ₱38,226.95 |
| Status counts | Pending 3 · Mockup 4 · In Production 7 · Ready 4 · Completed 11 · Cancelled 1 |

Chart data (income / expenses):

| Month | Income | Expenses |
|---|---|---|
| May | 98,400 | 61,200 |
| Jun | 132,650 | 70,350 |
| Jul | 87,300 | 66,480 |
| Aug | 145,900 | 74,120 |
| Sep | 112,980 | 69,900 |
| Oct | 126,450 | 58,320 |

---

## 13. Acceptance checklist (visual QA at 1440, 820 and 390 px wide)

- [ ] `npx tsc --noEmit` passes with `strict: true`; `npx vitest run` passes (including the ORD-2026-0148 figures); `vite build` succeeds.
- [ ] `globals.css` is the only stylesheet import. `components.css` and `screens.css` are byte-for-byte the appendix versions.
- [ ] No Tailwind default palette, radius or shadow utilities appear anywhere: grep for `-gray-`, `-blue-`, `-slate-`, `rounded-xl`, `shadow-lg` and similar returns nothing. No hex colors appear in TSX except the jersey illustration data.
- [ ] No component library is installed (MUI, shadcn/ui, Chakra, Bootstrap, Headless UI styling and so on).

- [ ] Fonts: Barlow Condensed for display, Archivo for UI. The **₱** glyph renders in Archivo (not a system fallback).
- [ ] Blush page `#f6dfd1`, Taupe sidebar `#d4bbab`, maroon primary buttons `#572e2b`, orange `#ff6600` used only as fill. Orange text is always `#a33f00`.
- [ ] The logo reads [C]SPS everywhere (mark as the C + italic "SPS" + orange underline), with the tagline where specified.
- [ ] Home sections appear in order: hero, cut categories, why, cut how-it-works, recent strip, testimonials, orange CTA, footer with Staff Login.
- [ ] Gallery filter counts are correct. The lightbox opens, navigates with wrap-around, and closes with Esc.
- [ ] The Contact phone layout shows the sticky Messenger/Call bar.
- [ ] Admin desktop: 248px sidebar; tablet: 72px icon rail; phone: no sidebar plus a 4-item bottom tab bar.
- [ ] The Orders grid ⇄ table toggle works. The table becomes stacked cards on a phone.
- [ ] ORD-2026-0148 shows exactly: Total ₱22,450.00 · Discount −₱1,122.50 · Paid −₱12,000.00 · Balance Due ₱9,327.50 · Expenses ₱6,065.00 · Profit ₱15,262.50.
- [ ] ORD-2026-0151 shows "Fully Paid".
- [ ] Adding a payment updates the totals and toast instantly. Discount % previews the computed amount.
- [ ] Deleting an order shows the cascade counts and type-to-confirm, deletes the children in one transaction and toasts.
- [ ] Order detail on tablet puts totals + customer side by side above the gallery.
- [ ] Users is visible only to Managers; there's no deactivate/delete on your own row.
- [ ] The Espresso theme toggle works on every admin screen, and the mark switches to the espresso ring / orange stitch.
- [ ] Empty, loading (skeleton) and error states exist for Orders, Expenses, Users and Dashboard (KPI skeletons via `loading`).
- [ ] Every money value uses `formatPeso`; every date uses `formatDate`.
- [ ] Keyboard: all actions are reachable; focus is visible; modals trap and restore focus.

---

# APPENDICES — source to copy exactly

Every file below was built and verified together:
- `tsc --strict` passes
- `vitest` passes
- `vite build` succeeds
- screenshots match the mockups in both themes

| Appendix | File | Notes |
|---|---|---|
| **A** | `src/styles/tokens.css` | Design tokens for both themes plus type utility classes. React/Tailwind edition (font family names only). |
| **A.2** | `src/styles/globals.css` | Tailwind v4 entry: layers, `dark` variant, `@theme` mapped to the tokens. |
| **A.3** | `src/styles/compat.css` | The two browser defaults the mockups relied on. |
| **B** | `src/styles/components.css` | Every `.csp-*` component style, unchanged. |
| **C** | `src/styles/screens.css` | Every `.s-*` page layout and responsive container query. Overlays are `position: fixed`. |
| **D.1** | `src/lib/csps.ts` | Domain types, formatting, order math, option lists. |
| **D.2** | `src/lib/csps.test.ts` | Must pass. |
| **D.3** | `src/ui/index.tsx` | Every design-system component, typed, plus `LinkProvider` / `UiLink` / `ButtonLink` / `ToastProvider`. |
| **D.4** | `src/ui/mark.ts` | |
| **D.5** | `src/ui/icons.ts` | |
| **D.6** | `src/main.tsx`, `src/app/RouterLink.tsx` | |
| **D.7** | `vite.config.ts`, `tsconfig.json`, `index.html` | |
| **E** | Reference page markup for every approved screen | Translate to TSX per §2.9. |
| **F** | `public/mark.svg` | The CSPS mark (favicon / app icon). |

---

## Appendix A — src/styles/tokens.css

Design tokens (Blush + Espresso), layout tokens and type utility classes. React/Tailwind edition: identical to the approved tokens except the font family names (§2.5).

```css
/* CSPS design tokens — React/Tailwind edition.
   Identical to the approved tokens except: the @font-face rules are removed (fonts load from @fontsource in main.tsx)
   and the Archivo family is "Archivo Variable" (the @fontsource-variable name; its latin-ext subset carries the peso sign). */
:root, [data-theme="light"] {
  --bg: #f6dfd1;
  --surface: #fbebe2;
  --surface-2: #f1e1d7;
  --surface-3: #fff6f0;
  --nav-bg: #d4bbab;
  --nav-ink: #572e2b;
  --sand: #e9b88f;
  --line: #e3c6b7;
  --line-strong: #9a6c60;
  --ink: #3b1f1c;
  --ink-muted: #6b443c;
  --ink-subtle: #7a5248;
  --primary: #572e2b;
  --primary-hover: #6f3b37;
  --on-primary: #f6dfd1;
  --accent: #ff6600;
  --accent-hover: #ff7a24;
  --on-accent: #1f0f0d;
  --accent-ink: #a33f00;
  --accent-soft: #fcd9c2;
  --accent-line: #c24e00;
  --focus: #572e2b;
  --danger: #b3261e;
  --danger-soft: #f9d6cf;
  --on-danger: #fff6f0;
  --success: #1b6a51;
  --success-soft: #d3eadf;
  --warning: #855400;
  --warning-soft: #f6e2b8;
  --info: #285787;
  --info-soft: #dbe5f0;
  --mockup: #6a3780;
  --mockup-soft: #eedcf0;
  --neutral-soft: #ead1c4;
  --chart-income: #d45500;
  --chart-expense: #572e2b;
  --scrim: #3b1f1ccc;
  --status-pending: var(--ink-muted);
  --status-mockup: var(--mockup);
  --status-production: var(--warning);
  --status-ready: var(--info);
  --status-completed: var(--success);
  --status-cancelled: var(--danger);
  --link: var(--accent-ink);
  --shadow-1: 0 1px 2px 0 #3b1f1c14, 0 1px 3px 0 #3b1f1c0d;
  --shadow-2: 0 12px 28px -10px #3b1f1c33;
  --shadow-3: 0 24px 56px -16px #3b1f1c4d;
}
[data-theme="dark"] {
  --bg: #1a100f;
  --surface: #241614;
  --surface-2: #2f1e1b;
  --surface-3: #382623;
  --nav-bg: #130b0a;
  --nav-ink: #d4bbab;
  --sand: #5a3a2c;
  --line: #3f2b28;
  --line-strong: #8f6c62;
  --ink: #f6dfd1;
  --ink-muted: #d0b2a4;
  --ink-subtle: #b39385;
  --primary: #f6dfd1;
  --primary-hover: #ffeee4;
  --on-primary: #572e2b;
  --accent: #ff6a1a;
  --accent-hover: #ff8340;
  --on-accent: #1a100f;
  --accent-ink: #ff8a4c;
  --accent-soft: #3d2014;
  --accent-line: #ff6a1a;
  --focus: #ff8a4c;
  --danger: #ff7b6b;
  --danger-soft: #3a1714;
  --on-danger: #1a100f;
  --success: #6fd1ad;
  --success-soft: #12302a;
  --warning: #f2b65c;
  --warning-soft: #3a2a10;
  --info: #8ab9ea;
  --info-soft: #142838;
  --mockup: #d3a8e6;
  --mockup-soft: #2e1d38;
  --neutral-soft: #34221f;
  --chart-income: #ff6a1a;
  --chart-expense: #d4bbab;
  --scrim: #000000b8;
  --status-pending: var(--ink-muted);
  --status-mockup: var(--mockup);
  --status-production: var(--warning);
  --status-ready: var(--info);
  --status-completed: var(--success);
  --status-cancelled: var(--danger);
  --link: var(--accent-ink);
  --shadow-1: 0 1px 0 0 #ffffff0a inset, 0 1px 2px 0 #00000066;
  --shadow-2: 0 12px 32px -8px #000000b3;
  --shadow-3: 0 24px 64px -12px #000000cc;
}
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;
  --space-24: 96px;
  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-pill: 999px;
  --container-max: 1200px;
  --header-height: 64px;
  --sidebar-width: 248px;
  --sidebar-collapsed: 72px;
  --topbar-height: 64px;
  --slideover-width: 480px;
  --cut-angle: 48px;
  --bp-sm: 640px;
  --bp-md: 768px;
  --bp-lg: 1024px;
  --bp-xl: 1280px;
  --z-header: 40;
  --z-overlay: 80;
  --z-toast: 100;
  --font-display: "Barlow Condensed", "Archivo Variable", "Arial Narrow", sans-serif;
  --font-sans: "Archivo Variable", system-ui, -apple-system, "Segoe UI", sans-serif;
}
.display-hero { font-family: var(--font-display); font-size: 96px; line-height: 0.88; font-weight: 800; font-style: italic; letter-spacing: -0.01em; }
.display-xl { font-family: var(--font-display); font-size: 72px; line-height: 0.92; font-weight: 800; letter-spacing: -0.005em; }
.display-lg { font-family: var(--font-display); font-size: 48px; line-height: 1; font-weight: 800; }
.display-md { font-family: var(--font-display); font-size: 32px; line-height: 1.05; font-weight: 700; }
.display-sm { font-family: var(--font-display); font-size: 22px; line-height: 1.1; font-weight: 700; }
.stat { font-family: var(--font-display); font-size: 40px; line-height: 1; font-weight: 700; }
.eyebrow { font-family: var(--font-display); font-size: 14px; line-height: 1.15; font-weight: 700; letter-spacing: 0.16em; }
.body-lg { font-family: var(--font-sans); font-size: 18px; line-height: 28px; font-weight: 400; }
.body { font-family: var(--font-sans); font-size: 16px; line-height: 24px; font-weight: 400; }
.body-sm { font-family: var(--font-sans); font-size: 14px; line-height: 20px; font-weight: 400; }
.label { font-family: var(--font-sans); font-size: 14px; line-height: 20px; font-weight: 600; }
.button { font-family: var(--font-sans); font-size: 15px; line-height: 20px; font-weight: 650; letter-spacing: 0.01em; }
.caption { font-family: var(--font-sans); font-size: 12px; line-height: 16px; font-weight: 500; letter-spacing: 0.02em; }
.overline { font-family: var(--font-sans); font-size: 11px; line-height: 16px; font-weight: 700; letter-spacing: 0.12em; }
```

---

## Appendix A.2 — src/styles/globals.css

The single stylesheet entry, imported in main.tsx. Tailwind v4 with the CSPS layers and theme mapping (§2.3, §2.4).

```css
/* CSPS — global stylesheet (import once, in main.tsx).
   Layer order: theme → base (preflight, tokens, compat) → components (CSPS design system + screens) → utilities.
   Tailwind utilities can therefore adjust layout glue, but the CSPS classes own every visual decision. */
@import "tailwindcss";
@import "./tokens.css" layer(base);
@import "./compat.css" layer(base);
@import "./components.css" layer(components);
@import "./screens.css" layer(components);

/* Espresso theme: the `dark:` variant follows data-theme, not the OS setting. */
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

/* Tailwind theme = CSPS tokens only. The default palette, fonts, radii and shadows are removed,
   so `bg-blue-500`, `rounded-xl`, `shadow-lg` etc. do not exist and cannot creep in.
   `inline` makes every utility read the live CSS variable, so it switches with data-theme. */
@theme inline {
  --color-*: initial;
  --font-*: initial;
  --radius-*: initial;
  --shadow-*: initial;
  --inset-shadow-*: initial;
  --drop-shadow-*: initial;

  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-surface-3: var(--surface-3);
  --color-nav-bg: var(--nav-bg);
  --color-nav-ink: var(--nav-ink);
  --color-sand: var(--sand);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-ink: var(--ink);
  --color-ink-muted: var(--ink-muted);
  --color-ink-subtle: var(--ink-subtle);
  --color-primary: var(--primary);
  --color-primary-hover: var(--primary-hover);
  --color-on-primary: var(--on-primary);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-on-accent: var(--on-accent);
  --color-accent-ink: var(--accent-ink);
  --color-accent-soft: var(--accent-soft);
  --color-accent-line: var(--accent-line);
  --color-focus: var(--focus);
  --color-danger: var(--danger);
  --color-danger-soft: var(--danger-soft);
  --color-on-danger: var(--on-danger);
  --color-success: var(--success);
  --color-success-soft: var(--success-soft);
  --color-warning: var(--warning);
  --color-warning-soft: var(--warning-soft);
  --color-info: var(--info);
  --color-info-soft: var(--info-soft);
  --color-mockup: var(--mockup);
  --color-mockup-soft: var(--mockup-soft);
  --color-neutral-soft: var(--neutral-soft);
  --color-chart-income: var(--chart-income);
  --color-chart-expense: var(--chart-expense);
  --color-scrim: var(--scrim);
  --color-link: var(--link);
  --color-transparent: transparent;
  --color-current: currentColor;

  /* Same literal stacks as tokens.css (Tailwind and the tokens share these variable names). */
  --font-display: "Barlow Condensed", "Archivo Variable", "Arial Narrow", sans-serif;
  --font-sans: "Archivo Variable", system-ui, -apple-system, "Segoe UI", sans-serif;

  /* Same values as tokens.css. */
  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-pill: 999px;

  /* shadow-level-1 / -2 / -3 → the themed --shadow-1/2/3 tokens. */
  --shadow-level-1: var(--shadow-1);
  --shadow-level-2: var(--shadow-2);
  --shadow-level-3: var(--shadow-3);

  /* Breakpoints = CSPS breakpoints (Tailwind's defaults already match; 2xl removed). */
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: initial;

  /* Spacing: Tailwind's default 4px step already equals the CSPS scale (p-4 = 16px = --space-4). */
}
```

---

## Appendix A.3 — src/styles/compat.css

Restores the two browser defaults the mockups relied on (§2.3).

```css
/* Browser defaults the approved mockups relied on that Tailwind's preflight removes.
   Verified by diffing computed styles of every screen with and without preflight. */
.s-hours, .s-meta { margin-block: 1em; }
.csp-search input, .s-search-box input { padding: 1px 2px; }
```

---

## Appendix B — src/styles/components.css

All `.csp-*` component styles. Unchanged from the approved design system.

```css
/* CSP components — reads tokens.css custom properties only. */
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--font-sans); font-size: 16px; line-height: 24px; -webkit-font-smoothing: antialiased; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.csp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.csp-icon { flex: none; display: inline-block; vertical-align: middle; }
.csp-spin { animation: csp-spin .8s linear infinite; }
@keyframes csp-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .csp-spin { animation-duration: 2.4s; } * { transition-duration: 0s !important; } }

/* preview scaffolding (component previews only) */
.csp-pv { padding: var(--space-6); display: flex; flex-wrap: wrap; gap: var(--space-4); align-items: flex-start; }
.csp-pv-col { flex-direction: column; align-items: stretch; }
.csp-pv-grid { display: grid; gap: var(--space-5); grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); padding: var(--space-6); }

/* texture + motif utilities */
.csp-mesh { background-image: radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--ink) 9%, transparent) 1px, transparent 1.6px); background-size: 6px 6px; }
.csp-stitch { background-image: repeating-linear-gradient(90deg, var(--line-strong) 0 8px, transparent 8px 14px); height: 2px; border: 0; }
.csp-stitch-divider { display: flex; align-items: center; gap: var(--space-3); color: var(--ink-muted); }
.csp-stitch-divider::before, .csp-stitch-divider::after { content: ""; flex: 1; height: 2px; background-image: repeating-linear-gradient(90deg, var(--line-strong) 0 8px, transparent 8px 14px); }
.csp-stitch-label { font-family: var(--font-display); font-weight: 700; font-size: 14px; letter-spacing: .16em; text-transform: uppercase; color: var(--accent-ink); }
.csp-cut { position: relative; padding: calc(var(--space-16) + var(--cut-angle)) var(--space-4); }
.csp-cut-surface { background-color: var(--surface); }
.csp-cut-accent { background-color: var(--accent); color: var(--on-accent); }
.csp-cut-top.csp-cut-bottom { clip-path: polygon(0 var(--cut-angle), 100% 0, 100% calc(100% - var(--cut-angle)), 0 100%); }
.csp-cut-top:not(.csp-cut-bottom) { clip-path: polygon(0 var(--cut-angle), 100% 0, 100% 100%, 0 100%); }
.csp-cut-bottom:not(.csp-cut-top) { clip-path: polygon(0 0, 100% 0, 100% calc(100% - var(--cut-angle)), 0 100%); }
.csp-cut-inner { max-width: var(--container-max); margin: 0 auto; }
@media (min-width: 1024px) { .csp-cut { padding: calc(var(--space-24) + var(--cut-angle)) var(--space-6); } }

/* ── Logo ── */
.csp-logo { display: inline-flex; align-items: center; gap: var(--space-3); color: var(--ink); text-decoration: none; }
.csp-mark { flex: none; display: block; }
[data-theme="dark"] .csp-mark { --csp-mark-ring: #1a100f; --csp-mark-stitch: #ff6a1a; }
.csp-logo-mark { position: relative; font-family: var(--font-display); font-weight: 800; font-style: italic; letter-spacing: -.01em; line-height: .8; padding-bottom: .14em; }
.csp-logo-slash { position: absolute; left: .04em; right: -.02em; bottom: 0; height: .085em; background: var(--accent); transform: skewX(-18deg); }
.csp-logo-tag { position: relative; font-family: var(--font-sans); font-weight: 700; text-transform: uppercase; letter-spacing: .16em; color: var(--ink); line-height: 1.32; padding-left: 1.4em; margin-left: .2em; white-space: nowrap; }
.csp-logo-tag::before { content: ""; position: absolute; left: 0; top: -.35em; bottom: -.35em; width: .22em; background: var(--accent); transform: skewX(-18deg); }
.csp-logo-word { display: inline-flex; align-items: flex-end; gap: .06em; }
.csp-logo-word .csp-logo-c { width: .784em; height: .784em; margin-bottom: .15em; }
.csp-logo-sm { gap: 12px; } .csp-logo-sm .csp-logo-word, .csp-logo-sm .csp-logo-mark { font-size: 32px; } .csp-logo-sm .csp-logo-tag { font-size: 9px; }
.csp-logo-md { gap: 16px; } .csp-logo-md .csp-logo-word, .csp-logo-md .csp-logo-mark { font-size: 50px; } .csp-logo-md .csp-logo-tag { font-size: 11px; }
.csp-logo-lg { gap: 22px; } .csp-logo-lg .csp-logo-word, .csp-logo-lg .csp-logo-mark { font-size: 92px; } .csp-logo-lg .csp-logo-tag { font-size: 15px; }

/* ── Button ── */
.csp-btn { display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); font: inherit; font-size: 15px; line-height: 20px; font-weight: 650; letter-spacing: .01em; height: 44px; padding: 0 var(--space-5); border-radius: var(--radius-sm); border: 1px solid transparent; cursor: pointer; white-space: nowrap; text-decoration: none; transition: background-color .15s ease, border-color .15s ease, color .15s ease, transform .15s ease, box-shadow .15s ease; }
.csp-btn:active:not(:disabled) { transform: translateY(1px); }
.csp-btn:disabled { opacity: .45; cursor: not-allowed; }
.csp-btn-sm { height: 36px; padding: 0 var(--space-3); font-size: 14px; }
.csp-btn-lg { height: 52px; padding: 0 var(--space-6); font-size: 16px; }
.csp-btn-block { width: 100%; }
.csp-btn-icon { width: 44px; padding: 0; } .csp-btn-icon.csp-btn-sm { width: 36px; }
.csp-btn-primary { background: var(--primary); color: var(--on-primary); border-color: var(--primary); }
.csp-btn-primary:hover:not(:disabled) { background: var(--primary-hover); border-color: var(--primary-hover); box-shadow: 0 6px 20px -10px var(--primary); }
.csp-btn-secondary { background: transparent; color: var(--ink); border-color: var(--line-strong); }
.csp-btn-secondary:hover:not(:disabled) { background: var(--surface-2); border-color: var(--ink-muted); }
.csp-btn-ghost { background: transparent; color: var(--ink-muted); }
.csp-btn-ghost:hover:not(:disabled) { background: var(--surface-2); color: var(--ink); }
.csp-btn-danger { background: var(--danger); color: var(--on-danger); border-color: var(--danger); }
.csp-btn-danger:hover:not(:disabled) { filter: brightness(1.08); }
.csp-btn-ghost-danger { background: transparent; color: var(--ink-muted); }
.csp-btn-ghost-danger:hover:not(:disabled) { background: var(--danger-soft); color: var(--danger); }
.csp-iconbtn { display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: var(--radius-sm); border: 0; background: transparent; color: var(--ink-muted); cursor: pointer; }
.csp-iconbtn:hover { background: var(--surface-2); color: var(--ink); }
.csp-linkbtn { border: 0; background: none; padding: 0; font: inherit; color: var(--link); font-weight: 650; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }

/* ── Badge ── */
.csp-badge { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 var(--space-2); border-radius: var(--radius-xs); font-size: 12px; line-height: 16px; font-weight: 600; letter-spacing: .02em; white-space: nowrap; }
.csp-badge-dot { width: 7px; height: 7px; border-radius: var(--radius-pill); background: currentColor; }
.csp-badge-neutral { background: var(--neutral-soft); color: var(--ink-muted); }
.csp-badge-accent { background: var(--accent-soft); color: var(--accent-ink); }
.csp-badge-success { background: var(--success-soft); color: var(--success); }
.csp-badge-warning { background: var(--warning-soft); color: var(--warning); }
.csp-badge-info { background: var(--info-soft); color: var(--info); }
.csp-badge-mockup { background: var(--mockup-soft); color: var(--mockup); }
.csp-badge-danger { background: var(--danger-soft); color: var(--danger); }
.csp-badge-solid { background: var(--accent); color: var(--on-accent); }

.csp-avatar { display: inline-grid; place-items: center; flex: none; border-radius: var(--radius-pill); background: var(--surface-2); color: var(--ink); font-family: var(--font-display); font-weight: 700; letter-spacing: .02em; box-shadow: inset 0 0 0 1px var(--line-strong); }

/* ── Forms ── */
.csp-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.csp-label { font-size: 14px; line-height: 20px; font-weight: 600; color: var(--ink); }
.csp-req { color: var(--danger); }
.csp-control { position: relative; display: flex; align-items: center; background: var(--surface-2); border: 1px solid var(--line-strong); border-radius: var(--radius-sm); transition: border-color .15s ease, box-shadow .15s ease; }
.csp-control:hover { border-color: var(--ink-muted); }
.csp-control:focus-within { border-color: var(--focus); box-shadow: 0 0 0 1px var(--focus); }
.csp-field.is-invalid .csp-control { border-color: var(--danger); }
.csp-field.is-invalid .csp-control:focus-within { box-shadow: 0 0 0 1px var(--danger); }
.csp-input { flex: 1; min-width: 0; width: 100%; height: 44px; padding: 0 var(--space-3); border: 0; background: transparent; color: var(--ink); font: inherit; font-size: 16px; outline: none; }
.csp-input::placeholder { color: var(--ink-muted); opacity: .8; }
.csp-control.is-multiline .csp-input { height: auto; min-height: 112px; padding: var(--space-3); resize: vertical; line-height: 24px; }
.csp-prefix { padding-left: var(--space-3); color: var(--ink-muted); font-weight: 600; }
.csp-control.has-prefix .csp-input { padding-left: var(--space-2); font-variant-numeric: tabular-nums; }
.csp-control.has-suffix .csp-input { padding-right: 48px; }
.csp-suffix-btn { position: absolute; right: 4px; display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: 6px; background: transparent; color: var(--ink-muted); cursor: pointer; }
.csp-suffix-btn:hover { color: var(--ink); background: var(--surface-3); }
.csp-select select { appearance: none; padding-right: 40px; cursor: pointer; }
.csp-select select option { background: var(--surface-3); color: var(--ink); }
.csp-select-chev { position: absolute; right: 12px; pointer-events: none; color: var(--ink-muted); }
.csp-msg { margin: 0; display: flex; align-items: center; gap: 6px; font-size: 12px; line-height: 16px; color: var(--ink-muted); }
.csp-msg-error { color: var(--danger); font-weight: 500; }
.csp-strength { display: flex; align-items: center; gap: var(--space-3); }
.csp-strength-bars { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; flex: 1; max-width: 180px; }
.csp-strength-bars span { height: 4px; border-radius: 2px; background: var(--line); }
.csp-strength.is-1 .on { background: var(--danger); }
.csp-strength.is-2 .on { background: var(--warning); }
.csp-strength.is-3 .on { background: var(--info); }
.csp-strength.is-4 .on { background: var(--success); }
.csp-strength-label { font-size: 12px; line-height: 16px; font-weight: 600; color: var(--ink-muted); }
.csp-strength.is-1 .csp-strength-label { color: var(--danger); }
.csp-strength.is-2 .csp-strength-label { color: var(--warning); }
.csp-strength.is-3 .csp-strength-label { color: var(--info); }
.csp-strength.is-4 .csp-strength-label { color: var(--success); }

.csp-seg { display: inline-flex; padding: 3px; gap: 2px; background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius-sm); }
.csp-seg-btn { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent; color: var(--ink-muted); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
.csp-seg-btn:hover { color: var(--ink); }
.csp-seg-btn.is-on { background: var(--surface-3); color: var(--ink); box-shadow: var(--shadow-1), inset 0 0 0 1px var(--line); }

.csp-tabs { display: flex; gap: var(--space-1); border-bottom: 1px solid var(--line); overflow-x: auto; scrollbar-width: none; }
.csp-tab { position: relative; display: inline-flex; align-items: center; gap: var(--space-2); height: 44px; padding: 0 var(--space-4); border: 0; background: none; color: var(--ink-muted); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.csp-tab:hover { color: var(--ink); }
.csp-tab.is-on { color: var(--ink); }
.csp-tab.is-on::after { content: ""; position: absolute; left: var(--space-3); right: var(--space-3); bottom: -1px; height: 3px; border-radius: 3px 3px 0 0; background: var(--accent-line); }
.csp-tab-count { min-width: 22px; height: 20px; padding: 0 6px; border-radius: var(--radius-xs); background: var(--neutral-soft); color: var(--ink-muted); font-size: 12px; line-height: 20px; text-align: center; font-variant-numeric: tabular-nums; }
.csp-tab.is-on .csp-tab-count { background: var(--accent-soft); color: var(--accent-ink); }

/* ── Image uploader ── */
.csp-uploader { display: flex; flex-direction: column; gap: var(--space-4); }
.csp-drop { display: flex; flex-direction: column; align-items: center; gap: var(--space-1); padding: var(--space-8) var(--space-4); border: 2px dashed var(--line-strong); border-radius: var(--radius-md); background: var(--surface-2); color: var(--ink-muted); text-align: center; transition: border-color .15s ease, background-color .15s ease; }
.csp-drop.is-over { border-color: var(--accent-line); background: var(--accent-soft); color: var(--accent-ink); }
.csp-drop-title { margin: var(--space-2) 0 0; color: var(--ink); font-weight: 600; }
.csp-drop-hint { margin: 0; font-size: 12px; line-height: 16px; }
.csp-thumbs { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); }
.csp-thumb { position: relative; aspect-ratio: 1; border-radius: var(--radius-md); overflow: hidden; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line); cursor: grab; }
.csp-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.csp-thumb .csp-media-ph { height: 100%; } .csp-thumb .csp-media-ph-label { display: none; } .csp-thumb .csp-media-ph-num { right: 50%; transform: translate(50%, -50%); }
.csp-thumb.is-cover { box-shadow: 0 0 0 2px var(--accent-line); }
.csp-thumb-cover { position: absolute; left: 6px; bottom: 6px; padding: 2px 6px; border-radius: var(--radius-xs); background: var(--accent); color: var(--on-accent); font-size: 11px; line-height: 16px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.csp-thumb-grip { position: absolute; left: 4px; top: 6px; color: var(--ink); opacity: 0; transition: opacity .15s; filter: drop-shadow(0 1px 1px var(--bg)); }
.csp-thumb-actions { position: absolute; right: 6px; top: 6px; display: flex; gap: 4px; opacity: 0; transition: opacity .15s; }
.csp-thumb:hover .csp-thumb-grip, .csp-thumb:hover .csp-thumb-actions, .csp-thumb:focus-within .csp-thumb-actions { opacity: 1; }
@media (hover: none) { .csp-thumb-actions, .csp-thumb-grip { opacity: 1; } }
.csp-thumb-btn { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 6px; border: 0; background: var(--surface-3); color: var(--ink); box-shadow: var(--shadow-2); cursor: pointer; }
.csp-thumb-btn:hover { background: var(--danger); color: var(--on-danger); }

/* ── Media placeholder ── */
.csp-media-ph { position: relative; width: 100%; overflow: hidden; background-color: var(--surface-2); color: var(--ink-muted); display: flex; align-items: flex-end; }
.csp-media-ph-num { position: absolute; right: 6%; top: 50%; transform: translateY(-55%); font-family: var(--font-display); font-weight: 800; font-style: italic; font-size: clamp(36px, 46cqi, 240px); line-height: .8; color: transparent; -webkit-text-stroke: 2px var(--line-strong); letter-spacing: -.02em; }
.csp-media-ph { container-type: inline-size; }
.csp-media-ph-label { position: relative; display: inline-flex; align-items: center; gap: 6px; margin: var(--space-3); padding: 4px 8px; border-radius: var(--radius-xs); background: var(--surface-3); font-size: 12px; line-height: 16px; font-weight: 600; }

/* ── Cards, money ── */
.csp-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-md); box-shadow: var(--shadow-1); }
.csp-overline { font-size: 11px; line-height: 16px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-muted); }
.csp-money { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
.csp-money-lg { font-family: var(--font-display); font-weight: 700; font-size: 40px; line-height: 1; }
.csp-money-sm { font-size: 14px; }
.csp-money.tone-success { color: var(--success); } .csp-money.tone-warning { color: var(--warning); } .csp-money.tone-danger { color: var(--danger); } .csp-money.tone-muted { color: var(--ink-muted); }

.csp-kpi { container-type: inline-size; padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }
.csp-kpi-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.csp-kpi-icon { display: grid; place-items: center; width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--accent-soft); color: var(--accent-ink); }
.csp-kpi-value { font-family: var(--font-display); font-weight: 700; font-size: clamp(26px, 15cqi, 40px); line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: -.005em; white-space: nowrap; }
.csp-kpi-foot { display: flex; align-items: center; gap: var(--space-2); font-size: 12px; line-height: 16px; color: var(--ink-muted); }
.csp-delta { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; }
.csp-delta.is-up { color: var(--success); } .csp-delta.is-down { color: var(--danger); }

/* totals */
.csp-totals { display: flex; flex-direction: column; gap: var(--space-3); }
.csp-totals-rows { margin: 0; display: flex; flex-direction: column; gap: 6px; }
.csp-totals-row { display: flex; justify-content: space-between; gap: var(--space-3); font-size: 14px; line-height: 20px; }
.csp-totals-row dt { color: var(--ink-muted); }
.csp-totals-row dd { margin: 0; font-variant-numeric: tabular-nums; font-weight: 600; }
.csp-totals-row.is-strong dt { color: var(--ink); font-weight: 600; }
.csp-totals-row .is-neg { color: var(--danger); }
.csp-balance { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm); }
.csp-balance.is-due { background: var(--warning-soft); }
.csp-balance.is-due .csp-overline { color: var(--warning); }
.csp-balance.is-paid { background: var(--success-soft); }
.csp-balance.is-paid .csp-overline { color: var(--success); }
.csp-balance-value { font-family: var(--font-display); font-weight: 700; font-size: 28px; line-height: 1; font-variant-numeric: tabular-nums; color: var(--ink); }
.csp-balance-paid { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-display); font-weight: 700; font-size: 22px; line-height: 1; text-transform: uppercase; letter-spacing: .02em; color: var(--success); }
.csp-totals-panel { padding: var(--space-5); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-md); }
.csp-totals-panel .csp-balance { padding: var(--space-4); }
.csp-totals-panel .csp-balance-value { font-size: 40px; }
.csp-totals-internal { padding-top: var(--space-3); border-top: 2px dashed var(--line); }
.csp-totals-note { margin: 2px 0 0; font-size: 12px; line-height: 16px; color: var(--ink-subtle); }
.csp-totals-card .csp-totals-rows { gap: 2px; }
.csp-totals-card .csp-totals-row { font-size: 13px; }

/* order card */
.csp-order-card { display: flex; flex-direction: column; overflow: hidden; transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
.csp-order-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-2); border-color: var(--line-strong); }
.csp-order-media { position: relative; display: block; padding: 0; border: 0; background: var(--surface-2); cursor: pointer; aspect-ratio: 16 / 10; overflow: hidden; }
.csp-order-media img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .4s ease; }
.csp-order-card:hover .csp-order-media img { transform: scale(1.03); }
.csp-order-media .csp-media-ph { height: 100%; }
.csp-order-status { position: absolute; left: var(--space-3); top: var(--space-3); }
.csp-order-status .csp-badge { box-shadow: 0 0 0 1px var(--line); }
.csp-order-count { position: absolute; right: var(--space-3); top: var(--space-3); display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 8px; border-radius: var(--radius-xs); background: var(--surface-3); color: var(--ink); font-size: 12px; font-weight: 600; }
.csp-order-body { padding: var(--space-4) var(--space-4) var(--space-3); display: flex; flex-direction: column; gap: 4px; flex: 1; }
.csp-order-head { display: flex; justify-content: space-between; align-items: baseline; }
.csp-order-no { font-family: var(--font-display); font-weight: 700; font-size: 15px; letter-spacing: .06em; color: var(--accent-ink); }
.csp-order-qty { font-size: 12px; color: var(--ink-muted); font-weight: 600; }
.csp-order-team { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: 22px; line-height: 1.1; }
.csp-order-cust { margin: 0; min-height: 20px; font-size: 14px; line-height: 20px; color: var(--ink-muted); }
.csp-order-dates { display: flex; flex-wrap: wrap; gap: 4px var(--space-4); margin: 4px 0 var(--space-3); font-size: 12px; line-height: 16px; color: var(--ink-muted); }
.csp-order-dates span { display: inline-flex; align-items: center; gap: 4px; }
.csp-order-dates .is-overdue { color: var(--danger); font-weight: 600; }
.csp-order-actions { display: flex; gap: 2px; padding: var(--space-2) var(--space-3); border-top: 1px solid var(--line); }
.csp-order-actions .csp-btn:last-child { margin-left: auto; }

/* table */
.csp-table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--surface); }
.csp-table { width: 100%; border-collapse: collapse; font-size: 14px; line-height: 20px; }
.csp-table th { position: sticky; top: 0; padding: var(--space-3) var(--space-4); background: var(--surface); color: var(--ink-muted); font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; border-bottom: 1px solid var(--line); white-space: nowrap; }
.csp-table td { padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--line); vertical-align: middle; }
.csp-table tbody tr:last-child td { border-bottom: 0; }
.csp-table tbody tr:hover td { background: var(--surface-2); }
.csp-table td.is-num { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
.csp-table-state { display: flex; align-items: center; justify-content: center; gap: var(--space-2); padding: var(--space-8); color: var(--ink-muted); }
.csp-table-state.is-error { color: var(--danger); }
.csp-cell-user { display: flex; align-items: center; gap: var(--space-3); }
.csp-cell-user strong { display: block; font-weight: 600; }
.csp-cell-user span { color: var(--ink-muted); font-size: 12px; }
.csp-row-actions { display: inline-flex; gap: 2px; }

/* chart */
.csp-chart { position: relative; margin: 0; }
.csp-chart svg { display: block; width: 100%; height: auto; overflow: visible; }
.csp-chart-legend { display: flex; flex-wrap: wrap; gap: var(--space-4); margin-bottom: var(--space-3); font-size: 12px; line-height: 16px; color: var(--ink-muted); font-weight: 600; }
.csp-chart-legend span, .csp-chart-tip span { display: inline-flex; align-items: center; gap: 6px; }
.csp-chart i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; }
.sw-income { background: var(--chart-income); } .sw-expense { background: var(--chart-expense); }
.csp-chart-income { fill: var(--chart-income); } .csp-chart-expense { fill: var(--chart-expense); }
.csp-chart-grid { stroke: var(--line); stroke-width: 1; }
.csp-chart-axis { stroke: var(--line-strong); stroke-width: 1; }
.csp-chart-tick { fill: var(--ink-muted); font-size: 11px; font-family: var(--font-sans); font-variant-numeric: tabular-nums; }
.csp-chart-hover { fill: var(--surface-2); }
.csp-chart-tip { position: absolute; top: 28px; transform: translateX(-50%); display: flex; flex-direction: column; gap: 2px; padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); background: var(--surface-3); border: 1px solid var(--line); box-shadow: var(--shadow-2); font-size: 12px; line-height: 18px; white-space: nowrap; pointer-events: none; font-variant-numeric: tabular-nums; }
.csp-chart-net { color: var(--ink-muted); }

/* ── Overlays ── */
.csp-overlay { position: fixed; inset: 0; z-index: var(--z-overlay); background: var(--scrim); display: flex; align-items: center; justify-content: center; padding: var(--space-4); animation: csp-fade .15s ease; }
.csp-overlay.is-inline { position: relative; inset: auto; min-height: 100%; animation: none; }
.csp-overlay-slideover { justify-content: flex-end; align-items: stretch; padding: 0; }
@keyframes csp-fade { from { opacity: 0; } }
@keyframes csp-rise { from { opacity: 0; transform: translateY(8px) scale(.98); } }
@keyframes csp-slide { from { transform: translateX(24px); opacity: 0; } }
.csp-modal { width: 100%; max-width: 520px; max-height: calc(100vh - 32px); display: flex; flex-direction: column; background: var(--surface-3); color: var(--ink); border: 1px solid var(--line); border-radius: var(--radius-lg); box-shadow: var(--shadow-3); animation: csp-rise .2s ease; }
.csp-overlay.is-inline .csp-modal { max-height: none; }
.csp-modal-slideover { max-width: var(--slideover-width); max-height: none; height: 100%; border-radius: var(--radius-lg) 0 0 var(--radius-lg); animation-name: csp-slide; }
.csp-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4); padding: var(--space-6) var(--space-6) var(--space-4); border-bottom: 1px solid var(--line); }
.csp-modal-title { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: 24px; line-height: 1.1; }
.csp-modal-desc { margin: 4px 0 0; font-size: 14px; line-height: 20px; color: var(--ink-muted); }
.csp-modal-body { padding: var(--space-5) var(--space-6); overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-5); flex: 1; }
.csp-modal-foot { display: flex; justify-content: flex-end; gap: var(--space-3); padding: var(--space-4) var(--space-6); border-top: 1px solid var(--line); }
@media (max-width: 639px) { .csp-modal-foot .csp-btn { flex: 1; } .csp-overlay:not(.csp-overlay-slideover) { align-items: flex-end; padding: 0; } .csp-overlay:not(.csp-overlay-slideover) .csp-modal { border-radius: var(--radius-lg) var(--radius-lg) 0 0; } .csp-modal-slideover { border-radius: 0; max-width: none; } }
.csp-form-grid { display: grid; gap: var(--space-4); grid-template-columns: 1fr 1fr; }
.csp-form-grid > .is-wide { grid-column: 1 / -1; }
@media (max-width: 639px) { .csp-form-grid { grid-template-columns: 1fr; } }

.csp-confirm { display: flex; gap: var(--space-4); align-items: flex-start; }
.csp-confirm > div { flex: 1; display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
.csp-confirm-icon { display: grid; place-items: center; flex: none; width: 44px; height: 44px; border-radius: var(--radius-pill); background: var(--danger-soft); color: var(--danger); }
.csp-confirm-msg { margin: 0; font-size: 15px; line-height: 22px; }
.csp-cascade { padding: var(--space-4); border-radius: var(--radius-sm); background: var(--danger-soft); border: 1px dashed var(--danger); }
.csp-cascade-lead { margin: 0 0 var(--space-3); font-weight: 650; color: var(--ink); font-size: 14px; line-height: 20px; }
.csp-cascade-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-2); }
.csp-cascade-list li { display: flex; flex-direction: column; align-items: center; padding: var(--space-2) 2px; border-radius: 6px; background: var(--surface-3); font-size: 11px; line-height: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-muted); }
.csp-cascade-list li span { font-family: var(--font-display); font-weight: 700; font-size: 26px; line-height: 1.1; color: var(--danger); letter-spacing: 0; font-variant-numeric: tabular-nums; }
.csp-cascade-list li.is-zero span { color: var(--ink-subtle); }
.csp-cascade-foot { margin: var(--space-3) 0 0; font-size: 12px; line-height: 16px; color: var(--danger); font-weight: 600; }
@media (max-width: 420px) { .csp-cascade-list { grid-template-columns: repeat(3, 1fr); } }

.csp-toast { display: flex; align-items: flex-start; gap: var(--space-3); width: 100%; max-width: 400px; padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4); background: var(--surface-3); border: 1px solid var(--line); border-radius: var(--radius-md); box-shadow: var(--shadow-3); position: relative; overflow: hidden; animation: csp-rise .2s ease; }
.csp-toast::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background-image: repeating-linear-gradient(180deg, currentColor 0 6px, transparent 6px 10px); color: var(--ink-muted); }
.csp-toast-success::before { color: var(--success); } .csp-toast-danger::before { color: var(--danger); } .csp-toast-info::before { color: var(--info); } .csp-toast-warning::before { color: var(--warning); }
.csp-toast-icon { padding-top: 6px; } .csp-toast-success .csp-toast-icon { color: var(--success); } .csp-toast-danger .csp-toast-icon { color: var(--danger); } .csp-toast-info .csp-toast-icon { color: var(--info); } .csp-toast-warning .csp-toast-icon { color: var(--warning); }
.csp-toast-text { flex: 1; display: flex; flex-direction: column; padding-top: 6px; font-size: 14px; line-height: 20px; }
.csp-toast-text span { color: var(--ink-muted); }
.csp-toasts { position: fixed; right: var(--space-6); bottom: var(--space-6); z-index: var(--z-toast); display: flex; flex-direction: column; gap: var(--space-3); }

/* ── Navigation ── */
.csp-site-header { position: sticky; top: 0; z-index: var(--z-header); background: color-mix(in srgb, var(--bg) 82%, transparent); backdrop-filter: blur(14px); border-bottom: 1px solid var(--line); }
.csp-site-header-in { max-width: var(--container-max); margin: 0 auto; height: var(--header-height); padding: 0 var(--space-4); display: flex; align-items: center; gap: var(--space-6); }
.csp-site-logo { text-decoration: none; }
.csp-site-nav { display: none; gap: var(--space-1); margin-left: auto; }
.csp-site-link { position: relative; padding: var(--space-2) var(--space-3); color: var(--ink-muted); text-decoration: none; font-weight: 600; font-size: 15px; border-radius: var(--radius-sm); transition: color .15s; }
.csp-site-link:hover { color: var(--ink); }
.csp-site-link.is-on { color: var(--ink); }
.csp-site-link.is-on::after { content: ""; position: absolute; left: var(--space-3); right: var(--space-3); bottom: 0; height: 3px; background: var(--accent); transform: skewX(-18deg); }
.csp-site-cta { display: none; }
.csp-site-burger { margin-left: auto; width: 44px; height: 44px; color: var(--ink); }
.csp-site-drawer { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-2) var(--space-4) var(--space-6); border-top: 1px solid var(--line); }
.csp-site-dlink { display: flex; align-items: center; justify-content: space-between; padding: var(--space-4) 0; border-bottom: 2px dashed var(--line); color: var(--ink); text-decoration: none; font-family: var(--font-display); font-weight: 800; font-size: 32px; line-height: 1; text-transform: uppercase; }
.csp-site-dlink.is-on { color: var(--accent-ink); }
.csp-site-drawer .csp-btn { margin-top: var(--space-4); }
@media (min-width: 768px) { .csp-site-nav, .csp-site-cta { display: inline-flex; } .csp-site-cta { margin-left: 0; } .csp-site-burger, .csp-site-drawer { display: none; } .csp-site-header-in { padding: 0 var(--space-6); } }

.csp-sidebar { width: var(--sidebar-width); height: 100%; min-height: 480px; display: flex; flex-direction: column; background: var(--nav-bg); color: var(--nav-ink); border-right: 1px solid var(--line); transition: width .2s ease; }
.csp-sidebar.is-collapsed { width: var(--sidebar-collapsed); }
.csp-sidebar-top { height: var(--topbar-height); display: flex; align-items: center; justify-content: space-between; padding: 0 var(--space-3) 0 var(--space-5); border-bottom: 1px solid var(--line); }
.csp-sidebar.is-collapsed .csp-sidebar-top { flex-direction: column; justify-content: center; height: auto; padding: var(--space-3) 0; gap: var(--space-2); }
.csp-sidebar-nav { display: flex; flex-direction: column; gap: 2px; padding: var(--space-3); flex: 1; }
.csp-sidebar-foot { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3); border-top: 1px solid var(--line); }
.csp-nav { position: relative; display: flex; align-items: center; gap: var(--space-3); height: 44px; padding: 0 var(--space-3); border-radius: var(--radius-sm); color: var(--ink-muted); text-decoration: none; font-size: 14px; font-weight: 600; white-space: nowrap; transition: background-color .15s, color .15s; }
.csp-nav { color: var(--nav-ink); }
.csp-nav:hover { background: color-mix(in srgb, var(--nav-ink) 12%, transparent); color: var(--nav-ink); }
.csp-nav.is-on { background: var(--primary); color: var(--on-primary); }
.csp-nav.is-on .csp-icon { color: var(--on-primary); }
.csp-nav.is-on::before { content: ""; position: absolute; left: -12px; top: 10px; bottom: 10px; width: 4px; border-radius: 0 3px 3px 0; background: var(--accent); }
.csp-nav-tag { margin-left: auto; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--nav-ink); opacity: .8; }
.csp-sidebar.is-collapsed .csp-nav { justify-content: center; padding: 0; }
.csp-sidebar.is-collapsed .csp-nav-label { display: none; }
.csp-sidebar-user { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-2) var(--space-3); border-bottom: 2px dashed var(--line); margin-bottom: var(--space-1); }
.csp-sidebar-user strong { display: block; font-size: 14px; line-height: 18px; }
.csp-sidebar-user span { font-size: 12px; line-height: 16px; color: var(--nav-ink); }

.csp-topbar { height: var(--topbar-height); display: flex; align-items: center; gap: var(--space-4); padding: 0 var(--space-6); background: var(--surface); border-bottom: 1px solid var(--line); }
.csp-topbar-menu { display: none; }
@media (max-width: 767px) { .csp-topbar { padding: 0 var(--space-4); gap: var(--space-2); } .csp-topbar-menu { display: inline-grid; } .csp-usermenu-text, .csp-search kbd { display: none !important; } }
.csp-search { flex: 1; max-width: 480px; display: flex; align-items: center; gap: var(--space-2); height: 40px; padding: 0 var(--space-3); background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius-sm); color: var(--ink-muted); }
.csp-search:focus-within { border-color: var(--focus); box-shadow: 0 0 0 1px var(--focus); }
.csp-search input { flex: 1; min-width: 0; border: 0; background: none; outline: none; color: var(--ink); font: inherit; font-size: 14px; }
.csp-search input::placeholder { color: var(--ink-muted); }
.csp-search kbd { font: inherit; font-size: 12px; padding: 0 6px; border-radius: 4px; border: 1px solid var(--line-strong); color: var(--ink-muted); }
.csp-topbar-right { margin-left: auto; display: flex; align-items: center; gap: var(--space-2); }
.csp-usermenu { display: flex; align-items: center; gap: var(--space-2); padding: 4px var(--space-2) 4px 4px; border: 0; border-radius: var(--radius-pill); background: transparent; color: var(--ink-muted); font: inherit; cursor: pointer; }
.csp-usermenu:hover { background: var(--surface-2); }
.csp-usermenu-text { display: flex; flex-direction: column; text-align: left; line-height: 16px; }
.csp-usermenu-text strong { color: var(--ink); font-size: 14px; line-height: 18px; }
.csp-usermenu-text span { font-size: 12px; }

/* ── Marketing ── */
.csp-cat { position: relative; display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-md); overflow: hidden; color: var(--ink); text-decoration: none; transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease; }
.csp-cat:hover { transform: translateY(-4px); border-color: var(--accent-line); box-shadow: var(--shadow-2); }
.csp-cat-media { overflow: hidden; clip-path: polygon(0 0, 100% 0, 100% 88%, 0 100%); }
.csp-cat-media img { display: block; width: 100%; aspect-ratio: 4 / 5; object-fit: cover; transition: transform .4s ease; }
.csp-cat-media .csp-media-ph-label { display: none; }
.csp-media-ph-num { transition: transform .4s ease; }
.csp-cat:hover .csp-cat-media img, .csp-cat:hover .csp-media-ph-num { transform: scale(1.04) translateY(-52%); }
.csp-cat-body { padding: var(--space-2) var(--space-5) var(--space-5); display: flex; flex-direction: column; gap: var(--space-2); }
.csp-cat-title { margin: 0; font-family: var(--font-display); font-weight: 800; font-size: 28px; line-height: 1; text-transform: uppercase; }
.csp-cat-desc { margin: 0; font-size: 14px; line-height: 20px; color: var(--ink-muted); }
.csp-cat-link { display: inline-flex; align-items: center; gap: 4px; margin-top: var(--space-2); font-weight: 650; font-size: 14px; color: var(--accent-ink); }
.csp-cat:hover .csp-cat-link .csp-icon { transform: translate(2px, -2px); }
.csp-cat-link .csp-icon { transition: transform .2s ease; }

.csp-steps { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-4); grid-template-columns: 1fr; counter-reset: s; }
@media (min-width: 640px) { .csp-steps { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .csp-steps { grid-template-columns: repeat(4, 1fr); } }
.csp-step { position: relative; padding: var(--space-6) var(--space-5) var(--space-5); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-md); overflow: hidden; }
.csp-step::after { content: ""; position: absolute; left: var(--space-5); right: var(--space-5); top: 0; height: 2px; background-image: repeating-linear-gradient(90deg, var(--line-strong) 0 8px, transparent 8px 14px); }
.csp-step-no { display: block; font-family: var(--font-display); font-weight: 800; font-style: italic; font-size: 56px; line-height: .9; color: var(--accent-ink); margin-bottom: var(--space-3); }
.csp-step-icon { position: absolute; right: var(--space-5); top: var(--space-6); color: var(--ink-muted); }
.csp-step-title { margin: 0 0 var(--space-2); font-family: var(--font-display); font-weight: 700; font-size: 22px; line-height: 1.1; text-transform: uppercase; }
.csp-step-desc { margin: 0; font-size: 14px; line-height: 20px; color: var(--ink-muted); }

.csp-testi { margin: 0; display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-6); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-md); }
.csp-testi-stars { display: flex; gap: 2px; color: var(--line-strong); }
.csp-testi-stars .on { color: var(--accent-ink); fill: var(--accent-ink); }
.csp-testi-quote { margin: 0; font-size: 17px; line-height: 26px; }
.csp-testi-quote::before { content: "“"; } .csp-testi-quote::after { content: "”"; }
.csp-testi-by { display: flex; align-items: center; gap: var(--space-3); padding-top: var(--space-4); border-top: 2px dashed var(--line); }
.csp-testi-by strong { display: block; font-size: 14px; line-height: 20px; }
.csp-testi-by span span { font-size: 12px; line-height: 16px; color: var(--ink-muted); }

/* ── Feedback ── */
.csp-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--space-2); padding: var(--space-12) var(--space-6); border: 2px dashed var(--line); border-radius: var(--radius-md); }
.csp-empty-icon { display: grid; place-items: center; width: 64px; height: 64px; margin-bottom: var(--space-2); border-radius: var(--radius-md); background: var(--accent-soft); color: var(--accent-ink); transform: rotate(-6deg); }
.csp-empty-icon .csp-icon { transform: rotate(6deg); }
.csp-empty-title { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: 26px; line-height: 1.1; }
.csp-empty-msg { margin: 0 0 var(--space-3); max-width: 380px; font-size: 14px; line-height: 20px; color: var(--ink-muted); }
.csp-skel { display: block; background: linear-gradient(90deg, var(--surface-2) 0%, var(--line) 50%, var(--surface-2) 100%); background-size: 200% 100%; border-radius: 6px; animation: csp-shimmer 1.4s ease-in-out infinite; }
@keyframes csp-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }

/* sidebar sits on nav-bg (taupe): its own ink for everything inside */
.csp-sidebar .csp-logo, .csp-sidebar .csp-logo-tag, .csp-sidebar .csp-iconbtn { color: var(--nav-ink); }
.csp-sidebar .csp-iconbtn:hover { background: color-mix(in srgb, var(--nav-ink) 12%, transparent); color: var(--nav-ink); }

.csp-sidebar .csp-avatar { background: var(--surface-3); color: var(--ink); }
```

---

## Appendix C — src/styles/screens.css

All `.s-*` page classes and every responsive container query. Identical to the approved file except `.s-overlay`, `.s-lightbox` and `.s-toast-layer` are `position: fixed` (§2.10.1).

```css
/* CSPS screens (React/Tailwind edition: .s-overlay, .s-lightbox and .s-toast-layer are position: fixed) — page-level layout on top of the CSPS design system (tokens.css + bundle.css).
   Every responsive rule is a container query on .s-page, so a page reflows to the width of its frame. */

.s-page { container: pg / inline-size; position: relative; min-height: 100%; background: var(--bg); color: var(--ink); font-family: var(--font-sans); font-size: 16px; line-height: 24px; }
.s-page *, .s-page *::before, .s-page *::after { box-sizing: border-box; }
:where(.s-page) a { color: inherit; }
.s-page h1, .s-page h2, .s-page h3, .s-page h4, .s-page p { margin: 0; }
.s-wrap { max-width: var(--container-max); margin: 0 auto; padding: 0 var(--space-6); }
.s-sec { padding: var(--space-24) 0; position: relative; }
.s-mesh { background-image: radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--ink) 9%, transparent) 1px, transparent 1.6px); background-size: 6px 6px; }

/* type */
.s-eyebrow { display: inline-flex; align-items: center; gap: var(--space-2); font-family: var(--font-display); font-weight: 700; font-size: 14px; line-height: 1.15; letter-spacing: .16em; text-transform: uppercase; color: var(--accent-ink); }
.s-eyebrow::before { content: ""; width: 24px; height: 3px; background: var(--accent-line); transform: skewX(-18deg); }
.s-h1 { font-family: var(--font-display); font-weight: 800; font-style: italic; font-size: 96px; line-height: .88; letter-spacing: -.01em; text-transform: uppercase; }
.s-h1 em { font-style: italic; color: var(--accent-ink); }
.s-h2 { font-family: var(--font-display); font-weight: 800; font-size: 48px; line-height: 1; text-transform: uppercase; }
.s-h2 em { font-style: normal; color: var(--accent-ink); }
.s-h3 { font-family: var(--font-display); font-weight: 800; font-size: 28px; line-height: 1.05; text-transform: uppercase; }
.s-title { font-family: var(--font-display); font-weight: 700; font-size: 32px; line-height: 1.05; }
.s-lead { font-size: 18px; line-height: 28px; color: var(--ink-muted); max-width: 560px; }
.s-muted { color: var(--ink-muted); }
.s-small { font-size: 14px; line-height: 20px; }
.s-cap { font-size: 12px; line-height: 16px; color: var(--ink-muted); }
.s-num { font-variant-numeric: tabular-nums; }
.s-head { display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-12); }
.s-head-row { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: var(--space-6); margin-bottom: var(--space-12); }
.s-btnrow { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; }
.s-link { display: inline-flex; align-items: center; gap: 6px; color: var(--accent-ink) !important; font-weight: 650; text-decoration: none; }
.s-link:hover { text-decoration: underline; text-underline-offset: 4px; }
.s-a-btn { display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); height: 52px; padding: 0 var(--space-6); border-radius: var(--radius-sm); font-weight: 650; font-size: 16px; text-decoration: none; border: 1px solid transparent; white-space: nowrap; transition: background-color .15s ease, transform .15s ease, box-shadow .15s ease; }
.s-a-primary { background: var(--primary); color: var(--on-primary) !important; border-color: var(--primary); }
.s-a-primary:hover { background: var(--primary-hover); box-shadow: 0 6px 20px -10px var(--primary); }
.s-a-secondary { color: var(--ink) !important; border-color: var(--line-strong); }
.s-a-secondary:hover { background: var(--surface-2); }

/* grids */
.s-g2 { display: grid; gap: var(--space-6); grid-template-columns: repeat(2, minmax(0, 1fr)); }
.s-g3 { display: grid; gap: var(--space-6); grid-template-columns: repeat(3, minmax(0, 1fr)); }
.s-g4 { display: grid; gap: var(--space-6); grid-template-columns: repeat(4, minmax(0, 1fr)); }
.s-g5 { display: grid; gap: var(--space-4); grid-template-columns: repeat(5, minmax(0, 1fr)); }

/* public: hero */
.s-hero { position: relative; overflow: hidden; padding: var(--space-16) 0 calc(var(--space-24) + var(--cut-angle)); }
.s-hero-grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: var(--space-12); align-items: center; }
.s-hero-copy { display: flex; flex-direction: column; gap: var(--space-6); position: relative; z-index: 1; }
.s-chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.s-chip { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 var(--space-3); border: 1px solid var(--line); border-radius: var(--radius-xs); background: var(--surface); font-size: 13px; font-weight: 600; color: var(--ink-muted); }
.s-chip .csp-icon { color: var(--accent-ink); }
.s-hero-art { position: relative; aspect-ratio: 1 / 1; }
.s-hero-slab { position: absolute; inset: 8% 0 0 14%; background: var(--accent); clip-path: polygon(0 18%, 100% 0, 100% 82%, 0 100%); }
.s-hero-slab2 { position: absolute; inset: 22% 22% 10% 0; background: var(--sand); clip-path: polygon(0 12%, 100% 0, 100% 100%, 0 100%); }
.s-hero-jersey { position: absolute; inset: 6% 8% 4% 10%; width: 82%; height: 90%; filter: drop-shadow(0 30px 40px rgba(0,0,0,.55)); }
.s-hero-tag { position: absolute; left: 0; bottom: 6%; display: flex; flex-direction: column; gap: 2px; padding: var(--space-3) var(--space-4); background: var(--surface-3); border: 1px solid var(--line); border-radius: var(--radius-md); box-shadow: var(--shadow-2); }
.s-hero-tag strong { font-family: var(--font-display); font-size: 20px; line-height: 1.1; text-transform: uppercase; }
.s-hero-num { position: absolute; right: -2%; top: -4%; font-family: var(--font-display); font-weight: 800; font-style: italic; font-size: 260px; line-height: .8; color: transparent; -webkit-text-stroke: 2px var(--line); pointer-events: none; }
.s-cut { position: relative; background: var(--surface); padding: calc(var(--space-24) + var(--cut-angle)) 0; clip-path: polygon(0 var(--cut-angle), 100% 0, 100% calc(100% - var(--cut-angle)), 0 100%); margin: calc(var(--cut-angle) * -1) 0; }
.s-cut-accent { background: var(--accent); color: var(--on-accent); }
.s-cut-accent .s-h2, .s-cut-accent .s-lead { color: var(--on-accent); }
.s-cut-accent .s-lead { opacity: .8; }
.s-cut-accent .s-a-dark { background: var(--on-accent); color: var(--accent) !important; }
.s-cut-accent .s-a-dark:hover { background: #000; }
.s-cut-accent .s-a-ghost { color: var(--on-accent) !important; border-color: var(--on-accent); }

/* public: categories */
.s-cats { display: grid; gap: var(--space-6); grid-template-columns: repeat(3, minmax(0, 1fr)); }

/* why */
.s-why { display: grid; gap: var(--space-4); grid-template-columns: repeat(5, minmax(0, 1fr)); }
.s-why-item { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-6) var(--space-5); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-md); position: relative; }
.s-why-icon { display: grid; place-items: center; width: 48px; height: 48px; border-radius: var(--radius-sm); background: var(--accent-soft); color: var(--accent-ink); transform: rotate(-6deg); }
.s-why-item h3 { font-family: var(--font-display); font-weight: 700; font-size: 22px; line-height: 1.1; text-transform: uppercase; }
.s-why-item p { font-size: 14px; line-height: 20px; color: var(--ink-muted); }

/* gallery strip */
.s-strip { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(240px, 1fr); gap: var(--space-4); overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: var(--space-2); scrollbar-width: none; }
.s-tile { position: relative; display: block; border-radius: var(--radius-md); overflow: hidden; scroll-snap-align: start; text-decoration: none; background: var(--surface-2); }
.s-tile .csp-media-ph { height: 100%; }
.s-tile .csp-media-ph-label { display: none; }
.s-tile-cap { position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; gap: 2px; padding: var(--space-6) var(--space-4) var(--space-4); background: linear-gradient(transparent, color-mix(in srgb, var(--bg) 92%, transparent)); }
.s-tile-cap strong { font-family: var(--font-display); font-size: 20px; line-height: 1.1; text-transform: uppercase; color: var(--ink); }
.s-tile-cap span { font-size: 12px; line-height: 16px; color: var(--ink-muted); font-weight: 600; }
.s-tile-kit { position: absolute; inset: 0; display: grid; place-items: center; }
.s-tile-kit svg { width: 64%; height: auto; }
.s-tile:hover .s-tile-kit svg { transform: scale(1.04); }
.s-tile-kit svg { transition: transform .4s ease; }

/* testimonials */
.s-testis { display: grid; gap: var(--space-6); grid-template-columns: repeat(3, minmax(0, 1fr)); }

/* footer */
.s-foot { border-top: 1px solid var(--line); padding: var(--space-16) 0 var(--space-8); background: var(--bg); }
.s-foot-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: var(--space-8); }
.s-foot h4 { font-family: var(--font-display); font-weight: 700; font-size: 16px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-muted); margin-bottom: var(--space-4); }
.s-foot ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3); font-size: 14px; line-height: 20px; }
.s-foot li { display: flex; gap: var(--space-2); align-items: flex-start; }
.s-foot li .csp-icon { color: var(--ink-muted); margin-top: 1px; }
.s-foot a { text-decoration: none; }
.s-foot a:hover { color: var(--accent-ink); }
.s-socials { display: flex; gap: var(--space-2); margin-top: var(--space-5); }
.s-social { display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); font-family: var(--font-display); font-weight: 700; font-size: 15px; text-decoration: none; }
.s-social:hover { border-color: var(--accent-line); color: var(--accent-ink); }
.s-foot-base { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--space-3); margin-top: var(--space-12); padding-top: var(--space-6); border-top: 2px dashed var(--line); font-size: 12px; line-height: 16px; color: var(--ink-subtle); }
.s-staff { color: var(--ink-subtle) !important; text-decoration: none; display: inline-flex; gap: 6px; align-items: center; }
.s-staff:hover { color: var(--ink) !important; }

/* page header (inner public pages) */
.s-pagehead { padding: var(--space-16) 0 calc(var(--space-12) + var(--cut-angle)); position: relative; overflow: hidden; }
.s-pagehead .s-h1 { font-size: 80px; }
.s-crumbs { display: flex; gap: var(--space-2); font-size: 13px; color: var(--ink-subtle); margin-bottom: var(--space-4); }
.s-crumbs a { text-decoration: none; }

/* products page */
.s-anchors { position: sticky; top: var(--header-height); z-index: 5; background: color-mix(in srgb, var(--bg) 90%, transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); }
.s-anchors-in { display: flex; gap: var(--space-2); overflow-x: auto; padding: var(--space-3) 0; scrollbar-width: none; }
.s-pill { display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 var(--space-4); border-radius: var(--radius-sm); border: 1px solid var(--line); color: var(--ink-muted) !important; text-decoration: none; font-weight: 600; font-size: 14px; white-space: nowrap; background: var(--surface); cursor: pointer; font-family: inherit; }
.s-pill:hover { color: var(--ink) !important; border-color: var(--line-strong); }
.s-pill.is-on { background: var(--primary); border-color: var(--primary); color: var(--on-primary) !important; }
.s-pill-count { font-size: 12px; opacity: .7; font-variant-numeric: tabular-nums; }
.s-prod { display: grid; grid-template-columns: 1.1fr .9fr; gap: var(--space-12); align-items: start; padding: var(--space-16) 0; border-bottom: 2px dashed var(--line); }
.s-prod.is-flip .s-prod-media { order: 2; }
.s-prod-media { display: grid; grid-template-columns: 2fr 1fr; grid-template-rows: 1fr 1fr; gap: var(--space-3); aspect-ratio: 5 / 4; }
.s-prod-media > div { border-radius: var(--radius-md); overflow: hidden; position: relative; }
.s-prod-media > div:first-child { grid-row: span 2; }
.s-prod-media .csp-media-ph { height: 100%; }
.s-prod-media .s-tile-kit svg { width: 70%; }
.s-prod-copy { display: flex; flex-direction: column; gap: var(--space-5); }
.s-prod-no { font-family: var(--font-display); font-weight: 800; font-style: italic; font-size: 20px; color: var(--accent-ink); letter-spacing: .04em; }
.s-custom { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); margin-top: var(--space-2); }
.s-custom-item { padding: var(--space-4); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 4px; }
.s-custom-item.is-wide { grid-column: 1 / -1; }
.s-custom-item h4 { display: flex; align-items: center; gap: var(--space-2); font-size: 14px; line-height: 20px; font-weight: 700; }
.s-custom-item h4 .csp-icon { color: var(--accent-ink); }
.s-custom-item p { font-size: 13px; line-height: 18px; color: var(--ink-muted); }
.s-price { display: flex; align-items: baseline; gap: var(--space-2); padding-top: var(--space-2); }
.s-price strong { font-family: var(--font-display); font-weight: 700; font-size: 28px; }

/* gallery */
.s-masonry { columns: 4; column-gap: var(--space-4); }
.s-masonry > * { break-inside: avoid; margin-bottom: var(--space-4); }
.s-mtile { display: block; width: 100%; padding: 0; border: 0; background: var(--surface-2); border-radius: var(--radius-md); overflow: hidden; position: relative; cursor: zoom-in; text-align: left; font: inherit; color: inherit; }
.s-mtile .csp-media-ph-label { display: none; }
.s-mtile:hover .s-tile-cap { padding-bottom: var(--space-5); }
.s-mtile .s-tile-cap { transition: padding .2s ease; }
.s-lightbox { position: fixed; inset: 0; z-index: 80; background: color-mix(in srgb, #1a100f 94%, transparent); display: flex; flex-direction: column; align-items: center; padding: var(--space-6); gap: var(--space-4); }
.s-lb-top { width: 100%; max-width: 1100px; display: flex; justify-content: space-between; align-items: center; color: #f6dfd1; }
.s-lb-stage { position: relative; width: 100%; max-width: 1100px; display: grid; grid-template-columns: 56px 1fr 56px; gap: var(--space-4); align-items: center; }
.s-lb-img { border-radius: var(--radius-lg); overflow: hidden; background: var(--surface-2); max-height: 680px; aspect-ratio: 4 / 3; position: relative; }
.s-lb-img .csp-media-ph { height: 100%; }
.s-lb-img .csp-media-ph-label { display: none; }
.s-lb-nav { display: grid; place-items: center; width: 56px; height: 56px; border-radius: var(--radius-pill); border: 1px solid #8f6c62; background: #241614; color: #f6dfd1; cursor: pointer; }
.s-lb-nav:hover { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.s-lb-cap { width: 100%; max-width: 1100px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--space-3); color: #f6dfd1; }
.s-lb-close { display: grid; place-items: center; width: 44px; height: 44px; border-radius: var(--radius-sm); border: 1px solid #8f6c62; background: transparent; color: #f6dfd1; cursor: pointer; }

/* contact */
.s-contact { display: grid; grid-template-columns: 1.35fr .9fr; gap: var(--space-8); align-items: start; }
.s-formcard { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: var(--space-8); display: flex; flex-direction: column; gap: var(--space-6); }
.s-formgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-5) var(--space-4); }
.s-formgrid > .is-wide { grid-column: 1 / -1; }
.s-side { display: flex; flex-direction: column; gap: var(--space-4); }
.s-bigbtn { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-5); border-radius: var(--radius-md); text-decoration: none; border: 1px solid var(--line); background: var(--surface); transition: transform .2s ease, border-color .2s ease; }
.s-bigbtn:hover { transform: translateY(-2px); border-color: var(--accent-line); }
.s-bigbtn-ic { display: grid; place-items: center; width: 52px; height: 52px; border-radius: var(--radius-sm); background: var(--surface-2); color: var(--accent-ink); flex: none; }
.s-bigbtn.is-primary { background: var(--accent); border-color: var(--accent-line); color: var(--on-accent) !important; }
.s-bigbtn.is-primary .s-bigbtn-ic { background: var(--on-accent); color: var(--accent); }
.s-bigbtn strong { display: block; font-family: var(--font-display); font-weight: 800; font-size: 24px; line-height: 1.05; text-transform: uppercase; }
.s-bigbtn span { font-size: 13px; line-height: 18px; opacity: .8; }
.s-bigbtn .s-go { margin-left: auto; }
.s-infocard { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-md); padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-3); }
.s-hours { display: grid; grid-template-columns: 1fr auto; gap: 6px var(--space-4); font-size: 14px; line-height: 20px; }
.s-hours dt { color: var(--ink-muted); }
.s-hours dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; }
.s-open { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--success); }
.s-open::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.s-map { position: relative; aspect-ratio: 16 / 10; border-radius: var(--radius-md); overflow: hidden; background: var(--surface-2); border: 1px solid var(--line); }
.s-map-roads { position: absolute; inset: 0; width: 100%; height: 100%; }
.s-map-pin { position: absolute; left: 50%; top: 46%; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; gap: 4px; }
.s-map-pin span { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: var(--accent); color: var(--on-accent); box-shadow: var(--shadow-2); }
.s-map-pin span .csp-icon { transform: rotate(45deg); }
.s-map-label { position: absolute; left: var(--space-3); bottom: var(--space-3); right: var(--space-3); display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); padding: var(--space-3); background: var(--surface-3); border-radius: var(--radius-sm); font-size: 13px; line-height: 18px; }
.s-mbar { display: none; }

/* ───────── admin ───────── */
.s-admin { display: flex; min-height: 100%; background: var(--bg); color: var(--ink); }
.s-admin-side { flex: none; position: relative; }
.s-admin-side .csp-sidebar { position: sticky; top: 0; height: 100%; min-height: 100%; }
.s-admin-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.s-admin-main > .csp-topbar { position: sticky; top: 0; z-index: 20; }
.s-body { padding: var(--space-8) var(--space-8) var(--space-12); display: flex; flex-direction: column; gap: var(--space-6); max-width: 1440px; width: 100%; }
.s-ph { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: var(--space-4); }
.s-ph-title { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.s-ph-title h1 { font-family: var(--font-display); font-weight: 700; font-size: 34px; line-height: 1.05; }
.s-ph-title p { font-size: 14px; line-height: 20px; color: var(--ink-muted); }
.s-ph-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
.s-back { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; color: var(--ink-muted) !important; text-decoration: none; }
.s-back:hover { color: var(--ink) !important; }
.s-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-md); box-shadow: var(--shadow-1); min-width: 0; }
.s-card-h { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--line); }
.s-card-h h2 { font-family: var(--font-display); font-weight: 700; font-size: 22px; line-height: 1.1; }
.s-card-h p { font-size: 13px; color: var(--ink-muted); }
.s-card-b { padding: var(--space-5); }
.s-kpis { display: grid; gap: var(--space-4); grid-template-columns: repeat(4, minmax(0, 1fr)); }
.s-dash { display: grid; gap: var(--space-6); grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); align-items: start; }
.s-status-list { list-style: none; margin: 0; padding: var(--space-2) var(--space-5) var(--space-5); display: flex; flex-direction: column; gap: var(--space-3); }
.s-status-row { display: grid; grid-template-columns: 128px 1fr 32px; align-items: center; gap: var(--space-3); }
.s-status-bar { height: 8px; border-radius: 4px; background: var(--surface-2); overflow: hidden; }
.s-status-bar span { display: block; height: 100%; border-radius: 4px; }
.s-status-row strong { font-family: var(--font-display); font-size: 20px; text-align: right; font-variant-numeric: tabular-nums; }
.s-status-total { display: flex; justify-content: space-between; padding: var(--space-3) var(--space-5); border-top: 2px dashed var(--line); font-size: 13px; color: var(--ink-muted); }

/* toolbar */
.s-toolbar { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: flex-end; padding: var(--space-4); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-md); }
.s-toolbar .s-search { flex: 1 1 260px; }
.s-toolbar .csp-field { flex: 0 1 180px; }
.s-toolbar .csp-input { height: 40px; font-size: 14px; }
.s-toolbar .csp-label { font-size: 12px; line-height: 16px; color: var(--ink-muted); }
.s-search-box { display: flex; align-items: center; gap: var(--space-2); height: 40px; padding: 0 var(--space-3); background: var(--surface-2); border: 1px solid var(--line-strong); border-radius: var(--radius-sm); color: var(--ink-muted); }
.s-search-box input { flex: 1; min-width: 0; border: 0; background: none; outline: none; color: var(--ink); font: inherit; font-size: 14px; }
.s-search-box input::placeholder { color: var(--ink-muted); }
.s-toolbar-end { display: flex; gap: var(--space-2); align-items: center; margin-left: auto; }
.s-resultbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: var(--space-3); font-size: 13px; color: var(--ink-muted); }
.s-filter-chip { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 6px 0 10px; border-radius: var(--radius-xs); background: var(--accent-soft); color: var(--accent-ink); font-weight: 600; font-size: 12px; }
.s-orders { display: grid; gap: var(--space-5); grid-template-columns: repeat(4, minmax(0, 1fr)); }

/* responsive table → cards on phones */
.s-rt-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--surface); }
.s-rt { width: 100%; border-collapse: collapse; font-size: 14px; line-height: 20px; }
.s-rt th { padding: var(--space-3) var(--space-4); text-align: left; color: var(--ink-muted); font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; border-bottom: 1px solid var(--line); white-space: nowrap; background: var(--surface); }
.s-rt td { padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--line); vertical-align: middle; }
.s-rt tbody tr:last-child td { border-bottom: 0; }
.s-rt tbody tr:hover td { background: var(--surface-2); }
.s-rt .r { text-align: right; }
.s-rt td.m { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
.s-rt tfoot td { padding: var(--space-3) var(--space-4); border-top: 2px dashed var(--line); font-weight: 700; }
.s-ord-no { font-family: var(--font-display); font-weight: 700; font-size: 15px; letter-spacing: .05em; color: var(--accent-ink); text-decoration: none; white-space: nowrap; }
.s-who strong { display: block; font-weight: 600; }
.s-who span { display: block; font-size: 12px; line-height: 16px; color: var(--ink-muted); }
.s-acts { display: inline-flex; gap: 2px; justify-content: flex-end; }
.s-iconbtn { display: inline-grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--ink-muted); cursor: pointer; }
.s-iconbtn:hover { background: var(--surface-2); color: var(--ink); }
.s-iconbtn.is-danger:hover { background: var(--danger-soft); color: var(--danger); }
.s-balance-cell { font-family: var(--font-display); font-weight: 700; font-size: 17px; }
.s-paid { display: inline-flex; align-items: center; gap: 4px; color: var(--success); font-weight: 700; font-size: 13px; }

/* order detail */
.s-detail { display: grid; gap: var(--space-6); grid-template-columns: minmax(0, 1fr) 360px; align-items: start; }
.s-detail-main { display: flex; flex-direction: column; gap: var(--space-6); min-width: 0; }
.s-detail-side { display: flex; flex-direction: column; gap: var(--space-4); position: sticky; top: calc(var(--topbar-height) + var(--space-6)); }
.s-gallery { display: grid; grid-template-columns: 2fr 1fr 1fr; grid-template-rows: 1fr 1fr; gap: var(--space-3); height: 360px; }
.s-gallery > button { position: relative; padding: 0; border: 0; border-radius: var(--radius-md); overflow: hidden; background: var(--surface-2); cursor: zoom-in; }
.s-gallery > button:first-child { grid-row: span 2; }
.s-gallery .csp-media-ph { height: 100%; }
.s-gallery .csp-media-ph-label { display: none; }
.s-gallery .s-cover-tag { position: absolute; left: var(--space-3); bottom: var(--space-3); }
.s-gallery .s-more { position: absolute; inset: 0; display: grid; place-items: center; background: color-mix(in srgb, var(--bg) 60%, transparent); font-family: var(--font-display); font-weight: 700; font-size: 22px; color: var(--ink); }
.s-tabcard .csp-tabs { padding: 0 var(--space-3); }
.s-tabbar-h { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: var(--space-3); padding: var(--space-4) var(--space-5); }
.s-tabbar-h h3 { font-family: var(--font-display); font-weight: 700; font-size: 20px; }
.s-meta { display: grid; grid-template-columns: auto 1fr; gap: var(--space-2) var(--space-4); font-size: 14px; line-height: 20px; }
.s-meta dt { color: var(--ink-muted); display: flex; align-items: center; gap: 6px; }
.s-meta dd { margin: 0; font-weight: 600; text-align: right; overflow-wrap: anywhere; }
.s-overlay { position: fixed; inset: 0; z-index: 80; background: var(--scrim); display: flex; justify-content: center; align-items: flex-start; padding: 140px var(--space-4) var(--space-4); }
.s-overlay .csp-overlay.is-inline { background: transparent; padding: 0; min-height: 0; width: 100%; }
.s-overlay > .csp-modal { animation: none; }
.s-toast-layer { position: fixed; top: calc(var(--topbar-height) + var(--space-4)); right: var(--space-6); z-index: 100; width: 380px; max-width: calc(100% - 32px); display: flex; flex-direction: column; gap: var(--space-3); }
.s-inline-empty { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); padding: var(--space-12) var(--space-4); color: var(--ink-muted); text-align: center; font-size: 14px; }

/* order form */
.s-form-layout { display: grid; gap: var(--space-6); grid-template-columns: minmax(0, 1fr) 320px; align-items: start; }
.s-form-col { display: flex; flex-direction: column; gap: var(--space-6); min-width: 0; }
.s-items { display: flex; flex-direction: column; }
.s-item-head, .s-item { display: grid; grid-template-columns: 180px minmax(0, 1.6fr) 96px 76px 120px 112px 40px; gap: var(--space-3); align-items: center; }
.s-item-head { padding: 0 var(--space-5) var(--space-2); font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-muted); }
.s-item { padding: var(--space-3) var(--space-5); border-top: 1px solid var(--line); }
.s-item .csp-input { height: 40px; font-size: 14px; }
.s-item .s-lbl { display: none; }
.s-line-total { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
.s-items-foot { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: var(--space-3); padding: var(--space-4) var(--space-5); border-top: 2px dashed var(--line); }
.s-items-foot strong { font-family: var(--font-display); font-size: 24px; font-variant-numeric: tabular-nums; }
.s-savebar { position: sticky; bottom: 0; z-index: 10; display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: var(--space-3); padding: var(--space-4) var(--space-8); background: color-mix(in srgb, var(--surface) 92%, transparent); backdrop-filter: blur(10px); border-top: 1px solid var(--line); }
.s-savebar .s-cap { margin-right: auto; }

/* profile */
.s-profile-head { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-5); padding: var(--space-6); position: relative; overflow: hidden; }
.s-profile-head .csp-avatar { box-shadow: 0 0 0 3px var(--accent-line); }
.s-profile-head h1 { font-family: var(--font-display); font-weight: 700; font-size: 34px; line-height: 1.05; }
.s-profile-stripe { position: absolute; right: -40px; top: 0; bottom: 0; width: 320px; background: var(--accent); clip-path: polygon(30% 0, 100% 0, 100% 100%, 0 100%); opacity: .95; }
.s-profile-stripe::after { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(-72deg, transparent 0 22px, var(--on-accent) 22px 30px); clip-path: polygon(40% 70%, 100% 50%, 100% 74%, 30% 100%); }
.s-cards2 { display: grid; gap: var(--space-6); grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
.s-card-foot { display: flex; justify-content: flex-end; gap: var(--space-3); padding: var(--space-4) var(--space-5); border-top: 1px solid var(--line); }
.s-stack { display: flex; flex-direction: column; gap: var(--space-5); }
.s-note { display: flex; gap: var(--space-2); align-items: flex-start; padding: var(--space-3); border-radius: var(--radius-sm); background: var(--surface-2); font-size: 13px; line-height: 18px; color: var(--ink-muted); }
.s-banner { display: flex; gap: var(--space-3); align-items: flex-start; padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm); font-size: 14px; line-height: 20px; }
.s-banner.is-danger { background: var(--danger-soft); color: var(--danger); border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent); }
.s-banner.is-danger strong { color: var(--ink); display: block; }
.s-banner.is-danger span { color: var(--ink-muted); }

/* login */
.s-login { display: grid; grid-template-columns: 1.1fr 1fr; min-height: 100%; background: var(--bg); }
.s-login-brand { position: relative; overflow: hidden; padding: var(--space-12); display: flex; flex-direction: column; justify-content: space-between; background: var(--surface); border-right: 1px solid var(--line); }
.s-login-slab { position: absolute; right: -10%; bottom: -6%; width: 78%; height: 62%; background: var(--accent); clip-path: polygon(0 22%, 100% 0, 100% 100%, 0 100%); }
.s-login-bands { position: absolute; right: -10%; bottom: -6%; width: 78%; height: 62%; clip-path: polygon(0 22%, 100% 0, 100% 100%, 0 100%); background: repeating-linear-gradient(-14deg, transparent 0 46px, var(--on-accent) 46px 56px); -webkit-mask: linear-gradient(transparent 55%, #000 56%); mask: linear-gradient(transparent 55%, #000 56%); }
.s-login-num { position: absolute; left: var(--space-12); bottom: 18%; font-family: var(--font-display); font-weight: 800; font-style: italic; font-size: 300px; line-height: .8; color: transparent; -webkit-text-stroke: 2px var(--line-strong); opacity: .5; }
.s-login-quote { position: relative; max-width: 420px; display: flex; flex-direction: column; gap: var(--space-3); }
.s-login-form { display: flex; align-items: center; justify-content: center; padding: var(--space-12) var(--space-6); }
.s-login-card { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: var(--space-5); }
.s-login-card h1 { font-family: var(--font-display); font-weight: 800; font-size: 44px; line-height: 1; text-transform: uppercase; }
.s-check { display: flex; align-items: center; gap: var(--space-2); font-size: 14px; color: var(--ink-muted); cursor: pointer; }
.s-check input { width: 20px; height: 20px; accent-color: var(--accent); margin: 0; }
.s-login-row { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); }

/* mobile tab bar (admin) */
.s-tabbar { display: none; }

/* ───────── container breakpoints ───────── */
@container pg (max-width: 1279px) {
  .s-orders { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .s-why { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .s-masonry { columns: 3; }
  .s-detail { grid-template-columns: minmax(0, 1fr) 320px; }
  .s-item-head, .s-item { grid-template-columns: 150px minmax(0, 1.4fr) 80px 64px 104px 100px 36px; }
}
@container pg (max-width: 1023px) {
  .s-h1 { font-size: 76px; }
  .s-hero-grid, .s-contact, .s-prod, .s-dash, .s-detail, .s-form-layout { grid-template-columns: minmax(0, 1fr); }
  .s-prod.is-flip .s-prod-media { order: 0; }
  .s-detail-side { position: static; }
  .s-cats, .s-testis, .s-g3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .s-kpis, .s-g4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .s-orders { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .s-foot-grid { grid-template-columns: 1fr 1fr; }
  .s-login { grid-template-columns: minmax(0, 1fr); }
  .s-item-head { display: none; }
  .s-item { grid-template-columns: repeat(6, minmax(0, 1fr)); row-gap: var(--space-2); }
  .s-item .s-lbl { display: block; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-muted); margin-bottom: 4px; }
  .s-item > :nth-child(1) { grid-column: span 3; } .s-item > :nth-child(2) { grid-column: span 3; }
  .s-item > :nth-child(3) { grid-column: span 2; } .s-item > :nth-child(4) { grid-column: span 1; } .s-item > :nth-child(5) { grid-column: span 2; }
  .s-item > :nth-child(6) { grid-column: span 1; align-self: end; } .s-item > :nth-child(7) { grid-column: 6; grid-row: 1; justify-self: end; }
}
@container pg (max-width: 767px) {
  .s-wrap { padding: 0 var(--space-4); }
  .s-sec { padding: var(--space-12) 0; }
  .s-h1 { font-size: 56px; }
  .s-pagehead .s-h1 { font-size: 52px; }
  .s-pagehead { padding: var(--space-8) 0 calc(var(--space-8) + var(--cut-angle)); }
  .s-h2 { font-size: 36px; }
  .s-lead { font-size: 16px; line-height: 24px; }
  .s-head, .s-head-row { margin-bottom: var(--space-8); }
  .s-hero { padding: var(--space-8) 0 calc(var(--space-16) + 32px); }
  .s-hero-grid { gap: var(--space-8); }
  .s-hero-num { font-size: 160px; }
  .s-cut { --cut-angle: 32px; padding: calc(var(--space-12) + 32px) 0; }
  .s-cats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
  .s-cats .csp-cat-title { font-size: 20px; }
  .s-cats .csp-cat-desc { display: none; }
  .s-cats .csp-cat-body { padding: var(--space-2) var(--space-3) var(--space-4); }
  .s-why { grid-template-columns: minmax(0, 1fr); gap: var(--space-3); }
  .s-why-item { flex-direction: row; align-items: flex-start; padding: var(--space-4); }
  .s-why-item > div { display: flex; flex-direction: column; gap: 4px; }
  .s-why-icon { flex: none; width: 44px; height: 44px; }
  .s-testis { display: grid; grid-auto-flow: column; grid-template-columns: none; grid-auto-columns: 86%; overflow-x: auto; scroll-snap-type: x mandatory; gap: var(--space-3); scrollbar-width: none; }
  .s-testis > * { scroll-snap-align: start; }
  .s-strip { grid-auto-columns: 72%; }
  .s-foot-grid { grid-template-columns: minmax(0, 1fr); gap: var(--space-6); }
  .s-foot { padding-bottom: 96px; }
  .s-g2, .s-g3, .s-formgrid, .s-custom, .s-cards2 { grid-template-columns: minmax(0, 1fr); }
  .s-prod { padding: var(--space-12) 0; gap: var(--space-6); }
  .s-prod-media { grid-template-columns: 1fr 1fr; grid-template-rows: auto auto; aspect-ratio: auto; }
  .s-prod-media > div:first-child { grid-column: span 2; grid-row: auto; aspect-ratio: 4 / 3; }
  .s-prod-media > div:not(:first-child) { aspect-ratio: 1 / 1; }
  .s-masonry { columns: 2; column-gap: var(--space-3); }
  .s-masonry > * { margin-bottom: var(--space-3); }
  .s-tile-cap strong { font-size: 16px; }
  .s-lb-stage { grid-template-columns: minmax(0, 1fr); }
  .s-lb-nav { display: none; }
  .s-lightbox { padding: var(--space-4); justify-content: center; }
  .s-formcard { padding: var(--space-5); border-radius: var(--radius-md); }
  .s-mbar { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); position: sticky; bottom: 0; z-index: 30; padding: var(--space-3) var(--space-4) var(--space-4); background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(12px); border-top: 1px solid var(--line); }
  .s-mbar .s-a-btn { height: 48px; padding: 0 var(--space-3); }
  .s-anchors { top: 56px; }
  .csp-site-header-in { height: 56px; }

  /* admin on phones */
  .s-admin-side { display: none; }
  .s-body { padding: var(--space-5) var(--space-4) var(--space-8); gap: var(--space-5); }
  .s-ph-title h1 { font-size: 30px; }
  .s-ph { align-items: flex-start; }
  .s-ph-actions { width: 100%; }
  .s-ph-actions > * { flex: 1; }
  .s-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
  .s-kpis .csp-kpi { padding: var(--space-4); }
  .s-kpis .csp-kpi-icon { display: none; }
  .s-orders { grid-template-columns: minmax(0, 1fr); }
  .s-toolbar { padding: var(--space-3); }
  .s-toolbar .csp-field { flex: 1 1 140px; }
  .s-toolbar-end { width: 100%; margin-left: 0; justify-content: space-between; }
  .s-gallery { grid-template-columns: repeat(5, minmax(0, 1fr)); grid-template-rows: 200px 64px; height: auto; gap: var(--space-2); }
  .s-gallery > button:first-child { grid-column: 1 / -1; grid-row: auto; }
  .s-gallery > a { font-size: 0 !important; gap: 0 !important; }
  .s-status-row { grid-template-columns: 116px 1fr 28px; }
  .s-item { grid-template-columns: repeat(4, minmax(0, 1fr)); padding: var(--space-4); }
  .s-item > :nth-child(1) { grid-column: span 3; } .s-item > :nth-child(2) { grid-column: 1 / -1; }
  .s-item > :nth-child(3) { grid-column: span 2; } .s-item > :nth-child(4) { grid-column: span 2; } .s-item > :nth-child(5) { grid-column: span 2; }
  .s-item > :nth-child(6) { grid-column: span 2; } .s-item > :nth-child(7) { grid-column: 4; grid-row: 1; }
  .s-savebar { padding: var(--space-3) var(--space-4); }
  .s-savebar .s-cap { width: 100%; }
  .s-savebar > .csp-btn { flex: 1; }
  .s-toast-layer { right: var(--space-4); left: var(--space-4); width: auto; top: auto; bottom: 88px; position: fixed; }
  .s-overlay { padding: 96px 0 0; align-items: flex-start; }
  .s-overlay > .csp-modal, .s-overlay .csp-modal { border-radius: var(--radius-lg) var(--radius-lg) 0 0; max-width: none; }
  .s-overlay .csp-modal-foot .csp-btn { flex: 1; }
  .s-overlay .csp-cascade-list { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .s-profile-stripe { width: 140px; }
  .s-login-brand { padding: var(--space-6) var(--space-4); min-height: 200px; border-right: 0; border-bottom: 1px solid var(--line); }
  .s-login-num { font-size: 160px; left: auto; right: var(--space-4); bottom: 10%; }
  .s-login-quote { display: none; }
  .s-login-slab, .s-login-bands { width: 60%; height: 80%; }
  .s-login-form { align-items: flex-start; padding: var(--space-8) var(--space-4); }
  .s-login-card h1 { font-size: 36px; }

  /* logo lockups shrink to fit a phone */
  .s-login-brand .csp-logo-lg { gap: 12px; }
  .s-login-brand .csp-logo-lg .csp-logo-word, .s-login-brand .csp-logo-lg .csp-logo-mark { font-size: 56px; }
  .s-login-brand .csp-logo-lg .csp-logo-tag { font-size: 9.5px; }
  .s-foot .csp-logo-md { gap: 10px; }
  .s-foot .csp-logo-md .csp-logo-word, .s-foot .csp-logo-md .csp-logo-mark { font-size: 40px; }
  .s-foot .csp-logo-md .csp-logo-tag { font-size: 9.5px; }
  .csp-site-header .csp-logo-tag { font-size: 8px; letter-spacing: .12em; }

  /* responsive tables become stacked cards */
  .s-rt-wrap { border: 0; background: transparent; overflow: visible; }
  .s-rt, .s-rt tbody, .s-rt tr, .s-rt td, .s-rt tfoot { display: block; width: 100%; }
  .s-rt thead { display: none; }
  .s-rt tr { position: relative; margin-bottom: var(--space-3); padding: var(--space-3) var(--space-4); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-md); }
  .s-rt tbody tr:hover td { background: transparent; }
  .s-rt td { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); padding: 6px 0; border: 0; text-align: right; }
  .s-rt td::before { content: attr(data-label); font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-muted); text-align: left; }
  .s-rt td.is-lead { padding-bottom: var(--space-2); margin-bottom: 4px; border-bottom: 1px solid var(--line); text-align: left; padding-right: 88px; }
  .s-rt td.is-lead::before { display: none; }
  .s-rt td.is-acts { position: absolute; top: 6px; right: 6px; width: auto; padding: 0; }
  .s-rt td.is-acts::before { display: none; }
  .s-rt tfoot tr { background: var(--surface-2); }
  .s-rt tfoot td { border: 0; padding: 4px 0; }

  .s-tabbar { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); position: sticky; bottom: 0; z-index: 30; margin-top: auto; background: color-mix(in srgb, var(--surface) 94%, transparent); backdrop-filter: blur(12px); border-top: 1px solid var(--line); padding: 6px var(--space-2) var(--space-3); }
  .s-tab-i { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 0; border-radius: var(--radius-sm); font-size: 11px; line-height: 14px; font-weight: 600; color: var(--ink-muted) !important; text-decoration: none; }
  .s-tab-i.is-on { color: var(--ink) !important; }
  .s-tab-i.is-on .csp-icon { color: var(--accent-ink); }
  .s-tab-i.is-on::before { content: ""; width: 24px; height: 3px; border-radius: 2px; background: var(--accent-line); margin: -6px 0 3px; }

  /* system components: phone overrides keyed to the frame, not the window */
  .csp-site-nav, .csp-site-cta { display: none !important; }
  .csp-site-burger { display: inline-grid !important; }
  .csp-topbar { padding: 0 var(--space-4); gap: var(--space-2); }
  .csp-topbar-menu { display: inline-grid !important; }
  .csp-usermenu-text, .csp-search kbd { display: none !important; }
  .csp-cascade-list { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@container pg (min-width: 768px) {
  .csp-site-nav, .csp-site-cta { display: inline-flex !important; }
  .csp-site-burger, .csp-site-drawer { display: none !important; }
  .csp-topbar-menu { display: none !important; }
}

/* ───────── tablet (768–1023): sidebar becomes an icon rail, summaries move up ───────── */
@container pg (min-width: 768px) and (max-width: 1023px) {
  /* icon rail */
  .s-admin-side .csp-sidebar { width: var(--sidebar-collapsed); }
  .s-admin-side .csp-sidebar-top { justify-content: center; padding: 0; }
  .s-admin-side .csp-sidebar-top .csp-iconbtn, .s-admin-side .csp-logo-tag { display: none; }
  .s-admin-side .csp-logo-mark { display: none; }
  .s-admin-side .csp-logo-word .csp-logo-c { width: 36px; height: 36px; margin: 0; }
  .s-admin-side .csp-sidebar-nav { padding: var(--space-3) var(--space-2); align-items: center; }
  .s-admin-side .csp-sidebar-foot { padding: var(--space-3) var(--space-2); align-items: center; }
  .s-admin-side .csp-nav { width: 52px; justify-content: center; padding: 0; }
  .s-admin-side .csp-nav-label, .s-admin-side .csp-nav-tag, .s-admin-side .csp-sidebar-user { display: none; }
  .s-admin-side .csp-nav.is-on::before { left: -8px; }

  /* page chrome */
  .s-body { padding: var(--space-6) var(--space-6) var(--space-12); }
  .s-ph-title h1 { font-size: 30px; }
  .csp-topbar { padding: 0 var(--space-5); }
  .csp-search { max-width: none; }

  /* toolbar: search on its own row, filters share the next */
  .s-toolbar > :first-child { flex: 1 1 100% !important; }
  .s-toolbar .csp-field { flex: 1 1 150px; }
  .s-toolbar-end { margin-left: 0; align-self: flex-end; }

  /* order detail: money and customer first, side by side, then gallery and tabs */
  .s-detail-side { order: -1; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
  .s-gallery { height: 300px; }

  /* order form: the live summary sits beside nothing, so keep it compact */
  .s-form-layout .s-detail-side { order: 0; grid-template-columns: minmax(0, 1fr); }

  /* KPI cards: 2 × 2, a touch tighter */
  .s-kpis .csp-kpi { padding: var(--space-4) var(--space-5); }

  /* tables keep their columns and scroll sideways inside the frame */
  .s-rt { min-width: 680px; }
  .s-rt-wrap { -webkit-overflow-scrolling: touch; }

  /* profile: cards stack, header stripe narrower */
  .s-cards2 { grid-template-columns: minmax(0, 1fr); }
  .s-profile-stripe { width: 220px; }
}
@container pg (max-width: 420px) {
  .s-h1 { font-size: 52px; }
  .s-kpis .csp-kpi-value { font-size: 24px; }
}
```

---

## Appendix D.1 — src/lib/csps.ts

Domain types, formatting, the order math and option lists. Every figure in the UI comes from these functions.

```ts
/* CSPS — domain types, formatting and the order math (core data rule).
   Every figure shown wherever an order appears comes from orderTotals(). */

/* ───────────── domain types ───────────── */

export type OrderStatus = 'pending' | 'mockup' | 'production' | 'ready' | 'completed' | 'cancelled';
export type ProductType = 'Basketball Jersey' | 'Volleyball Jersey' | 'Moto Riding Jersey' | 'Long Sleeves' | 'Polo Shirt' | 'Custom Design';
export type PaymentMethod = 'Cash' | 'GCash' | 'Maya' | 'Bank Transfer';
export type ExpenseCategory = 'Rent' | 'Utilities' | 'Salaries' | 'Supplies' | 'Equipment' | 'Maintenance' | 'Others';
export type OrderExpenseCategory = 'Fabric' | 'Ink & paper' | 'Outsourcing' | 'Labor' | 'Delivery' | 'Others';
export type DiscountType = 'fixed' | 'percentage';
export type Role = 'admin' | 'manager';

export interface OrderItem {
  id?: string;
  productType?: ProductType;
  description?: string;
  size?: string;
  quantity: number;
  unitPrice: number;
}
export interface Payment {
  id?: string;
  date?: string; // ISO yyyy-mm-dd
  amount: number;
  method?: PaymentMethod;
  reference?: string;
  notes?: string;
}
export interface Discount {
  id?: string;
  reason?: string;
  type: DiscountType;
  value: number;
}
export interface OrderExpense {
  id?: string;
  date?: string;
  category?: OrderExpenseCategory | string;
  description?: string;
  amount: number;
}
export interface OrderImage {
  id: string;
  name?: string;
  /** Image URL. When absent, the UI shows a MediaPlaceholder. */
  src?: string;
  /** Jersey number shown big on the placeholder. */
  number?: string;
}
export interface Order {
  id?: string;
  number: string; // "ORD-2026-0148"
  customer: string;
  team?: string;
  contact?: string;
  email?: string;
  address?: string;
  orderDate: string;
  dueDate: string;
  status: OrderStatus;
  notes?: string;
  overdue?: boolean;
  images?: OrderImage[]; // index 0 = cover
  items?: OrderItem[];
  payments?: Payment[];
  discounts?: Discount[];
  expenses?: OrderExpense[];
}
export interface CompanyExpense {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  recordedBy: string;
}
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}
export interface Totals {
  total: number;
  discount: number;
  paid: number;
  balance: number;
  expenses: number;
  profit: number;
  fullyPaid: boolean;
}
export interface CascadeCounts {
  items?: number;
  payments?: number;
  discounts?: number;
  expenses?: number;
  images?: number;
}

/* ───────────── option lists ───────────── */

export const PRODUCT_TYPES: ProductType[] = ['Basketball Jersey', 'Volleyball Jersey', 'Moto Riding Jersey', 'Long Sleeves', 'Polo Shirt', 'Custom Design'];
export const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'GCash', 'Maya', 'Bank Transfer'];
export const EXPENSE_CATEGORIES: ExpenseCategory[] = ['Rent', 'Utilities', 'Salaries', 'Supplies', 'Equipment', 'Maintenance', 'Others'];
export const ORDER_EXPENSE_CATEGORIES: OrderExpenseCategory[] = ['Fabric', 'Ink & paper', 'Outsourcing', 'Labor', 'Delivery', 'Others'];
export const ORDER_STATUSES: Record<OrderStatus, string> = {
  pending: 'Pending',
  mockup: 'Mockup',
  production: 'In Production',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
export const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'mockup', 'production', 'ready'];

/* ───────────── formatting ───────────── */

const pesoFmt = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "₱12,450.00"; negatives "−₱732.50" (U+2212 minus). */
export function formatPeso(n: number | string | null | undefined): string {
  const v = Number(n) || 0;
  return (v < 0 ? '−₱' : '₱') + pesoFmt.format(Math.abs(v));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 6, 2026". Accepts ISO "2026-10-06" (treated as a local date) or a Date. Empty → "—". */
export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const x = d instanceof Date ? d : new Date(String(d).length === 10 ? d + 'T00:00:00' : d);
  if (Number.isNaN(x.getTime())) return String(d);
  return MONTHS[x.getMonth()] + ' ' + x.getDate() + ', ' + x.getFullYear();
}

/* ───────────── order math ───────────── */

export const round2 = (n: number | string | null | undefined): number => Math.round((Number(n) || 0) * 100) / 100;

/** fixed → value; percentage → value % of the items total. */
export function discountAmount(discount: Discount | null | undefined, itemsTotal: number): number {
  if (!discount) return 0;
  return round2(discount.type === 'percentage' ? (itemsTotal * (Number(discount.value) || 0)) / 100 : discount.value);
}

/**
 * Total = Σ qty × unit price · Discount = Σ discounts · Paid = Σ payments
 * Balance = Total − Discount − Paid · Expenses = Σ order expenses
 * Profit = Total − Discount − Expenses · Fully paid = Total > 0 and Balance ≤ 0
 */
export function orderTotals(order: Partial<Order> | null | undefined): Totals {
  const o = order ?? {};
  const total = round2((o.items ?? []).reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0));
  const discount = round2((o.discounts ?? []).reduce((s, d) => s + discountAmount(d, total), 0));
  const paid = round2((o.payments ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0));
  const expenses = round2((o.expenses ?? []).reduce((s, e) => s + (Number(e.amount) || 0), 0));
  const balance = round2(total - discount - paid);
  return { total, discount, paid, balance, expenses, profit: round2(total - discount - expenses), fullyPaid: total > 0 && balance <= 0 };
}

export const CASCADE_LABELS: ReadonlyArray<readonly [keyof CascadeCounts, string]> = [
  ['items', 'item'],
  ['payments', 'payment'],
  ['discounts', 'discount'],
  ['expenses', 'expense'],
  ['images', 'image'],
];

/** "This will also delete 5 items, 2 payments, 1 discount, 3 expenses, and 4 images." ('' when all zero) */
export function cascadeSentence(counts: CascadeCounts = {}): string {
  const parts = CASCADE_LABELS.map(([k, one]) => [counts[k] ?? 0, one] as const)
    .filter(([n]) => n > 0)
    .map(([n, one]) => n + ' ' + (n === 1 ? one : one + 's'));
  if (!parts.length) return '';
  const list = parts.length > 1 ? parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1] : parts[0];
  return 'This will also delete ' + list + '.';
}

export type StrengthScore = 0 | 1 | 2 | 3 | 4;
export function passwordStrength(pw = ''): { score: StrengthScore; label: '' | 'Weak' | 'Fair' | 'Good' | 'Strong' } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const score = (!pw ? 0 : Math.max(1, Math.min(4, s - (pw.length < 8 ? 1 : 0)))) as StrengthScore;
  return { score, label: (['', 'Weak', 'Fair', 'Good', 'Strong'] as const)[score] };
}

/** "ORD-2026-0148" from year + sequence. */
export const orderNumber = (year: number, seq: number): string => `ORD-${year}-${String(seq).padStart(4, '0')}`;
```

---

## Appendix D.2 — src/lib/csps.test.ts

Run with `npx vitest run`. All 7 tests must pass.

```ts
import { describe, expect, it } from 'vitest';
import { cascadeSentence, discountAmount, formatDate, formatPeso, orderNumber, orderTotals, passwordStrength, type Order } from './csps';

const ORD_0148: Order = {
  number: 'ORD-2026-0148', team: 'Brgy. San Roque Ballers', customer: 'Juan Dela Cruz', status: 'production',
  orderDate: '2026-09-28', dueDate: '2026-10-14',
  items: [
    { quantity: 15, unitPrice: 650 }, { quantity: 15, unitPrice: 300 }, { quantity: 2, unitPrice: 550 },
    { quantity: 15, unitPrice: 420 }, { quantity: 1, unitPrice: 800 },
  ],
  discounts: [{ type: 'percentage', value: 5 }],
  payments: [{ amount: 10000 }, { amount: 2000 }],
  expenses: [{ amount: 3825 }, { amount: 1640 }, { amount: 600 }],
  images: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
};

describe('orderTotals', () => {
  it('matches the approved ORD-2026-0148 figures', () => {
    const t = orderTotals(ORD_0148);
    expect(t).toEqual({ total: 22450, discount: 1122.5, paid: 12000, balance: 9327.5, expenses: 6065, profit: 15262.5, fullyPaid: false });
    expect(formatPeso(t.balance)).toBe('₱9,327.50');
    expect(formatPeso(-t.discount)).toBe('−₱1,122.50');
  });
  it('marks ORD-2026-0151 fully paid', () => {
    const t = orderTotals({ items: [{ quantity: 20, unitPrice: 1150 }], discounts: [{ type: 'fixed', value: 500 }], payments: [{ amount: 12000 }, { amount: 10500 }] });
    expect(t.balance).toBe(0);
    expect(t.fullyPaid).toBe(true);
  });
  it('is not fully paid when empty', () => {
    expect(orderTotals({}).fullyPaid).toBe(false);
  });
  it('applies percentage discounts to the items total', () => {
    expect(discountAmount({ type: 'percentage', value: 5 }, 22450)).toBe(1122.5);
    expect(discountAmount({ type: 'fixed', value: 500 }, 22450)).toBe(500);
  });
});

describe('formatting', () => {
  it('formats pesos and dates', () => {
    expect(formatPeso(38226.95)).toBe('₱38,226.95');
    expect(formatPeso(0)).toBe('₱0.00');
    expect(formatDate('2026-10-06')).toBe('Oct 6, 2026');
    expect(formatDate(undefined)).toBe('—');
    expect(orderNumber(2026, 148)).toBe('ORD-2026-0148');
  });
  it('builds the cascade sentence', () => {
    expect(cascadeSentence({ items: 5, payments: 2, discounts: 1, expenses: 3, images: 4 }))
      .toBe('This will also delete 5 items, 2 payments, 1 discount, 3 expenses, and 4 images.');
    expect(cascadeSentence({ items: 1 })).toBe('This will also delete 1 item.');
    expect(cascadeSentence({})).toBe('');
  });
  it('scores passwords', () => {
    expect(passwordStrength('').label).toBe('');
    expect(passwordStrength('Csp!Volt26').label).toBe('Strong');
  });
});
```

---

## Appendix D.3 — src/ui/index.tsx

Every design-system component, typed. It also re-exports everything from `@/lib/csps`, so pages can `import { OrderCard, formatPeso } from "@/ui"`. Keep every class name, DOM node and string.

```tsx
/* CSPS design-system components — React + TypeScript port of the approved reference.
   DOM structure, class names and copy are identical to the reference. Styling lives in
   src/styles/components.css (.csp-*) — do not restyle these components with Tailwind utilities. */
import {
  createContext, useContext, useEffect, useId, useRef, useState,
  type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ComponentType, type InputHTMLAttributes,
  type ReactNode, type SelectHTMLAttributes, type SVGProps, type TextareaHTMLAttributes,
} from 'react';
import clsx from 'clsx';
import { ICONS, type IconName } from './icons';
import { MARK_SVG } from './mark';
import {
  CASCADE_LABELS, ORDER_STATUSES, cascadeSentence, formatDate, formatPeso, orderTotals, passwordStrength,
  type CascadeCounts, type Order, type OrderImage, type OrderStatus, type Role, type Totals,
} from '../lib/csps';

export * from '../lib/csps';
export type { IconName };

/* ───────────── links (router-agnostic) ─────────────
   Wrap the app once: <LinkProvider component={RouterLink}>…</LinkProvider>
   (React Router's <Link to> renders a plain <a>, so the DOM matches the reference). */

type LinkComponent = ComponentType<{ to: string; className?: string; children?: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>>;
const LinkCtx = createContext<LinkComponent | null>(null);
export function LinkProvider({ component, children }: { component: LinkComponent; children: ReactNode }) {
  return <LinkCtx.Provider value={component}>{children}</LinkCtx.Provider>;
}
export type UiLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string };
export function UiLink({ to, ...rest }: UiLinkProps) {
  const L = useContext(LinkCtx);
  const external = /^(https?:|mailto:|tel:|#)/.test(to);
  return L && !external ? <L to={to} {...rest} /> : <a href={to} {...rest} />;
}

/* ───────────── Icon ───────────── */

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  label?: string;
}
export function Icon({ name, size = 20, strokeWidth = 2, className, label, ...rest }: IconProps) {
  const nodes = ICONS[name];
  if (!nodes) return null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={clsx('csp-icon', className)}
      aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label} {...rest}
    >
      {nodes.map(([Tag, attrs], i) => {
        const T = Tag as 'path';
        return <T key={i} {...(attrs as SVGProps<SVGPathElement>)} />;
      })}
    </svg>
  );
}

/* ───────────── Brand ───────────── */

export interface MarkProps { size?: number; label?: string; className?: string }
/** The CSPS mark: a stitched C with a needle threaded through it. */
export function Mark({ size = 40, label, className }: MarkProps) {
  return (
    <svg
      className={clsx('csp-mark', className)} width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: MARK_SVG }}
    />
  );
}

const MARK_SIZE = { sm: 36, md: 56, lg: 104 } as const;
export interface LogoProps { size?: 'sm' | 'md' | 'lg'; variant?: 'full' | 'wordmark' | 'mark'; tagline?: boolean; className?: string }
/** [C]SPS — the mark stands in for the C. */
export function Logo({ size = 'md', tagline = true, variant = 'full', className }: LogoProps) {
  return (
    <span className={clsx('csp-logo', 'csp-logo-' + size, 'csp-logo-v-' + variant, className)} role="img" aria-label="CSPS — Carmen's Stitch & Printing Services">
      {variant === 'mark' && <Mark size={MARK_SIZE[size]} />}
      {variant === 'full' && (
        <span className="csp-logo-word" aria-hidden="true">
          <Mark size={MARK_SIZE[size]} className="csp-logo-c" />
          <span className="csp-logo-mark">SPS<span className="csp-logo-slash" /></span>
        </span>
      )}
      {variant === 'wordmark' && <span className="csp-logo-mark" aria-hidden="true">CSPS<span className="csp-logo-slash" /></span>}
      {variant !== 'mark' && tagline && <span className="csp-logo-tag" aria-hidden="true">Carmen's Stitch<br />&amp; Printing Services</span>}
    </span>
  );
}

export function StitchDivider({ label, className }: { label?: ReactNode; className?: string }) {
  return (
    <div className={clsx('csp-stitch-divider', className)} role="separator">
      {label && <span className="csp-stitch-label">{label}</span>}
    </div>
  );
}

export interface SectionCutProps { top?: boolean; bottom?: boolean; tone?: 'surface' | 'accent'; mesh?: boolean; children?: ReactNode; className?: string }
export function SectionCut({ top = true, bottom = true, tone = 'surface', mesh = false, children, className }: SectionCutProps) {
  return (
    <section className={clsx('csp-cut', top && 'csp-cut-top', bottom && 'csp-cut-bottom', 'csp-cut-' + tone, mesh && 'csp-mesh', className)}>
      <div className="csp-cut-inner">{children}</div>
    </section>
  );
}

export interface MediaPlaceholderProps { label?: string; number?: string | number; ratio?: string; className?: string }
export function MediaPlaceholder({ label, number, ratio = '4 / 3', className }: MediaPlaceholderProps) {
  return (
    <div className={clsx('csp-media-ph', 'csp-mesh', className)} style={{ aspectRatio: ratio }} role="img" aria-label={label ? label + ' (no image yet)' : 'No image yet'}>
      {number != null && number !== '' && <span className="csp-media-ph-num" aria-hidden="true">{number}</span>}
      <span className="csp-media-ph-label"><Icon name="image" size={16} />{label || 'No image yet'}</span>
    </div>
  );
}

/* ───────────── Actions ───────────── */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ghost-danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  block?: boolean;
}
export function Button({ variant = 'secondary', size = 'md', icon, iconRight, loading = false, block = false, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type} {...rest} disabled={disabled || loading} aria-busy={loading || undefined}
      className={clsx('csp-btn', 'csp-btn-' + variant, 'csp-btn-' + size, block && 'csp-btn-block', !children && 'csp-btn-icon', className)}
    >
      {loading ? <Icon name="loader-circle" size={18} className="csp-spin" /> : icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children != null && children !== false && <span>{children}</span>}
      {iconRight && !loading && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </button>
  );
}
/** Same look as Button, rendered as a link (the mockups use <a class="csp-btn …"> for navigation). */
export interface ButtonLinkProps extends UiLinkProps { variant?: ButtonVariant; size?: ButtonSize; icon?: IconName; iconRight?: IconName }
export function ButtonLink({ variant = 'secondary', size = 'md', icon, iconRight, className, children, ...rest }: ButtonLinkProps) {
  return (
    <UiLink {...rest} className={clsx('csp-btn', 'csp-btn-' + variant, 'csp-btn-' + size, className)}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </UiLink>
  );
}

/* ───────────── Status ───────────── */

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'info' | 'mockup' | 'danger' | 'solid';
export interface BadgeProps { tone?: BadgeTone; dot?: boolean; icon?: IconName; children?: ReactNode; className?: string }
export function Badge({ tone = 'neutral', dot = false, icon, children, className }: BadgeProps) {
  return (
    <span className={clsx('csp-badge', 'csp-badge-' + tone, className)}>
      {dot && <span className="csp-badge-dot" aria-hidden="true" />}
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<OrderStatus, BadgeTone> = { pending: 'neutral', mockup: 'mockup', production: 'warning', ready: 'info', completed: 'success', cancelled: 'danger' };
export const PAYMENT_TONE: Record<string, BadgeTone> = { GCash: 'info', Maya: 'success', Cash: 'neutral', 'Bank Transfer': 'mockup' };
export const EXPENSE_TONE: Record<string, BadgeTone> = { Rent: 'accent', Utilities: 'info', Salaries: 'mockup', Supplies: 'warning', Equipment: 'success', Maintenance: 'neutral', Others: 'neutral' };

export function StatusBadge({ status = 'pending', className }: { status?: OrderStatus; className?: string }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'} dot className={clsx('csp-status', className)}>{ORDER_STATUSES[status] ?? status}</Badge>;
}

export function Avatar({ name = '', size = 36, className }: { name?: string; size?: number; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  return <span className={clsx('csp-avatar', className)} style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }} aria-label={name}>{initials}</span>;
}

/* ───────────── Forms ───────────── */

type FieldBase = { label?: ReactNode; hint?: ReactNode; error?: string; prefix?: string; required?: boolean; className?: string; id?: string };
export type FieldProps =
  | (FieldBase & { multiline?: false } & Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'>)
  | (FieldBase & { multiline: true } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'prefix'>);
export function Field(props: FieldProps) {
  const { label, hint, error, prefix, required, multiline = false, id, className, ...rest } = props;
  const fid = useId();
  const iid = id || fid;
  const describedBy = error || hint ? iid + '-msg' : undefined;
  const common = { id: iid, className: 'csp-input', 'aria-invalid': !!error || undefined, 'aria-describedby': describedBy, required };
  return (
    <div className={clsx('csp-field', error && 'is-invalid', className)}>
      {label && <label className="csp-label" htmlFor={iid}>{label}{required && <span className="csp-req" aria-hidden="true"> *</span>}</label>}
      <div className={clsx('csp-control', prefix && 'has-prefix', multiline && 'is-multiline')}>
        {prefix && <span className="csp-prefix" aria-hidden="true">{prefix}</span>}
        {multiline
          ? <textarea {...common} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
          : <input {...common} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />}
      </div>
      {(error || hint) && (
        <p id={iid + '-msg'} className={error ? 'csp-msg csp-msg-error' : 'csp-msg'}>
          {error && <Icon name="triangle-alert" size={14} />}{error || hint}
        </p>
      )}
    </div>
  );
}

export interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue'> {
  label?: string; showStrength?: boolean; error?: string; hint?: ReactNode; value?: string; defaultValue?: string;
}
export function PasswordField({ label = 'Password', showStrength = false, value, defaultValue, onChange, error, hint, ...rest }: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  const [inner, setInner] = useState(defaultValue ?? '');
  const v = value ?? inner;
  const st = passwordStrength(v);
  const fid = useId();
  return (
    <div className={clsx('csp-field', error && 'is-invalid')}>
      <label className="csp-label" htmlFor={fid}>{label}</label>
      <div className="csp-control has-suffix">
        <input
          id={fid} className="csp-input" type={shown ? 'text' : 'password'} value={v} aria-invalid={!!error || undefined}
          aria-describedby={error || hint ? fid + '-msg' : undefined}
          onChange={(e) => { setInner(e.target.value); onChange?.(e); }} {...rest}
        />
        <button type="button" className="csp-suffix-btn" onClick={() => setShown(!shown)} aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown}>
          <Icon name={shown ? 'eye-off' : 'eye'} size={18} />
        </button>
      </div>
      {showStrength && (
        <div className={clsx('csp-strength', 'is-' + st.score)} aria-live="polite">
          <div className="csp-strength-bars" aria-hidden="true">{[1, 2, 3, 4].map((i) => <span key={i} className={i <= st.score ? 'on' : ''} />)}</div>
          <span className="csp-strength-label">{v ? st.label : 'Use 8+ characters with a number and a symbol'}</span>
        </div>
      )}
      {(error || hint) && <p id={fid + '-msg'} className={error ? 'csp-msg csp-msg-error' : 'csp-msg'}>{error && <Icon name="triangle-alert" size={14} />}{error || hint}</p>}
    </div>
  );
}

export type SelectOption = string | { value: string; label: string };
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { label?: ReactNode; options: readonly SelectOption[]; placeholder?: string; error?: string; hint?: ReactNode }
export function Select({ label, options = [], placeholder, error, hint, className, ...rest }: SelectProps) {
  const fid = useId();
  return (
    <div className={clsx('csp-field', error && 'is-invalid', className)}>
      {label && <label className="csp-label" htmlFor={fid}>{label}</label>}
      <div className="csp-control csp-select">
        <select id={fid} className="csp-input" aria-invalid={!!error || undefined} {...rest}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => {
            const v = typeof o === 'string' ? o : o.value;
            return <option key={v} value={v}>{typeof o === 'string' ? o : o.label}</option>;
          })}
        </select>
        <Icon name="chevron-down" size={18} className="csp-select-chev" />
      </div>
      {(error || hint) && <p className={error ? 'csp-msg csp-msg-error' : 'csp-msg'}>{error || hint}</p>}
    </div>
  );
}

export interface SegmentOption<V extends string = string> { value: V; label: string; icon?: IconName; showLabel?: boolean }
export interface SegmentedControlProps<V extends string = string> { options: readonly SegmentOption<V>[]; value?: V; onChange?: (v: V) => void; label?: string }
export function SegmentedControl<V extends string = string>({ options = [], value, onChange, label }: SegmentedControlProps<V>) {
  const [inner, setInner] = useState<V | undefined>(value ?? options[0]?.value);
  const cur = value ?? inner;
  return (
    <div className="csp-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={cur === o.value} className={clsx('csp-seg-btn', cur === o.value && 'is-on')}
          onClick={() => { setInner(o.value); onChange?.(o.value); }} aria-label={o.label && !o.showLabel && o.icon ? o.label : undefined} title={o.label}>
          {o.icon && <Icon name={o.icon} size={18} />}
          {(o.showLabel || !o.icon) && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}

export interface TabItem<I extends string = string> { id: I; label: string; count?: number }
export interface TabsProps<I extends string = string> { items: readonly TabItem<I>[]; value?: I; onChange?: (id: I) => void }
export function Tabs<I extends string = string>({ items = [], value, onChange }: TabsProps<I>) {
  const [inner, setInner] = useState<I | undefined>(value ?? items[0]?.id);
  const cur = value ?? inner;
  return (
    <div className="csp-tabs" role="tablist">
      {items.map((t) => (
        <button key={t.id} role="tab" type="button" aria-selected={cur === t.id} className={clsx('csp-tab', cur === t.id && 'is-on')}
          onClick={() => { setInner(t.id); onChange?.(t.id); }}>
          {t.label}{t.count != null && <span className="csp-tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Drag-drop or browse; thumbnails; drag to reorder; the first image is the cover. */
export interface ImageUploaderProps { images?: OrderImage[]; defaultImages?: OrderImage[]; onChange?: (images: OrderImage[]) => void; onFiles?: (files: File[]) => void; max?: number }
export function ImageUploader({ images, defaultImages = [], onChange, onFiles, max = 12 }: ImageUploaderProps) {
  const [inner, setInner] = useState<OrderImage[]>(defaultImages);
  const list = images ?? inner;
  const set = (next: OrderImage[]) => { setInner(next); onChange?.(next); };
  const [over, setOver] = useState(false);
  const dragFrom = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const addFiles = (files: FileList | null) => {
    const picked = Array.from(files ?? []).filter((f) => /^image\//.test(f.type)).slice(0, max - list.length);
    if (!picked.length) return;
    onFiles?.(picked);
    set(list.concat(picked.map((f, i) => ({ id: 'up-' + Date.now() + '-' + i, name: f.name, src: URL.createObjectURL(f) }))));
  };
  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = list.slice();
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    set(next);
  };
  return (
    <div className="csp-uploader">
      <div
        className={clsx('csp-drop', over && 'is-over')}
        onDragOver={(e) => { if (dragFrom.current == null) { e.preventDefault(); setOver(true); } }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (dragFrom.current == null) addFiles(e.dataTransfer.files); }}
      >
        <Icon name="cloud-upload" size={28} />
        <p className="csp-drop-title">Drag images here or <button type="button" className="csp-linkbtn" onClick={() => inputRef.current?.click()}>browse</button></p>
        <p className="csp-drop-hint">JPG, PNG or WEBP · up to 10 MB each · {list.length}/{max}</p>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      </div>
      {list.length > 0 && (
        <ul className="csp-thumbs" aria-label="Order images — drag to reorder; the first is the cover">
          {list.map((img, i) => (
            <li key={img.id} className={clsx('csp-thumb', i === 0 && 'is-cover')} draggable
              onDragStart={() => { dragFrom.current = i; }} onDragEnd={() => { dragFrom.current = null; }}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (dragFrom.current != null) move(dragFrom.current, i); dragFrom.current = null; }}>
              {img.src ? <img src={img.src} alt={img.name || 'Order image ' + (i + 1)} /> : <MediaPlaceholder label={img.name} number={img.number} ratio="1 / 1" />}
              {i === 0 && <span className="csp-thumb-cover">Cover</span>}
              <span className="csp-thumb-grip" aria-hidden="true"><Icon name="grip-vertical" size={16} /></span>
              <div className="csp-thumb-actions">
                {i > 0 && <button type="button" className="csp-thumb-btn" onClick={() => move(i, 0)} aria-label="Make cover image"><Icon name="star" size={14} /></button>}
                <button type="button" className="csp-thumb-btn" onClick={() => set(list.filter((x) => x.id !== img.id))} aria-label={'Remove ' + (img.name || 'image')}><Icon name="x" size={14} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────────── Data display ───────────── */

export function Money({ amount, size = 'md', tone, className }: { amount: number; size?: 'sm' | 'md' | 'lg'; tone?: 'success' | 'warning' | 'danger' | 'muted'; className?: string }) {
  return <span className={clsx('csp-money', 'csp-money-' + size, tone && 'tone-' + tone, className)}>{formatPeso(amount)}</span>;
}

export interface KpiCardProps { label: string; value: number | string; money?: boolean; icon?: IconName; delta?: number; deltaLabel?: string; hint?: string; loading?: boolean }
export function KpiCard({ label, value, money = true, icon, delta, deltaLabel, hint, loading = false }: KpiCardProps) {
  const up = delta != null && delta >= 0;
  return (
    <div className="csp-card csp-kpi" aria-busy={loading || undefined}>
      <div className="csp-kpi-head">
        <span className="csp-overline">{label}</span>
        {icon && <span className="csp-kpi-icon"><Icon name={icon} size={18} /></span>}
      </div>
      {loading ? <Skeleton width="70%" height={36} /> : <div className="csp-kpi-value">{money && typeof value === 'number' ? formatPeso(value) : value}</div>}
      {(delta != null || hint) && !loading && (
        <div className="csp-kpi-foot">
          {delta != null && <span className={clsx('csp-delta', up ? 'is-up' : 'is-down')}><Icon name={up ? 'trending-up' : 'trending-down'} size={14} />{Math.abs(delta)}%</span>}
          <span>{deltaLabel || hint}</span>
        </div>
      )}
    </div>
  );
}

/** variant "card" = compact block inside OrderCard; "panel" = order detail (adds expenses + profit). */
export function OrderTotals({ order, totals, variant = 'panel' }: { order?: Partial<Order>; totals?: Totals; variant?: 'card' | 'panel' }) {
  const t = totals ?? orderTotals(order);
  const rows: Array<[string, number]> = [['Total', t.total], ['Total Discount', -t.discount], ['Total Paid', -t.paid]];
  return (
    <div className={clsx('csp-totals', 'csp-totals-' + variant)}>
      <dl className="csp-totals-rows">
        {rows.map(([k, v]) => (
          <div key={k} className="csp-totals-row"><dt>{k}</dt><dd>{formatPeso(v)}</dd></div>
        ))}
      </dl>
      <div className={clsx('csp-balance', t.fullyPaid ? 'is-paid' : 'is-due')}>
        <span className="csp-overline">{t.fullyPaid ? 'Balance' : 'Balance due'}</span>
        {t.fullyPaid
          ? <span className="csp-balance-paid"><Icon name="circle-check" size={variant === 'card' ? 18 : 22} />Fully Paid</span>
          : <span className="csp-balance-value">{formatPeso(t.balance)}</span>}
      </div>
      {variant === 'panel' && (
        <dl className="csp-totals-rows csp-totals-internal">
          <div className="csp-totals-row"><dt>Order Expenses</dt><dd>{formatPeso(t.expenses)}</dd></div>
          <div className="csp-totals-row is-strong"><dt>Estimated Profit</dt><dd className={t.profit < 0 ? 'is-neg' : ''}>{formatPeso(t.profit)}</dd></div>
          <p className="csp-totals-note">Profit = Total − Discount − Expenses. Internal only.</p>
        </dl>
      )}
    </div>
  );
}

export interface OrderCardProps { order: Order; onView?: () => void; onEdit?: () => void; onDelete?: () => void }
export function OrderCard({ order, onView, onEdit, onDelete }: OrderCardProps) {
  const o = order;
  const t = orderTotals(o);
  const images = o.images ?? [];
  const cover = images[0];
  const qty = (o.items ?? []).reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  return (
    <article className="csp-card csp-order-card">
      <button type="button" className="csp-order-media" onClick={onView} aria-label={'View order ' + o.number}>
        {cover?.src ? <img src={cover.src} alt="" /> : <MediaPlaceholder label={cover ? cover.name : 'No images yet'} number={cover?.number} ratio="16 / 10" />}
        <span className="csp-order-status"><StatusBadge status={o.status} /></span>
        {images.length > 1 && <span className="csp-order-count"><Icon name="image" size={14} />{images.length}</span>}
      </button>
      <div className="csp-order-body">
        <div className="csp-order-head">
          <span className="csp-order-no">{o.number}</span>
          <span className="csp-order-qty">{qty} pcs</span>
        </div>
        <h3 className="csp-order-team">{o.team || o.customer}</h3>
        <p className="csp-order-cust">{o.team ? o.customer : ''}</p>
        <div className="csp-order-dates">
          <span><Icon name="calendar" size={14} />{formatDate(o.orderDate)}</span>
          <span className={clsx(o.overdue && 'is-overdue')}><Icon name="clock" size={14} />Due {formatDate(o.dueDate)}</span>
        </div>
        <OrderTotals totals={t} variant="card" />
      </div>
      <div className="csp-order-actions">
        <Button size="sm" variant="ghost" icon="eye" onClick={onView}>View</Button>
        <Button size="sm" variant="ghost" icon="pencil" onClick={onEdit}>Edit</Button>
        <Button size="sm" variant="ghost-danger" icon="trash-2" onClick={onDelete} aria-label={'Delete order ' + o.number} />
      </div>
    </article>
  );
}

export interface DataTableColumn<R> { key: string; label: ReactNode; align?: 'left' | 'right' | 'center'; width?: number | string; money?: boolean; render?: (row: R) => ReactNode }
export interface DataTableProps<R> { columns: DataTableColumn<R>[]; rows: R[]; rowKey?: keyof R & string; loading?: boolean; error?: string; empty?: ReactNode; caption?: string }
export function DataTable<R extends Record<string, unknown>>({ columns = [], rows = [], loading = false, error, empty, rowKey, caption }: DataTableProps<R>) {
  return (
    <div className="csp-table-wrap">
      <table className="csp-table">
        {caption && <caption className="csp-sr">{caption}</caption>}
        <thead><tr>{columns.map((c) => <th key={c.key} style={{ textAlign: c.align || 'left', width: c.width }} scope="col">{c.label}</th>)}</tr></thead>
        <tbody>
          {loading && [0, 1, 2, 3].map((i) => (
            <tr key={'sk' + i} aria-hidden="true">{columns.map((c) => <td key={c.key}><Skeleton width={c.align === 'right' ? '60%' : '80%'} height={14} /></td>)}</tr>
          ))}
          {!loading && error && <tr><td colSpan={columns.length}><div className="csp-table-state is-error"><Icon name="triangle-alert" size={18} />{error}</div></td></tr>}
          {!loading && !error && rows.length === 0 && <tr><td colSpan={columns.length}>{empty || <div className="csp-table-state">Nothing here yet.</div>}</td></tr>}
          {!loading && !error && rows.map((r, ri) => (
            <tr key={rowKey ? String(r[rowKey]) : ri}>
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align || 'left' }} className={c.money ? 'is-num' : undefined}>
                  {c.render ? c.render(r) : c.money ? formatPeso(r[c.key] as number) : (r[c.key] as ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Monthly income vs expenses — grouped bars, single axis. */
export interface ChartDatum { month: string; income: number; expenses: number }
export function IncomeExpenseChart({ data = [], height = 220 }: { data: ChartDatum[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expenses)));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const W = 640, H = height, L = 52, B = 28, T = 12;
  const gw = (W - L) / Math.max(1, data.length);
  const bw = Math.min(18, gw / 3.2);
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const ticks = [0, 0.5, 1].map((f) => top * f);
  const k = (v: number) => (v >= 1000 ? '₱' + Math.round(v / 1000) + 'k' : '₱' + v);
  const cur = hover != null ? data[hover] : undefined;
  return (
    <figure className="csp-chart">
      <div className="csp-chart-legend">
        <span><i className="sw-income" />Income (payments)</span>
        <span><i className="sw-expense" />Expenses (company + orders)</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly income versus expenses" onMouseLeave={() => setHover(null)}>
        {ticks.map((tv) => (
          <g key={tv}><line x1={L} x2={W} y1={y(tv)} y2={y(tv)} className="csp-chart-grid" /><text x={L - 8} y={y(tv) + 4} textAnchor="end" className="csp-chart-tick">{k(tv)}</text></g>
        ))}
        {data.map((d, i) => {
          const cx0 = L + gw * i + gw / 2;
          return (
            <g key={d.month} onMouseEnter={() => setHover(i)}>
              <rect x={L + gw * i} y={T} width={gw} height={H - T - B} fill="transparent" />
              {hover === i && <rect x={L + gw * i + 4} y={T} width={gw - 8} height={H - T - B} className="csp-chart-hover" rx="6" />}
              <path d={bar(cx0 - bw - 1, y(d.income), bw, H - B - y(d.income))} className="csp-chart-income" />
              <path d={bar(cx0 + 1, y(d.expenses), bw, H - B - y(d.expenses))} className="csp-chart-expense" />
              <text x={cx0} y={H - 8} textAnchor="middle" className="csp-chart-tick">{d.month}</text>
            </g>
          );
        })}
        <line x1={L} x2={W} y1={H - B} y2={H - B} className="csp-chart-axis" />
      </svg>
      {cur && hover != null && (
        <div className="csp-chart-tip" style={{ left: `calc(${((L + gw * hover + gw / 2) / W) * 100}% )` }}>
          <strong>{cur.month}</strong>
          <span><i className="sw-income" />Income {formatPeso(cur.income)}</span>
          <span><i className="sw-expense" />Expenses {formatPeso(cur.expenses)}</span>
          <span className="csp-chart-net">Net {formatPeso(cur.income - cur.expenses)}</span>
        </div>
      )}
    </figure>
  );
}
function bar(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  if (h <= 0) return '';
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/* ───────────── Overlays ───────────── */

export interface ModalProps {
  open?: boolean;
  title: string;
  description?: ReactNode;
  onClose?: () => void;
  footer?: ReactNode;
  variant?: 'center' | 'slideover';
  /** Render without the fixed .csp-overlay backdrop (used inside .s-overlay, as in the mockups). */
  inline?: boolean;
  children?: ReactNode;
}
export function Modal({ open = true, title, description, onClose, footer, variant = 'center', inline = false, children }: ModalProps) {
  useEffect(() => {
    if (!open || !onClose) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={clsx('csp-overlay', 'csp-overlay-' + variant, inline && 'is-inline')} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={clsx('csp-modal', 'csp-modal-' + variant)} role="dialog" aria-modal="true" aria-label={title}>
        <header className="csp-modal-head">
          <div>
            <h2 className="csp-modal-title">{title}</h2>
            {description && <p className="csp-modal-desc">{description}</p>}
          </div>
          {onClose && <button type="button" className="csp-iconbtn" onClick={onClose} aria-label="Close"><Icon name="x" size={20} /></button>}
        </header>
        <div className="csp-modal-body">{children}</div>
        {footer && <footer className="csp-modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  title?: string;
  message?: ReactNode;
  counts?: CascadeCounts;
  /** Type-to-confirm text (e.g. the order number). */
  confirmText?: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  inline?: boolean;
  loading?: boolean;
}
export function ConfirmDialog({ title = 'Delete this?', message, counts, confirmText, confirmLabel = 'Delete', onConfirm, onCancel, inline = false, loading = false }: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const ok = !confirmText || typed.trim() === confirmText;
  const cascade = counts ? cascadeSentence(counts) : '';
  return (
    <Modal open title={title} onClose={onCancel} inline={inline}
      footer={<><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button variant="danger" icon="trash-2" disabled={!ok} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <div className="csp-confirm">
        <span className="csp-confirm-icon"><Icon name="triangle-alert" size={22} /></span>
        <div>
          {message && <p className="csp-confirm-msg">{message}</p>}
          {cascade && counts && (
            <div className="csp-cascade" role="alert">
              <p className="csp-cascade-lead">{cascade}</p>
              <ul className="csp-cascade-list">
                {CASCADE_LABELS.map(([k, one]) => {
                  const n = counts[k] ?? 0;
                  return <li key={k} className={n === 0 ? 'is-zero' : ''}><span>{n}</span>{n === 1 ? one : k}</li>;
                })}
              </ul>
              <p className="csp-cascade-foot">This can't be undone.</p>
            </div>
          )}
          {confirmText && (
            <Field label={<>Type <strong>{confirmText}</strong> to confirm</>} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          )}
        </div>
      </div>
    </Modal>
  );
}

export type ToastTone = 'success' | 'danger' | 'info' | 'warning';
export interface ToastProps { tone?: ToastTone; title: string; message?: ReactNode; onClose?: () => void; action?: ReactNode }
const TOAST_ICON: Record<ToastTone, IconName> = { success: 'circle-check', danger: 'triangle-alert', info: 'info', warning: 'triangle-alert' };
export function Toast({ tone = 'success', title, message, onClose, action }: ToastProps) {
  return (
    <div className={clsx('csp-toast', 'csp-toast-' + tone)} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className="csp-toast-icon"><Icon name={TOAST_ICON[tone]} size={20} /></span>
      <div className="csp-toast-text"><strong>{title}</strong>{message && <span>{message}</span>}</div>
      {action}
      {onClose && <button type="button" className="csp-iconbtn" onClick={onClose} aria-label="Dismiss"><Icon name="x" size={18} /></button>}
    </div>
  );
}

/* ───────────── Navigation ───────────── */

export interface NavLinkItem { label: string; to: string }
export const SITE_LINKS: NavLinkItem[] = [
  { label: 'Home', to: '/' },
  { label: 'Products', to: '/products' },
  { label: 'Gallery', to: '/gallery' },
  { label: 'Contact', to: '/contact' },
];
export interface SiteHeaderProps { links?: NavLinkItem[]; active?: string; onQuote?: () => void }
export function SiteHeader({ links = SITE_LINKS, active = 'Home', onQuote }: SiteHeaderProps) {
  const [open, setOpen] = useState(false);
  return (
    <header className={clsx('csp-site-header', open && 'is-open')}>
      <div className="csp-site-header-in">
        <UiLink to="/" className="csp-site-logo"><Logo size="sm" /></UiLink>
        <nav className="csp-site-nav" aria-label="Main">
          {links.map((l) => <UiLink key={l.label} to={l.to} className={clsx('csp-site-link', l.label === active && 'is-on')} aria-current={l.label === active ? 'page' : undefined}>{l.label}</UiLink>)}
        </nav>
        <Button variant="primary" size="sm" iconRight="arrow-right" className="csp-site-cta" onClick={onQuote}>Get a Quote</Button>
        <button type="button" className="csp-iconbtn csp-site-burger" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}><Icon name={open ? 'x' : 'menu'} size={22} /></button>
      </div>
      {open && (
        <nav className="csp-site-drawer" aria-label="Mobile">
          {links.map((l) => <UiLink key={l.label} to={l.to} onClick={() => setOpen(false)} className={clsx('csp-site-dlink', l.label === active && 'is-on')}>{l.label}<Icon name="arrow-right" size={20} /></UiLink>)}
          <Button variant="primary" block iconRight="arrow-right" onClick={onQuote}>Get a Quote</Button>
        </nav>
      )}
    </header>
  );
}

export type AdminSection = 'dashboard' | 'orders' | 'expenses' | 'users' | 'profile';
export const ADMIN_NAV: Array<{ id: AdminSection; label: string; icon: IconName; to: string; manager?: boolean }> = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', to: '/admin' },
  { id: 'orders', label: 'Orders', icon: 'clipboard-list', to: '/admin/orders' },
  { id: 'expenses', label: 'Company Expenses', icon: 'receipt', to: '/admin/expenses' },
  { id: 'users', label: 'Users', icon: 'users', to: '/admin/users', manager: true },
  { id: 'profile', label: 'My Profile', icon: 'user-round', to: '/admin/profile' },
];
export interface SidebarProps { active?: AdminSection; role?: Role; collapsed?: boolean; defaultCollapsed?: boolean; onNavigate?: (id: AdminSection) => void; onLogout?: () => void; user?: { name: string } }
export function Sidebar({ active = 'dashboard', role = 'admin', collapsed: collapsedProp, defaultCollapsed = false, onNavigate, onLogout, user }: SidebarProps) {
  const [c, setC] = useState(defaultCollapsed);
  const collapsed = collapsedProp ?? c;
  return (
    <aside className={clsx('csp-sidebar', collapsed && 'is-collapsed')}>
      <div className="csp-sidebar-top">
        {collapsed ? <Logo size="sm" variant="mark" /> : <Logo size="sm" tagline={false} />}
        <button type="button" className="csp-iconbtn" onClick={() => setC(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <Icon name={collapsed ? 'panel-left-open' : 'panel-left-close'} size={18} />
        </button>
      </div>
      <nav className="csp-sidebar-nav" aria-label="Admin">
        {ADMIN_NAV.filter((n) => !n.manager || role === 'manager').map((n) => (
          <UiLink key={n.id} to={n.to} onClick={() => onNavigate?.(n.id)} className={clsx('csp-nav', active === n.id && 'is-on')} aria-current={active === n.id ? 'page' : undefined} title={collapsed ? n.label : undefined}>
            <Icon name={n.icon} size={20} /><span className="csp-nav-label">{n.label}</span>
            {n.manager && !collapsed && <span className="csp-nav-tag">Manager</span>}
          </UiLink>
        ))}
      </nav>
      <div className="csp-sidebar-foot">
        {user && !collapsed && (
          <div className="csp-sidebar-user"><Avatar name={user.name} size={32} /><div><strong>{user.name}</strong><span>{role === 'manager' ? 'Manager' : 'Admin'}</span></div></div>
        )}
        <a href="#" className="csp-nav" onClick={(e) => { e.preventDefault(); onLogout?.(); }} title={collapsed ? 'Logout' : undefined}><Icon name="log-out" size={20} /><span className="csp-nav-label">Logout</span></a>
      </div>
    </aside>
  );
}

export interface TopbarProps { user?: { name: string }; role?: Role; placeholder?: string; onMenu?: () => void; theme?: 'light' | 'dark'; onToggleTheme?: () => void; onSearch?: (q: string) => void }
export function Topbar({ user = { name: 'Carmen Reyes' }, role = 'manager', placeholder = 'Search orders, customers, teams…', onMenu, theme, onToggleTheme, onSearch }: TopbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key === '/' && !(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))) { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return (
    <div className="csp-topbar">
      <button type="button" className="csp-iconbtn csp-topbar-menu" aria-label="Open navigation" onClick={onMenu}><Icon name="menu" size={20} /></button>
      <label className="csp-search">
        <Icon name="search" size={18} />
        <input ref={inputRef} type="search" placeholder={placeholder} aria-label="Search" onKeyDown={(e) => { if (e.key === 'Enter') onSearch?.(e.currentTarget.value); }} />
        <kbd>/</kbd>
      </label>
      <div className="csp-topbar-right">
        {onToggleTheme && <button type="button" className="csp-iconbtn" onClick={onToggleTheme} aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}><Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} /></button>}
        <button type="button" className="csp-usermenu" aria-haspopup="menu">
          <Avatar name={user.name} size={32} />
          <span className="csp-usermenu-text"><strong>{user.name}</strong><span>{role === 'manager' ? 'Manager' : 'Admin'}</span></span>
          <Icon name="chevron-down" size={16} />
        </button>
      </div>
    </div>
  );
}

/* ───────────── Marketing ───────────── */

export interface CategoryCardProps { title: string; description: string; number?: string; image?: string; href?: string }
export function CategoryCard({ title, description, number, image, href = '/products' }: CategoryCardProps) {
  return (
    <UiLink to={href} className="csp-cat">
      <div className="csp-cat-media">
        {image ? <img src={image} alt="" /> : <MediaPlaceholder label={title} number={number} ratio="4 / 5" />}
      </div>
      <div className="csp-cat-body">
        <h3 className="csp-cat-title">{title}</h3>
        <p className="csp-cat-desc">{description}</p>
        <span className="csp-cat-link">Customize<Icon name="arrow-up-right" size={18} /></span>
      </div>
    </UiLink>
  );
}

export function ProcessSteps({ steps = [] }: { steps: Array<{ title: string; description: string; icon?: IconName }> }) {
  return (
    <ol className="csp-steps">
      {steps.map((s, i) => (
        <li key={i} className="csp-step">
          <span className="csp-step-no" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
          {s.icon && <span className="csp-step-icon"><Icon name={s.icon} size={22} /></span>}
          <h3 className="csp-step-title">{s.title}</h3>
          <p className="csp-step-desc">{s.description}</p>
        </li>
      ))}
    </ol>
  );
}

export function TestimonialCard({ quote, name, team, rating = 5 }: { quote: string; name: string; team: string; rating?: number }) {
  return (
    <figure className="csp-testi">
      <div className="csp-testi-stars" aria-label={rating + ' out of 5'}>{[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" size={16} className={i <= rating ? 'on' : ''} />)}</div>
      <blockquote className="csp-testi-quote">{quote}</blockquote>
      <figcaption className="csp-testi-by"><Avatar name={name} size={40} /><span><strong>{name}</strong><span>{team}</span></span></figcaption>
    </figure>
  );
}

/* ───────────── Feedback ───────────── */

export function EmptyState({ icon = 'clipboard-list', title, message, action }: { icon?: IconName; title: string; message?: ReactNode; action?: ReactNode }) {
  return (
    <div className="csp-empty">
      <span className="csp-empty-icon"><Icon name={icon} size={28} /></span>
      <h3 className="csp-empty-title">{title}</h3>
      {message && <p className="csp-empty-msg">{message}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ width = '100%', height = 16, radius, className }: { width?: number | string; height?: number | string; radius?: number | string; className?: string }) {
  return <span className={clsx('csp-skel', className)} style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

/* ───────────── Toast queue (auto-dismiss 4.5 s, newest on top, max 3) ───────────── */

export interface ToastItem extends Omit<ToastProps, 'onClose'> { id: number }
const ToastCtx = createContext<(t: Omit<ToastItem, 'id'>) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const push = (t: Omit<ToastItem, 'id'>) => {
    const id = ++seq.current;
    setList((l) => [{ ...t, id }, ...l].slice(0, 3));
    window.setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 4500);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {list.length > 0 && (
        <div className="s-toast-layer">
          {list.map(({ id, ...t }) => <Toast key={id} {...t} onClose={() => setList((l) => l.filter((x) => x.id !== id))} />)}
        </div>
      )}
    </ToastCtx.Provider>
  );
}
```

---

## Appendix D.4 — src/ui/mark.ts

Inner SVG markup of the CSPS mark. The ring and stitch read `--csp-mark-ring` / `--csp-mark-stitch`, so dark theme recolors them.

```ts
// CSPS mark — inner SVG markup (viewBox 0 0 512 512). Ring and stitch read --csp-mark-ring / --csp-mark-stitch.
export const MARK_SVG: string = "<rect width=\"512\" height=\"512\" rx=\"118\" fill=\"#ff6600\"/>\n  <path d=\"M423.4,145.6 L415.7,134.5 L407.0,124.1 L397.5,114.5 L387.1,105.8 L375.9,98.0 L364.0,91.2 L351.5,85.5 L338.4,80.8 L324.8,77.2 L310.7,74.7 L296.4,73.3 L281.8,73.0 L267.1,73.9 L252.2,75.9 L237.5,79.1 L222.8,83.3 L208.3,88.6 L194.1,94.9 L180.3,102.3 L166.9,110.6 L154.1,119.8 L141.8,129.8 L130.3,140.7 L119.5,152.2 L109.5,164.5 L100.5,177.3 L92.3,190.6 L85.1,204.4 L79.0,218.5 L73.9,232.8 L69.9,247.4 L67.0,262.0 L65.3,276.6 L64.6,291.2 L65.2,305.5 L66.9,319.6 L69.7,333.4 L73.6,346.7 L78.7,359.5 L84.7,371.8 L91.9,383.3 L100.0,394.2 L109.0,404.2 L118.9,413.4 L129.7,421.7 L141.2,429.1 L153.4,435.4 L166.2,440.7 L179.5,444.9 L193.3,448.1 L207.5,450.1 L221.9,451.0 L236.6,450.7 L251.4,449.3 L266.2,446.8 L281.0,443.2 L295.6,438.5 L309.9,432.8 L324.0,426.0 L337.6,418.2 L350.8,409.5 L363.4,399.9 L375.3,389.5 L386.5,378.4 L332.6,330.3 L326.1,336.9 L319.0,343.0 L311.7,348.6 L303.9,353.8 L295.9,358.3 L287.7,362.3 L279.2,365.7 L270.7,368.4 L262.0,370.5 L253.3,372.0 L244.6,372.8 L236.0,373.0 L227.5,372.5 L219.2,371.3 L211.1,369.4 L203.2,367.0 L195.7,363.8 L188.6,360.1 L181.8,355.8 L175.5,350.9 L169.7,345.5 L164.4,339.6 L159.6,333.3 L155.4,326.5 L151.8,319.3 L148.9,311.7 L146.6,303.9 L144.9,295.8 L143.9,287.6 L143.6,279.1 L144.0,270.6 L145.0,262.0 L146.7,253.4 L149.0,244.9 L152.0,236.4 L155.6,228.2 L159.9,220.1 L164.6,212.3 L170.0,204.7 L175.8,197.5 L182.2,190.7 L189.0,184.4 L196.1,178.5 L203.7,173.1 L211.5,168.2 L219.6,163.9 L228.0,160.2 L236.5,157.0 L245.1,154.6 L253.8,152.7 L262.5,151.5 L271.2,151.0 L279.7,151.2 L288.2,152.0 L296.4,153.5 L304.4,155.6 L312.1,158.3 L319.5,161.7 L326.4,165.7 L333.0,170.2 L339.1,175.4 L344.7,181.0 L349.8,187.1 L354.3,193.7 Z\" fill=\"var(--csp-mark-ring, #572e2b)\"/>\n  <path d=\"M374.0,150.5 L370.3,146.8 L366.3,143.2 L362.3,139.7 L358.0,136.5 L353.6,133.4 L349.1,130.6 L344.4,127.9 L339.6,125.4 L334.7,123.1 L329.6,121.0 L324.5,119.2 L319.2,117.5 L313.9,116.1 L308.4,114.9 L302.9,113.8 L297.4,113.1 L291.7,112.5 L286.0,112.1 L280.3,112.0 L274.5,112.1 L268.7,112.4 L262.9,112.9 L257.1,113.7 L251.2,114.7 L245.4,115.8 L239.6,117.2 L233.8,118.9 L228.1,120.7 L222.4,122.7 L216.7,125.0 L211.1,127.4 L205.6,130.1 L200.1,132.9 L194.7,135.9 L189.4,139.1 L184.2,142.5 L179.1,146.1 L174.2,149.8 L169.3,153.7 L164.6,157.8 L160.0,162.0 L155.6,166.4 L151.3,170.9 L147.1,175.5 L143.1,180.3 L139.3,185.2 L135.7,190.2 L132.2,195.3 L128.9,200.5 L125.8,205.8 L122.9,211.2 L120.2,216.6 L117.7,222.2 L115.4,227.7 L113.3,233.4 L111.4,239.1 L109.7,244.8 L108.3,250.5 L107.0,256.2 L106.0,262.0 L105.2,267.8 L104.6,273.5 L104.3,279.2 L104.1,284.9 L104.2,290.6 L104.5,296.3 L105.1,301.8 L105.8,307.4 L106.8,312.8 L108.0,318.2 L109.4,323.5 L111.1,328.7 L112.9,333.8 L115.0,338.8 L117.3,343.7 L119.7,348.5 L122.4,353.1 L125.3,357.6 L128.3,362.0 L131.6,366.2 L135.0,370.3 L138.6,374.2 L142.4,377.9 L146.4,381.5 L150.5,384.9 L154.8,388.1 L159.2,391.1 L163.8,393.9 L168.5,396.6 L173.3,399.0 L178.2,401.3 L183.3,403.3 L188.5,405.1 L193.7,406.8 L199.1,408.2 L204.6,409.3 L210.1,410.3 L215.7,411.1 L221.3,411.6 L227.0,411.9 L232.8,412.0 L238.5,411.9 L244.3,411.5 L250.2,410.9 L256.0,410.2 L261.8,409.1 L267.7,407.9 L273.5,406.5 L279.2,404.8 L285.0,403.0 L290.7,400.9 L296.3,398.6 L301.9,396.1 L307.4,393.4 L312.9,390.6 L318.3,387.5 L323.5,384.3 L328.7,380.8 L333.8,377.2 L338.7,373.5\" fill=\"none\" stroke=\"var(--csp-mark-stitch, #f6dfd1)\" stroke-width=\"7\" stroke-dasharray=\"20 13\" stroke-linecap=\"round\"/>\n  <path d=\"M96.0,470.0 L157.9,404.3 L415.1,93.3 L432.1,65.9 L430.0,54.0 L417.9,54.5 L394.8,77.1 L146.8,395.3 Z\" fill=\"#fff6f0\" stroke=\"#ff6600\" stroke-width=\"8\" paint-order=\"stroke\" stroke-linejoin=\"round\"/>\n  <path d=\"M372.4,125.7 L411.2,77.4\" stroke=\"#ff6600\" stroke-width=\"9\" stroke-linecap=\"round\"/>\n  <path d=\"M100.3,400.5 L102.3,402.6 L104.2,404.8 L106.3,406.8 L108.3,408.9 L110.4,410.9 L112.5,412.9 L114.7,414.8 L116.9,416.7 L119.2,418.5 L121.4,420.3 L123.7,422.1 L126.1,423.8 L128.5,425.5 L130.9,427.1 L133.3,428.7 L135.8,430.3 L138.3,431.8 L140.9,433.2 L143.5,434.6 L146.1,436.0 L148.7,437.3 L151.4,438.6 L154.1,439.8 L156.8,441.0 L159.5,442.1 L162.3,443.2 L165.1,444.2 L167.9,445.2 L170.8,446.2 L173.6,447.0 M169.1,339.3 L170.2,340.5 L171.3,341.7 L172.4,342.9 L173.5,344.0 L174.7,345.1 L175.9,346.2 L177.1,347.3 L178.3,348.4 L179.6,349.4 L180.9,350.4 L182.1,351.4 L183.5,352.4 L184.8,353.3 L186.1,354.2 L187.5,355.1 L188.9,356.0 L190.3,356.8 L191.7,357.6 L193.2,358.4 L194.6,359.2 L196.1,359.9 L197.6,360.6 L199.1,361.3 L200.6,362.0 L202.1,362.6 L203.7,363.2 L205.2,363.8 L206.8,364.3 L208.4,364.8 L210.0,365.3\" fill=\"none\" stroke=\"#ff6600\" stroke-width=\"7\"/>\n  <path d=\"M92.0,383.5 L93.1,385.1 L94.2,386.6 L95.3,388.2 L96.4,389.7 L97.6,391.2 L98.8,392.7 L100.0,394.2 L101.2,395.6 L102.4,397.1 L103.7,398.5 L105.0,399.9 L106.2,401.3 L107.6,402.7 L108.9,404.1 L110.2,405.4 L111.6,406.8 L113.0,408.1 L114.4,409.4 L115.8,410.7 L117.2,411.9 L118.6,413.2 L120.1,414.4 L121.6,415.6 L123.1,416.8 L124.6,418.0 L126.1,419.1 L127.6,420.3 L129.2,421.4 L130.8,422.5 L132.4,423.6 L134.0,424.6 L135.6,425.7 L137.2,426.7 L138.8,427.7 L140.5,428.7 L142.2,429.6 L143.9,430.6 L145.6,431.5 L147.3,432.4 L149.0,433.3 L150.7,434.2 L152.5,435.0 L154.2,435.8 L156.0,436.6 L157.8,437.4 L159.6,438.1 L161.4,438.9 L163.2,439.6 L165.1,440.3 L166.9,441.0 L168.8,441.6 L170.6,442.3 L172.5,442.9 L174.4,443.4 L176.3,444.0 L178.2,444.6 L180.1,445.1 L182.0,445.6 L183.9,446.1 L185.9,446.5 L187.8,447.0 L189.8,447.4 L191.7,447.8 L193.7,448.1 L219.4,371.3 L218.3,371.1 L217.1,370.9 L216.0,370.6 L214.8,370.4 L213.7,370.1 L212.5,369.8 L211.4,369.5 L210.3,369.2 L209.2,368.9 L208.1,368.6 L207.0,368.2 L205.9,367.9 L204.8,367.5 L203.7,367.1 L202.6,366.7 L201.5,366.3 L200.4,365.9 L199.4,365.5 L198.3,365.0 L197.3,364.6 L196.2,364.1 L195.2,363.6 L194.2,363.1 L193.2,362.6 L192.1,362.1 L191.1,361.6 L190.1,361.0 L189.2,360.5 L188.2,359.9 L187.2,359.3 L186.2,358.7 L185.3,358.1 L184.3,357.5 L183.4,356.9 L182.5,356.3 L181.5,355.6 L180.6,355.0 L179.7,354.3 L178.8,353.6 L177.9,352.9 L177.1,352.2 L176.2,351.5 L175.3,350.8 L174.5,350.1 L173.6,349.3 L172.8,348.6 L172.0,347.8 L171.2,347.0 L170.4,346.2 L169.6,345.5 L168.8,344.7 L168.0,343.8 L167.3,343.0 L166.5,342.2 L165.8,341.3 L165.1,340.5 L164.4,339.6 L163.7,338.8 L163.0,337.9 L162.3,337.0 L161.6,336.1 L161.0,335.2 L160.3,334.3 L159.7,333.3 Z\" fill=\"var(--csp-mark-ring, #572e2b)\"/>\n  <path d=\"M125.8,358.4 L128.6,362.4 L131.6,366.2 L134.7,369.9 L138.0,373.5 L141.4,376.9 L144.9,380.2 L148.6,383.4 L152.4,386.4 L156.4,389.2 L160.4,391.9 L164.6,394.4 L168.9,396.8 L173.3,399.0 L177.8,401.1 L182.4,403.0 L187.1,404.7 L191.8,406.2 L196.7,407.5 L201.6,408.7 L206.6,409.7\" fill=\"none\" stroke=\"var(--csp-mark-stitch, #f6dfd1)\" stroke-width=\"7\" stroke-dasharray=\"20 13\" stroke-linecap=\"round\"/>";
```

---

## Appendix D.5 — src/ui/icons.ts

Lucide v0.460.0 icon node data for the 57 icons in the design, with a typed `IconName`.

```ts
// Lucide v0.460.0 (ISC) — icon nodes. Each entry is [tag, attrs] drawn in a 24×24 viewBox.
export type IconNode = ReadonlyArray<readonly [string, Readonly<Record<string, string>>]>;
export const ICONS = {"plus":[["path",{"d":"M5 12h14"}],["path",{"d":"M12 5v14"}]],"x":[["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]],"eye":[["path",{"d":"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"}],["circle",{"cx":"12","cy":"12","r":"3"}]],"eye-off":[["path",{"d":"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"}],["path",{"d":"M14.084 14.158a3 3 0 0 1-4.242-4.242"}],["path",{"d":"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"}],["path",{"d":"m2 2 20 20"}]],"search":[["circle",{"cx":"11","cy":"11","r":"8"}],["path",{"d":"m21 21-4.3-4.3"}]],"trash-2":[["path",{"d":"M3 6h18"}],["path",{"d":"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"}],["path",{"d":"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"}],["line",{"x1":"10","x2":"10","y1":"11","y2":"17"}],["line",{"x1":"14","x2":"14","y1":"11","y2":"17"}]],"pencil":[["path",{"d":"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"}],["path",{"d":"m15 5 4 4"}]],"cloud-upload":[["path",{"d":"M12 13v8"}],["path",{"d":"M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"}],["path",{"d":"m8 17 4-4 4 4"}]],"image":[["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2","ry":"2"}],["circle",{"cx":"9","cy":"9","r":"2"}],["path",{"d":"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"}]],"grip-vertical":[["circle",{"cx":"9","cy":"12","r":"1"}],["circle",{"cx":"9","cy":"5","r":"1"}],["circle",{"cx":"9","cy":"19","r":"1"}],["circle",{"cx":"15","cy":"12","r":"1"}],["circle",{"cx":"15","cy":"5","r":"1"}],["circle",{"cx":"15","cy":"19","r":"1"}]],"chevron-down":[["path",{"d":"m6 9 6 6 6-6"}]],"chevron-left":[["path",{"d":"m15 18-6-6 6-6"}]],"chevron-right":[["path",{"d":"m9 18 6-6-6-6"}]],"layout-dashboard":[["rect",{"width":"7","height":"9","x":"3","y":"3","rx":"1"}],["rect",{"width":"7","height":"5","x":"14","y":"3","rx":"1"}],["rect",{"width":"7","height":"9","x":"14","y":"12","rx":"1"}],["rect",{"width":"7","height":"5","x":"3","y":"16","rx":"1"}]],"clipboard-list":[["rect",{"width":"8","height":"4","x":"8","y":"2","rx":"1","ry":"1"}],["path",{"d":"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"}],["path",{"d":"M12 11h4"}],["path",{"d":"M12 16h4"}],["path",{"d":"M8 11h.01"}],["path",{"d":"M8 16h.01"}]],"receipt":[["path",{"d":"M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"}],["path",{"d":"M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"}],["path",{"d":"M12 17.5v-11"}]],"users":[["path",{"d":"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}],["circle",{"cx":"9","cy":"7","r":"4"}],["path",{"d":"M22 21v-2a4 4 0 0 0-3-3.87"}],["path",{"d":"M16 3.13a4 4 0 0 1 0 7.75"}]],"user-round":[["circle",{"cx":"12","cy":"8","r":"5"}],["path",{"d":"M20 21a8 8 0 0 0-16 0"}]],"log-out":[["path",{"d":"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"}],["polyline",{"points":"16 17 21 12 16 7"}],["line",{"x1":"21","x2":"9","y1":"12","y2":"12"}]],"menu":[["line",{"x1":"4","x2":"20","y1":"12","y2":"12"}],["line",{"x1":"4","x2":"20","y1":"6","y2":"6"}],["line",{"x1":"4","x2":"20","y1":"18","y2":"18"}]],"phone":[["path",{"d":"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"}]],"message-circle":[["path",{"d":"M7.9 20A9 9 0 1 0 4 16.1L2 22Z"}]],"mail":[["rect",{"width":"20","height":"16","x":"2","y":"4","rx":"2"}],["path",{"d":"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"}]],"map-pin":[["path",{"d":"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"}],["circle",{"cx":"12","cy":"10","r":"3"}]],"clock":[["circle",{"cx":"12","cy":"12","r":"10"}],["polyline",{"points":"12 6 12 12 16 14"}]],"check":[["path",{"d":"M20 6 9 17l-5-5"}]],"circle-check":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"m9 12 2 2 4-4"}]],"triangle-alert":[["path",{"d":"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"}],["path",{"d":"M12 9v4"}],["path",{"d":"M12 17h.01"}]],"info":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 16v-4"}],["path",{"d":"M12 8h.01"}]],"layout-grid":[["rect",{"width":"7","height":"7","x":"3","y":"3","rx":"1"}],["rect",{"width":"7","height":"7","x":"14","y":"3","rx":"1"}],["rect",{"width":"7","height":"7","x":"14","y":"14","rx":"1"}],["rect",{"width":"7","height":"7","x":"3","y":"14","rx":"1"}]],"list":[["path",{"d":"M3 12h.01"}],["path",{"d":"M3 18h.01"}],["path",{"d":"M3 6h.01"}],["path",{"d":"M8 12h13"}],["path",{"d":"M8 18h13"}],["path",{"d":"M8 6h13"}]],"filter":[["polygon",{"points":"22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"}]],"calendar":[["path",{"d":"M8 2v4"}],["path",{"d":"M16 2v4"}],["rect",{"width":"18","height":"18","x":"3","y":"4","rx":"2"}],["path",{"d":"M3 10h18"}]],"arrow-right":[["path",{"d":"M5 12h14"}],["path",{"d":"m12 5 7 7-7 7"}]],"arrow-up-right":[["path",{"d":"M7 7h10v10"}],["path",{"d":"M7 17 17 7"}]],"star":[["path",{"d":"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"}]],"shirt":[["path",{"d":"M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"}]],"scissors":[["circle",{"cx":"6","cy":"6","r":"3"}],["path",{"d":"M8.12 8.12 12 12"}],["path",{"d":"M20 4 8.12 15.88"}],["circle",{"cx":"6","cy":"18","r":"3"}],["path",{"d":"M14.8 14.8 20 20"}]],"palette":[["circle",{"cx":"13.5","cy":"6.5","r":".5","fill":"currentColor"}],["circle",{"cx":"17.5","cy":"10.5","r":".5","fill":"currentColor"}],["circle",{"cx":"8.5","cy":"7.5","r":".5","fill":"currentColor"}],["circle",{"cx":"6.5","cy":"12.5","r":".5","fill":"currentColor"}],["path",{"d":"M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"}]],"zap":[["path",{"d":"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"}]],"truck":[["path",{"d":"M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"}],["path",{"d":"M15 18H9"}],["path",{"d":"M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"}],["circle",{"cx":"17","cy":"18","r":"2"}],["circle",{"cx":"7","cy":"18","r":"2"}]],"wallet":[["path",{"d":"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"}],["path",{"d":"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"}]],"trending-up":[["polyline",{"points":"22 7 13.5 15.5 8.5 10.5 2 17"}],["polyline",{"points":"16 7 22 7 22 13"}]],"trending-down":[["polyline",{"points":"22 17 13.5 8.5 8.5 13.5 2 7"}],["polyline",{"points":"16 17 22 17 22 11"}]],"quote":[["path",{"d":"M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"}],["path",{"d":"M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"}]],"package":[["path",{"d":"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"}],["path",{"d":"M12 22V12"}],["path",{"d":"m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"}],["path",{"d":"m7.5 4.27 9 5.15"}]],"ellipsis":[["circle",{"cx":"12","cy":"12","r":"1"}],["circle",{"cx":"19","cy":"12","r":"1"}],["circle",{"cx":"5","cy":"12","r":"1"}]],"sun":[["circle",{"cx":"12","cy":"12","r":"4"}],["path",{"d":"M12 2v2"}],["path",{"d":"M12 20v2"}],["path",{"d":"m4.93 4.93 1.41 1.41"}],["path",{"d":"m17.66 17.66 1.41 1.41"}],["path",{"d":"M2 12h2"}],["path",{"d":"M20 12h2"}],["path",{"d":"m6.34 17.66-1.41 1.41"}],["path",{"d":"m19.07 4.93-1.41 1.41"}]],"moon":[["path",{"d":"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"}]],"loader-circle":[["path",{"d":"M21 12a9 9 0 1 1-6.219-8.56"}]],"lock":[["rect",{"width":"18","height":"11","x":"3","y":"11","rx":"2","ry":"2"}],["path",{"d":"M7 11V7a5 5 0 0 1 10 0v4"}]],"panel-left-close":[["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2"}],["path",{"d":"M9 3v18"}],["path",{"d":"m16 15-3-3 3-3"}]],"panel-left-open":[["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2"}],["path",{"d":"M9 3v18"}],["path",{"d":"m14 9 3 3-3 3"}]],"shield-check":[["path",{"d":"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"}],["path",{"d":"m9 12 2 2 4-4"}]],"ruler":[["path",{"d":"M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"}],["path",{"d":"m14.5 12.5 2-2"}],["path",{"d":"m11.5 9.5 2-2"}],["path",{"d":"m8.5 6.5 2-2"}],["path",{"d":"m17.5 15.5 2-2"}]],"printer":[["path",{"d":"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"}],["path",{"d":"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"}],["rect",{"x":"6","y":"14","width":"12","height":"8","rx":"1"}]]} as const satisfies Record<string, IconNode>;
export type IconName = keyof typeof ICONS;
```

---

## Appendix D.6 — src/main.tsx

Font imports, then globals.css, then the app. Wrap the app in `<BrowserRouter>` + `<LinkProvider component={RouterLink}>` (see the next file).

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
// Fonts (self-hosted via @fontsource; all subsets incl. latin-ext for the ₱ glyph)
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/barlow-condensed/800-italic.css';
import '@fontsource-variable/archivo';
import './styles/globals.css';
import { LinkProvider } from '@/ui';
import { RouterLink } from '@/app/RouterLink';
import App from './App'; // your <Routes> (PublicLayout / AdminLayout per §1.1, §2.2)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LinkProvider component={RouterLink}>
        <App />
      </LinkProvider>
    </BrowserRouter>
  </StrictMode>,
);
```

---

## Appendix D.6b — src/app/RouterLink.tsx

React Router adapter used by `LinkProvider`.

```tsx
import { Link } from 'react-router';
import type { AnchorHTMLAttributes, ReactNode } from 'react';

/** Adapter so CSPS components navigate with React Router: <LinkProvider component={RouterLink}>. */
export function RouterLink({ to, ...rest }: { to: string; className?: string; children?: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return <Link to={to} {...rest} />;
}
```

---

## Appendix D.7 — vite.config.ts



```ts
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
```

---

## Appendix D.7b — tsconfig.json



```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": [
      "ES2022",
      "DOM",
      "DOM.Iterable"
    ],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": false,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": [
      "vite/client"
    ],
    "paths": {
      "@/*": [
        "./src/*"
      ]
    }
  },
  "include": [
    "src"
  ]
}
```

---

## Appendix D.7c — index.html



```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="/mark.svg" />
    <title>CSPS — Carmen's Stitch & Printing Services</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## Appendix E — Reference page markup (approved screens)

These are the exact screens from the design canvas.

These were written in a design-canvas template language. **Translate each one to a TSX page component (§2.9).** The structure, class names, copy and data must survive the translation unchanged.

**How to read the template syntax:**

- `<x-import component-from-global-scope="CSP.Button" variant="primary" icon-right="arrow-right">Save</x-import>` → `<Button variant="primary" iconRight="arrow-right">Save</Button>` from `@/ui`. Kebab-case attributes become camelCase props (`default-value` → `defaultValue`, `on-change` → `onChange`, `show-strength` → `showStrength`, `confirm-text` → `confirmText`). The full translation table is in §2.9.
- `{{name}}` → a value or handler returned by `renderVals()` in the page's `<script>`. For example, `{{n18}}` is just the number 18, `{{yes}}` is `true` and `{{no}}` is `false`.
- `<sc-for list="{{items}}" as="it">…</sc-for>` → `items.map(it => …)`.
- `<sc-if value="{{x}}">…</sc-if>` → `{x && …}`. Ignore every `hint-*` attribute.
- `class Component extends DCLogic` → the page's state and logic (`this.state` / `this.setState` behave like React class components). It also holds the sample data and the exact toast, error and confirmation copy.
- `href="Orders.dc.html"` → router link to the matching route (§1.1).
- `<div class="s-page" data-theme="{{theme}}">` → the page root; theme is `light` (Blush) or `dark` (Espresso).

**Tablet and phone frames** are the same pages rendered at 820 px and 390 px wide; they reflow purely through the container queries in Appendix C. The mockups show these states:

- Dashboard tablet in the Espresso (`dark`) theme
- Order Detail with `initial="payment"` (Add Payment modal open)
- Order Detail with `initial="delete"` (cascade confirm open; desktop in dark theme, phone as a bottom sheet)
- Expenses with `initial="add"` (validation errors showing)
- Users with `initial="create"` (Add User slide-over with an invalid email)
- Gallery with `initialLightbox=2`
- Login with `state="error"`

### E.1 Home — `/`

```html
<div class="s-page" data-theme="light">

<x-import component-from-global-scope="CSP.SiteHeader" active="Home"></x-import>

<!-- HERO -->
<section class="s-hero s-mesh">
  <div class="s-wrap s-hero-grid">
    <div class="s-hero-copy">
      <span class="s-eyebrow">Custom sublimation · Philippines</span>
      <h1 class="s-h1">Built for the <em>whole team.</em></h1>
      <p class="s-lead">Full-sublimation basketball, volleyball and moto jerseys — names, numbers and logos printed edge to edge. Send us your idea and we'll send back a mockup.</p>
      <div class="s-btnrow">
        <a class="s-a-btn s-a-primary" href="Contact.dc.html">Get a Quote <x-import component-from-global-scope="CSP.Icon" name="arrow-right" size="{{n20}}"></x-import></a>
        <a class="s-a-btn s-a-secondary" href="Gallery.dc.html">View Our Work</a>
      </div>
      <div class="s-chips">
        <span class="s-chip"><x-import component-from-global-scope="CSP.Icon" name="printer" size="{{n16}}"></x-import>Full sublimation</span>
        <span class="s-chip"><x-import component-from-global-scope="CSP.Icon" name="shirt" size="{{n16}}"></x-import>Names &amp; numbers</span>
        <span class="s-chip"><x-import component-from-global-scope="CSP.Icon" name="users" size="{{n16}}"></x-import>Team orders welcome</span>
      </div>
    </div>
    <div class="s-hero-art">
      <span class="s-hero-num">23</span>
      <div class="s-hero-slab2"></div>
      <div class="s-hero-slab"></div>
      <svg class="s-hero-jersey" viewBox="0 0 400 480" role="img" aria-label="Sample sublimated basketball jersey, number 23">
        <defs>
          <pattern id="hm" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#ffffff" fill-opacity=".06"></circle></pattern>
          <clipPath id="hc"><path d="M118,18 C150,74 250,74 282,18 L332,18 C332,108 356,148 384,160 L384,470 L16,470 L16,160 C44,148 68,108 68,18 Z"></path></clipPath>
        </defs>
        <path d="M118,18 C150,74 250,74 282,18 L332,18 C332,108 356,148 384,160 L384,470 L16,470 L16,160 C44,148 68,108 68,18 Z" fill="#572e2b"></path>
        <g clip-path="url(#hc)">
          <rect width="400" height="480" fill="url(#hm)"></rect>
          <path d="M16,250 L120,170 L120,200 L16,280 Z" fill="#ff6600"></path>
          <path d="M16,300 L120,220 L120,236 L16,316 Z" fill="#ff6600"></path>
          <path d="M384,250 L280,330 L280,360 L384,280 Z" fill="#ff6600"></path>
          <path d="M16,430 L384,380 L384,470 L16,470 Z" fill="#2b1513"></path>
          <path d="M16,420 L384,370 L384,380 L16,430 Z" fill="#ff6600"></path>
        </g>
        <path d="M118,18 C150,74 250,74 282,18" fill="none" stroke="#ff6600" stroke-width="8"></path>
        <path d="M68,18 C68,108 44,148 16,160 M332,18 C332,108 356,148 384,160" fill="none" stroke="#ff6600" stroke-width="6"></path>
        <text x="200" y="128" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-style="italic" font-size="30" letter-spacing="3" fill="#f3f4f0">SAN ROQUE</text>
        <text x="200" y="300" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-style="italic" font-size="190" fill="#ff6600" stroke="#2b1513" stroke-width="5" paint-order="stroke">23</text>
      </svg>
      <div class="s-hero-tag">
        <span class="s-cap">Recent order</span>
        <strong>Brgy. San Roque Ballers</strong>
        <span class="s-cap">17-piece set · mockup to pickup</span>
      </div>
    </div>
  </div>
</section>

<!-- CATEGORIES -->
<section class="s-cut">
  <div class="s-wrap">
    <div class="s-head-row">
      <div class="s-head" style="margin: 0">
        <span class="s-eyebrow">What we make</span>
        <h2 class="s-h2">Pick your <em>kit.</em></h2>
        <p class="s-lead">Six ways to suit up — every one fully customizable, from fabric to the last digit on the back.</p>
      </div>
      <a class="s-link" href="Products.dc.html">All products <x-import component-from-global-scope="CSP.Icon" name="arrow-right" size="{{n18}}"></x-import></a>
    </div>
    <div class="s-cats">
      <sc-for list="{{cats}}" as="c" hint-placeholder-count="6">
        <x-import component-from-global-scope="CSP.CategoryCard" title="{{c.title}}" description="{{c.description}}" number="{{c.number}}" href="Products.dc.html"></x-import>
      </sc-for>
    </div>
  </div>
</section>

<!-- WHY CSPS -->
<section class="s-sec">
  <div class="s-wrap">
    <div class="s-head">
      <span class="s-eyebrow">Why CSPS</span>
      <h2 class="s-h2">Made to <em>move.</em> Made to last.</h2>
    </div>
    <div class="s-why">
      <sc-for list="{{why}}" as="w" hint-placeholder-count="5">
        <div class="s-why-item">
          <span class="s-why-icon"><x-import component-from-global-scope="CSP.Icon" name="{{w.icon}}" size="{{n22}}"></x-import></span>
          <div>
            <h3>{{w.title}}</h3>
            <p>{{w.text}}</p>
          </div>
        </div>
      </sc-for>
    </div>
  </div>
</section>

<!-- HOW ORDERING WORKS -->
<section class="s-cut s-mesh">
  <div class="s-wrap">
    <div class="s-head">
      <span class="s-eyebrow">How ordering works</span>
      <h2 class="s-h2">Idea to jersey in <em>four steps.</em></h2>
    </div>
    <x-import component-from-global-scope="CSP.ProcessSteps" steps="{{steps}}"></x-import>
  </div>
</section>

<!-- FEATURED WORK -->
<section class="s-sec">
  <div class="s-wrap">
    <div class="s-head-row">
      <div class="s-head" style="margin: 0">
        <span class="s-eyebrow">Fresh off the press</span>
        <h2 class="s-h2">Recent <em>work.</em></h2>
      </div>
      <a class="s-link" href="Gallery.dc.html">View gallery <x-import component-from-global-scope="CSP.Icon" name="arrow-right" size="{{n18}}"></x-import></a>
    </div>
    <div class="s-strip">
      <sc-for list="{{tiles}}" as="t" hint-placeholder-count="6">
        <a class="s-tile" href="Gallery.dc.html" style="aspect-ratio: 4 / 5">
          <div class="csp-media-ph csp-mesh" style="height: 100%"></div>
          <div class="s-tile-kit">
            <sc-if value="{{t.tank}}" hint-placeholder-val="{{yes}}">
              <svg viewBox="0 0 400 480" aria-hidden="true"><path d="M118,18 C150,74 250,74 282,18 L332,18 C332,108 356,148 384,160 L384,470 L16,470 L16,160 C44,148 68,108 68,18 Z" fill="{{t.c1}}"></path><path d="M16,250 L384,170 L384,210 L16,290 Z" fill="{{t.c2}}"></path><path d="M118,18 C150,74 250,74 282,18" fill="none" stroke="{{t.c2}}" stroke-width="10"></path><text x="200" y="330" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-style="italic" font-size="150" fill="{{t.c3}}">{{t.num}}</text></svg>
            </sc-if>
            <sc-if value="{{t.sleeve}}" hint-placeholder-val="{{no}}">
              <svg viewBox="0 0 400 480" aria-hidden="true"><path d="M140,26 C165,64 235,64 260,26 L340,52 L398,250 L340,268 L320,190 L320,470 L80,470 L80,190 L60,268 L2,250 L60,52 Z" fill="{{t.c1}}"></path><path d="M60,52 L140,26 L170,120 L2,250 Z" fill="{{t.c2}}"></path><path d="M340,52 L260,26 L230,120 L398,250 Z" fill="{{t.c2}}"></path><path d="M140,26 C165,64 235,64 260,26" fill="none" stroke="{{t.c3}}" stroke-width="10"></path><text x="200" y="330" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-style="italic" font-size="130" fill="{{t.c3}}">{{t.num}}</text></svg>
            </sc-if>
          </div>
          <div class="s-tile-cap"><strong>{{t.team}}</strong><span>{{t.kind}}</span></div>
        </a>
      </sc-for>
    </div>
  </div>
</section>

<!-- TESTIMONIALS -->
<section class="s-sec" style="padding-top: 0">
  <div class="s-wrap">
    <div class="s-head">
      <span class="s-eyebrow">From the court and the road</span>
      <h2 class="s-h2">Teams that <em>suit up</em> with us.</h2>
    </div>
    <div class="s-testis">
      <sc-for list="{{testis}}" as="q" hint-placeholder-count="3">
        <x-import component-from-global-scope="CSP.TestimonialCard" quote="{{q.quote}}" team="{{q.team}}" name="{{q.who}}"></x-import>
      </sc-for>
    </div>
  </div>
</section>

<!-- FINAL CTA -->
<section class="s-cut s-cut-accent" style="margin-bottom: 0; clip-path: polygon(0 var(--cut-angle), 100% 0, 100% 100%, 0 100%)">
  <div class="s-wrap" style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 32px">
    <div style="display: flex; flex-direction: column; gap: 16px; max-width: 640px">
      <h2 class="s-h2" style="font-size: 64px; line-height: .95">Got a team? Let's suit them up.</h2>
      <p class="s-lead">Send your design, logo or rough idea. We'll reply with a mockup and a quote.</p>
    </div>
    <div class="s-btnrow">
      <a class="s-a-btn s-a-dark" href="Contact.dc.html">Get a Quote <x-import component-from-global-scope="CSP.Icon" name="arrow-right" size="{{n20}}"></x-import></a>
      <a class="s-a-btn s-a-ghost" href="Contact.dc.html"><x-import component-from-global-scope="CSP.Icon" name="message-circle" size="{{n20}}"></x-import> Message us on Messenger</a>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer class="s-foot">
  <div class="s-wrap">
    <div class="s-foot-grid">
      <div>
        <x-import component-from-global-scope="CSP.Logo" size="md"></x-import>
        <p class="s-small s-muted" style="margin-top: 16px; max-width: 320px">Custom tailoring and full-sublimation printing for teams, leagues and riding groups.</p>
        <div class="s-socials">
          <a class="s-social" href="#" aria-label="CSPS onFacebook">FB</a>
          <a class="s-social" href="#" aria-label="CSPS onInstagram">IG</a>
          <a class="s-social" href="#" aria-label="CSPS onTikTok">TT</a>
        </div>
      </div>
      <div>
        <h4>Shop</h4>
        <ul>
          <li><a href="Products.dc.html">Products</a></li>
          <li><a href="Gallery.dc.html">Gallery</a></li>
          <li><a href="Contact.dc.html">Get a Quote</a></li>
        </ul>
      </div>
      <div>
        <h4>Visit</h4>
        <ul>
          <li><x-import component-from-global-scope="CSP.Icon" name="map-pin" size="{{n16}}"></x-import><span>[Shop address], [City], Philippines</span></li>
          <li><x-import component-from-global-scope="CSP.Icon" name="clock" size="{{n16}}"></x-import><span>Mon–Sat · 9:00 AM – 6:00 PM</span></li>
        </ul>
      </div>
      <div>
        <h4>Contact</h4>
        <ul>
          <li><x-import component-from-global-scope="CSP.Icon" name="phone" size="{{n16}}"></x-import><a href="#">[0917 000 0000]</a></li>
          <li><x-import component-from-global-scope="CSP.Icon" name="message-circle" size="{{n16}}"></x-import><a href="#">Message us on Messenger</a></li>
          <li><x-import component-from-global-scope="CSP.Icon" name="mail" size="{{n16}}"></x-import><a href="#">[hello@yourdomain.ph]</a></li>
        </ul>
      </div>
    </div>
    <div class="s-foot-base">
      <span>© 2026 Carmen's Stitch &amp; Printing Services. All rights reserved.</span>
      <a class="s-staff" href="Login.dc.html"><x-import component-from-global-scope="CSP.Icon" name="lock" size="{{n14}}"></x-import>Staff Login</a>
    </div>
  </div>
</footer>

</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":5000}}'>
class Component extends DCLogic {
  renderVals() {
    return {
      yes: true, no: false, n14: 14, n16: 16, n18: 18, n20: 20, n22: 22,
      cats: [
        { title: 'Basketball Jerseys', description: 'Full sublimation tops and shorts, any colorway, names and numbers included.', number: '23' },
        { title: 'Volleyball Jerseys', description: 'Lightweight, stretch-fit cuts for indoor and beach teams.', number: '11' },
        { title: 'Moto Riding Jerseys', description: 'Breathable long-sleeve riding tops with club crests and sponsor logos.', number: '07' },
        { title: 'Long Sleeves', description: 'Warm-ups, shooting shirts and dri-fit long sleeves for training days.', number: '14' },
        { title: 'Polo Shirts', description: 'Sublimated or plain polos for coaches, staff, events and offices.', number: '03' },
        { title: 'Custom Designs', description: 'Bring a sketch or just an idea — our artists build the full design.', number: '00' }
      ],
      why: [
        { icon: 'printer', title: 'Full sublimation', text: 'Ink is dyed into the fabric, not printed on top — no cracking, peeling or fading after washes.' },
        { icon: 'shirt', title: 'Names & numbers', text: 'Every piece personalized. Send the lineup and sizes; we handle the layout.' },
        { icon: 'users', title: 'Team orders', text: 'From a five-player barkada to a full liga, kids to 4XL, in one order.' },
        { icon: 'scissors', title: 'Quality stitching', text: 'Reinforced seams and clean hems, finished in-house by our tailoring team.' },
        { icon: 'clock', title: 'Fast turnaround', text: 'Mockups in [24 hours]; production starts as soon as the downpayment is in.' }
      ],
      steps: [
        { title: 'Send your design', description: 'Message us your logo, colors or just an idea. Sketches welcome.', icon: 'message-circle' },
        { title: 'Approve the mockup', description: 'We send a digital mockup. Revise until every detail is right.', icon: 'palette' },
        { title: 'Downpayment & production', description: 'Pay the downpayment via GCash, Maya or bank transfer and we start printing.', icon: 'printer' },
        { title: 'Pickup or delivery', description: 'Settle the balance, then pick up in-store or get it delivered.', icon: 'truck' }
      ],
      tiles: [
        { team: 'Brgy. San Roque Ballers', kind: 'Basketball · 17 pcs', num: '23', tank: true, sleeve: false, c1: '#572e2b', c2: '#ff6600', c3: '#ff6600' },
        { team: 'Tondo Riders MC', kind: 'Moto riding · 20 pcs', num: '07', tank: false, sleeve: true, c1: '#1d3b8f', c2: '#f2f2ef', c3: '#ffb547' },
        { team: 'Lady Spikers QC', kind: 'Volleyball · 14 pcs', num: '11', tank: true, sleeve: false, c1: '#7a1430', c2: '#ffffff', c3: '#ffffff' },
        { team: 'Marikina Moto Club', kind: 'Long sleeves · 30 pcs', num: '88', tank: false, sleeve: true, c1: '#0e2a24', c2: '#3fe0b8', c3: '#f3f4f0' },
        { team: 'Kabataan Liga ng Pasig', kind: 'Basketball · 12 pcs', num: '05', tank: true, sleeve: false, c1: '#f2f2ef', c2: '#e04a2f', c3: '#121411' },
        { team: 'Batangas Bikers Brotherhood', kind: 'Moto riding · 25 pcs', num: '45', tank: false, sleeve: true, c1: '#121411', c2: '#e04a2f', c3: '#f3f4f0' }
      ],
      testis: [
        { quote: 'Seventeen pieces, names and numbers perfect, and ready before our liga opener. Colors are sharper than our old supplier.', who: 'Juan Dela Cruz', team: 'Captain, Brgy. San Roque Ballers' },
        { quote: 'Our ride jerseys survived a full Baguio loop in the rain and still look new. The whole MC is ordering again.', who: 'Mark Villanueva', team: 'Tondo Riders MC' },
        { quote: 'Sizes ran true for the whole team and the names didn’t fade after a full season of washing. Sulit na sulit.', who: 'Kristine Mendoza', team: 'Coach, Lady Spikers QC' }
      ]
    };
  }
}
</script>
```

### E.2 Products — `/products`

```html
<div class="s-page" data-theme="light">

<x-import component-from-global-scope="CSP.SiteHeader" active="Products"></x-import>

<section class="s-pagehead s-mesh">
  <div class="s-wrap" style="display: flex; flex-direction: column; gap: 20px">
    <nav class="s-crumbs" aria-label="Breadcrumb"><a href="Main.dc.html">Home</a><span>/</span><span>Products</span></nav>
    <span class="s-eyebrow">Products &amp; services</span>
    <h1 class="s-h1">Every kit, <em>your way.</em></h1>
    <p class="s-lead">Six product lines, all printed by full sublimation and finished by our tailors. Pick a base, then make every detail yours.</p>
  </div>
</section>

<div class="s-anchors">
  <div class="s-wrap s-anchors-in">
    <sc-for list="{{products}}" as="p" hint-placeholder-count="6">
      <a class="s-pill" href="#{{p.id}}">{{p.title}}</a>
    </sc-for>
  </div>
</div>

<div class="s-wrap">
  <sc-for list="{{products}}" as="p" hint-placeholder-count="6">
    <article id="{{p.id}}" class="{{p.cls}}">
      <div class="s-prod-media">
        <div>
          <div class="csp-media-ph csp-mesh"></div>
          <div class="s-tile-kit">
            <sc-if value="{{p.tank}}" hint-placeholder-val="{{yes}}">
              <svg viewBox="0 0 400 480" role="img" aria-label="{{p.title}} sample"><path d="M118,18 C150,74 250,74 282,18 L332,18 C332,108 356,148 384,160 L384,470 L16,470 L16,160 C44,148 68,108 68,18 Z" fill="{{p.c1}}"></path><path d="M16,250 L384,170 L384,210 L16,290 Z" fill="{{p.c2}}"></path><path d="M118,18 C150,74 250,74 282,18" fill="none" stroke="{{p.c2}}" stroke-width="10"></path><text x="200" y="330" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-style="italic" font-size="150" fill="{{p.c3}}">{{p.num}}</text></svg>
            </sc-if>
            <sc-if value="{{p.sleeve}}" hint-placeholder-val="{{no}}">
              <svg viewBox="0 0 400 480" role="img" aria-label="{{p.title}} sample"><path d="M140,26 C165,64 235,64 260,26 L340,52 L398,250 L340,268 L320,190 L320,470 L80,470 L80,190 L60,268 L2,250 L60,52 Z" fill="{{p.c1}}"></path><path d="M60,52 L140,26 L170,120 L2,250 Z" fill="{{p.c2}}"></path><path d="M340,52 L260,26 L230,120 L398,250 Z" fill="{{p.c2}}"></path><path d="M140,26 C165,64 235,64 260,26" fill="none" stroke="{{p.c3}}" stroke-width="10"></path><text x="200" y="330" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-style="italic" font-size="130" fill="{{p.c3}}">{{p.num}}</text></svg>
            </sc-if>
          </div>
        </div>
        <div><x-import component-from-global-scope="CSP.MediaPlaceholder" label="Back view" number="{{p.num}}"></x-import></div>
        <div><x-import component-from-global-scope="CSP.MediaPlaceholder" label="Fabric detail"></x-import></div>
      </div>
      <div class="s-prod-copy">
        <span class="s-prod-no">{{p.no}} / 06</span>
        <h2 class="s-h2">{{p.title}}</h2>
        <p class="s-lead">{{p.desc}}</p>
        <h3 class="s-eyebrow" style="margin-top: 8px">What you can customize</h3>
        <div class="s-custom">
          <sc-for list="{{p.opts}}" as="o" hint-placeholder-count="5">
            <div class="{{o.cls}}">
              <h4><x-import component-from-global-scope="CSP.Icon" name="{{o.icon}}" size="{{n18}}"></x-import>{{o.title}}</h4>
              <p>{{o.text}}</p>
            </div>
          </sc-for>
        </div>
        <div class="s-price"><span class="s-muted s-small">Starts at</span><strong>[YOUR PRICE]</strong><span class="s-muted s-small">/ pc · min. [X] pcs</span></div>
        <div class="s-btnrow">
          <a class="s-a-btn s-a-primary" href="Contact.dc.html">Get a Quote <x-import component-from-global-scope="CSP.Icon" name="arrow-right" size="{{n20}}"></x-import></a>
          <a class="s-a-btn s-a-secondary" href="Gallery.dc.html">See {{p.short}} work</a>
        </div>
      </div>
    </article>
  </sc-for>
</div>

<section class="s-sec">
  <div class="s-wrap">
    <div class="s-card" style="padding: 40px; display: flex; flex-wrap: wrap; gap: 24px; align-items: center; justify-content: space-between; border-radius: 18px">
      <div style="display: flex; flex-direction: column; gap: 8px; max-width: 620px">
        <span class="s-eyebrow">Not sure what to pick?</span>
        <h2 class="s-h2" style="font-size: 40px">Tell us the sport. We'll suggest the rest.</h2>
      </div>
      <div class="s-btnrow">
        <a class="s-a-btn s-a-primary" href="Contact.dc.html">Get a Quote</a>
        <a class="s-a-btn s-a-secondary" href="Contact.dc.html"><x-import component-from-global-scope="CSP.Icon" name="message-circle" size="{{n20}}"></x-import> Message us</a>
      </div>
    </div>
  </div>
</section>

<footer class="s-foot">
  <div class="s-wrap">
    <div class="s-foot-grid">
      <div>
        <x-import component-from-global-scope="CSP.Logo" size="md"></x-import>
        <p class="s-small s-muted" style="margin-top: 16px; max-width: 320px">Custom tailoring and full-sublimation printing for teams, leagues and riding groups.</p>
        <div class="s-socials"><a class="s-social" href="#" aria-label="CSPS onFacebook">FB</a><a class="s-social" href="#" aria-label="CSPS onInstagram">IG</a><a class="s-social" href="#" aria-label="CSPS onTikTok">TT</a></div>
      </div>
      <div><h4>Shop</h4><ul><li><a href="Products.dc.html">Products</a></li><li><a href="Gallery.dc.html">Gallery</a></li><li><a href="Contact.dc.html">Get a Quote</a></li></ul></div>
      <div><h4>Visit</h4><ul><li><x-import component-from-global-scope="CSP.Icon" name="map-pin" size="{{n16}}"></x-import><span>[Shop address], [City], Philippines</span></li><li><x-import component-from-global-scope="CSP.Icon" name="clock" size="{{n16}}"></x-import><span>Mon–Sat · 9:00 AM – 6:00 PM</span></li></ul></div>
      <div><h4>Contact</h4><ul><li><x-import component-from-global-scope="CSP.Icon" name="phone" size="{{n16}}"></x-import><a href="#">[0917 000 0000]</a></li><li><x-import component-from-global-scope="CSP.Icon" name="message-circle" size="{{n16}}"></x-import><a href="#">Message us on Messenger</a></li></ul></div>
    </div>
    <div class="s-foot-base"><span>© 2026 Carmen's Stitch &amp; Printing Services. All rights reserved.</span><a class="s-staff" href="Login.dc.html"><x-import component-from-global-scope="CSP.Icon" name="lock" size="{{n14}}"></x-import>Staff Login</a></div>
  </div>
</footer>

</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":5600}}'>
class Component extends DCLogic {
  renderVals() {
    const opts = (fabric, collar, cut, names, logos) => [
      { icon: 'layout-grid', title: 'Fabric', text: fabric, cls: 's-custom-item' },
      { icon: 'shirt', title: 'Collar style', text: collar, cls: 's-custom-item' },
      { icon: 'ruler', title: 'Cut & fit', text: cut, cls: 's-custom-item' },
      { icon: 'zap', title: 'Names & numbers', text: names, cls: 's-custom-item' },
      { icon: 'palette', title: 'Logos & sponsors', text: logos, cls: 's-custom-item is-wide' }
    ];
    const list = [
      { id: 'basketball', title: 'Basketball Jerseys', short: 'basketball', num: '23', tank: true, c1: '#572e2b', c2: '#ff6600', c3: '#ff6600',
        desc: 'Game-ready tops and shorts, printed edge to edge in any colorway. Built for full-court runs and summer liga heat.',
        opts: opts('Dri-fit mesh, aircool or spandex blend', 'V-neck, round or layered', 'Standard, slim, women’s fit and kids', 'Any font — front, back and shorts', 'Team crest, sponsors and barangay seal in full color') },
      { id: 'volleyball', title: 'Volleyball Jerseys', short: 'volleyball', num: '11', tank: true, c1: '#7a1430', c2: '#ffffff', c3: '#ffffff',
        desc: 'Light, stretchy and quick-drying for every dig and spike — indoor or beach.',
        opts: opts('Aircool micro-eyelet or spandex', 'Round, V-neck or mandarin', 'Sleeveless, cap sleeve or short sleeve', 'Libero colorway option included', 'Club crest and sponsors, front and back') },
      { id: 'moto', title: 'Moto Riding Jerseys', short: 'moto', num: '07', sleeve: true, c1: '#1d3b8f', c2: '#f2f2ef', c3: '#ffb547',
        desc: 'Long-sleeve riding tops that breathe on long hauls and keep your club’s colors loud on the road.',
        opts: opts('Breathable mesh or UV-protect knit', 'Crew, zip-neck or mandarin', 'Racing fit or relaxed, thumb loops optional', 'Rider name, club rank, plate number on sleeve', 'Club crest, chapter name and sponsor patches') },
      { id: 'longsleeves', title: 'Long Sleeves', short: 'long sleeve', num: '14', sleeve: true, c1: '#0e2a24', c2: '#3fe0b8', c3: '#f3f4f0',
        desc: 'Warm-ups, shooting shirts and everyday dri-fit long sleeves for training days and team events.',
        opts: opts('Dri-fit, cotton-spandex or UV-protect', 'Crew, hooded or quarter-zip', 'Regular, athletic or raglan', 'Names on back or sleeve', 'Printed or embroidered logos') },
      { id: 'polo', title: 'Polo Shirts', short: 'polo', num: '03', sleeve: true, c1: '#f2f2ef', c2: '#121411', c3: '#121411',
        desc: 'Clean polos for coaches, staff, reunions and company events — sublimated or plain.',
        opts: opts('Honeycomb piqué, dri-fit piqué or cotton', 'Classic, mandarin or tipped', 'Men’s, women’s and unisex', 'Embroidered or printed name on chest', 'Embroidered or sublimated logos') },
      { id: 'custom', title: 'Custom Designs', short: 'custom', num: '00', tank: true, c1: '#24282d', c2: '#b9a7ff', c3: '#ff6600',
        desc: 'Have only an idea or a phone photo? Our artists build the full design from scratch and send you a mockup.',
        opts: opts('Any of our fabrics', 'Any collar we offer', 'Our patterns, or match a sample you send', 'Full roster from a spreadsheet', 'We redraw and vectorize logos from a photo') }
    ];
    return {
      yes: true, no: false, n14: 14, n16: 16, n18: 18, n20: 20,
      products: list.map((p, i) => Object.assign({ tank: false, sleeve: false }, p, { no: '0' + (i + 1), cls: i % 2 ? 's-prod is-flip' : 's-prod' }))
    };
  }
}
</script>
```

### E.3 Gallery + lightbox — `/gallery`

```html
<div class="s-page" data-theme="light">

<x-import component-from-global-scope="CSP.SiteHeader" active="Gallery"></x-import>

<section class="s-pagehead s-mesh" style="padding-bottom: 48px">
  <div class="s-wrap" style="display: flex; flex-direction: column; gap: 20px">
    <nav class="s-crumbs" aria-label="Breadcrumb"><a href="Main.dc.html">Home</a><span>/</span><span>Gallery</span></nav>
    <span class="s-eyebrow">Our work</span>
    <h1 class="s-h1">Worn on <em>court &amp; road.</em></h1>
    <p class="s-lead">Real orders from barangay leagues, school teams, riding clubs and offices. Tap any piece to see it up close.</p>
  </div>
</section>

<div class="s-anchors">
  <div class="s-wrap s-anchors-in" role="toolbar" aria-label="Filter by category">
    <sc-for list="{{filters}}" as="f" hint-placeholder-count="7">
      <button type="button" class="{{f.cls}}" aria-pressed="{{f.on}}" onClick="{{f.pick}}">{{f.label}} <span class="s-pill-count">{{f.count}}</span></button>
    </sc-for>
  </div>
</div>

<section class="s-sec" style="padding-top: 32px">
  <div class="s-wrap">
    <div class="s-masonry">
      <sc-for list="{{shown}}" as="g" hint-placeholder-count="12">
        <button type="button" class="s-mtile" style="aspect-ratio: {{g.ratio}}" onClick="{{g.open}}" aria-label="Open {{g.team}}, {{g.cat}}">
          <div class="csp-media-ph csp-mesh" style="height: 100%"></div>
          <div class="s-tile-kit">
            <sc-if value="{{g.tank}}" hint-placeholder-val="{{yes}}">
              <svg viewBox="0 0 400 480" aria-hidden="true"><path d="M118,18 C150,74 250,74 282,18 L332,18 C332,108 356,148 384,160 L384,470 L16,470 L16,160 C44,148 68,108 68,18 Z" fill="{{g.c1}}"></path><path d="M16,250 L384,170 L384,210 L16,290 Z" fill="{{g.c2}}"></path><path d="M118,18 C150,74 250,74 282,18" fill="none" stroke="{{g.c2}}" stroke-width="10"></path><text x="200" y="330" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-style="italic" font-size="150" fill="{{g.c3}}">{{g.num}}</text></svg>
            </sc-if>
            <sc-if value="{{g.sleeve}}" hint-placeholder-val="{{no}}">
              <svg viewBox="0 0 400 480" aria-hidden="true"><path d="M140,26 C165,64 235,64 260,26 L340,52 L398,250 L340,268 L320,190 L320,470 L80,470 L80,190 L60,268 L2,250 L60,52 Z" fill="{{g.c1}}"></path><path d="M60,52 L140,26 L170,120 L2,250 Z" fill="{{g.c2}}"></path><path d="M340,52 L260,26 L230,120 L398,250 Z" fill="{{g.c2}}"></path><path d="M140,26 C165,64 235,64 260,26" fill="none" stroke="{{g.c3}}" stroke-width="10"></path><text x="200" y="330" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-style="italic" font-size="130" fill="{{g.c3}}">{{g.num}}</text></svg>
            </sc-if>
          </div>
          <div class="s-tile-cap"><strong>{{g.team}}</strong><span>{{g.cat}} · {{g.pcs}}</span></div>
        </button>
      </sc-for>
    </div>
    <div style="display: flex; justify-content: center; margin-top: 32px">
      <a class="s-a-btn s-a-secondary" href="Contact.dc.html">Want one like these? Get a Quote</a>
    </div>
  </div>
</section>

<footer class="s-foot">
  <div class="s-wrap">
    <div class="s-foot-base" style="margin-top: 0; padding-top: 0; border-top: 0">
      <x-import component-from-global-scope="CSP.Logo" size="sm"></x-import>
      <span>© 2026 Carmen's Stitch &amp; Printing Services</span>
      <a class="s-staff" href="Login.dc.html"><x-import component-from-global-scope="CSP.Icon" name="lock" size="{{n14}}"></x-import>Staff Login</a>
    </div>
  </div>
</footer>

<sc-if value="{{lb.open}}" hint-placeholder-val="{{no}}">
  <div class="s-lightbox" role="dialog" aria-modal="true" aria-label="Gallery image viewer">
    <div class="s-lb-top">
      <span class="s-small" style="font-variant-numeric: tabular-nums">{{lb.pos}}</span>
      <button type="button" class="s-lb-close" onClick="{{close}}" aria-label="Close viewer"><x-import component-from-global-scope="CSP.Icon" name="x" size="{{n20}}"></x-import></button>
    </div>
    <div class="s-lb-stage">
      <button type="button" class="s-lb-nav" onClick="{{prev}}" aria-label="Previous image"><x-import component-from-global-scope="CSP.Icon" name="chevron-left" size="{{n22}}"></x-import></button>
      <div class="s-lb-img">
        <div class="csp-media-ph csp-mesh" style="height: 100%"></div>
        <div class="s-tile-kit">
          <sc-if value="{{lb.g.tank}}" hint-placeholder-val="{{yes}}">
            <svg viewBox="0 0 400 480" style="width: 42%" aria-hidden="true"><path d="M118,18 C150,74 250,74 282,18 L332,18 C332,108 356,148 384,160 L384,470 L16,470 L16,160 C44,148 68,108 68,18 Z" fill="{{lb.g.c1}}"></path><path d="M16,250 L384,170 L384,210 L16,290 Z" fill="{{lb.g.c2}}"></path><path d="M118,18 C150,74 250,74 282,18" fill="none" stroke="{{lb.g.c2}}" stroke-width="10"></path><text x="200" y="330" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-style="italic" font-size="150" fill="{{lb.g.c3}}">{{lb.g.num}}</text></svg>
          </sc-if>
          <sc-if value="{{lb.g.sleeve}}" hint-placeholder-val="{{no}}">
            <svg viewBox="0 0 400 480" style="width: 42%" aria-hidden="true"><path d="M140,26 C165,64 235,64 260,26 L340,52 L398,250 L340,268 L320,190 L320,470 L80,470 L80,190 L60,268 L2,250 L60,52 Z" fill="{{lb.g.c1}}"></path><path d="M60,52 L140,26 L170,120 L2,250 Z" fill="{{lb.g.c2}}"></path><path d="M340,52 L260,26 L230,120 L398,250 Z" fill="{{lb.g.c2}}"></path><path d="M140,26 C165,64 235,64 260,26" fill="none" stroke="{{lb.g.c3}}" stroke-width="10"></path><text x="200" y="330" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-style="italic" font-size="130" fill="{{lb.g.c3}}">{{lb.g.num}}</text></svg>
          </sc-if>
        </div>
      </div>
      <button type="button" class="s-lb-nav" onClick="{{next}}" aria-label="Next image"><x-import component-from-global-scope="CSP.Icon" name="chevron-right" size="{{n22}}"></x-import></button>
    </div>
    <div class="s-lb-cap">
      <div>
        <div style="font-family: var(--font-display); font-weight: 800; font-size: 30px; line-height: 1.05; text-transform: uppercase">{{lb.g.team}}</div>
        <div class="s-small" style="color: #d0b2a4">{{lb.g.cat}} · {{lb.g.pcs}} · {{lb.g.note}}</div>
      </div>
      <a class="s-a-btn s-a-primary" href="Contact.dc.html" style="height: 44px">Get a quote for something like this</a>
    </div>
  </div>
</sc-if>

</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"initialLightbox":{"editor":"int","default":-1,"min":-1,"max":15},"$preview":{"width":1440,"height":2500}}'>
class Component extends DCLogic {
  constructor(props) {
    super(props);
    const i = props.initialLightbox;
    this.state = { filter: 'All', open: (typeof i === 'number' && i >= 0) ? i : null };
  }
  renderVals() {
    const T = (team, cat, pcs, num, kind, c1, c2, c3, ratio, note) => ({ team, cat, pcs: pcs + ' pcs', num, tank: kind === 't', sleeve: kind === 's', c1, c2, c3, ratio, note });
    const all = [
      T('Brgy. San Roque Ballers', 'Basketball', 17, '23', 't', '#572e2b', '#ff6600', '#ff6600', '4 / 5', 'Dri-fit mesh, V-neck'),
      T('Tondo Riders MC', 'Moto', 20, '07', 's', '#1d3b8f', '#f2f2ef', '#ffb547', '1 / 1', 'Zip-neck, thumb loops'),
      T('Lady Spikers QC', 'Volleyball', 14, '11', 't', '#7a1430', '#ffffff', '#ffffff', '3 / 4', 'Aircool, cap sleeve'),
      T('Marikina Moto Club', 'Long Sleeves', 30, '88', 's', '#0e2a24', '#3fe0b8', '#f3f4f0', '4 / 5', 'UV-protect knit'),
      T('St. Jude Parish Youth', 'Polo', 40, '03', 's', '#f2f2ef', '#1d3b8f', '#1d3b8f', '1 / 1', 'Honeycomb piqué, embroidered crest'),
      T('Kabataan Liga ng Pasig', 'Basketball', 12, '05', 't', '#f2f2ef', '#e04a2f', '#121411', '4 / 3', 'Reversible set'),
      T('Batangas Bikers Brotherhood', 'Moto', 25, '45', 's', '#121411', '#e04a2f', '#f3f4f0', '3 / 4', 'Racing fit'),
      T('Cainta Thunder', 'Basketball', 15, '32', 't', '#ffb547', '#121411', '#121411', '1 / 1', 'Layered collar'),
      T('UP Diliman Org League', 'Volleyball', 12, '09', 't', '#0b64a3', '#ff6600', '#ffffff', '4 / 5', 'Spandex, mandarin collar'),
      T('Laguna Trail Runners', 'Long Sleeves', 24, '21', 's', '#ff6600', '#121411', '#121411', '1 / 1', 'Quarter-zip'),
      T('Reyes Family Reunion', 'Custom', 36, '26', 't', '#5b3fc4', '#ffb547', '#ffffff', '4 / 3', 'Custom illustration'),
      T('Sampaloc Spikers', 'Volleyball', 14, '17', 't', '#24282d', '#ff6f61', '#ff6f61', '3 / 4', 'Libero colorway'),
      T('Antipolo Riders Club', 'Moto', 18, '99', 's', '#7a1430', '#121411', '#ffb547', '4 / 5', 'Breathable mesh'),
      T('BPO Fun Run 2026', 'Polo', 60, '01', 's', '#121411', '#ff6600', '#ff6600', '1 / 1', 'Dri-fit piqué'),
      T('Mandaluyong Masters', 'Basketball', 10, '50', 't', '#0e2a24', '#ffffff', '#3fe0b8', '4 / 5', 'Slim cut'),
      T('Barkada Cup 3x3', 'Custom', 8, '3X', 't', '#ff6f61', '#121411', '#121411', '3 / 4', 'Hand-drawn logo, vectorized')
    ];
    const cats = ['All', 'Basketball', 'Volleyball', 'Moto', 'Long Sleeves', 'Polo', 'Custom'];
    const f = this.state.filter;
    const shownRaw = f === 'All' ? all : all.filter((g) => g.cat === f);
    const shown = shownRaw.map((g, i) => Object.assign({}, g, { open: () => this.setState({ open: i }) }));
    const o = this.state.open;
    const cur = o != null ? shownRaw[o] : null;
    const step = (d) => () => this.setState({ open: (o + d + shownRaw.length) % shownRaw.length });
    return {
      yes: true, no: false, n14: 14, n20: 20, n22: 22,
      filters: cats.map((c) => ({ label: c, on: c === f, cls: c === f ? 's-pill is-on' : 's-pill', count: c === 'All' ? all.length : all.filter((g) => g.cat === c).length, pick: () => this.setState({ filter: c, open: null }) })),
      shown,
      lb: { open: !!cur, g: cur || all[0], pos: cur ? (o + 1) + ' / ' + shownRaw.length : '' },
      close: () => this.setState({ open: null }),
      prev: step(-1), next: step(1)
    };
  }
}
</script>
```

### E.4 Contact — `/contact`

```html
<div class="s-page" data-theme="light">

<x-import component-from-global-scope="CSP.SiteHeader" active="Contact"></x-import>

<section class="s-pagehead s-mesh" style="padding-bottom: 48px">
  <div class="s-wrap" style="display: flex; flex-direction: column; gap: 20px">
    <nav class="s-crumbs" aria-label="Breadcrumb"><a href="Main.dc.html">Home</a><span>/</span><span>Contact</span></nav>
    <span class="s-eyebrow">Get a quote</span>
    <h1 class="s-h1">Let's build <em>your kit.</em></h1>
    <p class="s-lead">Tell us about your team and what you need. We reply with a mockup and price — usually the same day. Faster? Message us on Messenger.</p>
  </div>
</section>

<section class="s-sec" style="padding-top: 24px">
  <div class="s-wrap s-contact">

    <form class="s-formcard" aria-label="Quote inquiry">
      <div style="display: flex; flex-direction: column; gap: 6px">
        <h2 class="s-title">Inquiry form</h2>
        <p class="s-small s-muted">Fields marked * are required.</p>
      </div>
      <div class="s-formgrid">
        <x-import component-from-global-scope="CSP.Field" label="Your name" required="{{yes}}" placeholder="Juan Dela Cruz" autocomplete="name"></x-import>
        <x-import component-from-global-scope="CSP.Field" label="Team / organization" placeholder="Brgy. San Roque Ballers"></x-import>
        <x-import component-from-global-scope="CSP.Field" label="Contact number" required="{{yes}}" type="tel" placeholder="0917 123 4567" hint="We'll text or call about your mockup." autocomplete="tel"></x-import>
        <x-import component-from-global-scope="CSP.Field" label="Email" type="email" placeholder="you@gmail.com" autocomplete="email"></x-import>
        <x-import component-from-global-scope="CSP.Select" label="Product type" options="{{products}}" placeholder="Choose a product"></x-import>
        <x-import component-from-global-scope="CSP.Select" label="Quantity (estimate)" options="{{qty}}" placeholder="How many pieces?"></x-import>
        <div class="is-wide"><x-import component-from-global-scope="CSP.Field" label="Message" multiline="{{yes}}" placeholder="Colors, sport, deadline, sizes, anything you have in mind…"></x-import></div>
        <div class="is-wide" style="display: flex; flex-direction: column; gap: 6px">
          <span class="csp-label">Reference design <span class="s-muted" style="font-weight: 400">(optional)</span></span>
          <label class="csp-drop" style="cursor: pointer; padding: 28px 16px">
            <x-import component-from-global-scope="CSP.Icon" name="cloud-upload" size="{{n28}}"></x-import>
            <span class="csp-drop-title">Drop your logo, sketch or photo — or <span style="color: var(--link); text-decoration: underline; text-underline-offset: 3px">browse</span></span>
            <span class="csp-drop-hint">JPG, PNG, PDF or AI · up to 10 MB each</span>
            <input type="file" multiple="multiple" style="position: absolute; width: 1px; height: 1px; opacity: 0">
          </label>
        </div>
      </div>
      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px">
        <p class="s-cap" style="max-width: 340px">By sending, you agree we may contact you about this inquiry. We never share your details.</p>
        <x-import component-from-global-scope="CSP.Button" variant="primary" size="lg" icon-right="arrow-right" type="submit">Send Inquiry</x-import>
      </div>
    </form>

    <aside class="s-side">
      <a class="s-bigbtn is-primary" href="#">
        <span class="s-bigbtn-ic"><x-import component-from-global-scope="CSP.Icon" name="message-circle" size="{{n26}}"></x-import></span>
        <span><strong>Message us on Messenger</strong><span>Fastest reply · send photos of your design</span></span>
        <span class="s-go"><x-import component-from-global-scope="CSP.Icon" name="arrow-up-right" size="{{n22}}"></x-import></span>
      </a>
      <a class="s-bigbtn" href="#">
        <span class="s-bigbtn-ic"><x-import component-from-global-scope="CSP.Icon" name="phone" size="{{n24}}"></x-import></span>
        <span><strong>Call [0917 000 0000]</strong><span class="s-muted">Mon–Sat, 9:00 AM – 6:00 PM</span></span>
        <span class="s-go s-muted"><x-import component-from-global-scope="CSP.Icon" name="arrow-up-right" size="{{n22}}"></x-import></span>
      </a>

      <div class="s-infocard">
        <div style="display: flex; justify-content: space-between; align-items: center">
          <h3 style="font-family: var(--font-display); font-weight: 700; font-size: 20px; text-transform: uppercase">Business hours</h3>
          <span class="s-open">Open now</span>
        </div>
        <dl class="s-hours">
          <dt>Monday – Friday</dt><dd>9:00 AM – 6:00 PM</dd>
          <dt>Saturday</dt><dd>9:00 AM – 5:00 PM</dd>
          <dt>Sunday &amp; holidays</dt><dd>Closed</dd>
        </dl>
      </div>

      <div class="s-map" role="img" aria-label="Map placeholder showing the shop location">
        <svg class="s-map-roads s-mesh" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path d="M-10,180 C80,160 160,190 240,150 S380,120 420,130" fill="none" stroke="#fff6f0" stroke-width="14"></path>
          <path d="M120,-10 L170,260" fill="none" stroke="#fff6f0" stroke-width="10"></path>
          <path d="M290,-10 C270,80 300,160 260,260" fill="none" stroke="#fbebe2" stroke-width="8"></path>
          <path d="M-10,70 L420,40" fill="none" stroke="#ead1c4" stroke-width="6"></path>
          <path d="M-10,180 C80,160 160,190 240,150 S380,120 420,130" fill="none" stroke="#d4bbab" stroke-width="1" stroke-dasharray="8 6"></path>
        </svg>
        <div class="s-map-pin"><span><x-import component-from-global-scope="CSP.Icon" name="shirt" size="{{n20}}"></x-import></span></div>
        <div class="s-map-label">
          <span><strong style="display: block">CSPS Shop</strong><span class="s-muted">[Street address], [City]</span></span>
          <a class="s-link" href="#">Directions <x-import component-from-global-scope="CSP.Icon" name="arrow-up-right" size="{{n16}}"></x-import></a>
        </div>
      </div>
    </aside>
  </div>
</section>

<footer class="s-foot">
  <div class="s-wrap">
    <div class="s-foot-base" style="margin-top: 0; padding-top: 0; border-top: 0">
      <x-import component-from-global-scope="CSP.Logo" size="sm"></x-import>
      <span>© 2026 Carmen's Stitch &amp; Printing Services</span>
      <a class="s-staff" href="Login.dc.html"><x-import component-from-global-scope="CSP.Icon" name="lock" size="{{n14}}"></x-import>Staff Login</a>
    </div>
  </div>
</footer>

<div class="s-mbar">
  <a class="s-a-btn s-a-primary" href="#"><x-import component-from-global-scope="CSP.Icon" name="message-circle" size="{{n20}}"></x-import>Messenger</a>
  <a class="s-a-btn s-a-secondary" href="#"><x-import component-from-global-scope="CSP.Icon" name="phone" size="{{n20}}"></x-import>Call us</a>
</div>

</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":2000}}'>
class Component extends DCLogic {
  renderVals() {
    return {
      yes: true, n14: 14, n16: 16, n20: 20, n22: 22, n24: 24, n26: 26, n28: 28,
      products: ['Basketball Jersey', 'Volleyball Jersey', 'Moto Riding Jersey', 'Long Sleeves', 'Polo Shirt', 'Custom Design', 'Not sure yet'],
      qty: ['1–9 pcs', '10–20 pcs', '21–50 pcs', '51–100 pcs', '100+ pcs']
    };
  }
}
</script>
```

### E.5 Admin login — `/admin/login` (prop `state`: default | error | loading)

```html
<div class="s-page" data-theme="light" style="min-height: 960px">
  <div class="s-login" style="min-height: 960px">
    <div class="s-login-brand s-mesh">
      <div class="s-login-slab"></div>
      <div class="s-login-bands"></div>
      <span class="s-login-num">C</span>
      <div style="position: relative">
        <x-import component-from-global-scope="CSP.Logo" size="lg"></x-import>
      </div>
      <div class="s-login-quote">
        <span class="s-eyebrow">Staff area</span>
        <p style="font-family: var(--font-display); font-weight: 800; font-size: 40px; line-height: 1; text-transform: uppercase">Orders, payments and expenses — all in one place.</p>
      </div>
    </div>

    <div class="s-login-form">
      <form class="s-login-card" aria-label="Sign in">
        <div style="display: flex; flex-direction: column; gap: 8px">
          <span class="s-eyebrow">CSPS Admin</span>
          <h1>Sign in</h1>
          <p class="s-small s-muted">Use the email and password your manager set up for you.</p>
        </div>

        <sc-if value="{{isError}}" hint-placeholder-val="{{no}}">
          <div class="s-banner is-danger" role="alert">
            <x-import component-from-global-scope="CSP.Icon" name="triangle-alert" size="{{n20}}"></x-import>
            <div><strong>Email or password is incorrect.</strong><span>Check for typos, or ask your manager to reset your password.</span></div>
          </div>
        </sc-if>

        <x-import component-from-global-scope="CSP.Field" label="Email" type="email" default-value="paolo.garcia@gmail.com" autocomplete="username" error="{{emailErr}}"></x-import>
        <x-import component-from-global-scope="CSP.PasswordField" label="Password" default-value="{{pw}}" autocomplete="current-password"></x-import>

        <div class="s-login-row">
          <label class="s-check"><input type="checkbox" checked="checked"> Keep me signed in</label>
          <a class="s-link s-small" href="#">Forgot password?</a>
        </div>

        <x-import component-from-global-scope="CSP.Button" variant="primary" size="lg" block="{{yes}}" loading="{{isLoading}}" icon-right="arrow-right" type="submit">{{cta}}</x-import>

        <div class="s-note">
          <x-import component-from-global-scope="CSP.Icon" name="shield-check" size="{{n18}}"></x-import>
          <span>Staff only. Customer orders are placed through the public site or Messenger.</span>
        </div>
        <a class="s-back" href="Main.dc.html"><x-import component-from-global-scope="CSP.Icon" name="chevron-left" size="{{n16}}"></x-import>Back to the CSPS website</a>
      </form>
    </div>
  </div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"state":{"editor":"enum","options":["default","error","loading"],"default":"default"},"$preview":{"width":1440,"height":960}}'>
class Component extends DCLogic {
  renderVals() {
    const s = this.props.state ?? 'default';
    return {
      yes: true, no: false, n16: 16, n18: 18, n20: 20,
      isError: s === 'error', isLoading: s === 'loading',
      emailErr: undefined,
      pw: s === 'default' ? '' : 'tahi2026',
      cta: s === 'loading' ? 'Signing in' : 'Sign In'
    };
  }
}
</script>
```

### E.6 Dashboard — `/admin`

```html
<div class="s-page" data-theme="{{theme}}">
<div class="s-admin">
  <div class="s-admin-side">
    <x-import component-from-global-scope="CSP.Sidebar" active="dashboard" role="manager" user="{{me}}"></x-import>
  </div>
  <div class="s-admin-main">
    <x-import component-from-global-scope="CSP.Topbar" user="{{me}}" role="manager" theme="{{theme}}" on-toggle-theme="{{noop}}"></x-import>

    <main class="s-body">
      <div class="s-ph">
        <div class="s-ph-title">
          <h1>Good evening, Carmen</h1>
          <p>Tuesday, Oct 6, 2026 · Here's how the shop is doing this month.</p>
        </div>
        <div class="s-ph-actions">
          <a class="csp-btn csp-btn-secondary csp-btn-md" href="Orders.dc.html">View Orders</a>
          <a class="csp-btn csp-btn-primary csp-btn-md" href="OrderForm.dc.html"><x-import component-from-global-scope="CSP.Icon" name="plus" size="{{n18}}"></x-import>New Order</a>
        </div>
      </div>

      <div class="s-kpis">
        <x-import component-from-global-scope="CSP.KpiCard" label="Active orders" value="{{k.active}}" money="{{no}}" icon="clipboard-list" hint="4 due this week"></x-import>
        <x-import component-from-global-scope="CSP.KpiCard" label="Total receivables" value="{{k.recv}}" icon="wallet" hint="Unpaid balances, all active orders"></x-import>
        <x-import component-from-global-scope="CSP.KpiCard" label="Collected · Oct" value="{{k.collected}}" icon="trending-up" delta="{{k.d1}}" delta-label="vs Sep, same day"></x-import>
        <x-import component-from-global-scope="CSP.KpiCard" label="Company expenses · Oct" value="{{k.exp}}" icon="receipt" hint="7 entries · top: Rent"></x-import>
      </div>

      <div class="s-dash">
        <section class="s-card">
          <div class="s-card-h">
            <div><h2>Income vs. expenses</h2><p>Last 6 months</p></div>
            <x-import component-from-global-scope="CSP.SegmentedControl" label="Range" options="{{ranges}}"></x-import>
          </div>
          <div class="s-card-b">
            <x-import component-from-global-scope="CSP.IncomeExpenseChart" data="{{chart}}"></x-import>
          </div>
        </section>
        <section class="s-card">
          <div class="s-card-h"><div><h2>Orders by status</h2><p>Open orders + completed this month</p></div></div>
          <ul class="s-status-list" style="padding-top: 16px">
            <sc-for list="{{statuses}}" as="s" hint-placeholder-count="6">
              <li class="s-status-row">
                <x-import component-from-global-scope="CSP.StatusBadge" status="{{s.id}}"></x-import>
                <div class="s-status-bar"><span style="width: {{s.pct}}; background: {{s.color}}"></span></div>
                <strong>{{s.n}}</strong>
              </li>
            </sc-for>
          </ul>
          <div class="s-status-total"><span>Active (Pending → Ready)</span><strong style="color: var(--ink)">18 orders</strong></div>
        </section>
      </div>

      <section class="s-card">
        <div class="s-card-h">
          <div><h2>Recent orders</h2><p>Newest first</p></div>
          <a class="s-link s-small" href="Orders.dc.html">All orders <x-import component-from-global-scope="CSP.Icon" name="arrow-right" size="{{n16}}"></x-import></a>
        </div>
        <div class="s-rt-wrap" style="border: 0; border-radius: 0 0 12px 12px">
          <table class="s-rt">
            <thead><tr><th>Order</th><th>Customer / team</th><th>Status</th><th>Due</th><th class="r">Total</th><th class="r">Balance</th><th class="r"><span class="csp-sr">Actions</span></th></tr></thead>
            <tbody>
              <sc-for list="{{recent}}" as="o" hint-placeholder-count="6">
                <tr>
                  <td class="is-lead" data-label="Order"><a class="s-ord-no" href="OrderDetail.dc.html">{{o.number}}</a></td>
                  <td data-label="Customer"><div class="s-who"><strong>{{o.title}}</strong><span>{{o.sub}}</span></div></td>
                  <td data-label="Status"><x-import component-from-global-scope="CSP.StatusBadge" status="{{o.status}}"></x-import></td>
                  <td data-label="Due" style="color: {{o.dueColor}}">{{o.due}}</td>
                  <td data-label="Total" class="r m">{{o.total}}</td>
                  <td data-label="Balance" class="r m">
                    <sc-if value="{{o.paid}}" hint-placeholder-val="{{no}}"><span class="s-paid"><x-import component-from-global-scope="CSP.Icon" name="circle-check" size="{{n16}}"></x-import>Fully Paid</span></sc-if>
                    <sc-if value="{{o.owing}}" hint-placeholder-val="{{yes}}"><span class="s-balance-cell">{{o.balance}}</span></sc-if>
                  </td>
                  <td class="r is-acts"><a class="s-iconbtn" href="OrderDetail.dc.html" aria-label="View {{o.number}}"><x-import component-from-global-scope="CSP.Icon" name="eye" size="{{n18}}"></x-import></a></td>
                </tr>
              </sc-for>
            </tbody>
          </table>
        </div>
      </section>
    </main>

    <nav class="s-tabbar" aria-label="Admin">
      <a class="s-tab-i is-on" href="Dashboard.dc.html"><x-import component-from-global-scope="CSP.Icon" name="layout-dashboard" size="{{n22}}"></x-import>Dashboard</a>
      <a class="s-tab-i" href="Orders.dc.html"><x-import component-from-global-scope="CSP.Icon" name="clipboard-list" size="{{n22}}"></x-import>Orders</a>
      <a class="s-tab-i" href="Expenses.dc.html"><x-import component-from-global-scope="CSP.Icon" name="receipt" size="{{n22}}"></x-import>Expenses</a>
      <a class="s-tab-i" href="Profile.dc.html"><x-import component-from-global-scope="CSP.Icon" name="user-round" size="{{n22}}"></x-import>Profile</a>
    </nav>
  </div>
</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"theme":{"editor":"enum","options":["light","dark"],"default":"light"},"$preview":{"width":1440,"height":1500}}'>
class Component extends DCLogic {
  renderVals() {
    const C = window.CSP || {};
    const peso = C.formatPeso || ((n) => '₱' + Number(n).toFixed(2));
    const tot = C.orderTotals || (() => ({ total: 0, balance: 0, fullyPaid: false }));
    const fd = C.formatDate || ((d) => d);
    const O = (number, team, customer, status, dueDate, overdue, items, discounts, payments) => ({ number, team, customer, status, dueDate, overdue, items, discounts, payments });
    const orders = [
      O('ORD-2026-0159', 'Batangas Bikers Brotherhood', 'Carlo Reyes', 'mockup', '2026-10-27', false, [{ quantity: 25, unitPrice: 1150 }], [], [{ amount: 5000 }]),
      O('ORD-2026-0157', 'St. Jude Parish Youth', 'Liza Cruz', 'production', '2026-10-17', false, [{ quantity: 40, unitPrice: 450 }], [], [{ amount: 9000 }]),
      O('ORD-2026-0155', 'Lady Spikers QC', 'Kristine Mendoza', 'pending', '2026-10-24', false, [{ quantity: 14, unitPrice: 720 }], [], []),
      O('ORD-2026-0153', '', 'Angelica Santos', 'mockup', '2026-10-05', true, [{ quantity: 12, unitPrice: 780 }], [], [{ amount: 3000 }]),
      O('ORD-2026-0151', 'Tondo Riders MC', 'Mark Villanueva', 'ready', '2026-10-10', false, [{ quantity: 20, unitPrice: 1150 }], [{ type: 'fixed', value: 500 }], [{ amount: 12000 }, { amount: 10500 }]),
      O('ORD-2026-0148', 'Brgy. San Roque Ballers', 'Juan Dela Cruz', 'production', '2026-10-14', false,
        [{ quantity: 15, unitPrice: 650 }, { quantity: 15, unitPrice: 300 }, { quantity: 2, unitPrice: 550 }, { quantity: 15, unitPrice: 420 }, { quantity: 1, unitPrice: 800 }],
        [{ type: 'percentage', value: 5 }], [{ amount: 10000 }, { amount: 2000 }])
    ];
    const st = [['pending', 3, '--status-pending'], ['mockup', 4, '--status-mockup'], ['production', 7, '--status-production'], ['ready', 4, '--status-ready'], ['completed', 11, '--status-completed'], ['cancelled', 1, '--status-cancelled']];
    return {
      theme: this.props.theme ?? 'light',
      me: { name: 'Carmen Reyes' }, yes: true, no: false, n16: 16, n18: 18, n22: 22, noop: () => {},
      k: { active: 18, recv: 84260, collected: 126450, d1: 12, exp: 38226.95 },
      ranges: [{ value: '6m', label: '6M' }, { value: '12m', label: '12M' }],
      chart: [
        { month: 'May', income: 98400, expenses: 61200 }, { month: 'Jun', income: 132650, expenses: 70350 },
        { month: 'Jul', income: 87300, expenses: 66480 }, { month: 'Aug', income: 145900, expenses: 74120 },
        { month: 'Sep', income: 112980, expenses: 69900 }, { month: 'Oct', income: 126450, expenses: 58320 }
      ],
      statuses: st.map(([id, n, v]) => ({ id, n, pct: Math.round(n / 11 * 100) + '%', color: 'var(' + v + ')' })),
      recent: orders.map((o) => {
        const t = tot(o);
        return {
          number: o.number, status: o.status, title: o.team || o.customer, sub: o.team ? o.customer : 'Walk-in customer',
          due: fd(o.dueDate) + (o.overdue ? ' · overdue' : ''), dueColor: o.overdue ? 'var(--danger)' : 'var(--ink-muted)',
          total: peso(t.total), balance: peso(t.balance), paid: t.fullyPaid, owing: !t.fullyPaid
        };
      })
    };
  }
}
</script>
```

### E.7 Orders — `/admin/orders` (grid/table toggle, cascade delete)

```html
<div class="s-page" data-theme="{{theme}}">
<div class="s-admin">
  <div class="s-admin-side">
    <x-import component-from-global-scope="CSP.Sidebar" active="orders" role="manager" user="{{me}}"></x-import>
  </div>
  <div class="s-admin-main">
    <x-import component-from-global-scope="CSP.Topbar" user="{{me}}" role="manager" theme="{{theme}}" on-toggle-theme="{{noop}}"></x-import>

    <main class="s-body">
      <div class="s-ph">
        <div class="s-ph-title">
          <h1>Orders</h1>
          <p>{{countLine}}</p>
        </div>
        <div class="s-ph-actions">
          <a class="csp-btn csp-btn-primary csp-btn-md" href="OrderForm.dc.html"><x-import component-from-global-scope="CSP.Icon" name="plus" size="{{n18}}"></x-import>New Order</a>
        </div>
      </div>

      <div class="s-toolbar" role="search">
        <div class="s-search" style="display: flex; flex-direction: column; gap: 6px; flex: 1 1 260px">
          <label class="csp-label" for="ord-q" style="font-size: 12px; line-height: 16px; color: var(--ink-muted)">Search</label>
          <div class="s-search-box"><x-import component-from-global-scope="CSP.Icon" name="search" size="{{n18}}"></x-import><input id="ord-q" type="search" placeholder="Order no., customer or team"></div>
        </div>
        <x-import component-from-global-scope="CSP.Select" label="Status" options="{{statusOpts}}" default-value="active"></x-import>
        <x-import component-from-global-scope="CSP.Select" label="Order date" options="{{dateOpts}}" default-value="90"></x-import>
        <x-import component-from-global-scope="CSP.Select" label="Product type" options="{{typeOpts}}" placeholder="All products"></x-import>
        <x-import component-from-global-scope="CSP.Select" label="Sort by" options="{{sortOpts}}" default-value="due"></x-import>
        <div class="s-toolbar-end">
          <x-import component-from-global-scope="CSP.SegmentedControl" label="View" value="{{view}}" on-change="{{setView}}" options="{{views}}"></x-import>
        </div>
      </div>

      <div class="s-resultbar">
        <span>Showing <strong style="color: var(--ink)">{{shownCount}}</strong> orders · sorted by due date</span>
        <span class="s-filter-chip">Status: Active + recent <button type="button" class="s-iconbtn" style="width: 22px; height: 22px; color: inherit" aria-label="Clear status filter"><x-import component-from-global-scope="CSP.Icon" name="x" size="{{n14}}"></x-import></button></span>
      </div>

      <sc-if value="{{isGrid}}" hint-placeholder-val="{{yes}}">
        <div class="s-orders">
          <sc-for list="{{orders}}" as="o" hint-placeholder-count="8">
            <x-import component-from-global-scope="CSP.OrderCard" order="{{o.data}}" on-delete="{{o.del}}" on-view="{{noop}}" on-edit="{{noop}}"></x-import>
          </sc-for>
        </div>
      </sc-if>

      <sc-if value="{{isTable}}" hint-placeholder-val="{{no}}">
        <div class="s-rt-wrap">
          <table class="s-rt">
            <thead><tr><th>Order</th><th>Customer / team</th><th>Status</th><th>Ordered</th><th>Due</th><th class="r">Total</th><th class="r">Discount</th><th class="r">Paid</th><th class="r">Balance</th><th class="r"><span class="csp-sr">Actions</span></th></tr></thead>
            <tbody>
              <sc-for list="{{orders}}" as="o" hint-placeholder-count="8">
                <tr>
                  <td class="is-lead" data-label="Order">
                    <div style="display: flex; gap: 12px; align-items: center">
                      <div style="width: 44px; height: 44px; border-radius: 8px; overflow: hidden; flex: none"><x-import component-from-global-scope="CSP.MediaPlaceholder" number="{{o.num}}" ratio="1 / 1"></x-import></div>
                      <a class="s-ord-no" href="OrderDetail.dc.html">{{o.data.number}}</a>
                    </div>
                  </td>
                  <td data-label="Customer"><div class="s-who"><strong>{{o.title}}</strong><span>{{o.sub}}</span></div></td>
                  <td data-label="Status"><x-import component-from-global-scope="CSP.StatusBadge" status="{{o.data.status}}"></x-import></td>
                  <td data-label="Ordered" class="s-muted">{{o.ordered}}</td>
                  <td data-label="Due" style="color: {{o.dueColor}}; white-space: nowrap">{{o.due}}</td>
                  <td data-label="Total" class="r m">{{o.total}}</td>
                  <td data-label="Discount" class="r m s-muted">{{o.discount}}</td>
                  <td data-label="Paid" class="r m s-muted">{{o.paidAmt}}</td>
                  <td data-label="Balance" class="r m">
                    <sc-if value="{{o.paid}}" hint-placeholder-val="{{no}}"><span class="s-paid"><x-import component-from-global-scope="CSP.Icon" name="circle-check" size="{{n16}}"></x-import>Fully Paid</span></sc-if>
                    <sc-if value="{{o.owing}}" hint-placeholder-val="{{yes}}"><span class="s-balance-cell">{{o.balance}}</span></sc-if>
                  </td>
                  <td class="r is-acts">
                    <span class="s-acts">
                      <a class="s-iconbtn" href="OrderDetail.dc.html" aria-label="View {{o.data.number}}"><x-import component-from-global-scope="CSP.Icon" name="eye" size="{{n18}}"></x-import></a>
                      <a class="s-iconbtn" href="OrderForm.dc.html" aria-label="Edit {{o.data.number}}"><x-import component-from-global-scope="CSP.Icon" name="pencil" size="{{n18}}"></x-import></a>
                      <button type="button" class="s-iconbtn is-danger" onClick="{{o.del}}" aria-label="Delete {{o.data.number}}"><x-import component-from-global-scope="CSP.Icon" name="trash-2" size="{{n18}}"></x-import></button>
                    </span>
                  </td>
                </tr>
              </sc-for>
            </tbody>
          </table>
        </div>
      </sc-if>
    </main>

    <nav class="s-tabbar" aria-label="Admin">
      <a class="s-tab-i" href="Dashboard.dc.html"><x-import component-from-global-scope="CSP.Icon" name="layout-dashboard" size="{{n22}}"></x-import>Dashboard</a>
      <a class="s-tab-i is-on" href="Orders.dc.html"><x-import component-from-global-scope="CSP.Icon" name="clipboard-list" size="{{n22}}"></x-import>Orders</a>
      <a class="s-tab-i" href="Expenses.dc.html"><x-import component-from-global-scope="CSP.Icon" name="receipt" size="{{n22}}"></x-import>Expenses</a>
      <a class="s-tab-i" href="Profile.dc.html"><x-import component-from-global-scope="CSP.Icon" name="user-round" size="{{n22}}"></x-import>Profile</a>
    </nav>
  </div>
</div>

<sc-if value="{{delOpen}}" hint-placeholder-val="{{no}}">
  <div class="s-overlay">
    <x-import component-from-global-scope="CSP.ConfirmDialog" inline="{{yes}}" title="{{del.title}}" message="{{del.message}}" counts="{{del.counts}}" confirm-text="{{del.number}}" confirm-label="Delete Order" on-cancel="{{cancelDel}}" on-confirm="{{confirmDel}}"></x-import>
  </div>
</sc-if>

<sc-if value="{{toast}}" hint-placeholder-val="{{no}}">
  <div class="s-toast-layer">
    <x-import component-from-global-scope="CSP.Toast" tone="success" title="{{toast}}" message="Its items, payments, discounts, expenses and images were removed." on-close="{{closeToast}}"></x-import>
  </div>
</sc-if>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"theme":{"editor":"enum","options":["light","dark"],"default":"light"},"view":{"editor":"enum","options":["grid","table"],"default":"grid"},"$preview":{"width":1440,"height":1900}}'>
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { view: null, removed: [], del: null, toast: null };
  }
  renderVals() {
    const C = window.CSP || {};
    const peso = C.formatPeso || ((n) => '₱' + Number(n).toFixed(2));
    const tot = C.orderTotals || (() => ({ total: 0, discount: 0, paid: 0, balance: 0, fullyPaid: false }));
    const fd = C.formatDate || ((d) => d);
    const img = (n, nums) => Array.from({ length: n }, (_, i) => ({ id: 'i' + i, name: 'image-' + (i + 1) + '.jpg', number: nums[i] }));
    const O = (number, team, customer, status, orderDate, dueDate, overdue, images, items, discounts, payments, expenses) =>
      ({ number, team, customer, status, orderDate, dueDate, overdue, images, items, discounts, payments, expenses: expenses || [] });
    const all = [
      O('ORD-2026-0148', 'Brgy. San Roque Ballers', 'Juan Dela Cruz', 'production', '2026-09-28', '2026-10-14', false, img(4, ['23', '23', '11', '']),
        [{ quantity: 15, unitPrice: 650 }, { quantity: 15, unitPrice: 300 }, { quantity: 2, unitPrice: 550 }, { quantity: 15, unitPrice: 420 }, { quantity: 1, unitPrice: 800 }],
        [{ type: 'percentage', value: 5 }], [{ amount: 10000 }, { amount: 2000 }], [{ amount: 3825 }, { amount: 1640 }, { amount: 600 }]),
      O('ORD-2026-0151', 'Tondo Riders MC', 'Mark Villanueva', 'ready', '2026-09-30', '2026-10-10', false, img(2, ['07', '07']),
        [{ quantity: 20, unitPrice: 1150 }], [{ type: 'fixed', value: 500 }], [{ amount: 12000 }, { amount: 10500 }], [{ amount: 7200 }, { amount: 2100 }]),
      O('ORD-2026-0153', '', 'Angelica Santos', 'mockup', '2026-10-03', '2026-10-05', true, [],
        [{ quantity: 12, unitPrice: 780 }], [], [{ amount: 3000 }]),
      O('ORD-2026-0155', 'Lady Spikers QC', 'Kristine Mendoza', 'pending', '2026-10-05', '2026-10-24', false, img(1, ['11']),
        [{ quantity: 14, unitPrice: 720 }], [], []),
      O('ORD-2026-0157', 'St. Jude Parish Youth', 'Liza Cruz', 'production', '2026-10-01', '2026-10-17', false, img(3, ['03', '', '']),
        [{ quantity: 40, unitPrice: 450 }], [], [{ amount: 9000 }], [{ amount: 6400 }]),
      O('ORD-2026-0159', 'Batangas Bikers Brotherhood', 'Carlo Reyes', 'mockup', '2026-10-06', '2026-10-27', false, img(2, ['45', '']),
        [{ quantity: 25, unitPrice: 1150 }], [], [{ amount: 5000 }]),
      O('ORD-2026-0142', 'Marikina Moto Club', 'Ramon Bautista', 'completed', '2026-09-12', '2026-09-30', false, img(5, ['88', '88', '', '', '']),
        [{ quantity: 30, unitPrice: 690 }], [{ type: 'fixed', value: 1000 }], [{ amount: 10000 }, { amount: 9700 }], [{ amount: 8900 }]),
      O('ORD-2026-0139', 'Kabataan Liga ng Pasig', 'Jessa Ramos', 'cancelled', '2026-09-08', '2026-09-25', false, img(1, ['05']),
        [{ quantity: 10, unitPrice: 850 }], [], [])
    ];
    const live = all.filter((o) => this.state.removed.indexOf(o.number) < 0);
    const view = this.state.view || this.props.view || 'grid';
    const delO = this.state.del ? all.find((o) => o.number === this.state.del) : null;
    const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
    return {
      theme: this.props.theme ?? 'light', me: { name: 'Carmen Reyes' },
      yes: true, no: false, n14: 14, n16: 16, n18: 18, n22: 22, noop: () => {},
      countLine: live.length + ' orders in the last 90 days · 6 active',
      shownCount: live.length,
      statusOpts: opt([['active', 'Active + recent'], ['all', 'All statuses'], ['pending', 'Pending'], ['mockup', 'Mockup'], ['production', 'In Production'], ['ready', 'Ready'], ['completed', 'Completed'], ['cancelled', 'Cancelled']]),
      dateOpts: opt([['30', 'Last 30 days'], ['90', 'Last 90 days'], ['month', 'This month'], ['custom', 'Custom range…']]),
      typeOpts: C.PRODUCT_TYPES || [],
      sortOpts: opt([['due', 'Due date (soonest)'], ['new', 'Newest first'], ['balance', 'Balance (highest)'], ['total', 'Total (highest)']]),
      views: [{ value: 'grid', label: 'Grid view', icon: 'layout-grid' }, { value: 'table', label: 'Table view', icon: 'list' }],
      view, isGrid: view === 'grid', isTable: view === 'table',
      setView: (v) => this.setState({ view: v }),
      orders: live.map((o) => {
        const t = tot(o);
        return {
          data: o, num: (o.images[0] && o.images[0].number) || '',
          title: o.team || o.customer, sub: o.team ? o.customer : 'Walk-in customer',
          ordered: fd(o.orderDate), due: fd(o.dueDate) + (o.overdue ? ' · overdue' : ''), dueColor: o.overdue ? 'var(--danger)' : 'var(--ink)',
          total: peso(t.total), discount: t.discount ? peso(-t.discount) : '—', paidAmt: t.paid ? peso(-t.paid) : '—',
          balance: peso(t.balance), paid: t.fullyPaid, owing: !t.fullyPaid,
          del: () => this.setState({ del: o.number, toast: null })
        };
      }),
      delOpen: !!delO,
      del: delO ? {
        number: delO.number,
        title: 'Delete order ' + delO.number + '?',
        message: (delO.team ? delO.team + ' · ' : '') + delO.customer + '. The order will be permanently deleted along with everything inside it.',
        counts: { items: delO.items.length, payments: delO.payments.length, discounts: delO.discounts.length, expenses: delO.expenses.length, images: delO.images.length }
      } : { counts: {} },
      cancelDel: () => this.setState({ del: null }),
      confirmDel: () => this.setState({ removed: this.state.removed.concat([this.state.del]), toast: 'Order ' + this.state.del + ' deleted', del: null }),
      toast: this.state.toast,
      closeToast: () => this.setState({ toast: null })
    };
  }
}
</script>
```

### E.8 Orders — empty / no matches / loading / error states

```html
<div class="s-page" data-theme="{{theme}}">
<div class="s-admin">
  <div class="s-admin-side">
    <x-import component-from-global-scope="CSP.Sidebar" active="orders" role="manager" user="{{me}}"></x-import>
  </div>
  <div class="s-admin-main">
    <x-import component-from-global-scope="CSP.Topbar" user="{{me}}" role="manager" theme="{{theme}}" on-toggle-theme="{{noop}}"></x-import>
    <main class="s-body">
      <div class="s-ph">
        <div class="s-ph-title"><h1>Orders — states</h1><p>What the Orders list shows when there's nothing to show, while it loads, and when it fails.</p></div>
      </div>

      <div class="s-g2">
        <section style="display: flex; flex-direction: column; gap: 12px">
          <span class="csp-overline">Empty — first use</span>
          <div class="csp-empty">
            <span class="csp-empty-icon"><x-import component-from-global-scope="CSP.Icon" name="clipboard-list" size="{{n28}}"></x-import></span>
            <h3 class="csp-empty-title">No orders yet</h3>
            <p class="csp-empty-msg">Create your first order to start tracking items, payments and balances.</p>
            <a class="csp-btn csp-btn-primary csp-btn-md" href="OrderForm.dc.html"><x-import component-from-global-scope="CSP.Icon" name="plus" size="{{n18}}"></x-import>New Order</a>
          </div>
        </section>
        <section style="display: flex; flex-direction: column; gap: 12px">
          <span class="csp-overline">No matches — filters applied</span>
          <div class="csp-empty">
            <span class="csp-empty-icon"><x-import component-from-global-scope="CSP.Icon" name="search" size="{{n28}}"></x-import></span>
            <h3 class="csp-empty-title">No matches</h3>
            <p class="csp-empty-msg">No orders match “Ballers” with status Ready. Try another search or clear the filters.</p>
            <x-import component-from-global-scope="CSP.Button" variant="secondary">Clear Filters</x-import>
          </div>
        </section>
      </div>

      <section style="display: flex; flex-direction: column; gap: 12px">
        <span class="csp-overline">Loading — skeleton cards in the card's own layout</span>
        <div class="s-orders" aria-busy="true">
          <sc-for list="{{sk}}" as="s" hint-placeholder-count="4">
            <div class="csp-card" style="overflow: hidden">
              <x-import component-from-global-scope="CSP.Skeleton" height="{{h180}}" radius="{{zero}}"></x-import>
              <div style="padding: 16px; display: grid; gap: 10px">
                <x-import component-from-global-scope="CSP.Skeleton" width="40%" height="{{h14}}"></x-import>
                <x-import component-from-global-scope="CSP.Skeleton" width="75%" height="{{h22}}"></x-import>
                <x-import component-from-global-scope="CSP.Skeleton" width="55%" height="{{h14}}"></x-import>
                <x-import component-from-global-scope="CSP.Skeleton" height="{{h56}}"></x-import>
              </div>
            </div>
          </sc-for>
        </div>
      </section>

      <section style="display: flex; flex-direction: column; gap: 12px">
        <span class="csp-overline">Error — couldn't load, and a failed save</span>
        <div class="s-banner is-danger" role="alert" style="align-items: center">
          <x-import component-from-global-scope="CSP.Icon" name="triangle-alert" size="{{n20}}"></x-import>
          <div style="flex: 1"><strong>Couldn't load orders.</strong><span>Check your internet connection. Your data is safe — nothing was changed.</span></div>
          <x-import component-from-global-scope="CSP.Button" variant="secondary" size="sm">Try Again</x-import>
        </div>
        <div style="max-width: 400px">
          <x-import component-from-global-scope="CSP.Toast" tone="danger" title="Couldn't save order" message="ORD-2026-0160 wasn't saved. Check your connection and try again." on-close="{{noop}}"></x-import>
        </div>
      </section>
    </main>
  </div>
</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"theme":{"editor":"enum","options":["light","dark"],"default":"light"},"$preview":{"width":1440,"height":1500}}'>
class Component extends DCLogic {
  renderVals() {
    return {
      theme: this.props.theme ?? 'light', me: { name: 'Carmen Reyes' }, noop: () => {},
      n18: 18, n20: 20, n28: 28, h14: 14, h22: 22, h56: 56, h180: 180, zero: 0,
      sk: [1, 2, 3, 4]
    };
  }
}
</script>
```

### E.9 Create / Edit Order — `/admin/orders/new`

```html
<div class="s-page" data-theme="{{theme}}">
<div class="s-admin">
  <div class="s-admin-side">
    <x-import component-from-global-scope="CSP.Sidebar" active="orders" role="manager" user="{{me}}"></x-import>
  </div>
  <div class="s-admin-main">
    <x-import component-from-global-scope="CSP.Topbar" user="{{me}}" role="manager" theme="{{theme}}" on-toggle-theme="{{noop}}"></x-import>

    <main class="s-body">
      <div class="s-ph">
        <div class="s-ph-title">
          <a class="s-back" href="Orders.dc.html"><x-import component-from-global-scope="CSP.Icon" name="chevron-left" size="{{n16}}"></x-import>Orders</a>
          <h1>New Order</h1>
          <p>Customer, dates, images and items. Payments, discounts and expenses are added on the order page after saving.</p>
        </div>
      </div>

      <div class="s-form-layout">
        <div class="s-form-col">

          <section class="s-card">
            <div class="s-card-h"><div><h2>Customer details</h2><p>Who the order is for</p></div></div>
            <div class="s-card-b s-formgrid">
              <x-import component-from-global-scope="CSP.Field" label="Customer name" required="{{yes}}" default-value="Juan Dela Cruz"></x-import>
              <x-import component-from-global-scope="CSP.Field" label="Team / organization" default-value="Brgy. San Roque Ballers" hint="Shown as the order title"></x-import>
              <x-import component-from-global-scope="CSP.Field" label="Contact number" required="{{yes}}" type="tel" default-value="0917 123 4567"></x-import>
              <x-import component-from-global-scope="CSP.Field" label="Email" type="email" default-value="juan.dc@gmail" error="Enter a valid email, like name@gmail.com"></x-import>
              <div class="is-wide"><x-import component-from-global-scope="CSP.Field" label="Address (optional)" placeholder="For delivery — street, barangay, city"></x-import></div>
            </div>
          </section>

          <section class="s-card">
            <div class="s-card-h"><div><h2>Order details</h2><p>Dates and current stage</p></div></div>
            <div class="s-card-b s-formgrid">
              <x-import component-from-global-scope="CSP.Field" label="Order date" type="date" default-value="2026-10-06" required="{{yes}}"></x-import>
              <x-import component-from-global-scope="CSP.Field" label="Due date" type="date" default-value="2026-10-20" required="{{yes}}" hint="14 days from order date"></x-import>
              <x-import component-from-global-scope="CSP.Select" label="Status" options="{{statusOpts}}" default-value="pending"></x-import>
              <div></div>
              <div class="is-wide"><x-import component-from-global-scope="CSP.Field" label="Notes" multiline="{{yes}}" default-value="V-neck, black and volt. Captain wants names in caps. Coach polos need embroidered logo, not printed."></x-import></div>
            </div>
          </section>

          <section class="s-card">
            <div class="s-card-h"><div><h2>Images</h2><p>Mockups and reference photos. Drag to reorder — the first image is the cover on the Orders list.</p></div></div>
            <div class="s-card-b">
              <x-import component-from-global-scope="CSP.ImageUploader" default-images="{{images}}"></x-import>
            </div>
          </section>

          <section class="s-card">
            <div class="s-card-h">
              <div><h2>Order items</h2><p>{{itemsLine}}</p></div>
              <button type="button" class="csp-btn csp-btn-secondary csp-btn-sm" onClick="{{addItem}}"><x-import component-from-global-scope="CSP.Icon" name="plus" size="{{n16}}"></x-import>Add Item</button>
            </div>
            <div class="s-items" style="padding-top: 12px">
              <div class="s-item-head"><span>Product type</span><span>Description</span><span>Size / variant</span><span>Qty</span><span>Unit price</span><span style="text-align: right">Line total</span><span></span></div>
              <sc-for list="{{items}}" as="it" hint-placeholder-count="3">
                <div class="s-item">
                  <div>
                    <span class="s-lbl">Product type</span>
                    <div class="csp-control csp-select"><select class="csp-input" aria-label="Product type" value="{{it.type}}" onChange="{{it.onType}}">
                      <sc-for list="{{types}}" as="t" hint-placeholder-count="6"><option value="{{t}}">{{t}}</option></sc-for>
                    </select><span class="csp-select-chev"><x-import component-from-global-scope="CSP.Icon" name="chevron-down" size="{{n16}}"></x-import></span></div>
                  </div>
                  <div><span class="s-lbl">Description</span><div class="csp-control"><input class="csp-input" aria-label="Description" value="{{it.desc}}" onChange="{{it.onDesc}}" placeholder="e.g. Jersey top, sublimated"></div></div>
                  <div><span class="s-lbl">Size</span><div class="csp-control"><input class="csp-input" aria-label="Size or variant" value="{{it.size}}" onChange="{{it.onSize}}" placeholder="S–XL"></div></div>
                  <div><span class="s-lbl">Qty</span><div class="csp-control"><input class="csp-input" aria-label="Quantity" inputMode="numeric" value="{{it.qty}}" onChange="{{it.onQty}}" style="text-align: right"></div></div>
                  <div><span class="s-lbl">Unit price</span><div class="csp-control has-prefix"><span class="csp-prefix">₱</span><input class="csp-input" aria-label="Unit price" inputMode="decimal" value="{{it.price}}" onChange="{{it.onPrice}}" style="text-align: right"></div></div>
                  <div class="s-line-total"><span class="s-lbl" style="text-align: right">Line total</span>{{it.line}}</div>
                  <div><button type="button" class="s-iconbtn is-danger" onClick="{{it.remove}}" aria-label="Remove item {{it.n}}"><x-import component-from-global-scope="CSP.Icon" name="trash-2" size="{{n18}}"></x-import></button></div>
                </div>
              </sc-for>
              <sc-if value="{{noItems}}" hint-placeholder-val="{{no}}">
                <div class="s-inline-empty">No items yet. Add at least one to save the order.<button type="button" class="csp-btn csp-btn-ghost csp-btn-sm" onClick="{{addItem}}"><x-import component-from-global-scope="CSP.Icon" name="plus" size="{{n16}}"></x-import>Add Item</button></div>
              </sc-if>
            </div>
            <div class="s-items-foot">
              <span class="s-muted s-small">{{pcs}} pcs across {{count}} line items</span>
              <span style="display: flex; gap: 12px; align-items: baseline"><span class="csp-overline">Items subtotal</span><strong>{{subtotal}}</strong></span>
            </div>
          </section>
        </div>

        <aside class="s-detail-side">
          <section class="s-card">
            <div class="s-card-h"><div><h2>Summary</h2><p>Updates as you edit items</p></div></div>
            <div class="s-card-b" style="display: flex; flex-direction: column; gap: 16px">
              <dl class="s-meta">
                <dt>Status</dt><dd><x-import component-from-global-scope="CSP.StatusBadge" status="pending"></x-import></dd>
                <dt>Due</dt><dd>Oct 20, 2026</dd>
                <dt>Line items</dt><dd>{{count}}</dd>
                <dt>Pieces</dt><dd>{{pcs}}</dd>
              </dl>
              <div class="csp-balance is-due">
                <span class="csp-overline">Total</span>
                <span class="csp-balance-value">{{subtotal}}</span>
              </div>
              <div class="s-note"><x-import component-from-global-scope="CSP.Icon" name="info" size="{{n16}}"></x-import><span>Balance = Total − Discounts − Payments. Record the downpayment after saving.</span></div>
            </div>
          </section>
        </aside>
      </div>
    </main>

    <div class="s-savebar">
      <span class="s-cap">1 field needs attention · unsaved changes</span>
      <a class="csp-btn csp-btn-secondary csp-btn-md" href="Orders.dc.html">Cancel</a>
      <a class="csp-btn csp-btn-primary csp-btn-md" href="OrderDetail.dc.html"><x-import component-from-global-scope="CSP.Icon" name="check" size="{{n18}}"></x-import>Save Order</a>
    </div>
  </div>
</div>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"theme":{"editor":"enum","options":["dark","light"],"default":"light"},"$preview":{"width":1440,"height":2000}}'>
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.seq = 3;
    this.state = { items: [
      { id: 1, type: 'Basketball Jersey', desc: 'Jersey top — sublimated, names & numbers', size: 'S–XL', qty: '15', price: '650.00' },
      { id: 2, type: 'Basketball Jersey', desc: 'Shorts — matching colorway', size: 'S–XL', qty: '15', price: '300.00' },
      { id: 3, type: 'Polo Shirt', desc: 'Coach polo, embroidered logo', size: 'L', qty: '2', price: '550.00' }
    ] };
  }
  renderVals() {
    const C = window.CSP || {};
    const peso = C.formatPeso || ((n) => '₱' + Number(n).toFixed(2));
    const num = (v) => Number(String(v).replace(/[^0-9.]/g, '')) || 0;
    const upd = (id, k) => (e) => this.setState({ items: this.state.items.map((x) => x.id === id ? Object.assign({}, x, { [k]: e.target.value }) : x) });
    const items = this.state.items;
    const subtotal = items.reduce((s, x) => s + num(x.qty) * num(x.price), 0);
    const pcs = items.reduce((s, x) => s + num(x.qty), 0);
    return {
      theme: this.props.theme ?? 'light', me: { name: 'Carmen Reyes' }, noop: () => {},
      yes: true, no: false, n16: 16, n18: 18,
      types: C.PRODUCT_TYPES || ['Basketball Jersey', 'Volleyball Jersey', 'Moto Riding Jersey', 'Long Sleeves', 'Polo Shirt', 'Custom Design'],
      statusOpts: [{ value: 'pending', label: 'Pending' }, { value: 'mockup', label: 'Mockup' }, { value: 'production', label: 'In Production' }, { value: 'ready', label: 'Ready' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }],
      images: [{ id: 'a', name: 'front-mockup.png', number: '23' }, { id: 'b', name: 'back-mockup.png', number: '11' }, { id: 'c', name: 'shorts.png' }, { id: 'd', name: 'reference.jpg', number: '05' }],
      items: items.map((x, i) => Object.assign({}, x, {
        n: i + 1, line: peso(num(x.qty) * num(x.price)),
        onType: upd(x.id, 'type'), onDesc: upd(x.id, 'desc'), onSize: upd(x.id, 'size'), onQty: upd(x.id, 'qty'), onPrice: upd(x.id, 'price'),
        remove: () => this.setState({ items: this.state.items.filter((y) => y.id !== x.id) })
      })),
      noItems: items.length === 0,
      addItem: () => { this.seq += 1; this.setState({ items: this.state.items.concat([{ id: this.seq, type: 'Basketball Jersey', desc: '', size: '', qty: '1', price: '0.00' }]) }); },
      subtotal: peso(subtotal), pcs, count: items.length,
      itemsLine: 'Add as many lines as you need — sizes and variants can share a line.'
    };
  }
}
</script>
```

### E.10 Order Detail — `/admin/orders/:id` (tabs, add/edit modals, deletes, lightbox)

```html
<div class="s-page" data-theme="{{theme}}">
<div class="s-admin">
  <div class="s-admin-side">
    <x-import component-from-global-scope="CSP.Sidebar" active="orders" role="manager" user="{{me}}"></x-import>
  </div>
  <div class="s-admin-main">
    <x-import component-from-global-scope="CSP.Topbar" user="{{me}}" role="manager" theme="{{theme}}" on-toggle-theme="{{noop}}"></x-import>

    <main class="s-body">
      <sc-if value="{{deleted}}" hint-placeholder-val="{{no}}">
        <div class="s-banner is-danger" role="status" style="align-items: center">
          <x-import component-from-global-scope="CSP.Icon" name="trash-2" size="{{n20}}"></x-import>
          <div style="flex: 1"><strong>ORD-2026-0148 was deleted.</strong><span>Its 5 items, payments, discounts, expenses and images were removed.</span></div>
          <a class="csp-btn csp-btn-secondary csp-btn-sm" href="Orders.dc.html">Back to Orders</a>
        </div>
      </sc-if>

      <div class="s-ph">
        <div class="s-ph-title">
          <a class="s-back" href="Orders.dc.html"><x-import component-from-global-scope="CSP.Icon" name="chevron-left" size="{{n16}}"></x-import>Orders</a>
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px">
            <h1 style="color: var(--accent-ink); letter-spacing: .02em">ORD-2026-0148</h1>
            <x-import component-from-global-scope="CSP.StatusBadge" status="production"></x-import>
          </div>
          <p><strong style="color: var(--ink)">Brgy. San Roque Ballers</strong> · Juan Dela Cruz · Ordered Sep 28, 2026 · Due Oct 14, 2026 (8 days left)</p>
        </div>
        <div class="s-ph-actions">
          <a class="csp-btn csp-btn-secondary csp-btn-md" href="OrderForm.dc.html"><x-import component-from-global-scope="CSP.Icon" name="pencil" size="{{n18}}"></x-import>Edit</a>
          <button type="button" class="csp-btn csp-btn-ghost-danger csp-btn-md" style="border: 1px solid var(--line-strong)" onClick="{{askDeleteOrder}}"><x-import component-from-global-scope="CSP.Icon" name="trash-2" size="{{n18}}"></x-import>Delete</button>
        </div>
      </div>

      <div class="s-detail">
        <div class="s-detail-main">
          <div class="s-gallery">
            <sc-for list="{{gallery}}" as="g" hint-placeholder-count="4">
              <button type="button" onClick="{{g.open}}" aria-label="Open {{g.name}}">
                <x-import component-from-global-scope="CSP.MediaPlaceholder" number="{{g.number}}" label="{{g.name}}"></x-import>
                <sc-if value="{{g.cover}}" hint-placeholder-val="{{no}}"><span class="s-cover-tag csp-badge csp-badge-solid">COVER</span></sc-if>
              </button>
            </sc-for>
            <a href="OrderForm.dc.html" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; border: 2px dashed var(--line-strong); border-radius: 12px; color: var(--ink-muted); text-decoration: none; font-size: 13px; font-weight: 600"><x-import component-from-global-scope="CSP.Icon" name="cloud-upload" size="{{n22}}"></x-import>Manage images</a>
          </div>

          <section class="s-card s-tabcard">
            <x-import component-from-global-scope="CSP.Tabs" items="{{tabs}}" value="{{tab}}" on-change="{{setTab}}"></x-import>

            <sc-if value="{{isItems}}" hint-placeholder-val="{{yes}}">
              <div class="s-tabbar-h"><div><h3>Order items</h3><p class="s-cap">Quantity × unit price. Changes update the total instantly.</p></div>
                <button type="button" class="csp-btn csp-btn-primary csp-btn-sm" onClick="{{add.item}}"><x-import component-from-global-scope="CSP.Icon" name="plus" size="{{n16}}"></x-import>Add Item</button></div>
              <div class="s-rt-wrap" style="border-left: 0; border-right: 0; border-bottom: 0; border-radius: 0 0 12px 12px">
                <table class="s-rt">
                  <thead><tr><th>Product</th><th>Description</th><th>Size</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Line total</th><th class="r"><span class="csp-sr">Actions</span></th></tr></thead>
                  <tbody>
                    <sc-for list="{{items}}" as="r" hint-placeholder-count="5">
                      <tr>
                        <td class="is-lead" data-label="Product"><strong>{{r.type}}</strong></td>
                        <td data-label="Description">{{r.desc}}</td>
                        <td data-label="Size" class="s-muted">{{r.size}}</td>
                        <td data-label="Qty" class="r m">{{r.qty}}</td>
                        <td data-label="Unit price" class="r m">{{r.priceF}}</td>
                        <td data-label="Line total" class="r m">{{r.lineF}}</td>
                        <td class="r is-acts"><span class="s-acts"><button type="button" class="s-iconbtn" onClick="{{r.edit}}" aria-label="Edit item"><x-import component-from-global-scope="CSP.Icon" name="pencil" size="{{n18}}"></x-import></button><button type="button" class="s-iconbtn is-danger" onClick="{{r.del}}" aria-label="Delete item"><x-import component-from-global-scope="CSP.Icon" name="trash-2" size="{{n18}}"></x-import></button></span></td>
                      </tr>
                    </sc-for>
                  </tbody>
                  <tfoot><tr><td data-label="Subtotal" colspan="5">Items subtotal · {{pcs}} pcs</td><td data-label="Subtotal" class="r m">{{tf.total}}</td><td></td></tr></tfoot>
                </table>
              </div>
            </sc-if>

            <sc-if value="{{isPayments}}" hint-placeholder-val="{{no}}">
              <div class="s-tabbar-h"><div><h3>Payments</h3><p class="s-cap">Downpayments and settlements. Balance due: <strong style="color: var(--ink)">{{tf.balance}}</strong></p></div>
                <button type="button" class="csp-btn csp-btn-primary csp-btn-sm" onClick="{{add.payment}}"><x-import component-from-global-scope="CSP.Icon" name="plus" size="{{n16}}"></x-import>Add Payment</button></div>
              <sc-if value="{{noPayments}}" hint-placeholder-val="{{no}}"><div class="s-inline-empty">No payments recorded yet.<button type="button" class="csp-btn csp-btn-ghost csp-btn-sm" onClick="{{add.payment}}">+ Add Payment</button></div></sc-if>
              <div class="s-rt-wrap" style="border-left: 0; border-right: 0; border-bottom: 0; border-radius: 0 0 12px 12px">
                <table class="s-rt">
                  <thead><tr><th>Date</th><th>Method</th><th>Reference no.</th><th>Notes</th><th class="r">Amount</th><th class="r"><span class="csp-sr">Actions</span></th></tr></thead>
                  <tbody>
                    <sc-for list="{{payments}}" as="r" hint-placeholder-count="2">
                      <tr>
                        <td class="is-lead" data-label="Date"><strong>{{r.dateF}}</strong></td>
                        <td data-label="Method"><x-import component-from-global-scope="CSP.Badge" tone="{{r.tone}}">{{r.method}}</x-import></td>
                        <td data-label="Reference" class="s-num">{{r.ref}}</td>
                        <td data-label="Notes" class="s-muted">{{r.notes}}</td>
                        <td data-label="Amount" class="r m">{{r.amountF}}</td>
                        <td class="r is-acts"><span class="s-acts"><button type="button" class="s-iconbtn" onClick="{{r.edit}}" aria-label="Edit payment"><x-import component-from-global-scope="CSP.Icon" name="pencil" size="{{n18}}"></x-import></button><button type="button" class="s-iconbtn is-danger" onClick="{{r.del}}" aria-label="Delete payment"><x-import component-from-global-scope="CSP.Icon" name="trash-2" size="{{n18}}"></x-import></button></span></td>
                      </tr>
                    </sc-for>
                  </tbody>
                  <tfoot><tr><td data-label="Total paid" colspan="4">Total paid</td><td data-label="Total paid" class="r m">{{tf.paid}}</td><td></td></tr></tfoot>
                </table>
              </div>
            </sc-if>

            <sc-if value="{{isDiscounts}}" hint-placeholder-val="{{no}}">
              <div class="s-tabbar-h"><div><h3>Discounts</h3><p class="s-cap">Percentages apply to the items total.</p></div>
                <button type="button" class="csp-btn csp-btn-primary csp-btn-sm" onClick="{{add.discount}}"><x-import component-from-global-scope="CSP.Icon" name="plus" size="{{n16}}"></x-import>Add Discount</button></div>
              <div class="s-rt-wrap" style="border-left: 0; border-right: 0; border-bottom: 0; border-radius: 0 0 12px 12px">
                <table class="s-rt">
                  <thead><tr><th>Reason</th><th>Type</th><th class="r">Value</th><th class="r">Amount</th><th class="r"><span class="csp-sr">Actions</span></th></tr></thead>
                  <tbody>
                    <sc-for list="{{discounts}}" as="r" hint-placeholder-count="1">
                      <tr>
                        <td class="is-lead" data-label="Reason"><strong>{{r.reason}}</strong></td>
                        <td data-label="Type"><x-import component-from-global-scope="CSP.Badge">{{r.typeL}}</x-import></td>
                        <td data-label="Value" class="r m">{{r.valueF}}</td>
                        <td data-label="Amount" class="r m">{{r.amountF}}</td>
                        <td class="r is-acts"><span class="s-acts"><button type="button" class="s-iconbtn" onClick="{{r.edit}}" aria-label="Edit discount"><x-import component-from-global-scope="CSP.Icon" name="pencil" size="{{n18}}"></x-import></button><button type="button" class="s-iconbtn is-danger" onClick="{{r.del}}" aria-label="Delete discount"><x-import component-from-global-scope="CSP.Icon" name="trash-2" size="{{n18}}"></x-import></button></span></td>
                      </tr>
                    </sc-for>
                  </tbody>
                  <tfoot><tr><td data-label="Total discount" colspan="3">Total discount</td><td data-label="Total discount" class="r m">{{tf.discount}}</td><td></td></tr></tfoot>
                </table>
              </div>
            </sc-if>

            <sc-if value="{{isExpenses}}" hint-placeholder-val="{{no}}">
              <div class="s-tabbar-h"><div><h3>Order expenses</h3><p class="s-cap">Internal costs for this order — not shown to the customer.</p></div>
                <button type="button" class="csp-btn csp-btn-primary csp-btn-sm" onClick="{{add.expense}}"><x-import component-from-global-scope="CSP.Icon" name="plus" size="{{n16}}"></x-import>Add Expense</button></div>
              <div class="s-rt-wrap" style="border-left: 0; border-right: 0; border-bottom: 0; border-radius: 0 0 12px 12px">
                <table class="s-rt">
                  <thead><tr><th>Date</th><th>Category</th><th>Description</th><th class="r">Amount</th><th class="r"><span class="csp-sr">Actions</span></th></tr></thead>
                  <tbody>
                    <sc-for list="{{expenses}}" as="r" hint-placeholder-count="3">
                      <tr>
                        <td class="is-lead" data-label="Date"><strong>{{r.dateF}}</strong></td>
                        <td data-label="Category"><x-import component-from-global-scope="CSP.Badge">{{r.category}}</x-import></td>
                        <td data-label="Description">{{r.desc}}</td>
                        <td data-label="Amount" class="r m">{{r.amountF}}</td>
                        <td class="r is-acts"><span class="s-acts"><button type="button" class="s-iconbtn" onClick="{{r.edit}}" aria-label="Edit expense"><x-import component-from-global-scope="CSP.Icon" name="pencil" size="{{n18}}"></x-import></button><button type="button" class="s-iconbtn is-danger" onClick="{{r.del}}" aria-label="Delete expense"><x-import component-from-global-scope="CSP.Icon" name="trash-2" size="{{n18}}"></x-import></button></span></td>
                      </tr>
                    </sc-for>
                  </tbody>
                  <tfoot><tr><td data-label="Order expenses" colspan="3">Order expenses</td><td data-label="Order expenses" class="r m">{{tf.expenses}}</td><td></td></tr></tfoot>
                </table>
              </div>
            </sc-if>
          </section>
        </div>

        <aside class="s-detail-side">
          <x-import component-from-global-scope="CSP.OrderTotals" totals="{{totals}}" variant="panel"></x-import>
          <section class="s-card">
            <div class="s-card-h"><div><h2>Customer</h2></div><a class="s-link s-small" href="OrderForm.dc.html">Edit</a></div>
            <div class="s-card-b">
              <dl class="s-meta">
                <dt><x-import component-from-global-scope="CSP.Icon" name="user-round" size="{{n16}}"></x-import>Name</dt><dd>Juan Dela Cruz</dd>
                <dt><x-import component-from-global-scope="CSP.Icon" name="users" size="{{n16}}"></x-import>Team</dt><dd>Brgy. San Roque Ballers</dd>
                <dt><x-import component-from-global-scope="CSP.Icon" name="phone" size="{{n16}}"></x-import>Contact</dt><dd>0917 123 4567</dd>
                <dt><x-import component-from-global-scope="CSP.Icon" name="mail" size="{{n16}}"></x-import>Email</dt><dd>juan.dc@gmail.com</dd>
                <dt><x-import component-from-global-scope="CSP.Icon" name="map-pin" size="{{n16}}"></x-import>Address</dt><dd>Brgy. San Roque, Marikina City</dd>
              </dl>
              <div class="s-note" style="margin-top: 16px"><x-import component-from-global-scope="CSP.Icon" name="info" size="{{n16}}"></x-import><span>V-neck, black and volt. Captain wants names in caps. Coach polos need embroidered logo.</span></div>
            </div>
          </section>
        </aside>
      </div>
    </main>

    <nav class="s-tabbar" aria-label="Admin">
      <a class="s-tab-i" href="Dashboard.dc.html"><x-import component-from-global-scope="CSP.Icon" name="layout-dashboard" size="{{n22}}"></x-import>Dashboard</a>
      <a class="s-tab-i is-on" href="Orders.dc.html"><x-import component-from-global-scope="CSP.Icon" name="clipboard-list" size="{{n22}}"></x-import>Orders</a>
      <a class="s-tab-i" href="Expenses.dc.html"><x-import component-from-global-scope="CSP.Icon" name="receipt" size="{{n22}}"></x-import>Expenses</a>
      <a class="s-tab-i" href="Profile.dc.html"><x-import component-from-global-scope="CSP.Icon" name="user-round" size="{{n22}}"></x-import>Profile</a>
    </nav>
  </div>
</div>

<!-- add / edit modal -->
<sc-if value="{{m.open}}" hint-placeholder-val="{{no}}">
  <div class="s-overlay">
    <div class="csp-modal" role="dialog" aria-modal="true" aria-label="{{m.title}}">
      <header class="csp-modal-head">
        <div><h2 class="csp-modal-title">{{m.title}}</h2><p class="csp-modal-desc">ORD-2026-0148 · Brgy. San Roque Ballers</p></div>
        <button type="button" class="csp-iconbtn" onClick="{{closeModal}}" aria-label="Close"><x-import component-from-global-scope="CSP.Icon" name="x" size="{{n20}}"></x-import></button>
      </header>
      <div class="csp-modal-body">
        <sc-if value="{{m.error}}" hint-placeholder-val="{{no}}">
          <div class="s-banner is-danger" role="alert"><x-import component-from-global-scope="CSP.Icon" name="triangle-alert" size="{{n18}}"></x-import><div><strong>{{m.error}}</strong></div></div>
        </sc-if>

        <sc-if value="{{m.isPayment}}" hint-placeholder-val="{{yes}}">
          <div class="csp-form-grid">
            <div class="csp-field"><label class="csp-label" for="p-date">Date</label><div class="csp-control"><input id="p-date" class="csp-input" type="date" value="{{m.d.date}}" onChange="{{m.set.date}}"></div></div>
            <div class="csp-field"><label class="csp-label" for="p-amt">Amount</label><div class="csp-control has-prefix"><span class="csp-prefix">₱</span><input id="p-amt" class="csp-input" inputMode="decimal" value="{{m.d.amount}}" onChange="{{m.set.amount}}"></div><p class="csp-msg">Balance due: {{tf.balance}}</p></div>
            <div class="csp-field"><label class="csp-label" for="p-method">Method</label><div class="csp-control csp-select"><select id="p-method" class="csp-input" value="{{m.d.method}}" onChange="{{m.set.method}}"><sc-for list="{{methods}}" as="o" hint-placeholder-count="4"><option value="{{o}}">{{o}}</option></sc-for></select><span class="csp-select-chev"><x-import component-from-global-scope="CSP.Icon" name="chevron-down" size="{{n16}}"></x-import></span></div></div>
            <div class="csp-field"><label class="csp-label" for="p-ref">Reference number</label><div class="csp-control"><input id="p-ref" class="csp-input" value="{{m.d.ref}}" onChange="{{m.set.ref}}" placeholder="GCash / Maya / bank ref."></div></div>
            <div class="csp-field is-wide"><label class="csp-label" for="p-notes">Notes</label><div class="csp-control"><input id="p-notes" class="csp-input" value="{{m.d.notes}}" onChange="{{m.set.notes}}" placeholder="Optional"></div></div>
          </div>
        </sc-if>

        <sc-if value="{{m.isItem}}" hint-placeholder-val="{{no}}">
          <div class="csp-form-grid">
            <div class="csp-field"><label class="csp-label" for="i-type">Product type</label><div class="csp-control csp-select"><select id="i-type" class="csp-input" value="{{m.d.type}}" onChange="{{m.set.type}}"><sc-for list="{{types}}" as="o" hint-placeholder-count="6"><option value="{{o}}">{{o}}</option></sc-for></select><span class="csp-select-chev"><x-import component-from-global-scope="CSP.Icon" name="chevron-down" size="{{n16}}"></x-import></span></div></div>
            <div class="csp-field"><label class="csp-label" for="i-size">Size / variant</label><div class="csp-control"><input id="i-size" class="csp-input" value="{{m.d.size}}" onChange="{{m.set.size}}" placeholder="S–XL"></div></div>
            <div class="csp-field is-wide"><label class="csp-label" for="i-desc">Description</label><div class="csp-control"><input id="i-desc" class="csp-input" value="{{m.d.desc}}" onChange="{{m.set.desc}}" placeholder="e.g. Jersey top, sublimated"></div></div>
            <div class="csp-field"><label class="csp-label" for="i-qty">Quantity</label><div class="csp-control"><input id="i-qty" class="csp-input" inputMode="numeric" value="{{m.d.qty}}" onChange="{{m.set.qty}}"></div></div>
            <div class="csp-field"><label class="csp-label" for="i-price">Unit price</label><div class="csp-control has-prefix"><span class="csp-prefix">₱</span><input id="i-price" class="csp-input" inputMode="decimal" value="{{m.d.price}}" onChange="{{m.set.price}}"></div><p class="csp-msg">Line total: {{m.preview}}</p></div>
          </div>
        </sc-if>

        <sc-if value="{{m.isDiscount}}" hint-placeholder-val="{{no}}">
          <div class="csp-form-grid">
            <div class="csp-field is-wide"><label class="csp-label" for="d-reason">Description / reason</label><div class="csp-control"><input id="d-reason" class="csp-input" value="{{m.d.reason}}" onChange="{{m.set.reason}}" placeholder="e.g. Barangay league discount"></div></div>
            <div class="csp-field"><span class="csp-label">Type</span><x-import component-from-global-scope="CSP.SegmentedControl" label="Discount type" value="{{m.d.type}}" on-change="{{m.setType}}" options="{{discTypes}}"></x-import></div>
            <div class="csp-field"><label class="csp-label" for="d-val">Value</label><div class="csp-control has-prefix"><span class="csp-prefix">{{m.unit}}</span><input id="d-val" class="csp-input" inputMode="decimal" value="{{m.d.value}}" onChange="{{m.set.value}}"></div><p class="csp-msg">Computed amount: {{m.preview}}</p></div>
          </div>
        </sc-if>

        <sc-if value="{{m.isExpense}}" hint-placeholder-val="{{no}}">
          <div class="csp-form-grid">
            <div class="csp-field"><label class="csp-label" for="e-date">Date</label><div class="csp-control"><input id="e-date" class="csp-input" type="date" value="{{m.d.date}}" onChange="{{m.set.date}}"></div></div>
            <div class="csp-field"><label class="csp-label" for="e-cat">Category</label><div class="csp-control csp-select"><select id="e-cat" class="csp-input" value="{{m.d.category}}" onChange="{{m.set.category}}"><sc-for list="{{expCats}}" as="o" hint-placeholder-count="6"><option value="{{o}}">{{o}}</option></sc-for></select><span class="csp-select-chev"><x-import component-from-global-scope="CSP.Icon" name="chevron-down" size="{{n16}}"></x-import></span></div></div>
            <div class="csp-field is-wide"><label class="csp-label" for="e-desc">Description</label><div class="csp-control"><input id="e-desc" class="csp-input" value="{{m.d.desc}}" onChange="{{m.set.desc}}" placeholder="e.g. Dri-fit mesh, 45 yds"></div></div>
            <div class="csp-field"><label class="csp-label" for="e-amt">Amount</label><div class="csp-control has-prefix"><span class="csp-prefix">₱</span><input id="e-amt" class="csp-input" inputMode="decimal" value="{{m.d.amount}}" onChange="{{m.set.amount}}"></div></div>
          </div>
        </sc-if>
      </div>
      <footer class="csp-modal-foot">
        <button type="button" class="csp-btn csp-btn-secondary csp-btn-md" onClick="{{closeModal}}">Cancel</button>
        <button type="button" class="csp-btn csp-btn-primary csp-btn-md" onClick="{{save}}"><x-import component-from-global-scope="CSP.Icon" name="check" size="{{n18}}"></x-import>{{m.cta}}</button>
      </footer>
    </div>
  </div>
</sc-if>

<!-- delete confirmations -->
<sc-if value="{{cf.open}}" hint-placeholder-val="{{no}}">
  <div class="s-overlay">
    <x-import component-from-global-scope="CSP.ConfirmDialog" inline="{{yes}}" title="{{cf.title}}" message="{{cf.message}}" counts="{{cf.counts}}" confirm-text="{{cf.confirmText}}" confirm-label="{{cf.label}}" on-cancel="{{cancelConfirm}}" on-confirm="{{doConfirm}}"></x-import>
  </div>
</sc-if>

<!-- lightbox -->
<sc-if value="{{lb.open}}" hint-placeholder-val="{{no}}">
  <div class="s-lightbox" role="dialog" aria-modal="true" aria-label="Order images">
    <div class="s-lb-top"><span class="s-small">{{lb.pos}} · {{lb.name}}</span><button type="button" class="s-lb-close" onClick="{{lb.close}}" aria-label="Close viewer"><x-import component-from-global-scope="CSP.Icon" name="x" size="{{n20}}"></x-import></button></div>
    <div class="s-lb-stage">
      <button type="button" class="s-lb-nav" onClick="{{lb.prev}}" aria-label="Previous image"><x-import component-from-global-scope="CSP.Icon" name="chevron-left" size="{{n22}}"></x-import></button>
      <div class="s-lb-img"><x-import component-from-global-scope="CSP.MediaPlaceholder" number="{{lb.number}}" label="{{lb.name}}"></x-import></div>
      <button type="button" class="s-lb-nav" onClick="{{lb.next}}" aria-label="Next image"><x-import component-from-global-scope="CSP.Icon" name="chevron-right" size="{{n22}}"></x-import></button>
    </div>
  </div>
</sc-if>

<sc-if value="{{toast}}" hint-placeholder-val="{{no}}">
  <div class="s-toast-layer">
    <x-import component-from-global-scope="CSP.Toast" tone="success" title="{{toast.title}}" message="{{toast.message}}" on-close="{{closeToast}}"></x-import>
  </div>
</sc-if>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"theme":{"editor":"enum","options":["light","dark"],"default":"light"},"initial":{"editor":"enum","options":["none","payment","delete","edit-payment"],"default":"none"},"$preview":{"width":1440,"height":1600}}'>
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.seq = 100;
    const init = props.initial || 'none';
    const st = {
      tab: init === 'payment' || init === 'edit-payment' ? 'payments' : 'items',
      items: [
        { id: 1, type: 'Basketball Jersey', desc: 'Jersey top — sublimated, names & numbers', size: 'S–XL', qty: 15, price: 650 },
        { id: 2, type: 'Basketball Jersey', desc: 'Shorts — matching colorway', size: 'S–XL', qty: 15, price: 300 },
        { id: 3, type: 'Polo Shirt', desc: 'Coach polo, embroidered logo', size: 'L', qty: 2, price: 550 },
        { id: 4, type: 'Long Sleeves', desc: 'Warm-up shooting shirt', size: 'S–XL', qty: 15, price: 420 },
        { id: 5, type: 'Custom Design', desc: 'Team logo redraw & vector cleanup', size: '—', qty: 1, price: 800 }
      ],
      payments: [
        { id: 1, date: '2026-09-28', amount: 10000, method: 'GCash', ref: '9012 345 678901', notes: '50% downpayment' },
        { id: 2, date: '2026-10-03', amount: 2000, method: 'Cash', ref: '—', notes: 'For 2 added coach polos' }
      ],
      discounts: [{ id: 1, reason: 'Barangay league discount', type: 'percentage', value: 5 }],
      expenses: [
        { id: 1, date: '2026-10-01', category: 'Fabric', desc: 'Dri-fit mesh, 45 yds', amount: 3825 },
        { id: 2, date: '2026-10-02', category: 'Ink & paper', desc: 'Sublimation ink + transfer paper', amount: 1640 },
        { id: 3, date: '2026-10-04', category: 'Outsourcing', desc: 'Embroidery — coach polos', amount: 600 }
      ],
      modal: null, confirm: null, toast: null, lb: null, deleted: false
    };
    if (init === 'payment') st.modal = { kind: 'payment', id: null, d: { date: '2026-10-06', amount: '5,000.00', method: 'GCash', ref: '9012 456 789012', notes: 'Second partial payment' } };
    if (init === 'edit-payment') st.modal = { kind: 'payment', id: 1, d: { date: '2026-09-28', amount: '10,000.00', method: 'GCash', ref: '9012 345 678901', notes: '50% downpayment' } };
    if (init === 'delete') st.confirm = { kind: 'order' };
    this.state = st;
  }
  renderVals() {
    const C = window.CSP || {};
    const peso = C.formatPeso || ((n) => '₱' + Number(n).toFixed(2));
    const fd = C.formatDate || ((d) => d);
    const totalsOf = C.orderTotals || (() => ({ total: 0, discount: 0, paid: 0, balance: 0, expenses: 0, profit: 0, fullyPaid: false }));
    const dAmt = C.discountAmount || (() => 0);
    const num = (v) => Number(String(v).replace(/[^0-9.]/g, '')) || 0;
    const s = this.state;
    const calc = (st) => totalsOf({ items: st.items.map((i) => ({ quantity: i.qty, unitPrice: i.price })), discounts: st.discounts, payments: st.payments, expenses: st.expenses });
    const t = calc(s);
    const LIST = { item: 'items', payment: 'payments', discount: 'discounts', expense: 'expenses' };
    const NAME = { item: 'Item', payment: 'Payment', discount: 'Discount', expense: 'Expense' };
    const blank = {
      item: () => ({ type: 'Basketball Jersey', desc: '', size: '', qty: '1', price: '' }),
      payment: () => ({ date: '2026-10-06', amount: '', method: 'GCash', ref: '', notes: '' }),
      discount: () => ({ reason: '', type: 'fixed', value: '' }),
      expense: () => ({ date: '2026-10-06', category: 'Fabric', desc: '', amount: '' })
    };
    const toDraft = (kind, r) => kind === 'item' ? { type: r.type, desc: r.desc, size: r.size, qty: String(r.qty), price: String(r.price) }
      : kind === 'payment' ? { date: r.date, amount: String(r.amount), method: r.method, ref: r.ref, notes: r.notes }
      : kind === 'discount' ? { reason: r.reason, type: r.type, value: String(r.value) }
      : { date: r.date, category: r.category, desc: r.desc, amount: String(r.amount) };
    const open = (kind, r) => () => this.setState({ modal: { kind, id: r ? r.id : null, d: r ? toDraft(kind, r) : blank[kind](), error: null }, toast: null });
    const askDel = (kind, r, label) => () => this.setState({ confirm: { kind, id: r.id, label }, toast: null });
    const flash = (title, message) => { this.setState({ toast: { title, message } }); clearTimeout(this.tt); this.tt = setTimeout(() => this.setState({ toast: null }), 4500); };

    const m = s.modal;
    const setField = (k) => (e) => this.setState({ modal: Object.assign({}, this.state.modal, { d: Object.assign({}, this.state.modal.d, { [k]: e.target.value }), error: null }) });
    const fields = ['date', 'amount', 'method', 'ref', 'notes', 'type', 'desc', 'size', 'qty', 'price', 'reason', 'value', 'category'];
    const set = {}; fields.forEach((k) => { set[k] = setField(k); });
    let preview = '';
    if (m && m.kind === 'item') preview = peso(num(m.d.qty) * num(m.d.price));
    if (m && m.kind === 'discount') preview = peso(dAmt({ type: m.d.type, value: num(m.d.value) }, t.total));

    const save = () => {
      const mm = this.state.modal; const d = mm.d; const kind = mm.kind;
      let rec, err = null;
      if (kind === 'payment') { rec = { date: d.date, amount: num(d.amount), method: d.method, ref: d.ref || '—', notes: d.notes }; if (!rec.amount) err = 'Enter an amount greater than ₱0.00.'; }
      if (kind === 'item') { rec = { type: d.type, desc: d.desc, size: d.size || '—', qty: num(d.qty), price: num(d.price) }; if (!rec.desc) err = 'Add a short description.'; else if (!rec.qty) err = 'Quantity must be at least 1.'; }
      if (kind === 'discount') { rec = { reason: d.reason, type: d.type, value: num(d.value) }; if (!rec.reason) err = 'Add a reason for the discount.'; else if (!rec.value) err = 'Enter a discount value.'; else if (d.type === 'percentage' && rec.value > 100) err = 'A percentage can’t be more than 100%.'; }
      if (kind === 'expense') { rec = { date: d.date, category: d.category, desc: d.desc, amount: num(d.amount) }; if (!rec.amount) err = 'Enter an amount greater than ₱0.00.'; }
      if (err) { this.setState({ modal: Object.assign({}, mm, { error: err }) }); return; }
      const key = LIST[kind]; const cur = this.state[key];
      let next;
      if (mm.id != null) next = cur.map((x) => x.id === mm.id ? Object.assign({ id: x.id }, rec) : x);
      else { this.seq += 1; next = cur.concat([Object.assign({ id: this.seq }, rec)]); }
      const ns = Object.assign({}, this.state, { [key]: next });
      const nt = calc(ns);
      this.setState({ [key]: next, modal: null, tab: key });
      flash(NAME[kind] + (mm.id != null ? ' updated' : ' added'), nt.fullyPaid ? 'Order is now fully paid.' : 'Balance now ' + peso(nt.balance));
    };

    const cf = s.confirm;
    let cfv = { open: false, counts: null };
    if (cf && cf.kind === 'order') {
      cfv = { open: true, title: 'Delete order ORD-2026-0148?', message: 'Brgy. San Roque Ballers · Juan Dela Cruz. The order will be permanently deleted along with everything inside it.',
        counts: { items: s.items.length, payments: s.payments.length, discounts: s.discounts.length, expenses: s.expenses.length, images: 4 }, confirmText: 'ORD-2026-0148', label: 'Delete Order' };
    } else if (cf) {
      cfv = { open: true, title: 'Delete ' + cf.label + '?', message: 'This removes it from ORD-2026-0148 and updates the totals right away.', counts: null, confirmText: undefined, label: 'Delete ' + NAME[cf.kind] };
    }
    const doConfirm = () => {
      const c = this.state.confirm;
      if (c.kind === 'order') { this.setState({ confirm: null, deleted: true }); flash('Order ORD-2026-0148 deleted', 'Removed with all its items, payments, discounts, expenses and images.'); return; }
      const key = LIST[c.kind]; const next = this.state[key].filter((x) => x.id !== c.id);
      const nt = calc(Object.assign({}, this.state, { [key]: next }));
      this.setState({ [key]: next, confirm: null });
      flash(NAME[c.kind] + ' deleted', 'Balance now ' + peso(nt.balance));
    };

    const imgs = [{ name: 'front-mockup.png', number: '23' }, { name: 'back-mockup.png', number: '23' }, { name: 'shorts.png', number: '11' }, { name: 'reference.jpg', number: '' }];
    const li = s.lb;
    const tone = { GCash: 'info', Maya: 'success', Cash: 'neutral', 'Bank Transfer': 'mockup' };
    return {
      theme: this.props.theme ?? 'light', me: { name: 'Carmen Reyes' }, noop: () => {},
      yes: true, no: false, n16: 16, n18: 18, n20: 20, n22: 22,
      deleted: s.deleted,
      tab: s.tab, setTab: (v) => this.setState({ tab: v }),
      isItems: s.tab === 'items', isPayments: s.tab === 'payments', isDiscounts: s.tab === 'discounts', isExpenses: s.tab === 'expenses',
      tabs: [{ id: 'items', label: 'Items', count: s.items.length }, { id: 'payments', label: 'Payments', count: s.payments.length }, { id: 'discounts', label: 'Discounts', count: s.discounts.length }, { id: 'expenses', label: 'Expenses', count: s.expenses.length }],
      totals: t,
      tf: { total: peso(t.total), paid: peso(t.paid), discount: peso(t.discount), expenses: peso(t.expenses), balance: peso(Math.max(0, t.balance)) },
      pcs: s.items.reduce((a, i) => a + num(i.qty), 0),
      add: { item: open('item'), payment: open('payment'), discount: open('discount'), expense: open('expense') },
      items: s.items.map((r) => Object.assign({}, r, { priceF: peso(r.price), lineF: peso(r.qty * r.price), edit: open('item', r), del: askDel('item', r, 'item “' + r.desc + '”') })),
      payments: s.payments.map((r) => Object.assign({}, r, { dateF: fd(r.date), amountF: peso(r.amount), tone: tone[r.method] || 'neutral', edit: open('payment', r), del: askDel('payment', r, 'payment of ' + peso(r.amount)) })),
      noPayments: s.payments.length === 0,
      discounts: s.discounts.map((r) => Object.assign({}, r, { typeL: r.type === 'percentage' ? 'Percentage' : 'Fixed amount', valueF: r.type === 'percentage' ? r.value + '%' : peso(r.value), amountF: peso(-dAmt(r, t.total)), edit: open('discount', r), del: askDel('discount', r, 'discount “' + r.reason + '”') })),
      expenses: s.expenses.map((r) => Object.assign({}, r, { dateF: fd(r.date), amountF: peso(r.amount), edit: open('expense', r), del: askDel('expense', r, 'expense “' + r.desc + '”') })),
      m: m ? {
        open: true, d: m.d, set, error: m.error, preview,
        setType: (v) => this.setState({ modal: Object.assign({}, this.state.modal, { d: Object.assign({}, this.state.modal.d, { type: v }) }) }),
        unit: m.d.type === 'percentage' ? '%' : '₱',
        title: (m.id != null ? 'Edit ' : 'Add ') + NAME[m.kind], cta: 'Save ' + NAME[m.kind],
        isPayment: m.kind === 'payment', isItem: m.kind === 'item', isDiscount: m.kind === 'discount', isExpense: m.kind === 'expense'
      } : { open: false, d: {}, set: {} },
      types: C.PRODUCT_TYPES || [], methods: C.PAYMENT_METHODS || ['Cash', 'GCash', 'Maya', 'Bank Transfer'],
      expCats: ['Fabric', 'Ink & paper', 'Outsourcing', 'Labor', 'Delivery', 'Others'],
      discTypes: [{ value: 'fixed', label: 'Fixed ₱' }, { value: 'percentage', label: 'Percent %' }],
      closeModal: () => this.setState({ modal: null }), save,
      askDeleteOrder: () => this.setState({ confirm: { kind: 'order' }, toast: null }),
      cf: cfv, cancelConfirm: () => this.setState({ confirm: null }), doConfirm,
      gallery: imgs.map((g, i) => Object.assign({}, g, { cover: i === 0, open: () => this.setState({ lb: i }) })),
      lb: li != null ? { open: true, name: imgs[li].name, number: imgs[li].number, pos: (li + 1) + ' / ' + imgs.length,
        close: () => this.setState({ lb: null }), prev: () => this.setState({ lb: (li + imgs.length - 1) % imgs.length }), next: () => this.setState({ lb: (li + 1) % imgs.length }) } : { open: false },
      toast: s.toast, closeToast: () => this.setState({ toast: null })
    };
  }
}
</script>
```

### E.11 Company Expenses — `/admin/expenses`

```html
<div class="s-page" data-theme="{{theme}}">
<div class="s-admin">
  <div class="s-admin-side">
    <x-import component-from-global-scope="CSP.Sidebar" active="expenses" role="manager" user="{{me}}"></x-import>
  </div>
  <div class="s-admin-main">
    <x-import component-from-global-scope="CSP.Topbar" user="{{me}}" role="manager" theme="{{theme}}" on-toggle-theme="{{noop}}"></x-import>

    <main class="s-body">
      <div class="s-ph">
        <div class="s-ph-title">
          <h1>Company Expenses</h1>
          <p>General business costs — rent, bills, payroll, supplies. Costs for a specific order go inside that order.</p>
        </div>
        <div class="s-ph-actions">
          <button type="button" class="csp-btn csp-btn-primary csp-btn-md" onClick="{{openAdd}}"><x-import component-from-global-scope="CSP.Icon" name="plus" size="{{n18}}"></x-import>Add Expense</button>
        </div>
      </div>

      <div class="s-g3">
        <x-import component-from-global-scope="CSP.KpiCard" label="This month · Oct" value="{{sum.month}}" icon="receipt" hint="{{sum.monthHint}}"></x-import>
        <x-import component-from-global-scope="CSP.KpiCard" label="Last month · Sep" value="{{sum.last}}" icon="calendar" hint="Full month"></x-import>
        <div class="csp-card csp-kpi">
          <div class="csp-kpi-head"><span class="csp-overline">Top category · Oct</span><span class="csp-kpi-icon"><x-import component-from-global-scope="CSP.Icon" name="trending-up" size="{{n18}}"></x-import></span></div>
          <div class="csp-kpi-value">{{sum.top}}</div>
          <div class="csp-kpi-foot"><span>{{sum.topHint}}</span></div>
        </div>
      </div>

      <div class="s-toolbar" role="search">
        <div style="display: flex; flex-direction: column; gap: 6px; flex: 1 1 260px">
          <label class="csp-label" for="ex-q" style="font-size: 12px; line-height: 16px; color: var(--ink-muted)">Search</label>
          <div class="s-search-box"><x-import component-from-global-scope="CSP.Icon" name="search" size="{{n18}}"></x-import><input id="ex-q" type="search" placeholder="Description or staff name"></div>
        </div>
        <x-import component-from-global-scope="CSP.Select" label="Category" options="{{cats}}" placeholder="All categories"></x-import>
        <x-import component-from-global-scope="CSP.Field" label="From" type="date" default-value="2026-09-06"></x-import>
        <x-import component-from-global-scope="CSP.Field" label="To" type="date" default-value="2026-10-06"></x-import>
      </div>

      <sc-if value="{{empty}}" hint-placeholder-val="{{no}}">
        <div class="csp-empty">
          <span class="csp-empty-icon"><x-import component-from-global-scope="CSP.Icon" name="receipt" size="{{n28}}"></x-import></span>
          <h3 class="csp-empty-title">No expenses recorded</h3>
          <p class="csp-empty-msg">Log rent, bills, payroll and supplies here to see monthly totals and where the money goes.</p>
          <button type="button" class="csp-btn csp-btn-primary csp-btn-md" onClick="{{openAdd}}"><x-import component-from-global-scope="CSP.Icon" name="plus" size="{{n18}}"></x-import>Add Expense</button>
        </div>
      </sc-if>

      <sc-if value="{{hasRows}}" hint-placeholder-val="{{yes}}">
        <div class="s-rt-wrap">
          <table class="s-rt">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th class="r">Amount</th><th>Recorded by</th><th class="r"><span class="csp-sr">Actions</span></th></tr></thead>
            <tbody>
              <sc-for list="{{rows}}" as="r" hint-placeholder-count="9">
                <tr>
                  <td class="is-lead" data-label="Date"><strong>{{r.dateF}}</strong></td>
                  <td data-label="Category"><x-import component-from-global-scope="CSP.Badge" tone="{{r.tone}}">{{r.category}}</x-import></td>
                  <td data-label="Description">{{r.desc}}</td>
                  <td data-label="Amount" class="r m">{{r.amountF}}</td>
                  <td data-label="Recorded by"><span class="csp-cell-user" style="gap: 8px"><x-import component-from-global-scope="CSP.Avatar" name="{{r.by}}" size="{{n24}}"></x-import>{{r.by}}</span></td>
                  <td class="r is-acts"><span class="s-acts"><button type="button" class="s-iconbtn" onClick="{{r.edit}}" aria-label="Edit expense"><x-import component-from-global-scope="CSP.Icon" name="pencil" size="{{n18}}"></x-import></button><button type="button" class="s-iconbtn is-danger" onClick="{{r.del}}" aria-label="Delete expense"><x-import component-from-global-scope="CSP.Icon" name="trash-2" size="{{n18}}"></x-import></button></span></td>
                </tr>
              </sc-for>
            </tbody>
            <tfoot><tr><td data-label="Total shown" colspan="3">{{rowCount}} expenses · Sep 6 – Oct 6, 2026</td><td data-label="Total shown" class="r m">{{shownTotal}}</td><td colspan="2"></td></tr></tfoot>
          </table>
        </div>
      </sc-if>
    </main>

    <nav class="s-tabbar" aria-label="Admin">
      <a class="s-tab-i" href="Dashboard.dc.html"><x-import component-from-global-scope="CSP.Icon" name="layout-dashboard" size="{{n22}}"></x-import>Dashboard</a>
      <a class="s-tab-i" href="Orders.dc.html"><x-import component-from-global-scope="CSP.Icon" name="clipboard-list" size="{{n22}}"></x-import>Orders</a>
      <a class="s-tab-i is-on" href="Expenses.dc.html"><x-import component-from-global-scope="CSP.Icon" name="receipt" size="{{n22}}"></x-import>Expenses</a>
      <a class="s-tab-i" href="Profile.dc.html"><x-import component-from-global-scope="CSP.Icon" name="user-round" size="{{n22}}"></x-import>Profile</a>
    </nav>
  </div>
</div>

<sc-if value="{{m.open}}" hint-placeholder-val="{{no}}">
  <div class="s-overlay">
    <div class="csp-modal" role="dialog" aria-modal="true" aria-label="{{m.title}}">
      <header class="csp-modal-head">
        <div><h2 class="csp-modal-title">{{m.title}}</h2><p class="csp-modal-desc">A general business cost, not tied to any order.</p></div>
        <button type="button" class="csp-iconbtn" onClick="{{closeModal}}" aria-label="Close"><x-import component-from-global-scope="CSP.Icon" name="x" size="{{n20}}"></x-import></button>
      </header>
      <div class="csp-modal-body">
        <div class="csp-form-grid">
          <div class="csp-field"><label class="csp-label" for="x-date">Date</label><div class="csp-control"><input id="x-date" class="csp-input" type="date" value="{{m.d.date}}" onChange="{{m.set.date}}"></div></div>
          <div class="csp-field"><label class="csp-label" for="x-cat">Category</label><div class="csp-control csp-select"><select id="x-cat" class="csp-input" value="{{m.d.category}}" onChange="{{m.set.category}}"><sc-for list="{{cats}}" as="o" hint-placeholder-count="7"><option value="{{o}}">{{o}}</option></sc-for></select><span class="csp-select-chev"><x-import component-from-global-scope="CSP.Icon" name="chevron-down" size="{{n16}}"></x-import></span></div></div>
          <div class="{{m.descCls}}" style="grid-column: 1 / -1"><label class="csp-label" for="x-desc">Description</label><div class="csp-control"><input id="x-desc" class="csp-input" value="{{m.d.desc}}" onChange="{{m.set.desc}}" placeholder="e.g. Meralco bill — October" aria-invalid="{{m.descBad}}"></div>
            <sc-if value="{{m.descBad}}" hint-placeholder-val="{{no}}"><p class="csp-msg csp-msg-error">Add a short description so others know what this was for.</p></sc-if></div>
          <div class="{{m.amtCls}}"><label class="csp-label" for="x-amt">Amount</label><div class="csp-control has-prefix"><span class="csp-prefix">₱</span><input id="x-amt" class="csp-input" inputMode="decimal" value="{{m.d.amount}}" onChange="{{m.set.amount}}" aria-invalid="{{m.amtBad}}"></div>
            <sc-if value="{{m.amtBad}}" hint-placeholder-val="{{no}}"><p class="csp-msg csp-msg-error">Enter an amount greater than ₱0.00.</p></sc-if></div>
          <div class="csp-field"><span class="csp-label">Recorded by</span><div class="csp-control" style="background: transparent; border-style: dashed"><span class="csp-input" style="display: flex; align-items: center; gap: 8px; color: var(--ink-muted)"><x-import component-from-global-scope="CSP.Avatar" name="Carmen Reyes" size="{{n24}}"></x-import>Carmen Reyes (you)</span></div></div>
        </div>
      </div>
      <footer class="csp-modal-foot">
        <button type="button" class="csp-btn csp-btn-secondary csp-btn-md" onClick="{{closeModal}}">Cancel</button>
        <button type="button" class="csp-btn csp-btn-primary csp-btn-md" onClick="{{save}}"><x-import component-from-global-scope="CSP.Icon" name="check" size="{{n18}}"></x-import>{{m.cta}}</button>
      </footer>
    </div>
  </div>
</sc-if>

<sc-if value="{{cf.open}}" hint-placeholder-val="{{no}}">
  <div class="s-overlay">
    <x-import component-from-global-scope="CSP.ConfirmDialog" inline="{{yes}}" title="{{cf.title}}" message="This expense will be removed from company records and monthly totals." confirm-label="Delete Expense" on-cancel="{{cancelDel}}" on-confirm="{{doDel}}"></x-import>
  </div>
</sc-if>

<sc-if value="{{toast}}" hint-placeholder-val="{{no}}">
  <div class="s-toast-layer">
    <x-import component-from-global-scope="CSP.Toast" tone="success" title="{{toast.title}}" message="{{toast.message}}" on-close="{{closeToast}}"></x-import>
  </div>
</sc-if>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"theme":{"editor":"enum","options":["dark","light"],"default":"light"},"initial":{"editor":"enum","options":["none","add","empty"],"default":"none"},"$preview":{"width":1440,"height":1300}}'>
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.seq = 50;
    const init = props.initial || 'none';
    const R = (id, date, category, desc, amount, by) => ({ id, date, category, desc, amount, by });
    this.state = {
      rows: init === 'empty' ? [] : [
        R(1, '2026-10-06', 'Supplies', 'Plotter cutting blades (3 pcs)', 640, 'Paolo Garcia'),
        R(2, '2026-10-05', 'Utilities', 'Meralco bill — September', 8642.35, 'Carmen Reyes'),
        R(3, '2026-10-05', 'Utilities', 'Maynilad water bill — September', 1215.6, 'Carmen Reyes'),
        R(4, '2026-10-04', 'Utilities', 'Converge fiber internet — October', 1899, 'Liza Mercado'),
        R(5, '2026-10-03', 'Supplies', 'Sublimation ink, 4 × 1L (CMYK)', 5480, 'Paolo Garcia'),
        R(6, '2026-10-02', 'Maintenance', 'Heat press service & new silicone pad', 2350, 'Paolo Garcia'),
        R(7, '2026-10-01', 'Rent', 'Shop rent — October', 18000, 'Carmen Reyes'),
        R(8, '2026-09-30', 'Salaries', 'Payroll, Sep 16–30 (4 staff)', 24000, 'Carmen Reyes'),
        R(9, '2026-09-26', 'Equipment', 'Thread trimmer & cutting mat', 1850, 'Liza Mercado')
      ],
      modal: init === 'add' ? { id: null, d: { date: '2026-10-06', category: 'Utilities', desc: 'Meralco bill — October', amount: '' }, tried: true } : null,
      del: null, toast: null
    };
  }
  renderVals() {
    const C = window.CSP || {};
    const peso = C.formatPeso || ((n) => '₱' + Number(n).toFixed(2));
    const fd = C.formatDate || ((d) => d);
    const num = (v) => Number(String(v).replace(/[^0-9.]/g, '')) || 0;
    const s = this.state;
    const oct = s.rows.filter((r) => r.date >= '2026-10-01');
    const monthTotal = oct.reduce((a, r) => a + r.amount, 0);
    const byCat = {}; oct.forEach((r) => { byCat[r.category] = (byCat[r.category] || 0) + r.amount; });
    const top = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a])[0];
    const tones = { Rent: 'accent', Utilities: 'info', Salaries: 'mockup', Supplies: 'warning', Equipment: 'success', Maintenance: 'neutral', Others: 'neutral' };
    const flash = (title, message) => { this.setState({ toast: { title, message } }); clearTimeout(this.tt); this.tt = setTimeout(() => this.setState({ toast: null }), 4500); };
    const m = s.modal;
    const setF = (k) => (e) => this.setState({ modal: Object.assign({}, this.state.modal, { d: Object.assign({}, this.state.modal.d, { [k]: e.target.value }) }) });
    const descBad = !!(m && m.tried && !m.d.desc.trim());
    const amtBad = !!(m && m.tried && !num(m.d.amount));
    const save = () => {
      const mm = this.state.modal; const d = mm.d;
      if (!d.desc.trim() || !num(d.amount)) { this.setState({ modal: Object.assign({}, mm, { tried: true }) }); return; }
      const rec = { date: d.date, category: d.category, desc: d.desc.trim(), amount: num(d.amount), by: 'Carmen Reyes' };
      let rows;
      if (mm.id != null) rows = this.state.rows.map((r) => r.id === mm.id ? Object.assign({ id: r.id }, rec) : r);
      else { this.seq += 1; rows = [Object.assign({ id: this.seq }, rec)].concat(this.state.rows); }
      rows = rows.slice().sort((a, b) => a.date < b.date ? 1 : -1);
      this.setState({ rows, modal: null });
      flash(mm.id != null ? 'Expense updated' : 'Expense added', peso(rec.amount) + ' · ' + rec.category);
    };
    const delRow = s.del != null ? s.rows.find((r) => r.id === s.del) : null;
    return {
      theme: this.props.theme ?? 'light', me: { name: 'Carmen Reyes' }, noop: () => {},
      yes: true, no: false, n16: 16, n18: 18, n20: 20, n22: 22, n24: 24, n28: 28,
      cats: C.EXPENSE_CATEGORIES || ['Rent', 'Utilities', 'Salaries', 'Supplies', 'Equipment', 'Maintenance', 'Others'],
      sum: {
        month: monthTotal, monthHint: oct.length + ' entries so far',
        last: 71904.2,
        top: top ? top : '—', topHint: top ? peso(byCat[top]) + ' · ' + Math.round(byCat[top] / monthTotal * 100) + '% of this month' : 'No expenses this month'
      },
      empty: s.rows.length === 0, hasRows: s.rows.length > 0,
      rows: s.rows.map((r) => Object.assign({}, r, {
        dateF: fd(r.date), amountF: peso(r.amount), tone: tones[r.category] || 'neutral',
        edit: () => this.setState({ modal: { id: r.id, d: { date: r.date, category: r.category, desc: r.desc, amount: String(r.amount) }, tried: false }, toast: null }),
        del: () => this.setState({ del: r.id, toast: null })
      })),
      rowCount: s.rows.length, shownTotal: peso(s.rows.reduce((a, r) => a + r.amount, 0)),
      openAdd: () => this.setState({ modal: { id: null, d: { date: '2026-10-06', category: 'Supplies', desc: '', amount: '' }, tried: false }, toast: null }),
      m: m ? {
        open: true, d: m.d,
        set: { date: setF('date'), category: setF('category'), desc: setF('desc'), amount: setF('amount') },
        title: m.id != null ? 'Edit Expense' : 'Add Expense', cta: m.id != null ? 'Save Changes' : 'Save Expense',
        descBad, amtBad, descCls: descBad ? 'csp-field is-invalid' : 'csp-field', amtCls: amtBad ? 'csp-field is-invalid' : 'csp-field'
      } : { open: false, d: {}, set: {} },
      closeModal: () => this.setState({ modal: null }), save,
      cf: { open: !!delRow, title: delRow ? 'Delete “' + delRow.desc + '” (' + peso(delRow.amount) + ')?' : '' },
      cancelDel: () => this.setState({ del: null }),
      doDel: () => { const r = delRow; this.setState({ rows: this.state.rows.filter((x) => x.id !== r.id), del: null }); flash('Expense deleted', r.desc); },
      toast: s.toast, closeToast: () => this.setState({ toast: null })
    };
  }
}
</script>
```

### E.12 Users — `/admin/users` (Manager only; slide-over)

```html
<div class="s-page" data-theme="{{theme}}">
<div class="s-admin">
  <div class="s-admin-side">
    <x-import component-from-global-scope="CSP.Sidebar" active="users" role="manager" user="{{me}}"></x-import>
  </div>
  <div class="s-admin-main">
    <x-import component-from-global-scope="CSP.Topbar" user="{{me}}" role="manager" theme="{{theme}}" on-toggle-theme="{{noop}}"></x-import>

    <main class="s-body">
      <div class="s-ph">
        <div class="s-ph-title">
          <div style="display: flex; align-items: center; gap: 10px"><h1>Users</h1><x-import component-from-global-scope="CSP.Badge" tone="accent" icon="shield-check">Manager only</x-import></div>
          <p>Who can sign in to CSPS Admin. Admins manage orders and expenses; Managers can also manage users.</p>
        </div>
        <div class="s-ph-actions">
          <button type="button" class="csp-btn csp-btn-primary csp-btn-md" onClick="{{openCreate}}"><x-import component-from-global-scope="CSP.Icon" name="plus" size="{{n18}}"></x-import>Add User</button>
        </div>
      </div>

      <div class="s-toolbar" role="search">
        <div style="display: flex; flex-direction: column; gap: 6px; flex: 1 1 260px">
          <label class="csp-label" for="u-q" style="font-size: 12px; line-height: 16px; color: var(--ink-muted)">Search</label>
          <div class="s-search-box"><x-import component-from-global-scope="CSP.Icon" name="search" size="{{n18}}"></x-import><input id="u-q" type="search" placeholder="Name or email"></div>
        </div>
        <x-import component-from-global-scope="CSP.Select" label="Role" options="{{roleOpts}}" placeholder="All roles"></x-import>
        <x-import component-from-global-scope="CSP.Select" label="Status" options="{{statusOpts}}" placeholder="All statuses"></x-import>
      </div>

      <div class="s-rt-wrap">
        <table class="s-rt">
          <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th class="r"><span class="csp-sr">Actions</span></th></tr></thead>
          <tbody>
            <sc-for list="{{users}}" as="u" hint-placeholder-count="5">
              <tr style="opacity: {{u.op}}">
                <td class="is-lead" data-label="User"><span class="csp-cell-user"><x-import component-from-global-scope="CSP.Avatar" name="{{u.name}}" size="{{n36}}"></x-import><span><strong>{{u.name}}</strong><span>{{u.you}}</span></span></span></td>
                <td data-label="Email">{{u.email}}</td>
                <td data-label="Role"><x-import component-from-global-scope="CSP.Badge" tone="{{u.roleTone}}">{{u.role}}</x-import></td>
                <td data-label="Status"><x-import component-from-global-scope="CSP.Badge" tone="{{u.statusTone}}" dot="{{yes}}">{{u.status}}</x-import></td>
                <td data-label="Created" class="s-muted">{{u.createdF}}</td>
                <td class="r is-acts">
                  <span class="s-acts">
                    <button type="button" class="s-iconbtn" onClick="{{u.edit}}" aria-label="Edit {{u.name}}"><x-import component-from-global-scope="CSP.Icon" name="pencil" size="{{n18}}"></x-import></button>
                    <sc-if value="{{u.canToggle}}" hint-placeholder-val="{{yes}}"><button type="button" class="s-iconbtn" onClick="{{u.toggle}}" aria-label="{{u.toggleLabel}}" title="{{u.toggleLabel}}"><x-import component-from-global-scope="CSP.Icon" name="{{u.toggleIcon}}" size="{{n18}}"></x-import></button></sc-if>
                    <sc-if value="{{u.canToggle}}" hint-placeholder-val="{{yes}}"><button type="button" class="s-iconbtn is-danger" onClick="{{u.del}}" aria-label="Delete {{u.name}}"><x-import component-from-global-scope="CSP.Icon" name="trash-2" size="{{n18}}"></x-import></button></sc-if>
                  </span>
                </td>
              </tr>
            </sc-for>
          </tbody>
        </table>
      </div>
      <p class="s-cap">You can't deactivate or delete your own account. Deactivated users can't sign in, but their records stay on orders and expenses.</p>
    </main>

    <nav class="s-tabbar" aria-label="Admin">
      <a class="s-tab-i" href="Dashboard.dc.html"><x-import component-from-global-scope="CSP.Icon" name="layout-dashboard" size="{{n22}}"></x-import>Dashboard</a>
      <a class="s-tab-i" href="Orders.dc.html"><x-import component-from-global-scope="CSP.Icon" name="clipboard-list" size="{{n22}}"></x-import>Orders</a>
      <a class="s-tab-i" href="Expenses.dc.html"><x-import component-from-global-scope="CSP.Icon" name="receipt" size="{{n22}}"></x-import>Expenses</a>
      <a class="s-tab-i is-on" href="Users.dc.html"><x-import component-from-global-scope="CSP.Icon" name="users" size="{{n22}}"></x-import>Users</a>
    </nav>
  </div>
</div>

<sc-if value="{{p.open}}" hint-placeholder-val="{{no}}">
  <div class="s-overlay" style="justify-content: flex-end; align-items: stretch; padding: 0">
    <div class="csp-modal csp-modal-slideover" role="dialog" aria-modal="true" aria-label="{{p.title}}" style="height: auto; min-height: 100%">
      <header class="csp-modal-head">
        <div><h2 class="csp-modal-title">{{p.title}}</h2><p class="csp-modal-desc">{{p.desc}}</p></div>
        <button type="button" class="csp-iconbtn" onClick="{{closePanel}}" aria-label="Close"><x-import component-from-global-scope="CSP.Icon" name="x" size="{{n20}}"></x-import></button>
      </header>
      <div class="csp-modal-body">
        <div class="csp-form-grid">
          <div class="csp-field"><label class="csp-label" for="nu-first">First name</label><div class="csp-control"><input id="nu-first" class="csp-input" value="{{p.d.first}}" onChange="{{p.set.first}}" autocomplete="off"></div></div>
          <div class="csp-field"><label class="csp-label" for="nu-last">Last name</label><div class="csp-control"><input id="nu-last" class="csp-input" value="{{p.d.last}}" onChange="{{p.set.last}}" autocomplete="off"></div></div>
          <div class="{{p.emailCls}}" style="grid-column: 1 / -1"><label class="csp-label" for="nu-email">Email</label><div class="csp-control"><input id="nu-email" class="csp-input" type="email" value="{{p.d.email}}" onChange="{{p.set.email}}" autocomplete="off"></div>
            <sc-if value="{{p.emailBad}}" hint-placeholder-val="{{no}}"><p class="csp-msg csp-msg-error">Enter a valid email, like name@gmail.com</p></sc-if>
            <sc-if value="{{p.emailOk}}" hint-placeholder-val="{{yes}}"><p class="csp-msg">They'll use this to sign in.</p></sc-if></div>
          <div class="csp-field" style="grid-column: 1 / -1"><span class="csp-label">Role</span>
            <x-import component-from-global-scope="CSP.SegmentedControl" label="Role" value="{{p.d.role}}" on-change="{{p.setRole}}" options="{{roles}}"></x-import>
            <p class="csp-msg">{{p.roleHint}}</p></div>
          <sc-if value="{{p.isNew}}" hint-placeholder-val="{{yes}}">
            <div style="grid-column: 1 / -1"><x-import component-from-global-scope="CSP.PasswordField" label="Temporary password" default-value="Csp-tahi-4821" show-strength="{{yes}}" hint="Share it privately. They'll be asked to change it on first sign-in."></x-import></div>
          </sc-if>
        </div>
      </div>
      <footer class="csp-modal-foot">
        <button type="button" class="csp-btn csp-btn-secondary csp-btn-md" onClick="{{closePanel}}">Cancel</button>
        <button type="button" class="csp-btn csp-btn-primary csp-btn-md" onClick="{{savePanel}}"><x-import component-from-global-scope="CSP.Icon" name="check" size="{{n18}}"></x-import>{{p.cta}}</button>
      </footer>
    </div>
  </div>
</sc-if>

<sc-if value="{{cf.open}}" hint-placeholder-val="{{no}}">
  <div class="s-overlay">
    <x-import component-from-global-scope="CSP.ConfirmDialog" inline="{{yes}}" title="{{cf.title}}" message="They won't be able to sign in. Orders and expenses they recorded stay, under their name. If they might come back, deactivate instead." confirm-label="Delete User" on-cancel="{{cancelDel}}" on-confirm="{{doDel}}"></x-import>
  </div>
</sc-if>

<sc-if value="{{toast}}" hint-placeholder-val="{{no}}">
  <div class="s-toast-layer">
    <x-import component-from-global-scope="CSP.Toast" tone="success" title="{{toast.title}}" message="{{toast.message}}" on-close="{{closeToast}}"></x-import>
  </div>
</sc-if>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"theme":{"editor":"enum","options":["dark","light"],"default":"light"},"initial":{"editor":"enum","options":["none","create"],"default":"none"},"$preview":{"width":1440,"height":1100}}'>
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.seq = 10;
    const U = (id, first, last, email, role, active, created) => ({ id, first, last, email, role, active, created });
    this.state = {
      users: [
        U(1, 'Carmen', 'Reyes', 'carmen.reyes.csp@gmail.com', 'Manager', true, '2026-01-12'),
        U(2, 'Paolo', 'Garcia', 'paolo.garcia@gmail.com', 'Admin', true, '2026-02-03'),
        U(3, 'Liza', 'Mercado', 'lizamercado09@gmail.com', 'Admin', true, '2026-03-18'),
        U(4, 'Rhea', 'Villanueva', 'rhea.villanueva@gmail.com', 'Manager', true, '2026-06-21'),
        U(5, 'Jomar', 'Santos', 'jomar.santos@yahoo.com', 'Admin', false, '2026-04-02')
      ],
      panel: props.initial === 'create' ? { id: null, d: { first: 'Joanna', last: 'Lim', email: 'joanna.lim@gmail', role: 'Admin' }, tried: true } : null,
      del: null, toast: null
    };
  }
  renderVals() {
    const C = window.CSP || {};
    const fd = C.formatDate || ((d) => d);
    const s = this.state;
    const flash = (title, message) => { this.setState({ toast: { title, message } }); clearTimeout(this.tt); this.tt = setTimeout(() => this.setState({ toast: null }), 4500); };
    const p = s.panel;
    const setF = (k) => (e) => this.setState({ panel: Object.assign({}, this.state.panel, { d: Object.assign({}, this.state.panel.d, { [k]: e.target.value }) }) });
    const validEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v || '');
    const emailBad = !!(p && p.tried && !validEmail(p.d.email));
    const savePanel = () => {
      const pp = this.state.panel; const d = pp.d;
      if (!validEmail(d.email) || !d.first.trim()) { this.setState({ panel: Object.assign({}, pp, { tried: true }) }); return; }
      let users;
      if (pp.id != null) users = this.state.users.map((u) => u.id === pp.id ? Object.assign({}, u, { first: d.first, last: d.last, email: d.email, role: d.role }) : u);
      else { this.seq += 1; users = this.state.users.concat([{ id: this.seq, first: d.first, last: d.last, email: d.email, role: d.role, active: true, created: '2026-10-06' }]); }
      this.setState({ users, panel: null });
      flash(pp.id != null ? 'User updated' : 'User created', d.first + ' ' + d.last + ' · ' + d.role);
    };
    const delU = s.del != null ? s.users.find((u) => u.id === s.del) : null;
    return {
      theme: this.props.theme ?? 'light', me: { name: 'Carmen Reyes' }, noop: () => {},
      yes: true, no: false, n18: 18, n20: 20, n22: 22, n36: 36,
      roleOpts: ['Admin', 'Manager'], statusOpts: ['Active', 'Inactive'],
      roles: [{ value: 'Admin', label: 'Admin', showLabel: true, icon: 'user-round' }, { value: 'Manager', label: 'Manager', showLabel: true, icon: 'shield-check' }],
      users: s.users.map((u) => {
        const me = u.id === 1;
        return {
          name: u.first + ' ' + u.last, email: u.email, role: u.role, roleTone: u.role === 'Manager' ? 'accent' : 'neutral',
          status: u.active ? 'Active' : 'Inactive', statusTone: u.active ? 'success' : 'neutral', op: u.active ? 1 : 0.72,
          createdF: fd(u.created), you: me ? 'You' : u.role, canToggle: !me,
          toggleLabel: u.active ? 'Deactivate ' + u.first : 'Activate ' + u.first, toggleIcon: u.active ? 'lock' : 'shield-check',
          toggle: () => { this.setState({ users: this.state.users.map((x) => x.id === u.id ? Object.assign({}, x, { active: !x.active }) : x) }); flash(u.active ? 'User deactivated' : 'User activated', u.first + ' ' + u.last + (u.active ? ' can no longer sign in.' : ' can sign in again.')); },
          edit: () => this.setState({ panel: { id: u.id, d: { first: u.first, last: u.last, email: u.email, role: u.role }, tried: false }, toast: null }),
          del: () => this.setState({ del: u.id, toast: null })
        };
      }),
      openCreate: () => this.setState({ panel: { id: null, d: { first: '', last: '', email: '', role: 'Admin' }, tried: false }, toast: null }),
      p: p ? {
        open: true, d: p.d, isNew: p.id == null,
        set: { first: setF('first'), last: setF('last'), email: setF('email') },
        setRole: (v) => this.setState({ panel: Object.assign({}, this.state.panel, { d: Object.assign({}, this.state.panel.d, { role: v }) }) }),
        title: p.id != null ? 'Edit User' : 'Add User', desc: p.id != null ? 'Update details or change their role.' : 'They can sign in right away with a temporary password.',
        cta: p.id != null ? 'Save Changes' : 'Create User',
        emailBad, emailOk: !emailBad, emailCls: emailBad ? 'csp-field is-invalid' : 'csp-field',
        roleHint: p.d.role === 'Manager' ? 'Managers can do everything Admins can, plus add, edit and remove users.' : 'Admins manage orders and company expenses.'
      } : { open: false, d: {}, set: {} },
      closePanel: () => this.setState({ panel: null }), savePanel,
      cf: { open: !!delU, title: delU ? 'Delete ' + delU.first + ' ' + delU.last + '?' : '' },
      cancelDel: () => this.setState({ del: null }),
      doDel: () => { const u = delU; this.setState({ users: this.state.users.filter((x) => x.id !== u.id), del: null }); flash('User deleted', u.first + ' ' + u.last); },
      toast: s.toast, closeToast: () => this.setState({ toast: null })
    };
  }
}
</script>
```

### E.13 My Profile — `/admin/profile`

```html
<div class="s-page" data-theme="{{theme}}">
<div class="s-admin">
  <div class="s-admin-side">
    <x-import component-from-global-scope="CSP.Sidebar" active="profile" role="manager" user="{{me}}"></x-import>
  </div>
  <div class="s-admin-main">
    <x-import component-from-global-scope="CSP.Topbar" user="{{me}}" role="manager" theme="{{theme}}" on-toggle-theme="{{noop}}"></x-import>

    <main class="s-body" style="max-width: 1120px">
      <section class="s-card s-profile-head">
        <div class="s-profile-stripe" aria-hidden="true"></div>
        <x-import component-from-global-scope="CSP.Avatar" name="Carmen Reyes" size="{{n72}}"></x-import>
        <div style="position: relative; display: flex; flex-direction: column; gap: 6px; min-width: 0">
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px"><h1>Carmen Reyes</h1><x-import component-from-global-scope="CSP.Badge" tone="accent" icon="shield-check">Manager</x-import></div>
          <p class="s-small s-muted">{{email}} · Member since Jan 12, 2026</p>
        </div>
      </section>

      <div class="s-cards2">
        <section class="s-card">
          <div class="s-card-h"><div><h2>Personal Information</h2><p>Shown on orders and expenses you record.</p></div></div>
          <div class="s-card-b s-stack">
            <div class="s-formgrid">
              <div class="csp-field"><label class="csp-label" for="pf-first">First name</label><div class="csp-control"><input id="pf-first" class="csp-input" value="{{first}}" onChange="{{setFirst}}" autocomplete="given-name"></div></div>
              <div class="csp-field"><label class="csp-label" for="pf-last">Last name</label><div class="csp-control"><input id="pf-last" class="csp-input" value="{{last}}" onChange="{{setLast}}" autocomplete="family-name"></div></div>
              <div class="{{emailCls}}" style="grid-column: 1 / -1"><label class="csp-label" for="pf-email">Email</label><div class="csp-control"><input id="pf-email" class="csp-input" type="email" value="{{email}}" onChange="{{setEmail}}" autocomplete="email"></div>
                <sc-if value="{{emailBad}}" hint-placeholder-val="{{no}}"><p class="csp-msg csp-msg-error">Enter a valid email, like name@gmail.com</p></sc-if>
                <sc-if value="{{emailOk}}" hint-placeholder-val="{{yes}}"><p class="csp-msg">You sign in with this email.</p></sc-if></div>
            </div>
          </div>
          <div class="s-card-foot">
            <button type="button" class="csp-btn csp-btn-primary csp-btn-md" onClick="{{saveInfo}}"><x-import component-from-global-scope="CSP.Icon" name="check" size="{{n18}}"></x-import>Save Changes</button>
          </div>
        </section>

        <section class="s-card">
          <div class="s-card-h"><div><h2>Change Password</h2><p>Use 8+ characters with a number and a symbol.</p></div></div>
          <div class="s-card-b s-stack">
            <x-import component-from-global-scope="CSP.PasswordField" label="Current password" default-value="tahi2026" autocomplete="current-password"></x-import>
            <x-import component-from-global-scope="CSP.PasswordField" label="New password" default-value="Csp!Volt26" show-strength="{{yes}}" autocomplete="new-password"></x-import>
            <x-import component-from-global-scope="CSP.PasswordField" label="Confirm new password" default-value="Csp!Volt62" autocomplete="new-password" error="Passwords don't match."></x-import>
          </div>
          <div class="s-card-foot">
            <button type="button" class="csp-btn csp-btn-primary csp-btn-md" onClick="{{savePw}}"><x-import component-from-global-scope="CSP.Icon" name="lock" size="{{n18}}"></x-import>Update Password</button>
          </div>
        </section>
      </div>
    </main>

    <nav class="s-tabbar" aria-label="Admin">
      <a class="s-tab-i" href="Dashboard.dc.html"><x-import component-from-global-scope="CSP.Icon" name="layout-dashboard" size="{{n22}}"></x-import>Dashboard</a>
      <a class="s-tab-i" href="Orders.dc.html"><x-import component-from-global-scope="CSP.Icon" name="clipboard-list" size="{{n22}}"></x-import>Orders</a>
      <a class="s-tab-i" href="Expenses.dc.html"><x-import component-from-global-scope="CSP.Icon" name="receipt" size="{{n22}}"></x-import>Expenses</a>
      <a class="s-tab-i is-on" href="Profile.dc.html"><x-import component-from-global-scope="CSP.Icon" name="user-round" size="{{n22}}"></x-import>Profile</a>
    </nav>
  </div>
</div>

<sc-if value="{{toast}}" hint-placeholder-val="{{yes}}">
  <div class="s-toast-layer">
    <x-import component-from-global-scope="CSP.Toast" tone="{{toastTone}}" title="{{toast.title}}" message="{{toast.message}}" on-close="{{closeToast}}"></x-import>
  </div>
</sc-if>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"theme":{"editor":"enum","options":["light","dark"],"default":"light"},"showToast":{"editor":"boolean","default":true},"$preview":{"width":1440,"height":1200}}'>
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = {
      first: 'Carmen', last: 'Reyes', email: 'carmen.reyes.csp@gmail.com',
      toast: (props.showToast ?? true) ? { title: 'Changes saved', message: 'Your name and email are updated.' } : null
    };
  }
  renderVals() {
    const s = this.state;
    const ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email);
    const flash = (title, message) => { this.setState({ toast: { title, message } }); clearTimeout(this.tt); this.tt = setTimeout(() => this.setState({ toast: null }), 4500); };
    return {
      theme: this.props.theme ?? 'light', me: { name: s.first + ' ' + s.last }, noop: () => {},
      yes: true, no: false, n18: 18, n22: 22, n72: 72,
      first: s.first, last: s.last, email: s.email,
      setFirst: (e) => this.setState({ first: e.target.value }), setLast: (e) => this.setState({ last: e.target.value }), setEmail: (e) => this.setState({ email: e.target.value }),
      emailBad: !ok, emailOk: ok, emailCls: ok ? 'csp-field' : 'csp-field is-invalid',
      saveInfo: () => { if (ok) flash('Changes saved', 'Your name and email are updated.'); },
      savePw: () => { this.setState({ toast: { tone: 'danger', title: 'Password not updated', message: 'The confirmation doesn’t match the new password.' } }); },
      toast: s.toast, toastTone: (s.toast && s.toast.tone) || 'success', closeToast: () => this.setState({ toast: null })
    };
  }
}
</script>
```

---

## Appendix F — mark.svg (the CSPS mark)

Use it for the favicon, app icon and `Mark` component. In the component, the ring fill is `var(--csp-mark-ring, #572e2b)` and the stitch stroke is `var(--csp-mark-stitch, #f6dfd1)`, so that dark theme can recolor them (see `.csp-mark` rules in Appendix B). The static file below uses the fixed light colors.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="CSPS — Carmen's Stitch &amp; Printing Services">
  <title>CSPS — Carmen's Stitch &amp; Printing Services</title>
  <rect width="512" height="512" rx="118" fill="#ff6600"/>
  <path d="M423.4,145.6 L415.7,134.5 L407.0,124.1 L397.5,114.5 L387.1,105.8 L375.9,98.0 L364.0,91.2 L351.5,85.5 L338.4,80.8 L324.8,77.2 L310.7,74.7 L296.4,73.3 L281.8,73.0 L267.1,73.9 L252.2,75.9 L237.5,79.1 L222.8,83.3 L208.3,88.6 L194.1,94.9 L180.3,102.3 L166.9,110.6 L154.1,119.8 L141.8,129.8 L130.3,140.7 L119.5,152.2 L109.5,164.5 L100.5,177.3 L92.3,190.6 L85.1,204.4 L79.0,218.5 L73.9,232.8 L69.9,247.4 L67.0,262.0 L65.3,276.6 L64.6,291.2 L65.2,305.5 L66.9,319.6 L69.7,333.4 L73.6,346.7 L78.7,359.5 L84.7,371.8 L91.9,383.3 L100.0,394.2 L109.0,404.2 L118.9,413.4 L129.7,421.7 L141.2,429.1 L153.4,435.4 L166.2,440.7 L179.5,444.9 L193.3,448.1 L207.5,450.1 L221.9,451.0 L236.6,450.7 L251.4,449.3 L266.2,446.8 L281.0,443.2 L295.6,438.5 L309.9,432.8 L324.0,426.0 L337.6,418.2 L350.8,409.5 L363.4,399.9 L375.3,389.5 L386.5,378.4 L332.6,330.3 L326.1,336.9 L319.0,343.0 L311.7,348.6 L303.9,353.8 L295.9,358.3 L287.7,362.3 L279.2,365.7 L270.7,368.4 L262.0,370.5 L253.3,372.0 L244.6,372.8 L236.0,373.0 L227.5,372.5 L219.2,371.3 L211.1,369.4 L203.2,367.0 L195.7,363.8 L188.6,360.1 L181.8,355.8 L175.5,350.9 L169.7,345.5 L164.4,339.6 L159.6,333.3 L155.4,326.5 L151.8,319.3 L148.9,311.7 L146.6,303.9 L144.9,295.8 L143.9,287.6 L143.6,279.1 L144.0,270.6 L145.0,262.0 L146.7,253.4 L149.0,244.9 L152.0,236.4 L155.6,228.2 L159.9,220.1 L164.6,212.3 L170.0,204.7 L175.8,197.5 L182.2,190.7 L189.0,184.4 L196.1,178.5 L203.7,173.1 L211.5,168.2 L219.6,163.9 L228.0,160.2 L236.5,157.0 L245.1,154.6 L253.8,152.7 L262.5,151.5 L271.2,151.0 L279.7,151.2 L288.2,152.0 L296.4,153.5 L304.4,155.6 L312.1,158.3 L319.5,161.7 L326.4,165.7 L333.0,170.2 L339.1,175.4 L344.7,181.0 L349.8,187.1 L354.3,193.7 Z" fill="#572e2b"/>
  <path d="M374.0,150.5 L370.3,146.8 L366.3,143.2 L362.3,139.7 L358.0,136.5 L353.6,133.4 L349.1,130.6 L344.4,127.9 L339.6,125.4 L334.7,123.1 L329.6,121.0 L324.5,119.2 L319.2,117.5 L313.9,116.1 L308.4,114.9 L302.9,113.8 L297.4,113.1 L291.7,112.5 L286.0,112.1 L280.3,112.0 L274.5,112.1 L268.7,112.4 L262.9,112.9 L257.1,113.7 L251.2,114.7 L245.4,115.8 L239.6,117.2 L233.8,118.9 L228.1,120.7 L222.4,122.7 L216.7,125.0 L211.1,127.4 L205.6,130.1 L200.1,132.9 L194.7,135.9 L189.4,139.1 L184.2,142.5 L179.1,146.1 L174.2,149.8 L169.3,153.7 L164.6,157.8 L160.0,162.0 L155.6,166.4 L151.3,170.9 L147.1,175.5 L143.1,180.3 L139.3,185.2 L135.7,190.2 L132.2,195.3 L128.9,200.5 L125.8,205.8 L122.9,211.2 L120.2,216.6 L117.7,222.2 L115.4,227.7 L113.3,233.4 L111.4,239.1 L109.7,244.8 L108.3,250.5 L107.0,256.2 L106.0,262.0 L105.2,267.8 L104.6,273.5 L104.3,279.2 L104.1,284.9 L104.2,290.6 L104.5,296.3 L105.1,301.8 L105.8,307.4 L106.8,312.8 L108.0,318.2 L109.4,323.5 L111.1,328.7 L112.9,333.8 L115.0,338.8 L117.3,343.7 L119.7,348.5 L122.4,353.1 L125.3,357.6 L128.3,362.0 L131.6,366.2 L135.0,370.3 L138.6,374.2 L142.4,377.9 L146.4,381.5 L150.5,384.9 L154.8,388.1 L159.2,391.1 L163.8,393.9 L168.5,396.6 L173.3,399.0 L178.2,401.3 L183.3,403.3 L188.5,405.1 L193.7,406.8 L199.1,408.2 L204.6,409.3 L210.1,410.3 L215.7,411.1 L221.3,411.6 L227.0,411.9 L232.8,412.0 L238.5,411.9 L244.3,411.5 L250.2,410.9 L256.0,410.2 L261.8,409.1 L267.7,407.9 L273.5,406.5 L279.2,404.8 L285.0,403.0 L290.7,400.9 L296.3,398.6 L301.9,396.1 L307.4,393.4 L312.9,390.6 L318.3,387.5 L323.5,384.3 L328.7,380.8 L333.8,377.2 L338.7,373.5" fill="none" stroke="#f6dfd1" stroke-width="7" stroke-dasharray="20 13" stroke-linecap="round"/>
  <path d="M96.0,470.0 L157.9,404.3 L415.1,93.3 L432.1,65.9 L430.0,54.0 L417.9,54.5 L394.8,77.1 L146.8,395.3 Z" fill="#fff6f0" stroke="#ff6600" stroke-width="8" paint-order="stroke" stroke-linejoin="round"/>
  <path d="M372.4,125.7 L411.2,77.4" stroke="#ff6600" stroke-width="9" stroke-linecap="round"/>
  <path d="M100.3,400.5 L102.3,402.6 L104.2,404.8 L106.3,406.8 L108.3,408.9 L110.4,410.9 L112.5,412.9 L114.7,414.8 L116.9,416.7 L119.2,418.5 L121.4,420.3 L123.7,422.1 L126.1,423.8 L128.5,425.5 L130.9,427.1 L133.3,428.7 L135.8,430.3 L138.3,431.8 L140.9,433.2 L143.5,434.6 L146.1,436.0 L148.7,437.3 L151.4,438.6 L154.1,439.8 L156.8,441.0 L159.5,442.1 L162.3,443.2 L165.1,444.2 L167.9,445.2 L170.8,446.2 L173.6,447.0 M169.1,339.3 L170.2,340.5 L171.3,341.7 L172.4,342.9 L173.5,344.0 L174.7,345.1 L175.9,346.2 L177.1,347.3 L178.3,348.4 L179.6,349.4 L180.9,350.4 L182.1,351.4 L183.5,352.4 L184.8,353.3 L186.1,354.2 L187.5,355.1 L188.9,356.0 L190.3,356.8 L191.7,357.6 L193.2,358.4 L194.6,359.2 L196.1,359.9 L197.6,360.6 L199.1,361.3 L200.6,362.0 L202.1,362.6 L203.7,363.2 L205.2,363.8 L206.8,364.3 L208.4,364.8 L210.0,365.3" fill="none" stroke="#ff6600" stroke-width="7"/>
  <path d="M92.0,383.5 L93.1,385.1 L94.2,386.6 L95.3,388.2 L96.4,389.7 L97.6,391.2 L98.8,392.7 L100.0,394.2 L101.2,395.6 L102.4,397.1 L103.7,398.5 L105.0,399.9 L106.2,401.3 L107.6,402.7 L108.9,404.1 L110.2,405.4 L111.6,406.8 L113.0,408.1 L114.4,409.4 L115.8,410.7 L117.2,411.9 L118.6,413.2 L120.1,414.4 L121.6,415.6 L123.1,416.8 L124.6,418.0 L126.1,419.1 L127.6,420.3 L129.2,421.4 L130.8,422.5 L132.4,423.6 L134.0,424.6 L135.6,425.7 L137.2,426.7 L138.8,427.7 L140.5,428.7 L142.2,429.6 L143.9,430.6 L145.6,431.5 L147.3,432.4 L149.0,433.3 L150.7,434.2 L152.5,435.0 L154.2,435.8 L156.0,436.6 L157.8,437.4 L159.6,438.1 L161.4,438.9 L163.2,439.6 L165.1,440.3 L166.9,441.0 L168.8,441.6 L170.6,442.3 L172.5,442.9 L174.4,443.4 L176.3,444.0 L178.2,444.6 L180.1,445.1 L182.0,445.6 L183.9,446.1 L185.9,446.5 L187.8,447.0 L189.8,447.4 L191.7,447.8 L193.7,448.1 L219.4,371.3 L218.3,371.1 L217.1,370.9 L216.0,370.6 L214.8,370.4 L213.7,370.1 L212.5,369.8 L211.4,369.5 L210.3,369.2 L209.2,368.9 L208.1,368.6 L207.0,368.2 L205.9,367.9 L204.8,367.5 L203.7,367.1 L202.6,366.7 L201.5,366.3 L200.4,365.9 L199.4,365.5 L198.3,365.0 L197.3,364.6 L196.2,364.1 L195.2,363.6 L194.2,363.1 L193.2,362.6 L192.1,362.1 L191.1,361.6 L190.1,361.0 L189.2,360.5 L188.2,359.9 L187.2,359.3 L186.2,358.7 L185.3,358.1 L184.3,357.5 L183.4,356.9 L182.5,356.3 L181.5,355.6 L180.6,355.0 L179.7,354.3 L178.8,353.6 L177.9,352.9 L177.1,352.2 L176.2,351.5 L175.3,350.8 L174.5,350.1 L173.6,349.3 L172.8,348.6 L172.0,347.8 L171.2,347.0 L170.4,346.2 L169.6,345.5 L168.8,344.7 L168.0,343.8 L167.3,343.0 L166.5,342.2 L165.8,341.3 L165.1,340.5 L164.4,339.6 L163.7,338.8 L163.0,337.9 L162.3,337.0 L161.6,336.1 L161.0,335.2 L160.3,334.3 L159.7,333.3 Z" fill="#572e2b"/>
  <path d="M125.8,358.4 L128.6,362.4 L131.6,366.2 L134.7,369.9 L138.0,373.5 L141.4,376.9 L144.9,380.2 L148.6,383.4 L152.4,386.4 L156.4,389.2 L160.4,391.9 L164.6,394.4 L168.9,396.8 L173.3,399.0 L177.8,401.1 L182.4,403.0 L187.1,404.7 L191.8,406.2 L196.7,407.5 L201.6,408.7 L206.6,409.7" fill="none" stroke="#f6dfd1" stroke-width="7" stroke-dasharray="20 13" stroke-linecap="round"/>
</svg>
```

---

*End of spec.*

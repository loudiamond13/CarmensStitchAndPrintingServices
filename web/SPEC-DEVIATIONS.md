# Design-system spec deviations (WEB-02, D-07)

<!-- prettier-ignore -->
*Created: 2026-10-08T02:06:00-05:00 · Updated: 2026-10-08T02:18:00-05:00*

This file records how the approved design-system code in `CSPS-UI-SPEC.md` (App. D.3 `src/ui/index.tsx`, D.4
`src/ui/mark.ts`, D.5 `src/ui/icons.ts`, D.6b `src/app/RouterLink.tsx`) was brought in under the strict type and lint
gates, following owner decision D-07:

1. Copy the code verbatim, then compile and lint it under the full PRD §17.2 settings.
2. Report the delta (below).
3. Apply the smallest fixes, each marked `// SPEC-DEVIATION: <reason>` in the code and listed in the register below,
   with no DOM or markup change. A fix that would change markup or looks stops for an owner ruling (D-08).

The frozen verbatim copies are in `src/ui/__reference__/` (see its README). `src/ui/differential.test.tsx` renders
every one of the 37 exported components from both copies over a prop matrix built from the UI-SPEC §12 seed data
(Carmen Reyes, Jomar Santos, ORD-2026-0148, ORD-2026-0151 and others) and requires the same DOM after
`src/test/normalizeDom.ts`.

## 1. Delta before any fix (D-07 step 2)

Measured on 2026-10-08 with the verbatim copies in place (commit `478f76a`): `tsc -p tsconfig.app.json`
(TypeScript 7.0.2) and `eslint` (the project's flat config: typescript-eslint `strictTypeChecked` +
`stylisticTypeChecked`, react-hooks 7 `recommended`, jsx-a11y-x `strict`, the architecture rules), each rule at error.

### Type errors: 7 (all in `src/ui/index.tsx`)

| Code   | Line | Where                                | Cause                                                                                                             |
| ------ | ---- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| TS2769 | 33   | `UiLink`                             | `{...rest}` into the LinkProvider component under `exactOptionalPropertyTypes` (`className: string \| undefined`) |
| TS2532 | 180  | `Avatar`                             | `p[0]` is possibly undefined (`noUncheckedIndexedAccess`)                                                         |
| TS2345 | 323  | `ImageUploader`                      | the `splice` result `OrderImage \| undefined` passed back to `splice`                                             |
| TS2375 | 345  | `ImageUploader` → `MediaPlaceholder` | optional `label` / `number` passed as possibly undefined                                                          |
| TS2375 | 424  | `OrderCard` → `MediaPlaceholder`     | same                                                                                                              |
| TS2375 | 738  | `CategoryCard` → `MediaPlaceholder`  | same (`number`)                                                                                                   |
| TS2375 | 589  | `ConfirmDialog` → `Modal`            | optional `onCancel` passed as `onClose`                                                                           |

Research Pitfall 7 predicted exactly these 7.

### Lint findings: 67

By file: `src/ui/index.tsx` 65, `src/ui/icons.ts` 1, `src/ui/mark.ts` 1, `src/app/RouterLink.tsx` 0.

| Count | Rule                                              | Lines (index.tsx unless noted)                                                 |
| ----: | ------------------------------------------------- | ------------------------------------------------------------------------------ |
|    16 | @typescript-eslint/no-confusing-void-expression   | 232, 331, 337, 344, 349, 350, 499, 506, 552, 608, 650, 654, 678, 709, 802, 809 |
|    16 | @typescript-eslint/restrict-template-expressions  | 499 ×2, 518, 531 ×13                                                           |
|     8 | @typescript-eslint/restrict-plus-operands         | 237, 317 ×2, 345, 460, 491 ×2, 767                                             |
|     7 | @typescript-eslint/no-useless-default-assignment  | 249, 271, 289, 452 ×2, 481, 749                                                |
|     4 | @typescript-eslint/array-type                     | 389, 663, 749; icons.ts 2                                                      |
|     3 | @typescript-eslint/no-unnecessary-condition       | 46, 176 ×2                                                                     |
|     2 | jsx-a11y-x/no-static-element-interactions         | 328 (uploader drop zone), 556 (Modal backdrop)                                 |
|     1 | jsx-a11y-x/no-noninteractive-element-interactions | 342 (draggable thumbnail `li`)                                                 |
|     1 | jsx-a11y-x/anchor-is-valid                        | 694 (Sidebar Logout `href="#"`)                                                |
|     1 | jsx-a11y-x/anchor-has-content                     | 33 (`UiLink`, children only via the spread)                                    |
|     1 | react-hooks/static-components                     | 33 (`UiLink` renders a component read from context)                            |
|     1 | no-restricted-syntax                              | 70 (`Mark` raw-HTML prop, CWE-79)                                              |
|     1 | @typescript-eslint/consistent-type-definitions    | 186 (`FieldBase`)                                                              |
|     1 | @typescript-eslint/prefer-string-starts-ends-with | 314                                                                            |
|     1 | @typescript-eslint/no-unnecessary-type-assertion  | 55 (`Icon` node attrs)                                                         |
|     1 | @typescript-eslint/no-unnecessary-type-conversion | 420 (`Number(i.quantity)`)                                                     |
|     1 | @typescript-eslint/no-empty-function              | 794 (`ToastCtx` default)                                                       |
|     1 | @typescript-eslint/no-inferrable-types            | mark.ts 2                                                                      |

**Why 67 and not the research probe's 99:** the probe also linted `csps.ts` (15 findings, reconciled in plan 02-04),
and the project config keeps `||` on strings, numbers and booleans (`prefer-nullish-coalescing` with
`ignorePrimitives`, research Pitfall 6), which removes the probe's 17 `prefer-nullish-coalescing` findings.

### Formatting

Prettier reported all four copied files as unformatted. The reconciled files are Prettier-formatted (layout only, no
code change); the frozen reference copies are in `.prettierignore`.

## 2. Deviation register (D-07 step 3)

Every entry is marked `// SPEC-DEVIATION` at the change. "DOM impact" is what the differential test checks.

| #   | File · component                                                                        | Rule or reason                                                         | Change                                                                                                                                                                                                                                                                                                                                 | DOM impact                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | index.tsx · header                                                                      | D-07                                                                   | Header note pointing here; Prettier layout                                                                                                                                                                                                                                                                                             | None                                                                                                                                                       |
| 2   | index.tsx · `UiLink`                                                                    | react-hooks/static-components, TS2769, anchor-has-content              | Renders react-router `Link` directly (React Router 8 is the only router, research Flag 2); children passed explicitly                                                                                                                                                                                                                  | None: the same `<a href data-discover>` RouterLink rendered                                                                                                |
| 3   | index.tsx · `LinkProvider`                                                              | API compatibility                                                      | Kept and exported; UiLink no longer reads its context                                                                                                                                                                                                                                                                                  | None (a provider renders no element)                                                                                                                       |
| 4   | index.tsx · `IconProps`                                                                 | D-10                                                                   | `color` left out of the props type: lucide-react reads it as the stroke colour. No App. D.3 call site passes it                                                                                                                                                                                                                        | None for any valid call                                                                                                                                    |
| 5   | index.tsx · `Icon`                                                                      | D-10, no-unnecessary-condition, no-unnecessary-type-assertion          | Renders `ICONS[name]` (lucide-react 1.52.0) with the App. D.3 wrapper attributes; the unreachable `if (!nodes)` guard is gone                                                                                                                                                                                                          | Wrapper identical after normalization: lucide adds `lucide lucide-<name>` classes (D-28); the inner drawing differs for 20 icons (D-12, owner review pack) |
| 6   | icons.ts                                                                                | D-10                                                                   | `IconName` (the 56 App. D.5 names; the spec's "57" is a miscount) and `ICONS: Record<IconName, LucideIcon>` from per-icon named imports (`trash-2` → `Trash2`, alias of `trash`; `filter` → `Filter`, alias of `funnel`). The name API keeps all 56 icons in Icon's chunk, about +3.3 KB gz (research Flag 4), accepted for API parity | See #5                                                                                                                                                     |
| 7   | mark.tsx · `MarkSvg`, index.tsx · `Mark`                                                | WEB-02, no-restricted-syntax (CWE-79, T-02-25), no-inferrable-types    | App. D.4's `MARK_SVG` string becomes JSX children of `MarkSvg`, including the whitespace text nodes; `mark.ts` is replaced by `mark.tsx`                                                                                                                                                                                               | None: same elements, attributes and text                                                                                                                   |
| 8   | index.tsx · `MediaPlaceholderProps`                                                     | TS2375 ×3                                                              | `label` / `number` also accept an explicit `undefined`                                                                                                                                                                                                                                                                                 | None                                                                                                                                                       |
| 9   | index.tsx · `StatusBadge`                                                               | no-unnecessary-condition ×2                                            | The tone and label maps are read as partial, so the `??` fallbacks still cover an unknown status string from the API                                                                                                                                                                                                                   | None                                                                                                                                                       |
| 10  | index.tsx · `Avatar`                                                                    | TS2532                                                                 | `p.charAt(0)` instead of `p[0]` (same for the non-empty words left by the filter)                                                                                                                                                                                                                                                      | None                                                                                                                                                       |
| 11  | index.tsx · `FieldBase`                                                                 | consistent-type-definitions                                            | `interface` instead of a type alias                                                                                                                                                                                                                                                                                                    | None                                                                                                                                                       |
| 12  | index.tsx · all handlers                                                                | no-confusing-void-expression ×16                                       | Arrow bodies wrapped in braces                                                                                                                                                                                                                                                                                                         | None                                                                                                                                                       |
| 13  | index.tsx · PasswordField, ImageUploader, DataTable, chart, TestimonialCard             | restrict-plus-operands ×8, restrict-template-expressions ×16           | `String()` inside template literals (a template already converts with `String()`, so the text is the same)                                                                                                                                                                                                                             | None                                                                                                                                                       |
| 14  | index.tsx · Select, SegmentedControl, Tabs, DataTable, IncomeExpenseChart, ProcessSteps | no-useless-default-assignment ×7                                       | `= []` defaults removed from required props                                                                                                                                                                                                                                                                                            | None for any typed call                                                                                                                                    |
| 15  | index.tsx · `ImageUploader`                                                             | prefer-string-starts-ends-with, TS2345                                 | `f.type.startsWith('image/')`; `move` returns early if the removed item is undefined (unreachable for a list index)                                                                                                                                                                                                                    | None                                                                                                                                                       |
| 16  | index.tsx · `ImageUploader`                                                             | no-static-element-interactions, no-noninteractive-element-interactions | Drop-zone and thumbnail drag handlers are native listeners attached through callback refs (React 19 ref cleanup) instead of JSX props                                                                                                                                                                                                  | None; handler parity is tested (onFiles, onChange, drag reorder, drag-over state)                                                                          |
| 17  | index.tsx · OrderTotals, ADMIN_NAV, ProcessSteps                                        | array-type ×3 (+1 in icons.ts)                                         | `T[]` instead of `Array<T>`                                                                                                                                                                                                                                                                                                            | None                                                                                                                                                       |
| 18  | index.tsx · `OrderCard`                                                                 | no-unnecessary-type-conversion                                         | `Number(i.quantity as unknown)` keeps the conversion for a quantity that arrives as text                                                                                                                                                                                                                                               | None                                                                                                                                                       |
| 19  | index.tsx · `ModalProps`                                                                | TS2375                                                                 | `onClose?: (() => void) \| undefined`                                                                                                                                                                                                                                                                                                  | None                                                                                                                                                       |
| 20  | index.tsx · `Modal`                                                                     | no-static-element-interactions                                         | The backdrop mousedown listener is attached through a callback ref                                                                                                                                                                                                                                                                     | None; parity tested (backdrop closes, inside does not, Escape closes). The focus trap is plan 02-11                                                        |
| 21  | index.tsx · `Sidebar`                                                                   | D-27 (O-9), anchor-is-valid                                            | Logout is `<button type="button" class="csp-nav">` with the same title and children; the `/* D-27 */ button.csp-nav` rule in overrides.css keeps the link look                                                                                                                                                                         | **The one listed structural difference**, asserted explicitly in the test                                                                                  |
| 22  | index.tsx · `ToastCtx`                                                                  | no-empty-function                                                      | Default value `() => undefined`                                                                                                                                                                                                                                                                                                        | None                                                                                                                                                       |
| 23  | RouterLink.tsx                                                                          | —                                                                      | App. D.6b verbatim; source note and Prettier layout only                                                                                                                                                                                                                                                                               | None                                                                                                                                                       |

No `eslint-disable` comment and no non-null assertion was added. `||` was kept everywhere it guards a string, number or
boolean (research Pitfall 6).

## 3. What the differential test normalizes, and nothing else

| Normalized                                              | Why                                                                                                                                                   | Decision           |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| React `useId` values (`:r1:`, `«r1»`, `_r_1_`, `_R_…_`) | Each React root numbers ids on its own; ids are mapped to placeholders by order of first use, so an id and the labels pointing at it must still agree | Research Pattern 3 |
| `lucide` / `lucide-<name>` classes on an icon svg       | lucide-react 1.52.0 always adds them; no CSS targets them                                                                                             | D-28               |
| `xmlns` on svg                                          | React writes it as an attribute from JSX                                                                                                              | D-28               |
| Attribute order                                         | Not part of the DOM                                                                                                                                   | Research Pattern 3 |
| The inner drawing of `svg.csp-icon`                     | The owner approves icon drawings in the review pack instead                                                                                           | D-12               |

Tag names, every other attribute and value, class order, text and whitespace still count. The Mark svg is compared
in full. The only structural difference allowed is the Sidebar Logout element (D-27).

## 4. Coverage note

Vitest runs the same React Compiler chain as the build (research Flag 2). The differential test re-renders every case
with equal props, so the compiler's memo-cache paths are exercised too. A few compiled cache-hit branches stay
uncovered by design: a component whose props reach it through a `{...rest}` spread gets a new `rest` object on every
render, so its cache never hits (for example App. D.6b `RouterLink`). Global web coverage stays above the 90% gate.

## 5. Open items for the owner (D-08)

No new markup-changing fix was needed in this reconciliation: every lint and type rule above was satisfied without a
DOM change, apart from D-27, which the owner already ruled. The owner review pack (section 6) shows the D-27 look,
the changed icon drawings and the UI-SPEC "Owner Confirmations" O-1..O-8. It also repeats one earlier D-08 question
from plan 02-05 (backlog D-BL-02): the "Manager" tag on the selected Users sidebar row is unreadable in the verbatim
App. B colours.

## 6. Review pack (plan 02-09 Task 2)

`node web/scripts/owner-review-pack.mjs` (local only; it refuses to run in CI and to write outside
`artifacts/owner-review/`) builds the owner's plain-words review into `artifacts/owner-review/phase2-rulings/`
(git-ignored): `index.html` plus 17 PNGs. Last run 2026-10-08:

- **Icons (D-12):** 56 icons, **20 changed** drawings between Lucide 0.460 and lucide-react 1.52.0 (search, trash-2,
  receipt, users, log-out, menu, phone, message-circle, mail, clock, circle-check, list, filter, calendar, palette,
  zap, trending-up, trending-down, package, moon), **2 renamed** by lucide (trash-2 → trash, filter → funnel; both
  also in the changed list), 36 the same. Shown at 24 and 48 px.
- **O-1..O-8:** 8 open items. Only O-3 is visible (the phone drawer's current link turns italic, picture included);
  O-6 affects only people who ask for reduced motion; O-8 lists the measured small controls (sm button 36 px high,
  `.csp-iconbtn` and `.s-iconbtn` 36 × 36, `.csp-seg-btn` 32 px high, filter-chip clear 22 × 22, login checkbox
  20 × 20).
- **D-27:** the approved link and the new button side by side in Blush and Espresso, expanded and collapsed, at rest
  and on hover. Measured in Chromium: **identical** in all 34 measured values (size, padding, border, colours, font,
  cursor, alignment, icon and label position). The first run found one difference, `border-top-style` none vs
  solid (0 width, invisible), fixed by restating only `border-width: 0` in the compat rule (`900e2a8`).
- **D-BL-02** (earlier open D-08 item from plan 02-05): the selected Users row's "Manager" tag today and with the
  recommended option A, both themes.
- **New D-08 items from this reconciliation:** none.

The D-27 compat rule deliberately sets only `appearance`, `border-width`, `text-align` and `cursor`. The plan also
listed a transparent background, full width and an inherited font and colour, but `overrides.css` is unlayered, so
those would beat the layered `.csp-nav` hover, current-item, collapsed and tablet-width rules. Tailwind's preflight
already gives buttons a transparent background and an inherited font and colour, and the flex column stretches the
button to full width; the measurements above confirm the result.

---
created: 2026-10-13T05:32:52-05:00
updated: 2026-10-13T05:32:52-05:00
phase: 02-web-foundation-design-system
lane: webui
reviewed: 2026-10-13T10:32:52Z
depth: standard
diff_base: 3b42ddc
files_reviewed: 155
files_reviewed_list:
  - web/src/dev/ComponentShowcase.tsx
  - web/src/dev/ShowcaseDemos.tsx
  - web/src/dev/kit.ts
  - web/src/dev/parity-main.tsx
  - web/src/dev/previews/AdminShell.tsx
  - web/src/dev/previews/DefinedTotalsNote.tsx
  - web/src/dev/previews/DimmedZeroKpi.tsx
  - web/src/dev/previews/FailedConfirmDialog.tsx
  - web/src/dev/previews/FailedLazyImage.tsx
  - web/src/dev/previews/FocusedSkipLink.tsx
  - web/src/dev/previews/IconSet.tsx
  - web/src/dev/previews/KeyboardScrollTable.tsx
  - web/src/dev/previews/ListTable.tsx
  - web/src/dev/previews/ListTableState.tsx
  - web/src/dev/previews/LongUserName.tsx
  - web/src/dev/previews/MediaPlaceholderNoChip.tsx
  - web/src/dev/previews/OpenedDialog.tsx
  - web/src/dev/previews/OpenedNavDrawer.tsx
  - web/src/dev/previews/OpenedSiteDrawer.tsx
  - web/src/dev/previews/OpenedUserMenu.tsx
  - web/src/dev/previews/PendingLazyImage.tsx
  - web/src/dev/previews/PublicShell.tsx
  - web/src/dev/previews/RatedTestimonial.tsx
  - web/src/dev/previews/RevealPassword.tsx
  - web/src/dev/previews/TabsWithPanel.tsx
  - web/src/dev/previews/Toolbar.tsx
  - web/src/dev/previews/TracedErrorState.tsx
  - web/src/dev/previews/WalkInOrderCard.tsx
  - web/src/dev/previews/typeInto.ts
  - web/src/dev/renderScenario.tsx
  - web/src/dev/scenarios/collect.ts
  - web/src/dev/scenarios/groups/actions.ts
  - web/src/dev/scenarios/groups/brand.ts
  - web/src/dev/scenarios/groups/choice.ts
  - web/src/dev/scenarios/groups/data.ts
  - web/src/dev/scenarios/groups/entry.ts
  - web/src/dev/scenarios/groups/feedback.ts
  - web/src/dev/scenarios/groups/forms.ts
  - web/src/dev/scenarios/groups/layouts-admin-boundaries.ts
  - web/src/dev/scenarios/groups/layouts-admin.ts
  - web/src/dev/scenarios/groups/layouts-public.ts
  - web/src/dev/scenarios/groups/lists-states.ts
  - web/src/dev/scenarios/groups/lists.ts
  - web/src/dev/scenarios/groups/marketing.ts
  - web/src/dev/scenarios/groups/media.ts
  - web/src/dev/scenarios/groups/money.ts
  - web/src/dev/scenarios/groups/navigation-gaps.ts
  - web/src/dev/scenarios/groups/navigation.ts
  - web/src/dev/scenarios/groups/overlays.ts
  - web/src/dev/scenarios/groups/states.ts
  - web/src/dev/scenarios/groups/status.ts
  - web/src/dev/scenarios/index.ts
  - web/src/dev/scenarios/types.ts
  - web/src/dev/showcase.recipe.ts
  - web/src/dev/showcaseCopy.ts
  - web/src/dev/showcaseSections.ts
  - web/src/ui/actions/Button.tsx
  - web/src/ui/actions/ButtonLink.tsx
  - web/src/ui/actions/UiLink.tsx
  - web/src/ui/actions/button.recipe.ts
  - web/src/ui/actions/index.ts
  - web/src/ui/brand/Icon.tsx
  - web/src/ui/brand/Logo.tsx
  - web/src/ui/brand/Mark.tsx
  - web/src/ui/brand/MediaPlaceholder.tsx
  - web/src/ui/brand/SectionCut.tsx
  - web/src/ui/brand/StitchDivider.tsx
  - web/src/ui/brand/brand.recipe.ts
  - web/src/ui/brand/icons.ts
  - web/src/ui/brand/index.ts
  - web/src/ui/choice/SegmentedControl.tsx
  - web/src/ui/choice/Tabs.tsx
  - web/src/ui/choice/choice.recipe.ts
  - web/src/ui/choice/index.ts
  - web/src/ui/choice/roving.ts
  - web/src/ui/data/DataTable.tsx
  - web/src/ui/data/IncomeExpenseChart.tsx
  - web/src/ui/data/OrderCard.tsx
  - web/src/ui/data/copy.ts
  - web/src/ui/data/data.recipe.ts
  - web/src/ui/data/index.ts
  - web/src/ui/entry/Checkbox.tsx
  - web/src/ui/entry/MoneyInput.tsx
  - web/src/ui/entry/OtpInput.tsx
  - web/src/ui/entry/SkipLink.tsx
  - web/src/ui/entry/copy.ts
  - web/src/ui/entry/entry.recipe.ts
  - web/src/ui/entry/index.ts
  - web/src/ui/feedback/EmptyState.tsx
  - web/src/ui/feedback/Skeleton.tsx
  - web/src/ui/feedback/Toast.tsx
  - web/src/ui/feedback/ToastProvider.tsx
  - web/src/ui/feedback/feedback.recipe.ts
  - web/src/ui/feedback/index.ts
  - web/src/ui/feedback/toastQueue.ts
  - web/src/ui/forms/Field.tsx
  - web/src/ui/forms/PasswordField.tsx
  - web/src/ui/forms/Select.tsx
  - web/src/ui/forms/field.recipe.ts
  - web/src/ui/forms/index.ts
  - web/src/ui/index.ts
  - web/src/ui/layout/layout.recipe.ts
  - web/src/ui/lists/FilterBar.tsx
  - web/src/ui/lists/Pagination.tsx
  - web/src/ui/lists/ResponsiveTable.tsx
  - web/src/ui/lists/SearchBox.tsx
  - web/src/ui/lists/SkeletonTable.tsx
  - web/src/ui/lists/cells.tsx
  - web/src/ui/lists/columns.ts
  - web/src/ui/lists/copy.ts
  - web/src/ui/lists/index.ts
  - web/src/ui/lists/lists.recipe.ts
  - web/src/ui/marketing/CategoryCard.tsx
  - web/src/ui/marketing/ProcessSteps.tsx
  - web/src/ui/marketing/TestimonialCard.tsx
  - web/src/ui/marketing/index.ts
  - web/src/ui/marketing/marketing.recipe.ts
  - web/src/ui/media/ImageUploader.tsx
  - web/src/ui/media/index.ts
  - web/src/ui/media/media.recipe.ts
  - web/src/ui/money/KpiCard.tsx
  - web/src/ui/money/Money.tsx
  - web/src/ui/money/OrderTotals.tsx
  - web/src/ui/money/index.ts
  - web/src/ui/money/money.recipe.ts
  - web/src/ui/navigation/MobileNavDrawer.tsx
  - web/src/ui/navigation/Sidebar.tsx
  - web/src/ui/navigation/SiteHeader.tsx
  - web/src/ui/navigation/Topbar.tsx
  - web/src/ui/navigation/UserMenu.tsx
  - web/src/ui/navigation/index.ts
  - web/src/ui/navigation/navItem.recipe.ts
  - web/src/ui/navigation/navigation.recipe.ts
  - web/src/ui/overlays/ConfirmDialog.tsx
  - web/src/ui/overlays/Modal.tsx
  - web/src/ui/overlays/Overlay.tsx
  - web/src/ui/overlays/index.ts
  - web/src/ui/overlays/overlays.recipe.ts
  - web/src/ui/overlays/useBodyScrollLock.ts
  - web/src/ui/overlays/useFocusTrap.ts
  - web/src/ui/states/ErrorState.tsx
  - web/src/ui/states/LazyImage.tsx
  - web/src/ui/states/LoadingRegion.tsx
  - web/src/ui/states/Skeletons.tsx
  - web/src/ui/states/copy.ts
  - web/src/ui/states/index.ts
  - web/src/ui/states/states.recipe.ts
  - web/src/ui/states/useDelayedFlag.ts
  - web/src/ui/status/Avatar.tsx
  - web/src/ui/status/Badge.tsx
  - web/src/ui/status/StatusBadge.tsx
  - web/src/ui/status/index.ts
  - web/src/ui/status/status.recipe.ts
  - web/src/ui/status/tones.ts
  - web/src/ui/tw.ts
findings:
  critical: 1
  warning: 15
  info: 13
  total: 29
status: issues_found
---

# Phase 2: Code Review Report (lane: webui)

**Reviewed:** 2026-10-13T10:32:52Z
**Depth:** standard
**Files Reviewed:** 155
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

This lane covers the design-system components under `web/src/ui` and the dev-only showcase, parity page, scenarios and previews under `web/src/dev`. I read every listed file. Where a finding depended on code outside the lane (`lib/format.ts`, `lib/csps.ts`, the server CSP string, `app/admin/routes.tsx`), I checked that code as well.

Checks that came back clean:
- No `dangerouslySetInnerHTML`, no `eval`, and no raw-HTML injection. `Mark` renders as JSX.
- Every `style={{…}}` sets only a CSS custom property. React applies these through the CSSOM, which the lint rule and the research note allow.
- Server text never reaches `ErrorState` or the ConfirmDialog failure line. Only the traceId is shown.
- `/dev/components` is gated by `__DEV_ROUTES__`, so a production build has no route to the dev code.

Most look decisions are App. D.3 parity or owner rulings, and I did not judge them.

Findings by area:
- **Overlays and toasts (WR-01 to WR-05):** the overlay stack has no concept of nesting, so Esc and focus trapping fight each other. Toasts nest live regions and can stay paused forever.
- **Production CSP (CR-01):** ImageUploader previews use `blob:` URLs, which the shipped `img-src` blocks.
- **Entry controls (WR-08, WR-09):** OtpInput's `maxLength={1}` truncates the autofill it advertises. MoneyInput silently drops a pasted amount in the app's own `₱` format.
- **Accessibility gaps (WR-07, WR-12, WR-15):** the global "/" shortcut fails WCAG 2.1.4. OrderCard hides the order status from assistive technology. Pagination drops focus.
- **ImageUploader state bugs (WR-10, WR-11).**

## Critical Issues

### CR-01: ImageUploader previews use `blob:` object URLs, which the shipped CSP blocks

**File:** `web/src/ui/media/ImageUploader.tsx:80` (also 187)
**Issue:** `addFiles` builds each new thumbnail's `src` with `URL.createObjectURL(f)`. The production policy (`src/Csps.Server/Http/SecurityHeadersMiddleware.cs:17`, PRD §504) is `img-src 'self' data: https://res.cloudinary.com`. CSP `'self'` does not match the `blob:` scheme, so every picked or dropped image renders as a broken image under the strict CSP. That includes the Component Showcase and the visual/e2e host, which serve the same policy. The guard/CSP listener would report it as a violation. The object URLs are also never revoked, either on remove or on unmount.
**Fix:** Pick one of these:
- Add `blob:` to `img-src` as a documented need. It is the narrowest change and keeps `unsafe-inline` out.
- Read previews with `FileReader.readAsDataURL`, which the existing `data:` source already allows.

In both cases, revoke the URLs:
```tsx
// on remove
URL.revokeObjectURL(img.src);
// on unmount
useEffect(() => () => {
  for (const img of listRef.current) {
    if (img.src?.startsWith('blob:')) URL.revokeObjectURL(img.src);
  }
}, []);
```

## Warnings

### WR-01: Esc closes every open overlay at once (Modal, ConfirmDialog, MobileNavDrawer)

**File:** `web/src/ui/overlays/Modal.tsx:95-103`, `web/src/ui/navigation/MobileNavDrawer.tsx:87-94`
**Issue:** Each open overlay adds its own `window` keydown listener that calls `requestClose()` on Escape. None of them checks `event.defaultPrevented`, stops propagation, or knows whether it is the topmost layer. Example: a ConfirmDialog opened from inside an edit Modal (a child-row delete from a dialog). One Esc closes both the confirm and the outer Modal, and the outer form's unsaved input is lost.
**Fix:** Keep a module-level overlay stack, like the `holders` counter in `useBodyScrollLock`. Only the top entry handles Esc, and it calls `event.preventDefault()`. At minimum:
```ts
const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && !event.defaultPrevented && isTopmost(overlayId)) {
    event.preventDefault();
    requestClose();
  }
};
```

### WR-02: useFocusTrap has no trap stack, so two active traps fight over focus

**File:** `web/src/ui/overlays/useFocusTrap.ts:65-70, 97-104`
**Issue:** Every active trap adds a document `focusin` listener that pulls focus back into its own root. A second trap whose root is a DOM sibling of the first has this problem:
- The second trap is, for example, a Modal rendered next to the open MobileNavDrawer, since nothing uses portals. When it activates, it focuses its initial element before its own listeners exist (lines 65-70 run before 103).
- The first trap's `focusin` handler sees a target outside its root and moves focus back into the drawer.

The dialog that is visually on top then has no focus. After both are listening, each Tab runs both keydown handlers, and both call `preventDefault` and focus their own first or last element.
**Fix:** Keep a stack of active traps. Only the top trap enforces `focusin` and Tab; lower traps go dormant until the traps above them are removed. When activated, push onto the stack before moving focus.

### WR-03: Persistent (danger and warning) toasts cannot be reached by keyboard or screen reader while a Modal or drawer is open

**File:** `web/src/ui/overlays/useFocusTrap.ts:97-101`, `web/src/ui/feedback/ToastProvider.tsx:122`
**Issue:**
- The toast layer sits at `z-(--z-toast)` above the scrim, outside the dialog.
- The focus trap sends any focus that leaves the dialog back to its first element, and `aria-modal="true"` hides the toast from the virtual cursor.
- Danger and warning toasts persist until someone closes them (D-04, D-31 O-7).

So a keyboard user cannot reach a danger toast's Dismiss button or `action` (for example "Try again") while a dialog is open. That fails WCAG 2.1.1, and the toast is the place a failed save is reported.
**Fix:** Let the trap treat `[data-ui="s-toast-layer"]` as an allowed outside region, so `focusin` there is not pulled back and Tab can cycle into it. Another option is to render the toast layer inside the topmost dialog while one is open. Keep the toast reachable from the dialog with an F6-style landmark jump or a visible "View message" link.

### WR-04: Toasts are live regions nested inside a live region, so they are announced twice

**File:** `web/src/ui/feedback/Toast.tsx:38`, `web/src/ui/feedback/ToastProvider.tsx:122`
**Issue:** The layer is `aria-live="polite"`, and each Toast inside it also gets `role="status"` (implicitly polite) or `role="alert"` (assertive). NVDA and JAWS commonly announce nested live regions twice. A danger toast is read once assertively by the alert and again by the polite parent.
**Fix:** Use a single live region. Either keep the always-mounted layer with `aria-live="polite"` (D-31 O-5) and drop the toast roles, or keep the roles and remove the layer's `aria-live`. For danger toasts, move the item into a separate always-mounted `role="alert"` region rather than nesting one inside the other.

### WR-05: Toast timers stay paused forever after a Dismiss click while other toasts remain; focus is lost

**File:** `web/src/ui/feedback/ToastProvider.tsx:92-95, 108-117`
**Issue:**
- Clicking Dismiss focuses the button and sets `focusInside` to true. The toast is then removed with focus inside it.
- As the comment at line 108 admits, some browsers fire no `focusout` for a removed focused element, so `focusInside` stays true.
- The reset only runs when the stack becomes empty. If another success or info toast is still shown, the later `pointerleave` calls `syncClock()`, which still sees `focusInside === true`, so the remaining timed toasts never expire.

Focus is also dropped to `<body>` (WCAG 2.4.3).
**Fix:** In the Dismiss handler, first move focus to the next toast's Dismiss button, or back to the element focused before the layer was entered. Then recompute `focusInside` as `layer.contains(document.activeElement)` after the commit, for example in a `useEffect` keyed on `toasts`, instead of trusting the event flag.

### WR-06: ConfirmDialog does not handle a synchronous throw from `onConfirm`

**File:** `web/src/ui/overlays/ConfirmDialog.tsx:100`
**Issue:** `const result = onConfirm?.();` is not guarded. If the handler throws before returning a promise (a validation guard, a `mutateAsync` misuse, a null deref), the error escapes the click handler. The failure line never shows, `inFlight` is never set, and the user sees nothing happen. The T-02-54 failure state only covers rejected promises.
**Fix:**
```ts
let result: unknown;
try {
  result = onConfirm?.();
} catch (error: unknown) {
  fail(error);
  return;
}
```

### WR-07: The global "/" single-character shortcut fails WCAG 2.1.4 (Level A)

**File:** `web/src/ui/navigation/Topbar.tsx:65-80`
**Issue:** Pressing "/" anywhere outside a field always moves focus to the search box. WCAG 2.1.4 Character Key Shortcuts requires a single printable-key shortcut to be:
- turnable off,
- remappable to include a modifier, or
- active only while its component has focus.

None of these apply here. Speech-input users who dictate text, and anyone typing "/" into a `role="textbox"` or `contenteditable="false"` widget, trigger it. The handler also ignores modifiers, `event.isComposing` and `event.defaultPrevented`. While a Modal or drawer is open, it steals focus outside the dialog, and the trap then bounces it back (WR-02). This is App. D.3 behaviour, but AA conformance is a binding project constraint.
**Fix:** Make the shortcut need a modifier (Ctrl+K or Ctrl+/), or add a user setting to turn it off. Also skip it when `event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.defaultPrevented`, and while an `[aria-modal="true"]` element is open.

### WR-08: OtpInput's `maxLength={1}` truncates the one-time-code autofill it advertises

**File:** `web/src/ui/entry/OtpInput.tsx:187-188` (with the header claim at lines 10-11)
**Issue:** The first box has `autoComplete="one-time-code"`, and the header says autofill "goes through the same fill". But the box also has `maxLength={1}`. Browser autofill and keyboard code suggestions (iOS Mail and Messages codes, Chrome) insert text as user input, and `maxlength` constrains that input. The `change` handler therefore receives one digit, and the other five boxes stay empty. The paste path works only because `onPaste` calls `preventDefault` before the browser applies `maxlength`.
**Fix:** Remove `maxLength` from box 0. The `change` handler already strips non-digits and `fill()` spreads the digits across the boxes. Alternatively, use a single visually hidden `one-time-code` input that feeds the boxes. Add a test that sets six digits on box 0 through the native value setter.

### WR-09: MoneyInput silently drops a pasted amount in the app's own `₱` format

**File:** `web/src/ui/entry/MoneyInput.tsx:68-81`
**Issue:** `normalizePastedMoney` returns `""` for any text with a peso sign (`lib/format.ts:82-89`). The paste handler then calls `preventDefault` and returns without feedback. Every figure the app shows is formatted as `₱4,327.50` (`formatPeso`), including the Add Payment hint "Balance due: ₱4,327.50". Copying the balance into the amount field is a natural staff action, and it silently does nothing.
**Fix:** Strip a leading `₱` or `PHP` (and the U+2212 minus check, which should still reject) in `normalizePastedMoney`, or at least in the MoneyInput paste path, before validating:
```ts
const pasted = normalizePastedMoney(event.clipboardData.getData('text').replace(/^\s*(₱|PHP)\s*/i, ''));
```
If the paste is still rejected, show the `ENTRY_COPY.money.invalid` hint instead of ignoring it.

### WR-10: ImageUploader exceeds `max` when the list is already over the limit (negative `slice` end)

**File:** `web/src/ui/media/ImageUploader.tsx:70-72`
**Issue:** `.slice(0, max - list.length)` is wrong when `list.length > max`, which can happen with controlled `images` from a migrated legacy order that has more than 12 images. The end index is then negative, and `slice(0, -n)` keeps all but the last `n` picked files, so more files are added past the cap. The hint then reads, for example, "15/12".
**Fix:**
```ts
const room = Math.max(0, max - list.length);
const picked = Array.from(files ?? []).filter((f) => f.type.startsWith('image/')).slice(0, room);
```

### WR-11: ImageUploader cannot re-pick a file that was just removed

**File:** `web/src/ui/media/ImageUploader.tsx:166-175`
**Issue:** The hidden `<input type="file">` value is never cleared. After a user removes `jersey.jpg` and chooses `jersey.jpg` again through "browse", the input value has not changed, so no `change` event fires and nothing is added.
**Fix:** Clear the input after reading it:
```tsx
onChange={(e) => {
  addFiles(e.target.files);
  e.target.value = '';
}}
```

### WR-12: OrderCard hides the order status and image count from assistive technology

**File:** `web/src/ui/data/OrderCard.tsx:62-82`
**Issue:** The cover `<button>` has `aria-label="View order …"`, which replaces its accessible name. The StatusBadge and the image count inside it are therefore never exposed, and the card body has no status anywhere else. A screen-reader user scanning order cards cannot tell Pending from In Production or Cancelled (WCAG 1.3.1 and 4.1.2). The View and Edit buttons are also unnamed per order ("View", "Edit"), while Delete is named "Delete order …".
**Fix:** Do one of the following:
- Include the status in the name: `aria-label={\`View order ${o.number}, ${statusLabel}\`}`.
- Move the badge out of the button, positioned absolutely over the media, so it is read as card content.

Also give View and Edit names that carry the order number, as Delete already does.

### WR-13: IncomeExpenseChart keys month groups by the short month name

**File:** `web/src/ui/data/IncomeExpenseChart.tsx:119`
**Issue:** `key={d.month}` uses "Oct", "Nov" and so on. Any series longer than 12 months, or one that crosses a year (Oct 2025 to Oct 2026), repeats keys. React then warns (which breaks the zero-console-warnings rule) and may reuse or drop the wrong `<g>`, including its focus and hover state.
**Fix:** Key on something unique, for example `key={d.label ?? \`${d.month}-${String(i)}\`}`, or require a `key`/`id` in `ChartDatum`.

### WR-14: OrderTotals shows an overpaid order as "Fully Paid" and hides the negative balance

**File:** `web/src/ui/money/OrderTotals.tsx:41, 58-66`
**Issue:** When `fullyPaid` is true (`balance <= 0`), the block shows only "Fully Paid" with a check and never shows `t.balance`. An order where payments exceed total minus discount, for example a duplicated GCash payment, looks the same as one paid exactly. The overpayment that staff need to refund or credit is not visible. That conflicts with the Core Value that staff "always see correct, server-computed totals and balances". This is App. D.3 parity, so it needs an owner decision, not a silent change.
**Fix:** When `t.balance < 0`, show the overpayment ("Overpaid ₱X" or "Credit ₱X", tone warning) alongside or instead of "Fully Paid". Log this as an owner question if the spec must stay frozen.

### WR-15: Pagination drops keyboard focus when it disables the focused button

**File:** `web/src/ui/lists/Pagination.tsx:54-59, 67, 84`
**Issue:** If Next is pressed on page `n-1`, Next gets the native `disabled` attribute on the next render while it still has focus, so focus falls to `<body>`. The same happens with Previous on page 2. `focusTargetId` is optional, so without it a keyboard user is sent back to the top of the document (WCAG 2.4.3). Even with it, `goTo` focuses the target synchronously, before the parent has re-rendered, so focus lands correctly only if the caption already exists and survives the update.
**Fix:**
- Use `aria-disabled` at the ends instead of `disabled`, as Button already does for `pending`, and ignore activation.
- Focus the target after the update, for example in a `useEffect` keyed on `page` when a page change came from this component.
- Consider making `focusTargetId` required.

## Info

### IN-01: DataTable is an unnamed focusable region when `caption` is omitted

**File:** `web/src/ui/data/DataTable.tsx:86`
**Issue:** `role="region" tabIndex={0} aria-label={caption}` renders a keyboard stop with no name when `caption` is undefined. `caption` is optional in `DataTableProps`.
**Fix:** Make `caption` required, as `ResponsiveTable` does, or drop `role` and `tabIndex` when there is no caption.

### IN-02: Native-prop spreads can override the computed ARIA and the reveal `type`

**File:** `web/src/ui/forms/Field.tsx:73-75`, `web/src/ui/forms/PasswordField.tsx:66-77`, `web/src/ui/forms/Select.tsx:45-50`
**Issue:** `{...rest}` is spread after `aria-invalid`, `aria-describedby` and (in PasswordField) `type`. A caller passing `aria-describedby` drops the hint and error linkage. A caller passing `type="password"` breaks the Show password toggle. PasswordField and Select also take `required` without showing the asterisk that Field shows.
**Fix:** Spread `rest` first and the computed attributes last, and merge any caller `aria-describedby` with the message id.

### IN-03: A controlled Sidebar `collapsed` leaves a focusable toggle that does nothing

**File:** `web/src/ui/navigation/Sidebar.tsx:90-91, 103-108`
**Issue:** With `collapsed` given, the "Collapse sidebar" button updates internal state that is ignored, and there is no `onCollapsedChange` callback. No caller uses controlled mode yet.
**Fix:** Add `onCollapsedChange`, or hide the toggle in controlled mode.

### IN-04: Topbar defaults to a demo identity

**File:** `web/src/ui/navigation/Topbar.tsx:53-54`
**Issue:** `user = { name: 'Carmen Reyes' }` and `role = 'manager'` are production defaults. If a caller forgets the props, the app shows a fake manager identity. This is display only, because the server enforces roles.
**Fix:** Make `user` and `role` required.

### IN-05: UiLink passes `target` without enforcing `rel` for external links

**File:** `web/src/ui/actions/UiLink.tsx:53-73`
**Issue:** `target="_blank"` with no `rel` relies on browsers treating it as `noopener`.
**Fix:** When `target === '_blank'`, default `rel` to `noopener noreferrer`.

### IN-06: ResponsiveTable shows the wrong empty-state edges

**File:** `web/src/ui/lists/ResponsiveTable.tsx:160, 173-181`
**Issue:**
- The "Clear Filters" button renders even when `onClearFilters` is undefined, so it does nothing.
- `rows === undefined && !pending` (a disabled query) shows the first-use "No {things} yet" state.

**Fix:** Render the button only when the handler exists, and treat `rows === undefined` as not-loaded rather than empty.

### IN-07: IncomeExpenseChart computes the Net figure on the client

**File:** `web/src/ui/data/IncomeExpenseChart.tsx:159`
**Issue:** `formatPeso(cur.income - cur.expenses)` is a money figure derived in the browser, documented as App. D.3 display parity. Centavo rounding in `formatPeso` makes it numerically safe, but it goes against "money is computed server-side only".
**Fix:** Accept a server `net` in `ChartDatum` when Phase 10 wires real data.

### IN-08: KpiCard shows the delta unrounded

**File:** `web/src/ui/money/KpiCard.tsx:75`
**Issue:** `{Math.abs(delta)}%` prints `12.3456789%` if the caller passes a raw ratio.
**Fix:** Format with one decimal, or document that the caller rounds.

### IN-09: ImageUploader accepts more than the hint says

**File:** `web/src/ui/media/ImageUploader.tsx:71, 164, 169`
**Issue:** `accept="image/*"` and the `image/` prefix filter also accept GIF, SVG and HEIC, while the copy says "JPG, PNG or WEBP". There is no 10 MB check (documented for Phase 9).
**Fix:** Use `accept="image/jpeg,image/png,image/webp"` and the same allow-list in the filter.

### IN-10: Avatar with an empty name renders an unnamed `role="img"`

**File:** `web/src/ui/status/Avatar.tsx:26, 44-45`
**Issue:** `name` defaults to `''`, which produces `role="img" aria-label=""` (axe `role-img-alt`). In UserMenu, Sidebar and TestimonialCard the avatar's name also repeats the visible name next to it.
**Fix:** Hide the avatar (`aria-hidden`) when the name is empty, or when the name is shown next to it.

### IN-11: The toast queue keeps its timers after the provider unmounts

**File:** `web/src/ui/feedback/ToastProvider.tsx:60`
**Issue:** The `browserQueue()` timeouts are never cancelled on unmount. They call `dismiss` on a queue nothing listens to. The effect is harmless but leaks.
**Fix:** Add `queue.dispose()`, which cancels every clock, and call it from an unmount effect.

### IN-12: OtpInput swallows Ctrl/Cmd + digit browser shortcuts

**File:** `web/src/ui/entry/OtpInput.tsx:125`
**Issue:** `DIGIT.test(key)` is checked before modifiers, so Ctrl+1 or Cmd+1 types a digit and blocks the tab-switch shortcut.
**Fix:** Check `!event.ctrlKey && !event.metaKey && !event.altKey` before the digit branch.

### IN-13 (dev only): FailedConfirmDialog picks the first dialog in the document

**File:** `web/src/dev/previews/FailedConfirmDialog.tsx:24`
**Issue:** `document.querySelector('[role="dialog"]')` can find another open dialog in the showcase, such as the drawer. It then types into and clicks the wrong one.
**Fix:** Scope the query to a wrapper ref, as OpenedDialog does.

---

_Reviewed: 2026-10-13T10:32:52Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

# Phase 2 Deferred Items

*Created: 2026-10-08T00:12:53-05:00 · Updated: 2026-10-08T00:12:53-05:00*

Out-of-scope findings logged by executors. Nothing here was changed, because each one needs an owner ruling or belongs to a later plan.

## Deferred Items

- Selected sidebar item hides its "Manager" tag (WCAG 1.4.3, verbatim App. B)
  status: open
  **Found by:** plan 02-05 (contrast check while applying D-02).
  **What:** `.csp-nav-tag` is `color: var(--nav-ink)`. When the Users item is current (`.csp-nav.is-on`), the row background is `--primary`, which equals `--nav-ink` in Blush. The tag reads 1.00:1 in Blush and 1.43:1 in Espresso, so it is invisible on the selected row.
  **Why deferred:** a fix (for example `.csp-nav.is-on .csp-nav-tag { color: var(--on-primary); }`) changes the approved visuals and no owner ruling covers it. Per D-08 it goes to the owner with a before/after, best batched with the O-1..O-8 confirmations.
- Tailwind `font-sans` / `font-display` utilities bypass the PERF-05 fallback faces
  status: open
  **Found by:** plan 02-05.
  **What:** globals.css (App. A.2, verbatim) maps the font families with `@theme inline`, so a Tailwind `font-sans` or `font-display` utility class inlines the literal App. A stack and skips the "Archivo Fallback" and "Barlow Condensed Fallback" faces that overrides.css adds to the `--font-sans` / `--font-display` tokens. The spec classes use the tokens, and no code uses those utilities yet.
  **Why deferred:** nothing is affected today. If a later plan uses those utilities, either avoid them (spec §2.3: utilities are layout glue only) or add a lint or test rule against them.

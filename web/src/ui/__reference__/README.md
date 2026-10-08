# Frozen design-system reference (App. D.3, D.4, D.5)

*Created: 2026-10-08T01:58:00-05:00 · Updated: 2026-10-08T01:58:00-05:00*

These three files are exact copies of the approved code in `CSPS-UI-SPEC.md`:

| File | Spec appendix |
|---|---|
| `index.tsx` | App. D.3 `src/ui/index.tsx` |
| `mark.ts` | App. D.4 `src/ui/mark.ts` |
| `icons.ts` | App. D.5 `src/ui/icons.ts` (Lucide 0.460.0 node data) |

They are the baseline that `src/ui/differential.test.tsx` renders next to the reconciled design system
(`src/ui/index.tsx`, `icons.ts`, `mark.tsx`) to prove the rendered DOM did not change (WEB-02, D-07, D-08).
`src/ui/reference-verbatim.test.ts` proves they still equal the spec text.

Rules:

- **Never edit them.** Fixes for the strict type and lint rules go into the reconciled files, each marked
  `// SPEC-DEVIATION: <reason>` and listed in `web/SPEC-DEVIATIONS.md`.
- They are excluded from the type check (`tsconfig.app.json`), ESLint (`eslint.config.mjs`), Prettier
  (`.prettierignore`) and coverage (`vitest.config.ts`). Nothing in the app imports them.
- Their `../lib/csps` import was written for `src/ui/`, so `scripts/reference-resolve-plugin.mjs` points it at
  `src/lib/csps.ts` for the tests and the owner review pack.
- They change only when the owner approves a re-import of a newer spec version. Re-copy all three, then re-run the
  differential test and record any new difference for an owner ruling (D-08).

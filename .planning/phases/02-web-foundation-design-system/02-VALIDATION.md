---
phase: "02"
slug: "web-foundation-design-system"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-08T07:15:00-05:00"
updated: "2026-10-14T05:46:18-05:00"
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded on 2026-10-08 for the from-scratch replan under owner ruling D-33 (full Tailwind conversion). Source: `02-RESEARCH.md` § Validation Architecture. The superseded strategy is in `superseded-2026-10-08/02-VALIDATION.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Web unit/component: Vitest 5.0.x + jsdom 30.1.1 + RTL 16 + in-house axe helper. Node-env tests (stylesheet contract, class gate, config, golden vectors, scripts): Vitest with `// @vitest-environment node`. E2E: Playwright 1.63.0 + @axe-core/playwright 4.13.0 (HTTPS 5199). Visual parity: Playwright, route-served A/B against the approved CSS, chromium/firefox/webkit. .NET: xUnit v3 on MTP (existing). |
| **Config file** | `web/vitest.config.ts`, `web/src/test/setup.ts`, `web/playwright.config.ts`, `web/visual/playwright.visual.config.ts`, `web/visual/vite.reference.config.ts` (all Wave 0) |
| **Quick run command** | `npm --prefix web run test -- --run <path-or-pattern>` (web); `dotnet test --project <touched test project>` (.NET) |
| **Full suite command** | `npm --prefix web run verify` (typecheck + lint `--max-warnings 0` + `prettier --check` + `vitest run --coverage` + build/budgets + license gate) and `CSPS_TEST_SQL=localdb dotnet test --solution Csps.slnx`, after the preflight |
| **Estimated runtime** | ~90 s for web verify + ~15 s for .NET; E2E ~30 s; full parity matrix several minutes (3 engines) |

---

## Sampling Rate

- **After every task commit:** the quick Vitest pattern for the touched folder plus `npm --prefix web run typecheck`. Conversion tasks also run the parity cases for the touched component (`npm --prefix web run parity -- --grep <component>`, chromium).
- **After every plan wave:** `npm --prefix web run verify`, the full parity matrix (3 engines), `npm --prefix web run e2e -- --grep "@smoke|@fixture"` and `dotnet test --solution Csps.slnx`, each after the preflight.
- **Before `/gsd-verify-work`:** full web and .NET suites, E2E, parity and Lighthouse all green.
- **Max feedback latency:** 120 seconds for the per-task loop.

---

## Per-Task Verification Map

The requirement-level map, re-checked against the built code on 2026-10-14 by `/gsd-validate-phase 2`. Several test files were renamed from the draft paths, for example the `*.node.test.ts` node-environment tests. Per-task coverage is in each SUMMARY's `coverage:` block, which is auto-passed in `02-UAT.md`.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| WEB-01 | Build emits `index.html` + assets into `wwwroot`; dev 5180/strictPort/proxy; `build.license: false` (D-35) | unit (config) + script | `vitest run src/test/build-config.node.test.ts`; `npm --prefix web run build` | ✅ | ✅ green |
| WEB-01 | SPA shell anonymous (GET/HEAD); `/api/*` and missing files ProblemDetails 404; dot/backslash/8.3 paths 404; reserved docs 404 outside Dev; matrix rows | Server integration tests (.NET) | `dotnet test --project tests/Csps.Server.IntegrationTests` (`SpaHostTests`, `HiddenSegmentFileProviderTests`, `AuthorizationFailureTests`) | ✅ | ✅ green |
| WEB-01 | .NET suite independent of an untracked `src/Csps.Server/wwwroot` (fixture web root) | Server integration tests (.NET) | `OpenApiExposureTests`, fixture web root in `tests/fixtures` | ✅ | ✅ green |
| WEB-02 | Stylesheets hold only allowed constructs; every class token compiles against the CSPS theme | unit (node) | `vitest run src/styles/stylesheet-contract.node.test.ts scripts/tailwind-classes.test.ts` | ✅ | ✅ green |
| WEB-02 | Rendered look equal to the approved design (+ rulings layer); comparator self-test fails on a 1px change | visual parity | `npm --prefix web run parity` (456/456; `@overlays\|@selftest` 21/21 after 02-43) | ✅ | ✅ green |
| WEB-02 | Modal focus trap/return, Tabs ARIA/roving, no non-null assertions | component + axe + lint | `vitest run src/ui` (45 files) | ✅ | ✅ green |
| WEB-03 | httpClient behaviours at 100% coverage | unit | `vitest run src/lib/http` (verify coverage thresholds) | ✅ | ✅ green |
| WEB-04 | Lint bans (fetch/httpClient/axios outside api.ts, D-33 style/class bans) | unit (ESLint `Linter`) | `vitest run src/test/lint-rules.node.test.ts src/test/eslint-config.node.test.ts` | ✅ | ✅ green |
| WEB-05 | Layout landmarks, skip link, one h1, error boundary, admin excluded from prod | component + build | `vitest run src/app`; budget plugin (`scripts/vite-budget-plugin.test.ts`) | ✅ | ✅ green |
| WEB-06 | SPEC-GAP primitives behaviour + zero axe | component | `vitest run src/ui/entry src/ui/lists src/ui/states` (MoneyInput, OtpInput, Pagination, ErrorState …) | ✅ | ✅ green |
| WEB-07 | ≥ 200 golden vectors pass in TS and C# | unit + Domain unit tests (.NET) | `vitest run src/lib/csps.golden.test.ts`; `OrderMathGoldenVectorTests` in `tests/Csps.Domain.UnitTests` | ✅ | ✅ green |
| WEB-08 | Query defaults, keepPreviousData, 300 ms debounce, cancellation, intent prefetch via `query()` | component | `vitest run src/lib/query` | ✅ | ✅ green |
| WEB-09 | One Idempotency-Key per submission, pending look, one request per double-click | unit + component + parity | `vitest run src/lib/http src/lib/forms src/ui`; parity `pending` state | ✅ | ✅ green |
| WEB-10 | Parsers, push vs replace, page reset, dropped defaults, rewrite-once | unit + component | `vitest run src/lib/url-state` | ✅ | ✅ green |
| ORD-09 | `₱12,450.00`, `−₱…`, `Oct 6, 2026`; MoneyInput entry rules | unit + component | `vitest run src/lib/format.test.ts src/ui/money src/ui/entry/MoneyInput.test.tsx` | ✅ | ✅ green |
| QUAL-02 | 0 type errors, 0 lint warnings, Prettier clean, no warn-level rule | gate + unit | `npm --prefix web run verify` (typecheck, lint `--max-warnings 0`, format:check) | ✅ | ✅ green |
| QUAL-04 | E2E fails on console error/warning, CSP violation, axe violation | E2E | `npm --prefix web run e2e -- --grep @fixture` (`fixture-selftest.spec.ts`) | ✅ | ✅ green |
| A11Y-01 | Zero axe violations on every page/preview in both themes | E2E | `npm --prefix web run e2e -- --grep @axe` | ✅ | ✅ green |
| A11Y-02 | Skip link, dialog trap/return, drawer, user menu keyboard; dialog fit and backdrop rules (D-42, 02-42, 02-43) | E2E + component | `npm --prefix web run e2e -- --grep "@keyboard\|@dialog-fit"` (47 passed, 0 failed, seven projects) | ✅ | ✅ green |
| A11Y-04 | Owner rulings on computed styles | parity rulings + E2E | `e2e/a11y-rulings.spec.ts`; `visual/reference/rulings.test.ts` | ✅ | ✅ green |
| PERF-01 | Budgets fail the build over limits; exactly one CSS asset | unit + build | `vitest run scripts/budget.test.ts scripts/vite-budget-plugin.test.ts`; `build:budget` in verify | ✅ | ✅ green |
| PERF-02 | Lighthouse ≥ 95, LCP < 2 s, CLS < 0.05 | Lighthouse script | `npm --prefix web run lighthouse` (0.99/1/1/1, LCP 1884 ms); `scripts/lighthouse-assert.test.ts` | ✅ | ✅ green |
| PERF-03 | No horizontal scroll at 320-1920 px; inputs ≥ 16 px on phones | E2E | `npm --prefix web run e2e -- --grep @responsive`; `visual/lists-overflow.spec.ts` | ✅ | ✅ green |
| PERF-05 | ₱ in the brand font; one preload; woff2 from `'self'`; fallback metrics | E2E + unit | `npm --prefix web run e2e -- --grep @fonts`; `vitest run scripts/font-metrics.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `web/` scaffold with D-25/D-34/D-36 exact pins, `.npmrc` (`min-release-age=14` plus only the owner-approved exceptions still needed), lockfile, tsconfigs, ESLint flat config, Prettier (tabWidth 2), `vite.config.ts` (`build.license: false`), `index.html`, `public/`
- [x] `.gitattributes`, `.editorconfig` `[web/**]`, `.gitignore` entries for build/test outputs (`src/Csps.Server/wwwroot/`, `web/.e2e-dist/`, `web/.reference-dist/`, `web/.vitest/`, `web/test-results/` …)
- [x] `web/src/styles/app.css` + `base.css` (theme, variants, tokens) with `stylesheet-contract.test.ts` and the class gate
- [x] `web/src/test/setup.ts` (jest-dom, console guard, `matchMedia`), axe helper, fake fetch
- [x] `web/visual/` parity harness (spec extraction + hash pin + frozen reference + rulings layer + comparator self-test)
- [x] Playwright config + E2E fixtures (console / CSP via `exposeBinding` / axe) + self-tests + `scripts/e2e.mjs`
- [x] Budget plugin + tests; Lighthouse assertion script
- [x] Golden vectors + generator; `OrderMath.cs` + xUnit theory
- [x] Test fixture web root (incl. dot-folder fixtures) wired into `CspsApiFactory`; SpaHost / HiddenSegmentFileProvider tests; matrix rows
- [x] Dependency registry `npm` kind; npm license gate + exceptions (D-26 + addendum); repository THIRD-PARTY-NOTICES (D-35)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Owner visual sign-off of the converted UI (D-23 screenshot report) | WEB-02, A11Y-04 | Look approval is the owner's judgment; parity proves equality, not taste | Run the local owner report from the final plan; the owner reviews both themes at 1440/820/390 |
| Developer guide readability | WEB-01 | Reading judgment | Owner or reviewer reads `docs/development.md` |
| Screen-reader and real-phone spot checks (NVDA / VoiceOver) | A11Y-02, A11Y-05 | jsdom and axe check roles and names, not real announcements | UAT test 9 (passed 2026-10-13) |
| Dialog at real zoom with the owner's scrollbar setting; macOS Safari overlay scrollbar | A11Y-02 | Real zoom and Safari overlay scrollbars cannot be automated on this machine | UAT tests 200 and 202 (passed 2026-10-14) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-10-14 (`/gsd-validate-phase 2`)

---

## Validation Audit 2026-10-14

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Every requirement maps to an existing test that runs green. Runs here, after the preflight (port 5180 was this project's own Vite dev server; no TheBETSLLC processes): `npm --prefix web run verify` exit 0 (109 files, 3110 tests, coverage 98.26 / 96.51 / 99.82 / 99.82, zero lint warnings); `CSPS_TEST_SQL=localdb dotnet test --solution Csps.slnx` 908/908. The E2E, parity and Lighthouse evidence is carried from `02-VERIFICATION.md` (02-43 `@dialog-fit` 47 passed / 0 failed in seven projects; parity 21/21; Lighthouse 0.99).

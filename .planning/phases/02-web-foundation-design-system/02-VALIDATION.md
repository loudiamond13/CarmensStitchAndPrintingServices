---
phase: "02"
slug: "web-foundation-design-system"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-07T20:44:00-05:00"
updated: "2026-10-07T21:30:00-05:00"
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `02-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.x + jsdom 30.1.1 + RTL 16 + in-house axe helper (web); Playwright 1.63.0 + @axe-core/playwright 4.13.0 (E2E); xUnit v3 on MTP (.NET, existing) |
| **Config file** | `web/vitest.config.ts` (or the `test` block in `web/vite.config.ts`), `web/src/test/setup.ts`, `web/playwright.config.ts`. None exist yet; Wave 0 installs them. |
| **Quick run command** | `npm --prefix web run test -- --run <path-or-pattern>` / `dotnet test --project tests/Csps.Domain.UnitTests` |
| **Full suite command** | `npm --prefix web run verify` (typecheck + lint `--max-warnings 0` + `prettier --check` + `vitest run --coverage` + build with budgets + license gate) and `dotnet test --solution Csps.slnx` |
| **E2E / Lighthouse** | Run the preflight, then `npm --prefix web run e2e` (HTTPS 5199 host) and `npm --prefix web run lighthouse` |
| **Estimated runtime** | ~60 s quick, ~5 min full web + .NET, ~10 min E2E across engines |

---

## Sampling Rate

- **After every task commit:** the quick Vitest pattern for the touched folder, plus `npm --prefix web run typecheck`
- **After every plan wave:** `npm --prefix web run verify` and `dotnet test --solution Csps.slnx`
- **Before `/gsd-verify-work`:** the full web and .NET suites, then E2E (after the preflight) and Lighthouse, all green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

The planner filled in Task IDs (format `<plan>-T<task>`, e.g. 02-01-T1 = plan 02-01, Task 1); execution updates Status. Commands run from the repository root.

| Task ID(s) | Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|------------|-------------|----------|-----------|-------------------|-------------|--------|
| 02-01-T1, 02-02-T2 | WEB-01 | Build emits `index.html` + assets into `wwwroot`; dev config has 5180/strictPort/proxy | unit (config) + script | `npm --prefix web run test -- --run src/test/build-config.test.ts`; `npm --prefix web run build` | ❌ W0 | ⬜ pending |
| 02-01-T1, 02-01-T2, 02-01-T3 | WEB-01 | SPA shell is anonymous; `/api/*` stays ProblemDetails 404; missing file → 404; `/scalar` and `/openapi` → 404 in production (D-29); compression and caching; matrix rows | .NET integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*SpaHostTests"`; same with `"*OpenApiExposureTests"` | ❌ W0 | ⬜ pending |
| 02-03-T1, 02-03-T2 | WEB-01 (supply chain) | npm pins registered (`npm` kind, folder-qualified ids); npm license gate; web notices drift check | .NET arch test + node | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*DependencyRegistryTests"`; `node web/scripts/license-gate.mjs`; `node web/scripts/third-party-notices.mjs --check` | ❌ W0 | ⬜ pending |
| 02-05-T1 | WEB-02 | Verbatim CSS equals the spec blocks (LF-normalized) | unit | `npm --prefix web run test -- --run src/styles/verbatim.test.ts` | ❌ W0 | ⬜ pending |
| 02-09-T1, 02-11-T1..T3 | WEB-02 | Reconciled components render the same DOM as the frozen verbatim reference (lucide classes normalized, D-28) | component | `npm --prefix web run test -- --run src/ui/differential.test.tsx src/ui/reference-verbatim.test.ts` | ❌ W0 | ⬜ pending |
| 02-07-T1..T3 | WEB-03 | httpClient interceptors, timeout/abort, single-flight 401, capped retries, HttpError; 100% coverage | unit | `npm --prefix web run test -- --run src/lib/http --coverage` | ❌ W0 | ⬜ pending |
| 02-02-T1, 02-02-T2, 02-10-T1 | WEB-04 | Lint rejects fetch/httpClient/axios outside api.ts; nuqs bans; api.ts is the only endpoint module | unit (ESLint `Linter`) | `npm --prefix web run test -- --run src/test/lint-rules.test.ts src/lib/api.test.ts` | ❌ W0 | ⬜ pending |
| 02-14-T1, 02-14-T2, 02-15-T1 | WEB-05 | Landmarks, skip link, one h1, error boundary; admin excluded from the production build | component + build assertion | `npm --prefix web run test -- --run src/app` | ❌ W0 | ⬜ pending |
| 02-12-T1, 02-12-T2, 02-13-T1..T3 | WEB-06 | Each SPEC-GAP primitive behaves correctly, with zero axe violations | component | `npm --prefix web run test -- --run src/ui/gaps` | ❌ W0 | ⬜ pending |
| 02-04-T1, 02-04-T2 | WEB-07 | ≥ 200 golden vectors pass in TS and C# | unit + xUnit | `npm --prefix web run test -- --run src/lib/csps.golden.test.ts`; `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*OrderMathGoldenVectorTests"` | ❌ W0 | ⬜ pending |
| 02-08-T1, 02-08-T3 | WEB-08 | Query defaults, keepPreviousData, 300 ms debounce, cancellation | component | `npm --prefix web run test -- --run src/lib/query` | ❌ W0 | ⬜ pending |
| 02-07-T2, 02-10-T2, 02-11-T2 | WEB-09 | One Idempotency-Key per submission, reused on retry; pending button aria-disabled | unit + component | `npm --prefix web run test -- --run src/lib/http src/lib/forms src/ui/Button.test.tsx` | ❌ W0 | ⬜ pending |
| 02-08-T1, 02-08-T2, 02-13-T2 | WEB-10 | nuqs parsers, push vs replace, page reset, dropped defaults, rewrite-once | unit + component | `npm --prefix web run test -- --run src/lib/url-state src/ui/gaps/listState.integration.test.tsx` | ❌ W0 | ⬜ pending |
| 02-04-T3, 02-12-T1 | ORD-09 | `₱12,450.00`, `−₱…`, `Oct 6, 2026`; MoneyInput behavior | unit + component | `npm --prefix web run test -- --run src/lib/format.test.ts src/ui/gaps/MoneyInput.test.tsx` | ❌ W0 | ⬜ pending |
| 02-02-T1, 02-02-T2 | QUAL-02 | 0 type errors, 0 lint warnings, Prettier clean | gate | `npm --prefix web run typecheck && npm --prefix web run lint && npm --prefix web run format:check` | ❌ W0 | ⬜ pending |
| 02-06-T1, 02-06-T2 | QUAL-04 | E2E fails on a console error, CSP violation or axe violation (fixture self-tests) | E2E | `npm --prefix web run e2e -- --grep "@smoke\|@fixture"` | ❌ W0 | ⬜ pending |
| 02-02-T3, 02-11-T2, 02-16-T2 | A11Y-01 | Zero axe violations at component level and on the placeholder, admin previews and showcase (both themes) | component + E2E | `npm --prefix web run test -- --run src/ui/a11y.test.tsx`; `npm --prefix web run e2e -- --grep "@public\|@admin\|@showcase"` | ❌ W0 | ⬜ pending |
| 02-11-T1, 02-14-T1, 02-15-T2, 02-17-T2 | A11Y-02 | Keyboard: skip link, dialog trap/return, drawer, menus | E2E + component | `npm --prefix web run e2e -- --grep @keyboard` | ❌ W0 | ⬜ pending |
| 02-05-T2, 02-09-T3, 02-17-T2 | A11Y-04 | WCAG rulings D-01..D-05 and D-31 applied | unit + E2E | `npm --prefix web run test -- --run src/styles/overrides.test.ts`; `npm --prefix web run e2e -- --grep @a11y-rulings` | ❌ W0 | ⬜ pending |
| 02-16-T1 | PERF-01 | Budgets fail the build when over the limit | unit + build | `npm --prefix web run test -- --run scripts/budget.test.ts`; `npm --prefix web run build && npm --prefix web run build:budget` | ❌ W0 | ⬜ pending |
| 02-17-T1 | PERF-02 | Lighthouse ≥ 95 mobile, LCP < 2 s, CLS < 0.05, TBT < 200 ms | Lighthouse script | `npm --prefix web run lighthouse` | ❌ W0 | ⬜ pending |
| 02-17-T2 | PERF-03 | No horizontal scroll 320–1920; touch targets; 16 px inputs on phones | E2E | `npm --prefix web run e2e -- --grep @responsive` | ❌ W0 | ⬜ pending |
| 02-05-T3, 02-17-T2 | PERF-05 | ₱ renders in a brand font; font preload; woff2 self-hosted | unit + E2E | `npm --prefix web run test -- --run scripts/vite-preload-font-plugin.test.ts`; `npm --prefix web run e2e -- --grep @fonts` | ❌ W0 | ⬜ pending |
| 02-10-T1 | WEB-04 / D-16 | Committed OpenAPI snapshot equals the live Development document; generated types match | .NET integration + node | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiSnapshotTests"`; `npm --prefix tools/openapi-gen run check` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Each item names the plan that delivers it (the earliest wave that can run its check).

- [ ] `web/` scaffold: `package.json` with the approved exact pins (D-25), `.npmrc`, lockfile, `vite.config.ts`, `index.html` — 02-01; tsconfigs, `eslint.config.mjs` (JavaScript, so no extra loader package), Prettier config — 02-02
- [ ] `.gitattributes` (`eol=lf`) and `.gitignore` additions (`src/Csps.Server/wwwroot/`; `web/.gitignore` for `.e2e-dist/`, `.budget-dist/`) — 02-01
- [ ] `web/src/test/setup.ts` (console-error/warn guard, `matchMedia` mock), `web/src/test/axe.ts` — 02-02
- [ ] `web/playwright.config.ts` + `e2e/fixtures.ts` (console/CSP/axe) + smoke test over HTTPS 5199 — 02-06
- [ ] Budget plugin + tests — 02-16; `scripts/lighthouse-assert.mjs` — 02-17
- [ ] `tests/fixtures/order-math-golden-vectors.json` + generator; `OrderMath` + xUnit theory — 02-04
- [ ] `DependencyRegistry` gains the `npm` kind and reads the web/tools package pins — 02-03
- [ ] npm license gate script (license exceptions per D-26) — 02-03
- [ ] `CspsApiFactory` fixture web root + SPA host tests + matrix rows — 02-01

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Owner approves the icon drawings that changed (D-12) — checkpoint 02-09-T3 | WEB-02 | Visual judgement by the owner | Render the 20 changed icons next to the 0.460 drawings and send screenshots |
| Owner reviews layout/showcase screenshots (D-23) and the side-by-side report (D-24) — checkpoint 02-18-T3 | WEB-02, WEB-05, WEB-06 | Visual judgement by the owner | Capture at 390/820/1440 px in light and dark and send the report |
| Logout button looks identical to the old link (D-27) — shown in 02-09-T3 and 02-18-T3 | WEB-02 | Visual confirmation | Before/after screenshots |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

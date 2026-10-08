---
phase: "02"
slug: "web-foundation-design-system"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-07T20:44:00-05:00"
updated: "2026-10-07T20:44:00-05:00"
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

The planner fills in Task IDs, and execution updates Status. The requirement-level map comes from the research:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| WEB-01 | Build emits `index.html` + assets into `wwwroot`; dev config has 5180/strictPort/proxy | unit (config) + script | `vitest run src/test/build-config.test.ts`; `npm run build` | ❌ W0 | ⬜ pending |
| WEB-01 | SPA shell is anonymous; `/api/*` stays ProblemDetails 404; missing file → 404; `/scalar` and `/openapi` → 404 in production (D-29); matrix rows | .NET integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*SpaHost*"` | ❌ W0 | ⬜ pending |
| WEB-02 | Verbatim CSS equals the spec blocks (LF-normalized) | unit | `vitest run src/styles/verbatim.test.ts` | ❌ W0 | ⬜ pending |
| WEB-02 | Reconciled components render the same DOM as the frozen verbatim reference (lucide classes normalized, D-28) | component | `vitest run src/ui/differential.test.tsx` | ❌ W0 | ⬜ pending |
| WEB-03 | httpClient interceptors, timeout/abort, single-flight 401, capped retries, HttpError; 100% coverage | unit | `vitest run src/lib/http --coverage` | ❌ W0 | ⬜ pending |
| WEB-04 | Lint rejects fetch/httpClient/axios outside api.ts; nuqs bans | unit (ESLint `Linter`) | `vitest run src/test/lint-rules.test.ts` | ❌ W0 | ⬜ pending |
| WEB-05 | Landmarks, skip link, one h1, error boundary; admin excluded from the production build | component + build assertion | `vitest run src/app` | ❌ W0 | ⬜ pending |
| WEB-06 | Each SPEC-GAP primitive behaves correctly, with zero axe violations | component | `vitest run src/ui/gaps` | ❌ W0 | ⬜ pending |
| WEB-07 | ≥ 200 golden vectors pass in TS and C# | unit + xUnit | `vitest run src/lib/csps.golden.test.ts`; `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*OrderMathGoldenVector*"` | ❌ W0 | ⬜ pending |
| WEB-08 | Query defaults, keepPreviousData, 300 ms debounce, cancellation | component | `vitest run src/lib/query` | ❌ W0 | ⬜ pending |
| WEB-09 | One Idempotency-Key per submission, reused on retry; pending button disabled | unit + component | `vitest run src/lib/http src/ui/gaps/submit` | ❌ W0 | ⬜ pending |
| WEB-10 | nuqs parsers, push vs replace, page reset, dropped defaults, rewrite-once | unit + component | `vitest run src/lib/url-state` | ❌ W0 | ⬜ pending |
| ORD-09 | `₱12,450.00`, `−₱…`, `Oct 6, 2026`; MoneyInput behavior | unit + component | `vitest run src/lib/format src/ui/gaps/MoneyInput` | ❌ W0 | ⬜ pending |
| QUAL-02 | 0 type errors, 0 lint warnings, Prettier clean | gate | `npm --prefix web run typecheck && npm --prefix web run lint && npm --prefix web run format:check` | ❌ W0 | ⬜ pending |
| QUAL-04 | E2E fails on a console error, CSP violation or axe violation (fixture self-tests) | E2E | `npm --prefix web run e2e -- --grep @fixture` | ❌ W0 | ⬜ pending |
| A11Y-01 | Zero axe violations on the placeholder, admin previews and showcase (both themes) | E2E | `npm --prefix web run e2e -- --grep @axe` | ❌ W0 | ⬜ pending |
| A11Y-02 | Keyboard: skip link, dialog trap/return, drawer, menus | E2E + component | `npm --prefix web run e2e -- --grep @keyboard` | ❌ W0 | ⬜ pending |
| A11Y-04 | WCAG rulings D-01..D-05 applied | unit + E2E | `vitest run src/styles/overrides.test.ts`; `e2e --grep @a11y-rulings` | ❌ W0 | ⬜ pending |
| PERF-01 | Budgets fail the build when over the limit | unit + build | `vitest run scripts/budget.test.ts`; `npm run build` | ❌ W0 | ⬜ pending |
| PERF-02 | Lighthouse ≥ 95 mobile, LCP < 2 s, CLS < 0.05 | Lighthouse script | `npm --prefix web run lighthouse` | ❌ W0 | ⬜ pending |
| PERF-03 | No horizontal scroll 320–1920; touch targets; 16 px inputs on phones | E2E | `npm --prefix web run e2e -- --grep @responsive` | ❌ W0 | ⬜ pending |
| PERF-05 | ₱ renders in a brand font; font preload; woff2 self-hosted | E2E | `npm --prefix web run e2e -- --grep @fonts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/` scaffold: `package.json` with the approved exact pins (D-25), `.npmrc`, lockfile, tsconfigs, `eslint.config.ts`, Prettier config, `vite.config.ts`, `index.html`
- [ ] `.gitattributes` (`eol=lf`) and `.gitignore` additions (`src/Csps.Server/wwwroot/`, `web/.e2e-dist/`, `web/.budget-dist/`)
- [ ] `web/src/test/setup.ts` (console-error/warn guard, `matchMedia` mock), `web/src/test/axe.ts`
- [ ] `web/playwright.config.ts` + `e2e/fixtures.ts` (console/CSP/axe) + smoke test over HTTPS 5199
- [ ] Budget plugin + tests; `scripts/lighthouse-assert.mjs`
- [ ] `tests/fixtures/order-math-golden-vectors.json` + generator; `OrderMath` + xUnit theory
- [ ] `DependencyRegistry` gains the `npm` kind and reads the web/tools package pins
- [ ] npm license gate script (license exceptions per D-26)
- [ ] `CspsApiFactory` fixture web root + SPA host tests + matrix rows

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Owner approves the icon drawings that changed (D-12) | WEB-02 | Visual judgement by the owner | Render the 20 changed icons next to the 0.460 drawings and send screenshots |
| Owner reviews layout/showcase screenshots (D-23) and the side-by-side report (D-24) | WEB-02, WEB-05, WEB-06 | Visual judgement by the owner | Capture at 390/820/1440 px in light and dark and send the report |
| Logout button looks identical to the old link (D-27) | WEB-02 | Visual confirmation | Before/after screenshots |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

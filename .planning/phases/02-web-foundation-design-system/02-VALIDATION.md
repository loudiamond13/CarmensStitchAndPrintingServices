---
phase: "02"
slug: "web-foundation-design-system"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-08T07:15:00-05:00"
updated: "2026-10-08T07:15:00-05:00"
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

Filled by the planner and executors once the plans exist. The requirement-level map below comes from the research and is binding for task design.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| WEB-01 | Build emits `index.html` + assets into `wwwroot`; dev 5180/strictPort/proxy; `build.license: false` (D-35) | unit (config) + script | `vitest run src/test/build-config.test.ts`; `npm --prefix web run build` | ❌ W0 | ⬜ pending |
| WEB-01 | SPA shell anonymous (GET/HEAD); `/api/*` and missing files ProblemDetails 404; dot/backslash/8.3 paths 404 with no file metadata; reserved docs 404 outside Dev; compression/caching; matrix rows | .NET integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*SpaHost*"` (+ `*HiddenSegmentFileProvider*`, `*Authorization*`) | ❌ W0 | ⬜ pending |
| WEB-01 | .NET suite independent of an untracked `src/Csps.Server/wwwroot` (fixture web root) | .NET integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiExposure*"` on a tree without `wwwroot` | ✅ tests / ❌ fixture | ⬜ pending |
| WEB-02 | Stylesheets hold only allowed constructs; every class token compiles against the CSPS theme (no defaults, no raw colors) | unit (node) | `vitest run src/styles/stylesheet-contract.test.ts scripts/tailwind-classes.test.ts` | ❌ W0 | ⬜ pending |
| WEB-02 | Rendered look equal to the approved design (+ rulings layer) per scenario/state/theme at 320/390/820/1440; comparator self-test fails on a 1px change | visual parity | `npm --prefix web run parity` | ❌ W0 | ⬜ pending |
| WEB-02 | Modal focus trap/return, Tabs ARIA/roving, Mark JSX, no non-null assertions | component + axe + lint | `vitest run src/ui` | ❌ | ⬜ pending |
| WEB-03 | httpClient behaviours at 100% coverage | unit | `vitest run src/lib/http --coverage "--coverage.include=src/lib/http/**"` | ❌ | ⬜ pending |
| WEB-04 | Lint bans (fetch/httpClient/axios outside api.ts, nuqs bans, D-33 style/class bans) | unit (ESLint `Linter`) | `vitest run src/test/lint-rules.test.ts` | ❌ | ⬜ pending |
| WEB-05 | Layout landmarks, skip link, one h1, error boundary, admin excluded from prod | component + build | `vitest run src/app`; budget plugin asserts no admin chunk | ❌ | ⬜ pending |
| WEB-06 | SPEC-GAP primitives behaviour + zero axe | component | `vitest run src/ui/gaps` | ❌ | ⬜ pending |
| WEB-07 | ≥ 200 golden vectors pass in TS and C# | unit + xUnit | `vitest run src/lib/csps.golden.test.ts`; `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*OrderMathGoldenVector*"` | ❌ | ⬜ pending |
| WEB-08 | Query defaults, keepPreviousData, 300 ms debounce, cancellation, prefetch via `query()` | component | `vitest run src/lib/query` | ❌ | ⬜ pending |
| WEB-09 | One Idempotency-Key per submission, pending look, one request per double-click | unit + component + parity | `vitest run src/lib/http src/lib/forms src/ui`; parity `pending` state | ❌ | ⬜ pending |
| WEB-10 | Parsers, push vs replace, page reset, dropped defaults, rewrite-once | unit + component | `vitest run src/lib/url-state` | ❌ | ⬜ pending |
| ORD-09 | `₱12,450.00`, `−₱…`, `Oct 6, 2026`; MoneyInput entry rules | unit + component | `vitest run src/lib/format src/ui/gaps/MoneyInput` | ❌ | ⬜ pending |
| QUAL-02 | 0 type errors, 0 lint warnings, Prettier clean, no warn-level rule | gate + unit | `npm --prefix web run typecheck && npm --prefix web run lint && npm --prefix web run format:check` | ❌ | ⬜ pending |
| QUAL-04 | E2E fails on console error/warning, CSP violation, axe violation | E2E | `npm --prefix web run e2e -- --grep @fixture` | ❌ | ⬜ pending |
| A11Y-01 | Zero axe violations on every page/preview in both themes | E2E | `npm --prefix web run e2e -- --grep @axe` | ❌ | ⬜ pending |
| A11Y-02 | Skip link, dialog trap/return, drawer, user menu keyboard | E2E + component | `npm --prefix web run e2e -- --grep @keyboard` | ❌ | ⬜ pending |
| A11Y-04 | Owner rulings on computed styles (D-01..D-05, D-27, D-31 incl. O-3 and D-BL-02, O-6) | parity rulings + E2E | `npm --prefix web run parity -- --grep @rulings` | ❌ | ⬜ pending |
| PERF-01 | Budgets fail the build over limits; exactly one CSS asset | unit + build | `vitest run scripts/budget.test.ts`; `npm --prefix web run build` | ❌ | ⬜ pending |
| PERF-02 | Lighthouse ≥ 95, LCP < 2 s, CLS < 0.05 | Lighthouse script | `npm --prefix web run lighthouse` | ❌ | ⬜ pending |
| PERF-03 | No horizontal scroll at 8 widths × 2 orientations; inputs ≥ 16 px on phones | E2E | `npm --prefix web run e2e -- --grep @responsive` | ❌ | ⬜ pending |
| PERF-05 | ₱ in the brand font; one preload; woff2 from `'self'`; fallback metrics | E2E + unit | `npm --prefix web run e2e -- --grep @fonts`; `vitest run scripts/font-metrics.test.ts` | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/` scaffold with D-25/D-34/D-36 exact pins, `.npmrc` (`min-release-age=14` plus only the owner-approved exceptions still needed), lockfile, tsconfigs, ESLint flat config, Prettier (tabWidth 2), `vite.config.ts` (`build.license: false`), `index.html`, `public/`
- [ ] `.gitattributes`, `.editorconfig` `[web/**]`, `.gitignore` entries for build/test outputs (`src/Csps.Server/wwwroot/`, `web/.e2e-dist/`, `web/.reference-dist/`, `web/.vitest/`, `web/test-results/` …)
- [ ] `web/src/styles/app.css` + `base.css` (theme, variants, tokens) with `stylesheet-contract.test.ts` and the class gate
- [ ] `web/src/test/setup.ts` (jest-dom, console guard, `matchMedia`), axe helper, fake fetch
- [ ] `web/visual/` parity harness (spec extraction + hash pin + frozen reference + rulings layer + comparator self-test)
- [ ] Playwright config + E2E fixtures (console / CSP via `exposeBinding` / axe) + self-tests + `scripts/e2e.mjs`
- [ ] Budget plugin + tests; Lighthouse assertion script
- [ ] Golden vectors + generator; `OrderMath.cs` + xUnit theory
- [ ] Test fixture web root (incl. dot-folder fixtures) wired into `CspsApiFactory`; SpaHost / HiddenSegmentFileProvider tests; matrix rows
- [ ] Dependency registry `npm` kind; npm license gate + exceptions (D-26 + addendum); repository THIRD-PARTY-NOTICES (D-35)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Owner visual sign-off of the converted UI (D-23 screenshot report) | WEB-02, A11Y-04 | Look approval is the owner's judgment; parity proves equality, not taste | Run the local owner report from the final plan; the owner reviews both themes at 1440/820/390 |
| Developer guide readability | WEB-01 | Reading judgment | Owner or reviewer reads `docs/development.md` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

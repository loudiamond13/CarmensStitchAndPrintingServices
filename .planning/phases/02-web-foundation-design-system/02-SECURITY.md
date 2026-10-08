---
phase: "02"
slug: "web-foundation-design-system"
status: draft
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
scope: "executed plans 02-01..02-10, 02-12, 02-13, 02-19 (02-11 and 02-14..02-18 not run; they wait on owner rulings D-BL-03)"
created: "2026-10-08T05:15:00-05:00"
updated: "2026-10-08T05:15:00-05:00"
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

**Status: draft (partial phase).** This audit covers the 13 plans that have run. Six plans (02-11 and 02-14..02-18) have not run, because they wait on the owner's design rulings (D-BL-03, backlog 999.1). Their 20 threat rows are listed as "not yet implemented". Re-run `/gsd-secure-phase 2` after those plans, before `status: verified`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| anonymous browser -> static files / SPA fallback | Untrusted request paths, decoded by Kestrel or IIS, reach `UseStaticFiles` and anonymous fallbacks before routing and authorization | Request paths (untrusted); public app files |
| build output -> served web root | Anything Vite or a later tool writes into `wwwroot`, `web/.e2e-dist` or the Lighthouse root is reachable unless the pipeline refuses it; `wwwroot` is shipped in Phase 3 | Build artefacts (public; dependency versions are low-sensitivity) |
| browser -> API (`/api/v1`) | Requests carry user data and, from Phase 4, bearer tokens | Form data, query strings, Idempotency-Keys (personal / auth-sensitive) |
| API -> browser | Error bodies may contain server detail | ProblemDetails, traceId |
| client -> API writes | Repeated submissions could duplicate money records | Order and payment writes (financial) |
| browser preview -> staff decisions | Staff read the preview before the server confirms | Money figures (financial) |
| URL query string -> app state / app state -> URL, history, referrer | Anyone can craft a link; values written to the URL leak through history, bookmarks and logs | List filters and search text (may hold personal data) |
| user keyboard / paste -> form values | Untrusted text enters money and code fields | Amounts, one-time codes |
| server data -> rendered UI; image URLs -> img elements | User-entered names and notes, later image URLs | Personal data (escaped by React; CSP-limited) |
| CSS and fonts -> browser under CSP | Assets must load from 'self' only | Static assets |
| npm registry -> node_modules (web/, tools/openapi-gen/) | Third-party code and transitive licenses enter at install time | Supply chain |
| third-party icon package -> shipped UI | lucide-react code ships to every visitor | Supply chain / visuals |
| approved design -> implemented UI | Drift would ship a look the owner never approved | Visual contract |
| repository policy and lint config -> gates | Editing an allow-list, exception file or lint rule could silently relax a gate | Policy |
| committed fixtures / server contract -> test suites and client types | A hand-edited fixture or an un-regenerated contract could hide a defect | Test oracles, API types |
| test runner -> local E2E host -> LocalDB | The host runs with Development secrets and a harness-chosen database | Dev secrets, `CSPS_E2E` data |

---

## Threat Register

| Threat ID | Plan | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | 02-01 | Information disclosure | SPA fallback vs `/api/*` | medium | mitigate | `/api/{**path}` literal fallback outranks `{*path:nonfile}`; SpaHostTests.UnknownApiRouteIsStillProblem404 | closed |
| T-02-02 | 02-01 | Elevation of privilege | Anonymous fallbacks under default-deny | high | mitigate | Only the four SPA/static fallbacks are AllowAnonymous, each on the allow-list with a matrix row; DiscoveredEndpointsAreFullyCovered fails on any unlisted anonymous endpoint (CWE-862) | closed |
| T-02-03 | 02-01 | Information disclosure | Response compression over HTTPS | medium | mitigate | MIME list limited to html/css/js/svg; NeverCompressesJson test (BREACH) | closed |
| T-02-04 | 02-01 | Information disclosure | `/scalar`, `/openapi` in production | medium | mitigate | Reserved-prefix 404 fallbacks outside Development (D-29); ProductionHasNoApiDocs asserts 404 | closed |
| T-02-05 | 02-01 | Denial of service | Stale cached `index.html` after deploy | low | mitigate | `index.html` and non-hashed files `no-cache`; hashed `/assets/*` immutable | closed |
| T-02-SC | 02-01 | Tampering | npm installs | high | mitigate | D-25 approved table at exact versions, `min-release-age=14` for the whole tree, lockfiles, `npm audit` at install; any different version or new advisory stops for a `checkpoint:decision` | closed |
| T-02-06 | 02-02 | Tampering | eslint.config.mjs architecture rules | medium | mitigate | lint-rules.test.ts proves each rule fires; eslint-config.test.ts fails on any warn-level rule or missing ignore entry | closed |
| T-02-07 | 02-02 | Tampering | Raw-HTML JSX injection (CWE-79) | high | mitigate | Lint error on the raw-HTML JSX attribute; strict CSP is the second layer (canon, also reviewed by /gsd-secure-phase) | closed |
| T-02-08 | 02-02 | Information disclosure | console output in app code | low | mitigate | `no-console: error` in src; Vitest console guard; Playwright console fixture (plan 06) | closed |
| T-02-SC | 02-02 | Tampering | npm installs | high | mitigate | No packages added; jiti, vitest-axe and eslint-plugin-jsx-a11y stay out; any new package stops for a `checkpoint:decision` | closed |
| T-02-09 | 02-03 | Tampering | docs/allowed-licenses.json, docs/license-exceptions.json, docs/dependencies.json | medium | mitigate | Exceptions carry approved/approvedBy; stale exceptions fail both gates; registry test fails on pin/registry drift; the gate tells the reader to go to the owner instead of widening lists | closed |
| T-02-10 | 02-03 | Tampering | Production npm tree licenses | high | mitigate | `--production` tree gated with no D-26 exceptions (only allow-list + OFL fonts) | closed |
| T-02-SC | 02-03 | Tampering | npm installs | high | mitigate | No installs here; `min-release-age=14` (plan 01) and the exact-pin test keep the tree reviewable; any new package stops for a `checkpoint:decision` | closed |
| T-02-11 | 02-04 | Tampering | Client/server money math mismatch | high | mitigate | One golden-vector file in xUnit and Vitest; integer-centavo rounding (D-09); server figures replace previews after a save | closed |
| T-02-12 | 02-04 | Tampering | Golden-vector fixture edited by hand | medium | mitigate | Independent exact-rational oracle with `--check` drift mode; amounts stored as strings; reviewed in the plan SUMMARY | closed |
| T-02-SC | 02-04 | Tampering | npm/NuGet installs | high | mitigate | No installs in this plan; any new package stops for a `checkpoint:decision` | closed |
| T-02-13 | 02-05 | Denial of service | Fonts inlined as data: URLs blocked by `font-src 'self'` | low | mitigate | `assetsInlineLimit: 0` (plan 01); build check that woff2 files exist under /assets | closed |
| T-02-14 | 02-05 | Information disclosure | Third-party font CDN requests leaking visitor IPs | low | mitigate | Self-hosted @fontsource only; CSP `font-src 'self'` blocks any CDN | closed |
| T-02-SC | 02-05 | Tampering | npm installs | high | mitigate | No installs in this plan; any new package stops for a `checkpoint:decision` | closed |
| T-02-15 | 02-06 | Information disclosure | Dev secrets for the E2E host | medium | mitigate | Secrets only from user-secrets (D-30); the precondition counts keys without printing values; child-process env carries only the environment name and a non-secret connection string | closed |
| T-02-16 | 02-06 | Repudiation | Relaxed CSP in tests hiding violations | medium | mitigate | No `bypassCSP`; smoke asserts the exact strict CSP header; self-test proves the CSP listener fires per engine | closed |
| T-02-17 | 02-06 | Tampering | E2E host pointed at the wrong database | medium | mitigate | Only `CSPS_E2E` on `(localdb)\CSPS`, migrated through DevSeedTargetGuard, which refuses any other database or server | closed |
| T-02-SC | 02-06 | Tampering | npm installs / browser downloads | high | mitigate | No new packages; browsers already present for Playwright 1.63.0; any new download or package stops for a `checkpoint:decision` | closed |
| T-02-18 | 02-07 | Information disclosure | Secrets in URLs (CWE-598) | high | mitigate | Sensitive param names rejected before sending; tokens only in headers via interceptors; `credentials: 'same-origin'` | closed |
| T-02-19 | 02-07 | Denial of service | Refresh storms or retry loops | medium | mitigate | Single-flight refresh, one retry after refresh, max 2 capped retries, no Query-level retries | closed |
| T-02-20 | 02-07 | Tampering | Duplicate writes from retried non-idempotent POSTs | high | mitigate | Only POSTs with an Idempotency-Key are retried, and the same key is sent on every attempt (WEB-09, SEC-06) | closed |
| T-02-21 | 02-07 | Information disclosure | Raw server errors surfaced to users | low | mitigate | Every failure normalized to HttpError with plain-English message and traceId; no raw Response or body dump | closed |
| T-02-SC | 02-07 | Tampering | npm installs | high | mitigate | No packages added; axios stays forbidden | closed |
| T-02-22 | 02-08 | Tampering | Untrusted URL params (CWE-20) | medium | mitigate | Allow-list or validating parser for every key; invalid values fall back and are removed; search capped at 100; server re-validates (SEC-03) | closed |
| T-02-23 | 02-08 | Spoofing | Open redirect through params (CWE-601) | medium | mitigate | Only parsed, typed values leave the hook; no param is used as an href or redirect target without validation | closed |
| T-02-24 | 02-08 | Information disclosure | Personal data in URLs (CWE-598) | medium | mitigate | Only free-text `q` may hold personal data; no dedicated PII params; secrets rejected by httpClient; Referrer-Policy strict-origin-when-cross-origin (Phase 1) | closed |
| T-02-SC | 02-08 | Tampering | npm installs | high | mitigate | No packages added; nuqs version fixed by plan 01 with owner approval rules | closed |
| T-02-25 | 02-09 | Tampering | Mark raw-HTML injection (CWE-79) | high | mitigate | Mark rendered as JSX; lint bans the raw-HTML attribute; strict CSP as second layer | closed |
| T-02-26 | 02-09 | Tampering | lucide-react with the cool-down waived (D-11) | medium | mitigate | Exact pin 1.52.0, advisory/deprecation check at install (plan 01), owner review of every changed drawing (D-12) | open — below high threshold (non-blocking); owner review deferred (D-BL-03) |
| T-02-27 | 02-09 | Repudiation | Undocumented design drift | medium | mitigate | SPEC-DEVIATION markers, SPEC-DEVIATIONS.md register, differential DOM test with listed exceptions only, owner checkpoint | open — below high threshold (non-blocking); owner review deferred (D-BL-03) |
| T-02-SC | 02-09 | Tampering | npm installs | high | mitigate | No packages added | closed |
| T-02-28 | 02-10 | Tampering | OpenAPI contract drift | medium | mitigate | OpenApiSnapshotTests (live vs committed) and `tools/openapi-gen` check (snapshot vs generated types) | closed |
| T-02-29 | 02-10 | Spoofing | Predictable Idempotency-Keys | medium | mitigate | `crypto.randomUUID` / `crypto.getRandomValues` only; test asserts Math.random is never used | closed |
| T-02-30 | 02-10 | Information disclosure | Error text leaking server internals | low | mitigate | describeHttpError shows only approved copy plus the traceId reference | closed |
| T-02-SC | 02-10 | Tampering | npm installs | high | mitigate | No packages added; openapi-typescript isolated in tools/openapi-gen with its own TypeScript (D-16) | closed |
| T-02-31 | 02-11 | Tampering | Destructive confirm bypass | medium | mitigate | Type-to-confirm with exact trimmed match; danger button disabled until it matches; Esc and scrim ignored while loading | not yet implemented (plan 02-11 not run; waits on D-BL-03) |
| T-02-32 | 02-11 | Repudiation | User misses a failed save because the message vanished | medium | mitigate | Danger toasts persist (D-04); ConfirmDialog failures stay inside the dialog with role=alert | not yet implemented (plan 02-11 not run; waits on D-BL-03) |
| T-02-SC | 02-11 | Tampering | npm installs | high | mitigate | No packages added (no focus-trap or toast libraries) | not yet implemented (plan 02-11 not run; waits on D-BL-03) |
| T-02-33 | 02-12 | Tampering | Malformed money input (CWE-20) | medium | mitigate | Pattern-enforced keystrokes and paste, exact `toCentavos`; the server re-validates every amount | closed |
| T-02-34 | 02-12 | Spoofing | Code entry blocking password managers or paste | low | mitigate | `autocomplete="one-time-code"` on the first box and paste always allowed (PRD 12 accessible authentication); non-digits ignored | closed |
| T-02-35 | 02-12 | Information disclosure | Password reveal toggle | low | accept | Hidden by default; the reveal is user-initiated and local to the device (App. D.3 verbatim behaviour) | closed (accepted, see log) |
| T-02-SC | 02-12 | Tampering | npm installs | high | mitigate | No packages added | closed |
| T-02-36 | 02-13 | Denial of service | Oversized search text | low | mitigate | `maxLength={100}` on SearchBox plus the parser cap (plan 08); the server rejects longer text (SEC-03) | closed |
| T-02-37 | 02-13 | Information disclosure | Server error detail in ErrorState | low | mitigate | Only approved copy plus the traceId reference is shown | closed |
| T-02-38 | 02-13 | Tampering | Untrusted image URLs | low | mitigate | React escapes attributes; CSP `img-src 'self' data: https://res.cloudinary.com` blocks other hosts | closed |
| T-02-SC | 02-13 | Tampering | npm installs | high | mitigate | No packages added | closed |
| T-02-39 | 02-14 | Information disclosure | Error boundary output | medium | mitigate | Plain copy only, no message or stack; production `onCaughtError`/`onUncaughtError` no-ops; zero console output | not yet implemented (plan 02-14 not run; waits on D-BL-03) |
| T-02-40 | 02-14 | Tampering | Footer external links (reverse tabnabbing) | low | accept | Footer markup is App. E.1 verbatim; current engines treat `target=_blank` as noopener by default; real social URLs arrive in the public-site phase, which re-checks | not yet implemented (plan 02-14 not run; waits on D-BL-03) |
| T-02-41 | 02-14 | Spoofing | Structured data (JSON-LD) | low | accept | None shipped in Phase 2 (Flag 3); the public-site phase adds it with a Playwright CSP check | not yet implemented (plan 02-14 not run; waits on D-BL-03) |
| T-02-SC | 02-14 | Tampering | npm installs | high | mitigate | No packages added | not yet implemented (plan 02-14 not run; waits on D-BL-03) |
| T-02-42 | 02-15 | Elevation of privilege | Dev-only admin routes in production (CWE-489) | high | mitigate | Compile-time `__DEV_ROUTES__` false only in production; buildRoutes test; production asset check; budget plugin assertion in plan 16 | not yet implemented (plan 02-15 not run; waits on D-BL-03) |
| T-02-43 | 02-15 | Tampering | `localStorage['csps-theme']` | low | mitigate | Only 'light' or 'dark' accepted, anything else is 'light'; try/catch on read and write | not yet implemented (plan 02-15 not run; waits on D-BL-03) |
| T-02-44 | 02-15 | Repudiation | A Logout that does not sign out | low | mitigate | Dev-only shell; Logout shows "Not available yet / Sign-out comes with the sign-in phase."; real sign-out in Phase 4 | not yet implemented (plan 02-15 not run; waits on D-BL-03) |
| T-02-SC | 02-15 | Tampering | npm installs | high | mitigate | No packages added | not yet implemented (plan 02-15 not run; waits on D-BL-03) |
| T-02-45 | 02-16 | Tampering | Budget gate bypass | medium | mitigate | Fails closed on missing route modules; boundary tests; limits are constants changed only with the owner | not yet implemented (plan 02-16 not run; waits on D-BL-03) |
| T-02-46 | 02-16 | Information disclosure | Showcase seed data in production (CWE-489) | medium | mitigate | Dev-only route; production budget build errors on any `src/app/dev/` or `src/app/admin/` module | not yet implemented (plan 02-16 not run; waits on D-BL-03) |
| T-02-SC | 02-16 | Tampering | npm installs | high | mitigate | No packages added; license gate now part of verify | not yet implemented (plan 02-16 not run; waits on D-BL-03) |
| T-02-47 | 02-17 | Information disclosure | Lighthouse telemetry and uploads | low | mitigate | `--no-enable-error-reporting`; no temporary-public-storage upload; reports only in git-ignored `artifacts/lighthouse/` | not yet implemented (plan 02-17 not run; waits on D-BL-03) |
| T-02-48 | 02-17 | Information disclosure | E2E/Lighthouse artifacts committed | low | mitigate | `artifacts/`, `web/playwright-report/`, `web/test-results/` are git-ignored; reports contain page data only, never secrets | not yet implemented (plan 02-17 not run; waits on D-BL-03) |
| T-02-SC | 02-17 | Tampering | npm installs | high | mitigate | No packages added; @lhci/cli (11 high advisories) stays out (D-25) | not yet implemented (plan 02-17 not run; waits on D-BL-03) |
| T-02-49 | 02-18 | Information disclosure | `.planning/design/*.html` and their renders | high | mitigate | Guard refuses CI and any output outside git-ignored `artifacts/owner-review/`; design files are only read; every output path checked with `git check-ignore`; never `git add -f` | not yet implemented (plan 02-18 not run; waits on D-BL-03) |
| T-02-50 | 02-18 | Information disclosure | Captures containing data | low | accept | Only fake seed data (spec section 12) appears; captures stay local | not yet implemented (plan 02-18 not run; waits on D-BL-03) |
| T-02-SC | 02-18 | Tampering | npm installs | high | mitigate | No packages added | not yet implemented (plan 02-18 not run; waits on D-BL-03) |
| T-02-51 | 02-19 | Information disclosure | Files in dot folders of the web root (`.vite/license.md` lists every bundled dependency with its exact version; a future `.vite/manifest.json` or stray `.git/`) (CWE-200, CWE-538, CWE-497) | medium | mitigate | `HiddenSegmentFileProvider` wraps the web-root provider in `UseStaticFiles`; any dot-prefixed segment reads as missing and gets the `{*path:file}` ProblemDetails 404; SpaHostTests.HiddenFilesAreProblem404 with committed fixtures and a File.Exists guard; real-host curl of the UAT reproduction | closed |
| T-02-52 | 02-19 | Information disclosure | Path-equivalence bypass of the dot rule on Windows: backslash separators and NTFS 8.3 short names such as `VITE~1` (CWE-41, CWE-58) | medium | mitigate | The rule splits on `/` and `\` and refuses any segment containing `~`; alias rows in SpaHostTests (RED on this machine), IsHidden unit truth table on every OS, real-host curl of `%5C`, `%2F`, `..` and the alias | closed |
| T-02-53 | 02-19 | Information disclosure | A hidden file's 404 differing from a missing file's, or HEAD/ETag/Last-Modified/Accept-Ranges revealing size and dates (CWE-204, CWE-200) | low | mitigate | The same fallback endpoint answers both; tests assert an equal title and no ETag, Last-Modified or Accept-Ranges, HEAD included | closed |
| T-02-54 | 02-19 | Denial of service | The rule hiding a real app file and breaking the site | low | mitigate | Vite/Rolldown names never start with a dot or contain `~`; existing SpaHostTests for real files stay green; the real-host check fetches every built file outside `.vite/` | closed |
| T-02-55 | 02-19 | Elevation of privilege | New anonymous surface under default-deny (CWE-862) | low | mitigate | No endpoint, AllowAnonymous, matrix row or allow-list key is added; DiscoveredEndpointsAreFullyCovered and the matrix rows stay green | closed |
| T-02-56 | 02-19 | Denial of service | A future deliberate `/.well-known/` file (security.txt, Android App Links, ACME HTTP-01) is refused | low | accept | No such file exists today, and extensionless ACME tokens were already not served by UseStaticFiles; a later need adds an explicit, tested exact-path exception in the wrapper (documented in docs/development.md and the class XML docs); Phase 3 records how the host validates certificates | closed (accepted, see log) |
| T-02-SC | 02-19 | Tampering | npm/NuGet installs | high | mitigate | No packages added | closed |

*Status: open · closed · open — below high threshold (non-blocking) · not yet implemented (plan not run)*
*Severity: critical > high > medium > low. Only open threats at or above workflow.security_block_on (high) count toward threats_open.*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*
*T-02-SC (supply chain) recurs once per plan. Each row was verified against that plan's own commit range.*

### Verification evidence (gsd-security-auditor, 2026-10-08)

The auditor ran read-only checks: Server integration tests 258/258, Domain 390/390, Architecture 102/102, 25 Vitest files 993/993, `npm run lint` clean, `npm audit` 0/0 in both npm folders, the golden-vector `--check` and the OpenAPI types `check` both exit 0. The license gate exits 1, as designed, only on the 5 dev-tree packages of D-BL-01; the production tree passes. Evidence for the high-severity rows:

- **T-02-02 (default-deny):** `AuthorizationMatrix.cs` allow-list (5 SPA/static keys, including GET and HEAD `{*path:nonfile}`; 02-01 deviation 2); `DiscoveredEndpointsAreFullyCovered` passes.
- **T-02-07 / T-02-25 (CWE-79):** the raw-HTML JSX attribute is a lint error (`eslint.config.mjs`, `lint-rules.test.ts`); Mark renders as JSX (`src/ui/index.tsx`, `differential.test.tsx`); strict CSP with no unsafe-inline or unsafe-eval (`SecurityHeadersMiddleware.cs`).
- **T-02-10:** production npm tree gated with no exceptions (`license-gate.mjs`); a live run shows 0 production problems.
- **T-02-11:** one golden-vector fixture is read by xUnit and Vitest; centavo rounding is half away from zero on both sides (`OrderMath.cs`, `csps.ts`). Server figures replacing previews after a save arrive with the Phase 8 screens (carry-forward 2).
- **T-02-18 (CWE-598):** secret parameter names are refused before sending; `credentials: 'same-origin'` (`httpClient.ts`, `httpClient.resilience.test.ts`).
- **T-02-20:** POSTs are retried only with an Idempotency-Key, and the same key is resent on every attempt (`httpClient.ts`, resilience tests).
- **T-02-SC (all plans):** only plan 02-01 changed packages. Both lockfiles, both `.npmrc` files and `Directory.Packages.props` are unchanged since commit 644ae7c.
- **T-02-51 / T-02-52 (UAT gap G-02-2):** `HiddenSegmentFileProvider` wraps the web root (`Program.cs`); `HiddenFilesAreProblem404` covers 6 variants including `%5C` and `VITE~1`; there is a truth-table test; the live re-test returned 404 for every variant.

### Carry-forwards (each maps to a registered threat; none changes a status)

1. **T-02-18 → Phase 4:** `assertNoSecretParams` checks only `params` keys, not a query string written into `url` itself. There are no such callers today (lint limits callers to `api.ts`). Extend the check, and consider adding `code`, before tokens and reset links arrive.
2. **T-02-11 → Phase 8:** `OrderCard` (verbatim spec D.3) always shows the browser preview `orderTotals(o)`. The order screens need a path for server totals (also UAT follow-up 999.2).
3. **T-02-12 → Phase 3:** `gen-golden-vectors.mjs --check` is run only by hand. Add it to CI.
4. **T-02-09 / T-02-10 → owner:** the npm license gate stays red on 5 dev-only packages until D-BL-01 is decided. This is the gate failing closed, as designed.
5. **T-02-51 → owner / Phase 3:** `vite build` still writes `.vite/license.md` into wwwroot (no longer served). What to do with it is owner decision D-BL-04.
6. **T-02-20 (informational):** after a 401 and a successful refresh, a POST without a key is resent once. This is safe only because default-deny rejects a 401 before any handler runs. Keep that order.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-35 | The password field is hidden by default; revealing it is user-initiated and local to the device (App. D.3 verbatim behaviour). The auditor confirmed `useState(false)` and the Show/Hide password labels. | Plan-time disposition in 02-12; owner ratification pending (backlog 999.1 FYI-02) | 2026-10-08 |
| AR-02-02 | T-02-56 | The dot-folder rule would also refuse a future deliberate `/.well-known/` file (security.txt, Android App Links, ACME HTTP-01). No such file exists today, extensionless ACME tokens were never served, and the exception path is documented (`docs/development.md`, `HiddenSegmentFileProvider.cs`). | Plan-time disposition in gap plan 02-19 (written while the owner was away); owner ratification pending (backlog 999.1 FYI-02) | 2026-10-08 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-08 | 55 in scope (+20 not yet implemented) | 53 (51 mitigate, 2 accept) | 2 non-blocking (T-02-26, T-02-27, medium; owner review deferred to D-BL-03); 0 blocking | gsd-security-auditor via /gsd-secure-phase 2 (owner away) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (owner ratification pending, FYI-02)
- [x] `threats_open: 0` confirmed (for the 13 executed plans)
- [ ] `status: verified` set in frontmatter. Pending: plans 02-11 and 02-14..02-18, owner rulings D-BL-03 (closes T-02-26 / T-02-27), then a re-audit.

**Approval:** pending

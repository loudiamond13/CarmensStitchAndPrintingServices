# Security review: CWE Top 25 (2025) and ATT&CK

*Created: 2026-11-27T18:58:00-06:00 · Updated: 2026-11-27T18:58:00-06:00*

This is the pre-release security review for CSPS (SEC-05). It lists every weakness on the MITRE CWE Top 25 list for 2025 and the ATT&CK attacker techniques that matter to this app. Each row says how CSPS defends against it and names the test files that prove it. A test in the architecture suite (`SecurityReviewDocTests.cs`) fails if a row is missing, out of order, has no status, or names a test file that does not exist.

## How to read this

- **Status** is `Mitigated` (a control exists and a test proves it) or `Not applicable` (the weakness cannot happen in this stack, and a test proves why).
- **Tests** names test files, not single tests. Look the file up by name in the repository.
- The memory-safety rows are `Not applicable`. CSPS runs on .NET and JavaScript, which are memory-safe runtimes. `NoUnsafeCodeTests.cs` fails the build if any C# file under `src/` or `tools/` uses the `unsafe` keyword, or if any project turns on `AllowUnsafeBlocks`.
- Phase 14's own work (the ZAP scan, the offline worker cache, the header changes) is added to this review by plan 14-25, once its tests exist.
- Each earlier phase kept its own threat register. They are linked under "Per-phase records" and are the detailed evidence behind the rows below.

## CWE Top 25 (2025)

| Rank | CWE | Name | Status | Mitigation | Tests |
|------|-----|------|--------|------------|-------|
| 1 | CWE-79 | Cross-site scripting | Mitigated | React escapes all text. Raw HTML sinks (`dangerouslySetInnerHTML`, `innerHTML` writes) are lint errors. The page policy allows no inline or eval scripts. Server-written page head values are encoded. | `lint-rules.node.test.ts`, `SecurityHeadersTests.cs`, `ShellHeadTests.cs` |
| 2 | CWE-89 | SQL injection | Mitigated | All data access goes through EF Core with parameters. No hand-written SQL exists in application code, and a scan fails the build if it appears. | `NoInlineSqlTests.cs` |
| 3 | CWE-352 | Cross-site request forgery | Mitigated | The access token lives in memory and travels in the Authorization header. The refresh cookie is SameSite Strict and needs a custom header and a same-origin fetch. | `CsrfHeaderTests.cs`, `StaffMarkerCookieTests.cs`, `auth-cookies.spec.ts` |
| 4 | CWE-862 | Missing authorization | Mitigated | Default deny: every call needs a signed-in user unless an action says it is anonymous on purpose. The matrix test discovers every action and checks anonymous, Admin and Manager. | `AuthorizationMatrixTests.cs`, `AuthorizationCoverageTests.cs`, `AuthorizationFailureTests.cs` |
| 5 | CWE-787 | Out-of-bounds write | Not applicable | .NET and JavaScript are memory-safe runtimes and the code has no unsafe blocks. | `NoUnsafeCodeTests.cs` |
| 6 | CWE-22 | Path traversal | Mitigated | No user-supplied value is used as a file path. Uploads are held in memory and sent to Cloudinary, never written to disk. Dot folders and hidden segments in the web root answer 404. | `UploadNoDiskTests.cs`, `HiddenSegmentFileProviderTests.cs`, `WebConfigTests.cs` |
| 7 | CWE-416 | Use after free | Not applicable | .NET and JavaScript are memory-safe runtimes and the code has no unsafe blocks. | `NoUnsafeCodeTests.cs` |
| 8 | CWE-125 | Out-of-bounds read | Not applicable | .NET and JavaScript are memory-safe runtimes and the code has no unsafe blocks. | `NoUnsafeCodeTests.cs` |
| 9 | CWE-78 | OS command injection | Mitigated | The app never starts an operating system process, so there is no command line to inject into. A scan fails the build if any code under `src/` or `tools/` starts one. | `NoUnsafeCodeTests.cs` |
| 10 | CWE-94 | Code injection | Mitigated | Nothing loads or builds code at run time on the server, and browser code never evaluates text as code. Scans cover both. The page policy blocks eval and inline scripts. | `NoUnsafeCodeTests.cs`, `SecurityHeadersTests.cs` |
| 11 | CWE-120 | Buffer copy without checking size | Not applicable | .NET and JavaScript are memory-safe runtimes and the code has no unsafe blocks. | `NoUnsafeCodeTests.cs` |
| 12 | CWE-434 | Unrestricted file upload | Mitigated | The server checks the real file type from the first bytes, caps size and pixels, strips metadata, allows no SVG, and stores the file privately in Cloudinary. Uploads are rate limited. | `ImageSnifferTests.cs`, `ImageMetadataStripperTests.cs`, `OrderImageUploadLimitsTests.cs`, `ImageUploadRateLimitTests.cs`, `UploadNoDiskTests.cs` |
| 13 | CWE-476 | NULL pointer dereference | Not applicable | A null in .NET raises an exception and never reads memory. Nullable analysis is on and every warning is a build error, so a missing null check fails the build. | `NoUnsafeCodeTests.cs`, `BuildConfigTests.cs` |
| 14 | CWE-121 | Stack-based buffer overflow | Not applicable | .NET and JavaScript are memory-safe runtimes and the code has no unsafe blocks. | `NoUnsafeCodeTests.cs` |
| 15 | CWE-502 | Deserialization of untrusted data | Mitigated | Only System.Text.Json is used, with no type names in the payload. No binary or type-name serializers exist, and a scan fails the build if one appears. Request bodies are capped at 1 MiB. | `NoUnsafeCodeTests.cs`, `RequestBodyLimitTests.cs` |
| 16 | CWE-122 | Heap-based buffer overflow | Not applicable | .NET and JavaScript are memory-safe runtimes and the code has no unsafe blocks. | `NoUnsafeCodeTests.cs` |
| 17 | CWE-863 | Incorrect authorization | Mitigated | Each action names its policy. The matrix test proves the exact role that may call each action, and the last-Manager guard stops the only Manager from being removed. | `AuthorizationMatrixTests.cs`, `LastManagerGuardTests.cs`, `ExpenseAccessTests.cs` |
| 18 | CWE-20 | Improper input validation | Mitigated | Every command has a FluentValidation validator with length limits. Request bodies and list page sizes are capped. | `CreateOrderRequestValidatorTests.cs`, `SignInRequestValidatorTests.cs`, `ListQueryRulesTests.cs`, `RequestBodyLimitTests.cs` |
| 19 | CWE-284 | Improper access control | Mitigated | Default-deny policies, a signed-in check on every route, and a check that every action declares its policy. Files and folders that are not public answer 404. | `AuthorizationCoverageTests.cs`, `AuthorizationMatrixTests.cs`, `HiddenSegmentFileProviderTests.cs` |
| 20 | CWE-200 | Exposure of sensitive information | Mitigated | Errors are plain-English problem responses with a trace id and no stack. Logs mask secrets, codes and tokens. The API description is not served in production. The server banner headers are removed. | `ProblemDetailsTests.cs`, `SensitiveDataMaskingTests.cs`, `OpenApiExposureTests.cs`, `ImageSecretExposureTests.cs`, `WebConfigTests.cs` |
| 21 | CWE-306 | Missing authentication for critical function | Mitigated | Staff sign in needs a password and an emailed code. Anonymous endpoints are limited to sign-in steps, public content, the quote form, page counting, health and the keyed maintenance call. The matrix test proves anonymous callers get 401 everywhere else. | `AuthorizationMatrixTests.cs`, `VerifyCodeEndpointTests.cs`, `MaintenanceKeyTests.cs` |
| 22 | CWE-918 | Server-side request forgery | Mitigated | The server never fetches an address a visitor supplies. Outbound calls go only to fixed hosts (Cloudinary and the breached-password range lookup), and a scan limits which files may make them. | `NoUnsafeCodeTests.cs`, `HibpPwnedPasswordsTests.cs` |
| 23 | CWE-77 | Command injection | Mitigated | No process is started (see CWE-78). Email addresses are parsed as mailboxes and length limited, so a visitor cannot add mail headers. | `NoUnsafeCodeTests.cs`, `CreateQuoteRequestRequestValidatorTests.cs` |
| 24 | CWE-639 | Authorization bypass through user-controlled key | Mitigated | Ids are GUIDs, and each lookup is scoped to the caller. Another user's session answers the same 404 as a missing one. Profile calls always act on the signed-in user. Quote form tickets are signed and expire. | `SessionsEndpointTests.cs`, `ProfileEndpointTests.cs`, `QuoteFormTicketsTests.cs`, `AuthorizationMatrixTests.cs` |
| 25 | CWE-770 | Allocation of resources without limits | Mitigated | Rate limits on sign-in, code resend, uploads, analytics and public forms. Request bodies are capped at 1 MiB, list pages are capped, and uploads have slot limits. | `RateLimitTests.cs`, `RequestBodyLimitTests.cs`, `ImageUploadRateLimitTests.cs`, `AnalyticsRateLimitTests.cs`, `UploadSlotsCoverageTests.cs` |

## ATT&CK techniques

| Technique | Name | Status | Mitigation | Tests |
|-----------|------|--------|------------|-------|
| T1110 | Brute Force | Mitigated | Accounts lock after repeated failures. Sign-in is rate limited per address. Sign-in takes the same time whether or not the account exists. | `LockoutTests.cs`, `RateLimitTests.cs`, `SignInTimingTests.cs` |
| T1110.003 | Brute Force: Password Spraying | Mitigated | The rate limit and the lockout both stop one address trying one password across many accounts. Common passwords are refused. | `RateLimitPartitionTests.cs`, `LockoutTests.cs`, `CommonPasswordListTests.cs` |
| T1110.004 | Brute Force: Credential Stuffing | Mitigated | Passwords found in known breaches are refused when set and checked again at sign-in. Only the first five characters of the hash leave the server. | `HibpPwnedPasswordsTests.cs`, `BreachRecheckTests.cs`, `RateLimitTests.cs` |
| T1078 | Valid Accounts | Mitigated | Deactivated accounts cannot sign in or refresh. A temporary password must be changed at first use. Sessions can be revoked. A second factor is needed for every sign-in. | `InactiveAccountTests.cs`, `MustChangePasswordTests.cs`, `SessionRevocationTests.cs`, `VerifyCodeEndpointTests.cs` |
| T1190 | Exploit Public-Facing Application | Mitigated | Strict security headers, parameterized data access only, a request body cap, no API description in production, and CodeQL and dependency review on every pull request. | `SecurityHeadersTests.cs`, `NoInlineSqlTests.cs`, `RequestBodyLimitTests.cs`, `OpenApiExposureTests.cs`, `SecurityWorkflowTests.cs` |
| T1539 | Steal Web Session Cookie | Mitigated | The refresh cookie is HttpOnly, Secure and SameSite Strict, and it rotates on every use. A reused old cookie ends the session. | `StaffMarkerCookieTests.cs`, `RefreshRotationTests.cs`, `CsrfHeaderTests.cs`, `auth-cookies.spec.ts` |
| T1556 | Modify Authentication Process | Mitigated | Changing a password needs the current one. Changing an email needs a confirmation. Sign-in codes are checked against a keyed hash. Every change is audited. | `ChangePasswordTests.cs`, `EmailChangeTests.cs`, `VerifyCodeEndpointTests.cs`, `AuditLogEndpointTests.cs` |
| T1566 | Phishing | Mitigated | Reset and invite emails come from one consistent sender. The hosting record keeps the SPF, DKIM and DMARC facts. Forgot-password gives the same answer whether or not the account exists. | `ForgotPasswordTests.cs`, `HostingRecordTests.cs`, `ManagerResetLinkTests.cs`, `MailSafetyTests.cs` |
| T1499 | Endpoint Denial of Service | Mitigated | Rate limits per address and per route, a 1 MiB body cap, upload slot limits and list page caps. | `RateLimitTests.cs`, `RequestBodyLimitTests.cs`, `ImageUploadRateLimitTests.cs`, `AnalyticsRateLimitTests.cs` |
| T1552 | Unsecured Credentials | Mitigated | No secret is kept in git or in settings files. Logs mask secrets. The host record and docs are scanned for keys and passwords. Gitleaks runs on every commit. | `AuthSecretsTests.cs`, `SensitiveDataMaskingTests.cs`, `ImageSecretExposureTests.cs`, `MaintenanceKeySafetyTests.cs`, `HostingRecordTests.cs`, `MailSafetyTests.cs` |
| T1195 | Supply Chain Compromise | Mitigated | Actions are pinned by commit hash, versions are exact and at least 14 days old, lock files are committed, and packages need a recorded approval. | `CiWorkflowTests.cs`, `DependencyRegistryTests.cs`, `HygieneWorkflowTests.cs`, `package-check.test.ts` |
| T1550.001 | Use Alternate Authentication Material: Application Access Token | Mitigated | Access tokens are signed and last 15 minutes. Refresh tokens rotate, and replaying a used one revokes the whole session. Signing out revokes the session too. | `AccessTokenTests.cs`, `RefreshRotationTests.cs`, `SessionRevocationTests.cs` |
| T1621 | Multi-Factor Authentication Request Generation | Mitigated | Code resends are rate limited. Wrong codes are counted across tickets, so starting a new ticket does not reset the count, and ten wrong codes lock the account. | `ResendCodeEndpointTests.cs`, `CrossTicketCapTests.cs`, `RateLimitTests.cs` |
| T1098 | Account Manipulation | Mitigated | Only a Manager can create users, change roles or reset access. The last Manager cannot be removed or demoted. Every change is written to the audit log. | `UserLifecycleTests.cs`, `LastManagerGuardTests.cs`, `ManagerEmailChangeTests.cs`, `AuthorizationMatrixTests.cs` |
| T1531 | Account Access Removal | Mitigated | Locking, deactivating or deleting a user is a Manager action, and the last Manager is protected from all three. | `LastManagerGuardTests.cs`, `LockUserTests.cs`, `DeleteUserTests.cs` |
| T1485 | Data Destruction | Mitigated | Orders and expenses are soft deleted and can be restored. Deleting needs the right role, and each deletion is audited. | `OrderDeletionTests.cs`, `CompanyExpenseDeletionTests.cs`, `AuthorizationMatrixTests.cs` |
| T1565 | Data Manipulation | Mitigated | Every aggregate has a row version, so a stale write gets 409. Money is computed on the server. Repeated posts are caught by idempotency keys. Changes are audited. | `OrderConcurrencyTests.cs`, `OrderMathGoldenVectorTests.cs`, `IdempotencyTests.cs`, `AuditLogAppendOnlyTests.cs` |
| T1070 | Indicator Removal | Mitigated | The audit log is append only, enforced by one database guard (`TR_AuditLog_AppendOnly`). No other trigger is allowed, and a test lists every trigger. | `AuditLogAppendOnlyTests.cs`, `TriggerInventoryTests.cs` |
| T1505.003 | Server Software Component: Web Shell | Mitigated | Uploads are never written to the web root or to disk. Only image types pass the byte check. The publish output is checked for forbidden file types. | `UploadNoDiskTests.cs`, `ImageSnifferTests.cs`, `PublishOutputTests.cs`, `HiddenSegmentFileProviderTests.cs` |
| T1530 | Data from Cloud Storage | Mitigated | Order and quote photos are private in Cloudinary and are served only at fixed named sizes. The Cloudinary secret never reaches a response or a log. | `CloudinaryImageDeliveryTests.cs`, `CloudinaryImageStorageTests.cs`, `ImageSecretExposureTests.cs` |

## Per-phase records

Each earlier phase kept a threat register with its own evidence. These are the detailed per-phase CWE records.

- [Phase 01: hosting verification and backend foundation](../../.planning/phases/01-hosting-verification-backend-foundation/01-SECURITY.md)
- [Phase 02: web foundation and design system](../../.planning/phases/02-web-foundation-design-system/02-SECURITY.md)
- [Phase 03: CI/CD and staging deploy](../../.planning/phases/03-ci-cd-staging-deploy/03-SECURITY.md)
- [Phase 04: identity and authentication](../../.planning/phases/04-identity-authentication/04-SECURITY.md)
- [Phase 05: profile and user management](../../.planning/phases/05-profile-user-management/05-SECURITY.md)
- [Phase 06: company expenses](../../.planning/phases/06-company-expenses/06-SECURITY.md)
- [Phase 07: order domain API](../../.planning/phases/07-order-domain-api/07-SECURITY.md)
- [Phase 07.1: legacy fit check, read only](../../.planning/phases/07.1-legacy-fit-check-read-only/07.1-SECURITY.md)
- [Phase 08: order screens](../../.planning/phases/08-order-screens/08-SECURITY.md)
- [Phase 09: order images and maintenance jobs](../../.planning/phases/09-order-images-maintenance-jobs/09-SECURITY.md)
- [Phase 10: admin dashboard](../../.planning/phases/10-admin-dashboard/10-SECURITY.md)
- [Phase 11: public site content management](../../.planning/phases/11-public-site-content-management/11-SECURITY.md)
- [Phase 12: consent, analytics and legal](../../.planning/phases/12-consent-analytics-legal/12-SECURITY.md)
- [Phase 12.1: analytics simplification](../../.planning/phases/12.1-analytics-simplification-daily-page-tally-only-no-cookie-ban/12.1-SECURITY.md)
- [Phase 13: quote inquiries](../../.planning/phases/13-quote-inquiries/13-SECURITY.md)

## Checked on

2026-11-27. The CWE list is the MITRE CWE Top 25 for 2025 (cwe.mitre.org, archive page for 2025). On that day the site had no 2026 list, so the 2025 list is the latest. Each ATT&CK technique id and name above was read on attack.mitre.org on the same day. If MITRE publishes a 2026 list, tell the owner before switching this review to it.

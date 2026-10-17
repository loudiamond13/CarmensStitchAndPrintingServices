# Phase 5: Profile & User Management - Pattern Map

*Created: 2026-10-17T17:05:00-05:00 · Updated: 2026-10-17T17:05:00-05:00*

**Mapped:** 2026-10-17
**Files analyzed:** 46 new or modified (grouped below)
**Analogs found:** 42 / 46

CONTEXT D-34..D-41 win over RESEARCH where they differ: **no shadcn, no new package** (D-37), Tailwind first (D-38), drawer open and close motion without a hamburger morph (D-34), user-menu and every Modal/ConfirmDialog animate at all widths (D-35, D-39), audit detail stores field names and role values only (D-40), research defaults Q3/Q4/Q5/Q6/Q9 accepted (D-41). Ignore the RESEARCH "burger bars" and "drawer below the topbar" items; they are not required.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/Csps.Server/Controllers/UsersController.cs` | controller | request-response | `src/Csps.Server/Controllers/SessionsController.cs` | exact |
| `src/Csps.Server/Controllers/ProfileController.cs` | controller | request-response | `SessionsController.cs` (Staff policy) + `InviteController.cs` (anonymous check/confirm) | exact |
| `src/Csps.Server/Controllers/AuditLogController.cs` | controller | request-response (list) | `SessionsController.cs` | role-match |
| `src/Csps.Application/Users/*Handler.cs` (Create, Update, Lock, Unlock, Deactivate, Activate, Delete, ResendInvitation, SendResetLink, SetTemporaryPassword, List, Get) | service (use case) | CRUD + transactional | `src/Csps.Application/Users/BootstrapManagerHandler.cs`, `src/Csps.Application/Auth/RevokeSessionHandler.cs` | exact |
| `src/Csps.Application/Users/UserErrors.cs` (extend) | utility | n/a | itself | exact |
| `src/Csps.Application/Users/*Validator.cs` | utility (validation) | transform | `BootstrapManagerCommandValidator.cs` | exact |
| `src/Csps.Application/Profile/*Handler.cs` (GetProfile, UpdateName, ChangePassword, Request/Resend/Cancel/Check/ConfirmEmailChange) | service | CRUD + token | `BootstrapManagerHandler.cs` (token + outbox), `Auth/ResetPasswordHandler.cs`, `Auth/CheckInviteHandler.cs` | exact |
| `src/Csps.Application/Audit/ListAuditLogHandler.cs` | service | read/list | `Auth/ListSessionsHandler.cs` | role-match |
| `src/Csps.Application/Ports/IUserDirectory.cs`, `IManagerRosterLock` | port | n/a | existing `Ports/IAccountTokens` (`LockAccountAsync`) | exact |
| `src/Csps.Application/Auth/UserAccount.cs` (one "can sign in" rule) | model | n/a | itself; ~11 call sites (RESEARCH Pitfall 1) | exact |
| `src/Csps.Application/Auth/AuthSettings.cs` (`InviteLinkLifetime` 7 d) | config | n/a | itself line 63 | exact |
| `src/Csps.Domain/Auditing/AuditActions.cs` (+ `user.*`, `profile.*`) | model | n/a | itself | exact |
| `src/Csps.Domain/Identity/AccountToken.cs` (+ `EmailChange = 3`) | model | n/a | itself | exact |
| `src/Csps.Infrastructure/Identity/ApplicationUser.cs` (+ columns) | model | n/a | itself | exact |
| `src/Csps.Infrastructure/Persistence/Configurations/ApplicationUserConfiguration.cs` | config | n/a | itself + `AccountTokenConfiguration.cs` | exact |
| `src/Csps.Infrastructure/Identity/UserDirectory.cs`, `ManagerRosterLock.cs` | repository | CRUD / lock | `src/Csps.Infrastructure/Identity/AccountTokenStore.cs` | exact |
| `src/Csps.Infrastructure/Persistence/RecordStampInterceptor.cs` | middleware (EF interceptor) | event-driven | `src/Csps.Infrastructure/Auditing/AuditLogAppendOnlyInterceptor.cs`, `Email/OutboxSignal.cs` | exact |
| `src/Csps.Infrastructure/Persistence/Migrations/<ts>_AddUserManagement.cs` | migration | n/a | `Migrations/20261015060201_AddAccountTokens.cs` | exact |
| `tests/Csps.Infrastructure.IntegrationTests/Auditing/NoTriggersTests.cs` (D-06) | test | n/a | `tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditLogAppendOnlyTests.cs` | exact |
| `tests/Csps.Server.IntegrationTests/Users/*`, `Profile/*`, `Audit/*` (two-writer, SEC-08 forged fields, inactive table) | test | request-response | `tests/Csps.Server.IntegrationTests/Auth/InactiveAccountTests.cs`, `Auth/InviteTests.cs`, `Sessions/*` | exact |
| `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs` (rows) | test | n/a | itself lines 65-83 | exact |
| `tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyAllowList.cs` (check/confirm exemptions) | test config | n/a | itself | exact |
| `web/src/modules/admin/services/usersService.ts`, `profileService.ts`, `auditLogService.ts` | service | request-response | `web/src/modules/admin/services/sessionsService.ts` | exact |
| `web/src/modules/admin/hooks/useUsersListParams.ts`, `useAuditListParams.ts`, `useProfileTab.ts` | hook | URL state | `web/src/lib/url-state/createListParams.ts` (+ its test) | exact |
| `web/src/modules/admin/hooks/useUsersQuery.ts`, `useAuditLogQuery.ts`, `useProfileQuery.ts` | hook | read | `web/src/modules/admin/hooks/useSessionsQuery.ts`, `web/src/lib/query/useListQuery.ts`, `lib/query/keys.ts` | exact |
| `web/src/modules/admin/pages/UsersPage.tsx`, `AuditLogPage.tsx` | component (page) | list | `web/src/modules/admin/pages/SessionsPage.tsx` + `components/SessionsView.tsx` | exact |
| `web/src/modules/admin/pages/ProfilePage.tsx` | component (page) | form CRUD | `SessionsPage.tsx` (page shell) + `NewPasswordPage.tsx` (form) | role-match |
| `web/src/modules/admin/pages/ConfirmEmailPage.tsx` | component (auth page) | request-response | `web/src/modules/admin/pages/ResetPasswordPage.tsx` / `AcceptInvitePage.tsx` (hash token + check + explicit button) | exact |
| `web/src/modules/admin/components/DeactivateUserDialog.tsx`, `LockUserDialog.tsx` | component | request-response | `web/src/modules/admin/components/SignOutDeviceDialog.tsx` over `SignOutDialog.tsx` | exact |
| `AddUserPanel.tsx`, `EditUserPanel.tsx`, `TemporaryPasswordDialog.tsx`, `ChangeEmailDialog.tsx`, `CopyField.tsx`, `AuditDetail.tsx` | component | form | `Modal variant="slideover"` + `NewPasswordFields.tsx`, `SignInForm.tsx` | role-match |
| `web/src/modules/admin/usersCopy.ts`, `profileCopy.ts`, `auditCopy.ts` | config (copy) | n/a | `web/src/modules/admin/authCopy.ts` | exact |
| `web/src/modules/admin/usersSchemas.ts`, `profileSchemas.ts` | utility (zod, OR-3) | transform | `web/src/modules/admin/authSchemas.ts` (+ `authSchemas.test.ts`) | exact |
| `web/src/modules/admin/guard.ts` (+ `requireManagerLoader`) | middleware (route guard) | request-response | itself `requireSessionLoader` | exact |
| `web/src/modules/admin/routes.tsx` (users, profile, audit-log, confirm-email, components) | route | n/a | itself (`sessionsPage`, `acceptInvitePage`) | exact |
| `web/src/components/entry/RadioGroup.tsx`, `forms/DateInput.tsx` | component | n/a | `entry/Checkbox.tsx`, `forms/Field.tsx` | role-match |
| `web/src/components/states/ConflictBanner.tsx` | component | n/a | `states/ErrorState.tsx` (`align="start"`) | exact |
| `web/src/components/data/ActorName.tsx`, `RecordMeta.tsx` | component | n/a | `states/EmptyValue.tsx`, `data/OrderCard.tsx` | role-match |
| `web/src/components/lists/ResponsiveTable.tsx`, `RowAction` (`cells.tsx`), `forms/Select.tsx` (extend) | component | n/a | themselves | exact |
| `web/src/components/brand/icons.ts`, `navigation` `ADMIN_NAV` (+ audit) | config | n/a | themselves | exact |
| `web/src/components/navigation/MobileNavDrawer.tsx`, `UserMenu.tsx`, `overlays/Modal.tsx`, `ConfirmDialog.tsx`, `overlays.recipe.ts`, `navigation.recipe.ts` (motion) | component | event-driven | `overlays.recipe.ts` lines 44, 72, 82 (existing `animate-csp-*` + `motion-reduce:animate-none`) | exact |
| `web/src/hooks/usePresence.ts` | hook | event-driven | `web/src/hooks/useDebouncedValue.ts` (folder/test shape); logic from RESEARCH Pattern 7 | partial |
| `web/src/ui/app.css` (@theme keyframes) | config | n/a | itself lines 44-80 | exact |
| `web/src/components/layout/layout.recipe.ts`, `modules/admin/components/admin.recipe.ts`, `layouts/AdminLayout.tsx`, `PublicLayout.tsx` (D-01..D-05, D-36) | config/layout | n/a | themselves; `authPageRootClasses` (`min-h-dvh`) | exact |
| `web/src/utils/temporaryPassword.ts` | utility | transform | none (use `crypto.getRandomValues`) | no analog |
| Showcase move to `web/src/modules/admin/showcase/` + `web/scripts/budget.ts`, `build-output.node.test.ts` | component/config | n/a | `web/src/dev/ComponentShowcase.tsx`, `dev/kit.ts` | exact (move) |
| `web/e2e/shell.spec.ts` (geometry 320-1920, tab bar bottom) | test | n/a | `web/e2e/auth-overflow.spec.ts`, `admin.spec.ts` | role-match |

## Pattern Assignments

### Controllers (`UsersController`, `ProfileController`, `AuditLogController`)

**Analog:** `src/Csps.Server/Controllers/SessionsController.cs` (whole file, 60 lines)

Imports and class attributes (lines 1-24):
```csharp
using Csps.Application.Auth;
using Csps.Application.Security;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

[ApiController]
[Route("api/v1/sessions")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class SessionsController(ListSessionsHandler list, RevokeSessionHandler revoke) : ControllerBase
```
Thin action (lines 52-59): one handler call, `ToHttpResult` maps `Result<T>` to ProblemDetails.
```csharp
[HttpDelete("{id:guid}")]
[EnableRateLimiting(RateLimitPolicies.Refresh)]
[EndpointName("RevokeSession")]
[ProducesResponseType<RevokeSessionResponse>(StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
[ProducesResponseType(StatusCodes.Status409Conflict)]
public async Task<IResult> Revoke(Guid id, CancellationToken cancellationToken)
{
    var result = await revoke.HandleAsync(id, cancellationToken).ConfigureAwait(false);
    return result.ToHttpResult(HttpContext, static response => TypedResults.Ok(response));
}
```
- Users and AuditLog: `[Authorize(Policy = Policies.Manager)]`. Profile: `Policies.Staff`; its `email-change/check` and `confirm` actions are `[AllowAnonymous]` + `[IdempotencyExempt]` like `InviteController` check.
- `DELETE /api/v1/users/{id}` takes no version (D-41 Q4, precedent line 46 here).
- Every action gets a row in `AuthorizationMatrix.cs` (shape line 65: `new("GET", "/api/v1/users", "/api/v1/users", Anonymous: 401, Admin: 403, Manager: 200)`).

### Application handlers (Users/*, Profile/*)

**Analog:** `src/Csps.Application/Users/BootstrapManagerHandler.cs`

Constructor injection + validate then transaction (lines 21-48):
```csharp
public sealed class BootstrapManagerHandler(
    IUserAccounts accounts, IAccountTokens tokens, ISecureRandom random, IEmailOutbox outbox,
    IAuditTrail audit, IUnitOfWork unitOfWork, IValidator<BootstrapManagerCommand> validator,
    AuthSettings settings, TimeProvider time)
...
var validation = await validator.ValidateAsync(command, cancellationToken).ConfigureAwait(false);
if (!validation.IsValid)
{
    return Result.Failure<Guid>(ValidationResults.ToError(validation, AuthErrors.ValidationCode, AuthErrors.ValidationMessage));
}
return await unitOfWork.InTransactionAsync(token => CreateAsync(command, token), cancellationToken).ConfigureAwait(false);
```
Invitation token + outbox + audit in one transaction (lines 70-81), reuse for Create (invite route), ResendInvitation (after `tokens.RevokeOpenAsync(userId, AccountTokenPurpose.Invitation, now, ct)`) and RequestEmailChange (`AccountTokenPurpose.EmailChange`, 24 h):
```csharp
var secret = random.NewToken();
var now = time.GetUtcNow();
var invitation = AccountToken.Create(id, AccountTokenPurpose.Invitation, TokenHash.Compute(secret), now, settings.InviteLinkLifetime);
tokens.Add(invitation);
await outbox.EnqueueAsync(new InviteEmail(email, secret, invitation.ExpiresAt, now), cancellationToken).ConfigureAwait(false);
audit.Record(AuditActions.UserInvited, UserTarget, Key(id), "bootstrap");
await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
```
Note the class doc says "72-hour"; update with D-13 (RESEARCH Pitfall 7 lists every file with "72").

**Second analog (caller identity, revoke, evict after save):** `src/Csps.Application/Auth/RevokeSessionHandler.cs` lines 35-71
```csharp
if (requestContext.UserId is not { } userId || requestContext.SessionId is not { } currentId)
{
    return Result.Failure<RevokeSessionResponse>(AuthErrors.SessionEnded);
}
return await ConflictRetry.RunAsync(() => AttemptAsync(...), Result.Failure<...>(AuthErrors.SessionBusy)).ConfigureAwait(false);
...
session.Revoke(SessionRevocationReason.DeviceSignedOut, now);
audit.Record(AuditActions.SessionRevoked, "UserSession", session.Id.ToString("D", CultureInfo.InvariantCulture), null);
await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
await sessionCache.EvictAsync(session.Id, cancellationToken).ConfigureAwait(false);   // after commit
```
- Guard handlers (demote, lock, deactivate, delete): inside `InTransactionAsync`, first `await roster.LockActiveManagersAsync(ct)`, then read target, D-19 self check (`target.Id == requestContext.UserId`), D-18 count, write, `audit.Record`, save, then `ISessions.RevokeAllAsync` + `ISessionCache.EvictUserAsync` (RESEARCH Pattern 2 lines 408-417).
- Audit `Detail` values: field names and role values only (`fields=first-name,last-name`, `role=admin>manager`), never names or emails (D-40).

### `UserErrors.cs` (extend)

**Analog:** itself (lines 1-26). Each error = `const Code` + `const Message` + static `Error` property:
```csharp
public const string EmailTakenCode = "bootstrap.email-taken";
public const string EmailTakenMessage = "An account with that email already exists.";
public static Error EmailTaken { get; } = Error.BusinessRule(EmailTakenCode, EmailTakenMessage);
```
Factories available in `src/Csps.Domain/Common/Error.cs`: `NotFound` (61), `Conflict` (67, use for SEC-07 `StaleEdit` "This was changed by someone else. Reload and try again."), `BusinessRule` (73, `LastActiveManager`, `SelfAction`).

### `ManagerRosterLock.cs` / `UserDirectory.cs` (Infrastructure)

**Analog:** `src/Csps.Infrastructure/Identity/AccountTokenStore.cs` lines 28-43
```csharp
public async Task LockAccountAsync(Guid userId, CancellationToken cancellationToken)
{
    var resource = "csps-account-token:" + userId.ToString("N", CultureInfo.InvariantCulture);
    var outcome = new SqlParameter("@result", SqlDbType.Int) { Direction = ParameterDirection.Output };
    await context.Database.ExecuteSqlRawAsync(
        "EXEC @result = sp_getapplock @Resource = {0}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000",
        [resource, outcome],
        cancellationToken).ConfigureAwait(false);
    // 0 and 1 mean the lock is held; a negative value is a timeout, a deadlock or an error.
    if (outcome.Value is not int code || code < 0)
    {
        throw new InvalidOperationException("The account link lock could not be taken.");
    }
}
```
Use resource `"csps-active-managers"`. Query style (`RevokeOpenAsync` lines 45+): `context.X.Where(...).ToListAsync(ct).ConfigureAwait(false)`. Roster search uses EF `Contains` (Pitfall 9: test `%`, `_`, `[`).

### `ApplicationUser.cs` + configuration + migration

**Analog:** `src/Csps.Infrastructure/Identity/ApplicationUser.cs` (properties with one-line XML docs). Add `EditVersion` (Guid, `.IsConcurrencyToken()`, default `NEWID()`), `CreatedById`/`CreatedAtUtc`/`UpdatedById`/`UpdatedAtUtc` (nullable FK, `OnDelete NoAction`), `ManagerLockedAtUtc`, `DeletedAtUtc`, `PendingEmail` (nvarchar 256). Config in `ApplicationUserConfiguration.cs` (index pattern line 23 `builder.HasIndex(user => user.NormalizedEmail)`). Migration follows `20261015060201_AddAccountTokens.cs` (generated by `dotnet-ef`, Designer + snapshot updated). No trigger, no JSON (OR-7). Do NOT use `ConcurrencyStamp` or `rowversion` for the form version (RESEARCH Pattern 3).

### `RecordStampInterceptor.cs` (SEC-08)

**Analog:** `src/Csps.Infrastructure/Auditing/AuditLogAppendOnlyInterceptor.cs` lines 13-38
```csharp
internal sealed class AuditLogAppendOnlyInterceptor : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    { ArgumentNullException.ThrowIfNull(eventData); EnsureAppendOnly(eventData.Context); return base.SavingChanges(eventData, result); }
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    { ... return base.SavingChangesAsync(eventData, result, cancellationToken); }
```
Registration analog: `src/Csps.Infrastructure/DependencyInjection.cs` lines 119-121 (`TryAddSingleton<OutboxSignalInterceptor>()` then `.AddInterceptors(provider.GetRequiredService<...>())`). Singleton, so it takes a singleton actor accessor + `TimeProvider`, not scoped `IRequestContext`. Stamp `Updated*` only when `EditVersion` original != current (Pitfall 2).

### `NoTriggersTests.cs` (D-06)

**Analog:** `tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditLogAppendOnlyTests.cs` (already queries `sys.triggers`). Assert names equal `[AuditEntryConfiguration.TriggerName]` (`src/Csps.Infrastructure/Persistence/Configurations/AuditEntryConfiguration.cs:16`); add a migration-source scan for `CREATE TRIGGER` outside `AddAuditLog`.

### Web services (`usersService.ts`, `profileService.ts`, `auditLogService.ts`)

**Analog:** `web/src/modules/admin/services/sessionsService.ts` (whole file)
```ts
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';
type Schemas = components['schemas'];
export type SessionListItem = Schemas['SessionListItem'];
export interface SessionsService {
  /** `GET /api/v1/sessions`: ... */
  list(signal?: AbortSignal): Promise<SessionListItem[]>;
}
export function createSessionsService(client: HttpClient): SessionsService {
  return {
    list: (signal) => client.get<SessionListItem[]>('/sessions', { signal }),
    revoke: (id, signal) => client.delete<RevokeSessionResponse>(`/sessions/${encodeURIComponent(id)}`, { signal }),
  };
}
export const sessionsService: SessionsService = createSessionsService(apiClient);
```
Types come from regenerated `api.generated.ts` (OpenAPI snapshot test must be updated). Test pattern: `sessionsService.test.ts` with MSW. POSTs carry the `Idempotency-Key` from `useSubmission` (`web/src/lib/forms/useSubmission.ts`).

### List params hooks

**Analog:** `web/src/lib/url-state/createListParams.ts` (lines 1-80): `createListParams(parsers)` returns `useXxxListParams()` with `setPage` (push), `setSearch` (300 ms debounce), `setFilter`/`setFilters` (replace, page reset), `clampPage`, `reset`. URL keys are checked by `assertAllowedUrlKey`: never `email`/`name`; audit `actor`/`target` are GUIDs. Parsers from `lib/url-state/parsers.ts` (`parseAsBusinessDate`). Date presets via `resolveDateRange`.

### Query hooks

**Analog:** `web/src/modules/admin/hooks/useSessionsQuery.ts`
```ts
export function useSessionsQuery() {
  return useQuery({ queryKey: sessionsListKey, queryFn: ({ signal }) => sessionsService.list(signal), staleTime: 0, select: orderDevices });
}
```
Keys go in `web/src/lib/query/keys.ts`; paged lists use `lib/query/useListQuery.ts` + `useSettledListParams.ts`.

### Pages (`UsersPage`, `AuditLogPage`, `ProfilePage`)

**Analog:** `web/src/modules/admin/pages/SessionsPage.tsx` lines 1-40: SPEC-GAP header comment, `@/` imports, copy from module copy file, `document.title = \`${COPY.documentTitle}${ADMIN_COPY.titleSuffix}\``, dialogs rendered in the page root (never inside a ResponsiveTable cell), focus-after-removal ref (next row, previous row, else heading). Export a `XxxRoute` component for `lazyRoute`.

### Confirm dialogs (`DeactivateUserDialog`, `LockUserDialog`)

**Analog:** `web/src/modules/admin/components/SignOutDeviceDialog.tsx` (thin wrapper) over `SignOutDialog.tsx`:
```tsx
<SignOutDialog title={copy.title(...)} message={copy.body(...)} keepLabel={copy.keep}
  confirmLabel={copy.confirm} pendingLabel={copy.pending} onConfirm={onConfirm} onCancel={onCancel} />
```
`SignOutDialog` (lines 1-70) already implements the failure rule (pending blocks Esc/scrim, `describeHttpError` line in `role="alert"`, confirm refocused). Either generalize it (rename to a shared keep/confirm dialog with an icon prop) or compose identically. Delete uses `ConfirmDialog` from `@/components`.

### Route guard and routes

**Analog:** `web/src/modules/admin/guard.ts` `requireSessionLoader` (lines 50-60): add `requireManagerLoader` that awaits it and `throw redirect('/admin')` for non-Managers, with the same eslint-disable comment. In `routes.tsx`, add a lazy wrapper like `requireSession` (lines 73-75) so guard code stays out of the public entry, then replace `{ path: 'users', lazy: notFoundPage }` and `profile` (lines 95-96), add `audit-log` and `components` (Manager loader), and `admin/confirm-email` in the auth branch beside `admin/accept-invite` (no sign-in check). Remove `/dev/components` from `devRoutes` or redirect it.

### Motion (drawer, user menu, Modal, ConfirmDialog)

**Analog:** `web/src/components/overlays/overlays.recipe.ts` lines 44, 72, 82 and `web/src/ui/app.css` lines 44-80:
```ts
fixed: tw('fixed inset-0 animate-csp-fade motion-reduce:animate-none'),
'... animate-csp-rise ... motion-reduce:animate-none ...'
'h-full max-w-(--slideover-width) animate-csp-slide ...'
```
```css
--animate-csp-fade: csp-fade 0.15s ease;
@keyframes csp-fade { from { opacity: 0; } }
```
Add `-out` keyframes inside `@theme` (RESEARCH Pattern 7 lines 482-491), use `data-[state=closed]:animate-csp-*-out` + `data-[state=closed]:pointer-events-none`. Today both components unmount at once: `MobileNavDrawer.tsx` line 56 `return open ? <OpenDrawer {...props} /> : null;` and `UserMenu.tsx` line 96 `{openAt !== null && <MenuPopover .../>}`; wrap them with `usePresence`. Chevron: add `group` on the UserMenu button (it has `aria-expanded`, line 82) and `group-aria-expanded:rotate-180 transition-transform duration-200` on the `chevron-down` icon. Keep focus trap/inert/scroll lock released when closing starts (Pitfall 4: unmount at once when `animationName` is `none`, 300 ms fallback).

### Shell height chain (D-01..D-05, D-36)

**Analogs:** `layout.recipe.ts:16` `pageRootClasses = tw('@container/pg relative min-h-full bg-bg ...')`; `admin.recipe.ts:9` `adminClasses = tw('flex min-h-full bg-bg text-ink')`; `tabBarClasses` (`sticky bottom-0 z-30 mt-auto ... pb-3 ...`). Recommended: real layouts mark the page root (e.g. `data-fill="viewport"`) and recipes add `in-data-[fill=viewport]:min-h-dvh`; Sidebar `sticky top-0 h-dvh`, nav `min-h-0 flex-1 overflow-y-auto overscroll-contain`; tab bar `pb-[calc(12px+env(safe-area-inset-bottom))]`. Never `overflow-x: hidden` on html/body. Do not put `min-h-dvh` in `pageRootClasses` itself (breaks parity frames). Update the stale comment at `navigation.recipe.ts:198-202`.

## Shared Patterns

### Result to ProblemDetails
**Source:** `SessionsController.cs` line 58 `result.ToHttpResult(HttpContext, static x => TypedResults.Ok(x))`. **Apply to:** every new controller action.

### Validation
**Source:** `BootstrapManagerHandler.cs` lines 42-46 + `BootstrapManagerCommandValidator.cs`. **Apply to:** every handler with a body. Web mirror in `authSchemas.ts` style (OR-3), zod tested against the same cases.

### Transactions, audit, session eviction
**Source:** `IUnitOfWork.InTransactionAsync` (Bootstrap line 48), `audit.Record(action, target, key, detail)`, `sessionCache.EvictAsync` after `SaveChangesAsync` (RevokeSession lines 66-69). **Apply to:** all user/profile mutations.

### Idempotency (SEC-06)
**Source:** `tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyAllowList.cs` (exemption entries with Key, Reason, Decision) + `[IdempotencyExempt]`. **Apply to:** anonymous `email-change/check` and `confirm` only; every other POST takes the key.

### Copy and OR-4
**Source:** `web/src/modules/admin/authCopy.ts`. All strings in module copy files, no em/en dash; empty values render `EmptyValue`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `web/src/utils/temporaryPassword.ts` | utility | transform | No generator exists; use `crypto.getRandomValues` and the 04 D-21 word list (`Tela-Sukat-7381` form) |
| `web/src/hooks/usePresence.ts` | hook | event-driven | No exit-animation helper yet; use RESEARCH Pattern 7 code |
| `src/Csps.Application/Audit/ListAuditLogHandler.cs` (filter/paging over AuditLog) | service | list | No paged server list exists yet; build from `ListSessionsHandler` + `IBusinessCalendar` day bounds |
| `web/src/components/data/RecordMeta.tsx` | component | n/a | First SEC-08 view; compose from `dl` + `formatBusinessDateTime` + `ActorName` |

## Metadata

**Analog search scope:** `src/Csps.{Domain,Application,Infrastructure,Server}`, `tests/*`, `web/src/{components,modules/admin,lib,hooks,ui,dev}`, `web/e2e`
**Files scanned:** ~60
**Tracked-source check:** analogs verified with `git ls-files` (all tracked; no mirror paths)
**Pattern extraction date:** 2026-10-17

---
phase: 04-identity-authentication
plan: 08
subsystem: auth
tags: [identity, ef-core, migration, user-accounts, lockout, nfc, auth-01, auth-07, auth-10]
status: complete
created: "2026-10-14T21:15:00-05:00"
updated: "2026-10-14T21:15:00-05:00"

requires: ["04-02", "04-03", "04-04", "04-05"]
provides:
  - "ApplicationUser (IdentityUser<Guid>) with FirstName, LastName, IsActive, MustChangePassword + reason (tinyint), BreachRecheckPending"
  - "CspsDbContext is an IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>; AddIdentity migration (schema version 2, unique filtered EmailIndex, Admin and Manager role rows with fixed ids)"
  - "IdentityRegistration.AddCspsIdentity (called from AddInfrastructure): AddIdentityCore + roles + EF stores, lockout 5 / 15 min, no token providers, no sign-in manager"
  - "IUserAccounts (16 members), PasswordCheck, FailedPasswordResult, UserAccount, NewUserAccount in Application; UserAccounts in Infrastructure"
  - "CspsDatabase.IgnoredTables keeps AspNetRoles across Respawn resets"
affects: [04-09, 04-12, 04-15, 04-16, 04-19, Phase 5 user management, Phase 15-16 legacy import]

requirements-completed: []

actuals:
  tokens: 14500
  tasks: 3
  commits: 6
plan_head_before: 87f396daa1210d16bf98744bd55e26f203c8c1f3
plan_head_after: 1546e8bfab152f2bf70b3c5a7d4ed4736698f0a9

tech-stack:
  added: []
  patterns:
    - "Identity stores use schema version 2 in every context, host or not: CspsDbContextOptions.Configure gives a host-less context (dotnet ef, tests, tools) an application service provider whose IdentityOptions pick version 2"
    - "Account operations go through UserManager only (no SignInManager); the password hash is set directly after PasswordPolicy.Normalize, so Identity's password validators are not used"
    - "Mutating the security stamp saves hash and stamp in one UpdateSecurityStampAsync call"

key-files:
  created:
    - src/Csps.Infrastructure/Identity/ApplicationUser.cs
    - src/Csps.Infrastructure/Identity/IdentityRegistration.cs
    - src/Csps.Infrastructure/Identity/UserAccounts.cs
    - src/Csps.Infrastructure/Persistence/Configurations/ApplicationUserConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/RoleConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261015020438_AddIdentity.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261015020438_AddIdentity.Designer.cs
    - src/Csps.Application/Ports/IUserAccounts.cs
    - src/Csps.Application/Auth/UserAccount.cs
    - tests/Csps.Infrastructure.IntegrationTests/Identity/IdentitySchemaTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Identity/UserAccountsTests.cs
    - tests/Csps.Application.UnitTests/Auth/UserAccountTests.cs
  modified:
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/CspsDbContextOptions.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Infrastructure/DependencyInjection.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationScriptTests.cs
    - tests/Csps.Server.IntegrationTests/Logging/SensitiveDataMaskingTests.cs
    - tests/Csps.Testing/CspsDatabase.cs

key-decisions:
  - "Schema version 2 is forced for host-less contexts too (design-time factory, tests): without it Identity builds version 1 (nvarchar(450) composite keys, unbounded PhoneNumber) and the migration would not match the runtime model"
  - "Passwords are hashed directly (PasswordPolicy.Normalize, then IPasswordHasher) instead of through UserManager.AddPasswordAsync/RemovePasswordAsync: one atomic save, never a window with no password, and the owner's rule stays in PasswordPolicy"
  - "CreateAsync marks the email confirmed only when a password is supplied (bootstrap and temporary-password creates); an account created without a password stays unconfirmed for the Phase 5 invitation flow to confirm"
  - "Account operations throw InvalidOperationException for an unknown id, a taken email or a missing role (error codes only, no addresses); CheckPasswordAsync for an unknown id or an account without a password runs the dummy hash and returns Failed"
  - "ApplicationUser is public because the public CspsDbContext exposes it as a generic argument"
---

# Phase 4 Plan 8: Identity Accounts and the Account Port Summary

Staff accounts now run on ASP.NET Core Identity (schema version 2) inside CspsDbContext, the Admin and Manager roles ship in the `AddIdentity` migration, and `IUserAccounts` gives the auth handlers one tested port for sign-in checks, lockout, password changes, the must-change and breach flags, and the bootstrap check, with no Identity type visible to Application.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (tracer) | Manager created through Identity is found by email in any case with the seeded role | RED c51d892, GREEN 53d5b8c |
| 2 | Schema guards: race-proof unique email, no passkey table, roles survive resets | RED c8e4550, GREEN c209d83 |
| 3 | IUserAccounts: NFC passwords, dummy hashing, lockout signals | RED 11c9e95, GREEN 1546e8b |

`commits: 6` is measured from the plan ledger base (`plan_head_before`). Tracer gate: the tracer's tests plus the migration-script tests were re-run green after the full slice was built, before the expansion tasks.

## Reviewed AddIdentity migration

Tables (all new, no drop, rename or lossy change; compat level stays 160):

| Table | Notes |
|-------|-------|
| AspNetRoles | Name and NormalizedName nvarchar(256); two seeded rows, Admin and Manager, with fixed ids and concurrency stamps |
| AspNetUsers | Identity columns plus FirstName and LastName nvarchar(100) not null, IsActive bit default 1, MustChangePassword bit default 0, MustChangePasswordReason tinyint null, BreachRecheckPending bit default 0; PhoneNumber nvarchar(256) |
| AspNetRoleClaims, AspNetUserClaims, AspNetUserLogins, AspNetUserRoles, AspNetUserTokens | Standard; login and token string keys nvarchar(128) |

Indexes: `EmailIndex` on AspNetUsers(NormalizedEmail), unique, filtered `[NormalizedEmail] IS NOT NULL` (the one Identity index, made unique, not a second one); `UserNameIndex` unique filtered; `RoleNameIndex` unique filtered; `IX_AspNetRoleClaims_RoleId`, `IX_AspNetUserClaims_UserId`, `IX_AspNetUserLogins_UserId`, `IX_AspNetUserRoles_RoleId`. No AspNetUserPasskeys table and no JSON column.

## Verification

- Infrastructure integration tests 165 passed (18 for UserAccounts, 8 for IdentitySchema), Server integration 326, Architecture 106, Application unit 19, Domain unit 576; solution builds with 0 warnings and 0 errors.
- Coverage gate: Domain 100% line and branch, Application 100% line.
- Acceptance greps: `IdentitySchemaVersions.Version2` and `IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>` present, `_AddIdentity.cs` exists, `PasswordPolicy.Normalize` used in UserAccounts, `AnyActiveManagerAsync` on the port, no `SignInManager<` in src.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Design-time model used Identity schema version 1**
- **Found during:** Task 1 (first generated migration showed nvarchar(450) login keys and an unbounded PhoneNumber)
- **Issue:** Identity reads the schema version from the application service provider. The design-time factory and test contexts have none, so the migration and snapshot described a version 1 model while the host builds version 2.
- **Fix:** `CspsDbContextOptions.Configure` sets an application service provider carrying the version 2 `IdentityOptions` when none is set; the version is chosen in one place (`IdentityRegistration.ConfigureStores`). The migration was regenerated, and `HostBuiltModelMatchesTheMigrations` guards the host model against pending changes.
- **Files modified:** src/Csps.Infrastructure/Persistence/CspsDbContextOptions.cs, src/Csps.Infrastructure/Identity/IdentityRegistration.cs
- **Commit:** 53d5b8c

**2. [Rule 1 - Bug] `OnModelCreating` parameter name (CA1725)**
- **Found during:** Task 1 build
- **Fix:** parameter renamed to `builder` to match `IdentityDbContext.OnModelCreating`.
- **Commit:** 53d5b8c

**3. [Rule 2 - Missing critical] Coverage gate failed for Application (79.3% < 95%)**
- **Found during:** Task 3 verification
- **Fix:** `UserAccountTests` in Csps.Application.UnitTests covers the new records, bringing Application to 100%.
- **Files modified:** tests/Csps.Application.UnitTests/Auth/UserAccountTests.cs
- **Commit:** 1546e8b

### Plan interpretation

- `SetPasswordAsync` sets the hash directly and calls `UpdateSecurityStampAsync` (one save) instead of remove-then-add, to avoid a passwordless window if the second step fails. Behavior matches the plan: NFC, new hash, new security stamp.
- The Task 3 masking test uses the real `ApplicationUser` next to the existing identity-shaped one; both pass (WR-05).
- The existing `IdentitySchemaTests`, `MigrationScriptTests` and masking guards were extended; `MigrationTests.cs` needed no change.
- The RED commits for tasks 1 and 3 fail at build time (the types under test do not exist yet); the task 2 RED fails as a test (Respawn removed the roles).
- Co-author trailer on commits is `Claude Sonnet 5.5` (the model that ran the plan) rather than the `Opus 5.5` named in the dispatch text.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or file access; the threat register items T-04-22 to T-04-25 are mitigated as planned (dummy hash plus no sign-in manager, lockout with `LockedNow` once, unique filtered index with a race test, schema version 2 with the passkey and JSON guards).

## Notes for later plans

- `UserManager` saves on the shared scoped context. Handlers in 04-12 and 04-19 must finish tracked entities (challenges, tokens, audit rows) before the first `IUserAccounts` mutation, or order them knowingly (Pitfall 13).
- `RecordFailedPasswordAsync` does not skip locked accounts; the sign-in handler decides not to call it for a locked, inactive or unconfirmed account.
- `AnyActiveManagerAsync` counts `IsActive` Managers only; it does not look at lockout or confirmation.

## Self-Check: PASSED

- Files: ApplicationUser.cs, IdentityRegistration.cs, UserAccounts.cs, ApplicationUserConfiguration.cs, RoleConfiguration.cs, the AddIdentity migration and designer, IUserAccounts.cs, UserAccount.cs and the three new test files all exist.
- Commits c51d892, 53d5b8c, c8e4550, c209d83, 11c9e95 and 1546e8b are ancestors of HEAD.

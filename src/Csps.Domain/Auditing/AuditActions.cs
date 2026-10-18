namespace Csps.Domain.Auditing;

/// <summary>
/// The audit action codes (AUDIT-01, USER-06). Each is a dotted lowercase code that <see cref="AuditEntry"/>
/// accepts. Entries reference people by user id only: never an e-mail address, name, code, token or password.
/// </summary>
public static class AuditActions
{
    /// <summary>A sign-in attempt failed; the detail is one of <see cref="SignInFailureReasons"/>.</summary>
    public const string SignInFailed = "auth.sign-in-failed";

    /// <summary>An account was locked after repeated failures; the detail is one of <see cref="LockoutDetails"/>.</summary>
    public const string Lockout = "auth.lockout";

    /// <summary>A sign-in code was created and e-mailed.</summary>
    public const string TwoFactorIssued = "auth.2fa-issued";

    /// <summary>A new sign-in code was requested.</summary>
    public const string TwoFactorResent = "auth.2fa-resent";

    /// <summary>A sign-in code was entered correctly.</summary>
    public const string TwoFactorVerified = "auth.2fa-verified";

    /// <summary>A wrong sign-in code was entered.</summary>
    public const string TwoFactorFailed = "auth.2fa-failed";

    /// <summary>A sign-in code ran out of attempts.</summary>
    public const string TwoFactorExhausted = "auth.2fa-exhausted";

    /// <summary>A sign-in completed and a session started.</summary>
    public const string SignedIn = "auth.signed-in";

    /// <summary>A used refresh token was presented again, so the session was revoked.</summary>
    public const string RefreshReuseDetected = "auth.refresh-reuse-detected";

    /// <summary>A user signed out of the current session.</summary>
    public const string SignedOut = "auth.signed-out";

    /// <summary>Several sessions were revoked at once; the detail is one of <see cref="SessionsRevokedDetails"/>.</summary>
    public const string SessionsRevoked = "auth.sessions-revoked";

    /// <summary>One session was revoked.</summary>
    public const string SessionRevoked = "auth.session-revoked";

    /// <summary>A password reset was requested.</summary>
    public const string PasswordResetRequested = "auth.password-reset-requested";

    /// <summary>A password reset was completed.</summary>
    public const string PasswordResetCompleted = "auth.password-reset-completed";

    /// <summary>A reset link was used that is unknown, expired or already used.</summary>
    public const string PasswordResetLinkInvalid = "auth.password-reset-link-invalid";

    /// <summary>A signed-in user changed their own password.</summary>
    public const string PasswordChanged = "auth.password-changed";

    /// <summary>A chosen password was refused because it appears in a known breach, or a saved one was found in a breach at sign-in (D-18).</summary>
    public const string PasswordBreachFound = "auth.password-breach-found";

    /// <summary>The breached-password lookup could not be reached.</summary>
    public const string BreachCheckUnavailable = "auth.breach-check-unavailable";

    /// <summary>An invited user set a password and activated the account.</summary>
    public const string InviteAccepted = "auth.invite-accepted";

    /// <summary>The first Manager account was created by the bootstrap command.</summary>
    public const string BootstrapManagerCreated = "user.bootstrap-manager-created";

    /// <summary>A user was invited.</summary>
    public const string UserInvited = "user.invited";

    /// <summary>A Manager created a user with a temporary password; no detail, and never the password (D-14, D-40).</summary>
    public const string UserCreatedTemporary = "user.created-temporary";

    /// <summary>A Manager deactivated a user; no detail (D-40).</summary>
    public const string UserDeactivated = "user.deactivated";

    /// <summary>A Manager reactivated a user; no detail (D-40).</summary>
    public const string UserActivated = "user.activated";

    /// <summary>A Manager locked a user until a Manager unlocks them; no detail (D-16, D-40).</summary>
    public const string UserLocked = "user.locked";

    /// <summary>A Manager lifted a user's Manager lock; no detail (D-16, D-40).</summary>
    public const string UserUnlocked = "user.unlocked";

    /// <summary>A Manager deleted a user for good (soft delete, D-07); no detail, and never the name or address (D-40).</summary>
    public const string UserDeleted = "user.deleted";

    /// <summary>A Manager changed another person's first or last name or sign-in email; the detail lists the changed fields, never the values (D-40).</summary>
    public const string UserDetailsChanged = "user.details-changed";

    /// <summary>A Manager changed another person's role; the detail is <c>role=old&gt;new</c> in lower case, never a name (D-40).</summary>
    public const string UserRoleChanged = "user.role-changed";

    /// <summary>A Manager started a confirm-by-link email change for another person; no detail and no address (C-9, D-40).</summary>
    public const string UserEmailChangeStarted = "user.email-change-started";

    /// <summary>A new invitation replaced the old one, because the invited person's address moved or a Manager sent it again; no detail (D-40).</summary>
    public const string UserInvitationResent = "user.invitation-resent";

    /// <summary>A Manager emailed a person a password reset link; no detail, never the link (USER-07, D-40).</summary>
    public const string UserResetLinkSent = "user.reset-link-sent";

    /// <summary>A Manager set a temporary password for a person; no detail, and never the password (C-4, D-14, D-40).</summary>
    public const string UserTemporaryPasswordSet = "user.temporary-password-set";

    /// <summary>A signed-in user changed their own first or last name; the detail lists the changed fields, never the names (D-40).</summary>
    public const string ProfileNameChanged = "profile.name-changed";

    /// <summary>A signed-in user asked to change their sign-in email; no detail and no address (D-40).</summary>
    public const string ProfileEmailChangeRequested = "profile.email-change-requested";

    /// <summary>A new sign-in email was confirmed and applied; no detail and no address (D-40).</summary>
    public const string ProfileEmailChanged = "profile.email-changed";

    /// <summary>A waiting email change was called off; the detail is none, or <c>taken</c> when the address was taken first (D-40).</summary>
    public const string ProfileEmailChangeCanceled = "profile.email-change-canceled";

    /// <summary>Why a sign-in failed (the detail of <see cref="SignInFailed"/>).</summary>
    public static IReadOnlyList<string> SignInFailureReasons { get; } =
        ["unknown-account", "bad-password", "locked", "deactivated", "unconfirmed", "no-password", "manager-locked", "deleted"];

    /// <summary>What triggered a lockout (the detail of <see cref="Lockout"/>).</summary>
    public static IReadOnlyList<string> LockoutDetails { get; } = ["password", "code"];

    /// <summary>Why sessions were revoked (the detail of <see cref="SessionsRevoked"/>).</summary>
    public static IReadOnlyList<string> SessionsRevokedDetails { get; } = ["sign-out-others", "password-reset", "password-changed", "account-changed", "temporary-password"];

    /// <summary>
    /// The codes a person can cause without a signed-in token: sign-in, sign-in codes, password reset, invitation acceptance and the
    /// email-confirmation steps. Such an entry has no actor, so the audit viewer reads the person it is about as the one who did it.
    /// </summary>
    public static IReadOnlyList<string> SelfService { get; } =
    [
        SignInFailed,
        Lockout,
        TwoFactorIssued,
        TwoFactorResent,
        TwoFactorVerified,
        TwoFactorFailed,
        TwoFactorExhausted,
        SignedIn,
        RefreshReuseDetected,
        SignedOut,
        SessionsRevoked,
        SessionRevoked,
        PasswordResetRequested,
        PasswordResetCompleted,
        PasswordResetLinkInvalid,
        PasswordChanged,
        PasswordBreachFound,
        BreachCheckUnavailable,
        InviteAccepted,
        ProfileEmailChanged,
        ProfileEmailChangeCanceled,
    ];

    /// <summary>Every action code, in declaration order.</summary>
    public static IReadOnlyList<string> All { get; } =
    [
        SignInFailed,
        Lockout,
        TwoFactorIssued,
        TwoFactorResent,
        TwoFactorVerified,
        TwoFactorFailed,
        TwoFactorExhausted,
        SignedIn,
        RefreshReuseDetected,
        SignedOut,
        SessionsRevoked,
        SessionRevoked,
        PasswordResetRequested,
        PasswordResetCompleted,
        PasswordResetLinkInvalid,
        PasswordChanged,
        PasswordBreachFound,
        BreachCheckUnavailable,
        InviteAccepted,
        BootstrapManagerCreated,
        UserInvited,
        UserCreatedTemporary,
        UserDeactivated,
        UserActivated,
        UserLocked,
        UserUnlocked,
        UserDeleted,
        UserDetailsChanged,
        UserRoleChanged,
        UserEmailChangeStarted,
        UserInvitationResent,
        UserResetLinkSent,
        UserTemporaryPasswordSet,
        ProfileNameChanged,
        ProfileEmailChangeRequested,
        ProfileEmailChanged,
        ProfileEmailChangeCanceled,
    ];
}

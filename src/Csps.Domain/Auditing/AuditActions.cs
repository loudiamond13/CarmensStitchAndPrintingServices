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

    /// <summary>A password was changed: the must-change step after the sign-in code, or a person's own change from My Profile.</summary>
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

    /// <summary>Sign-in failure detail: no account has that email.</summary>
    public const string DetailUnknownAccount = "unknown-account";

    /// <summary>Sign-in failure detail: the password did not match.</summary>
    public const string DetailBadPassword = "bad-password";

    /// <summary>Sign-in failure detail: the account is locked after repeated failures.</summary>
    public const string DetailLocked = "locked";

    /// <summary>Sign-in failure and reset-request detail: the account is deactivated.</summary>
    public const string DetailDeactivated = "deactivated";

    /// <summary>Sign-in failure detail: the invitation was never accepted.</summary>
    public const string DetailUnconfirmed = "unconfirmed";

    /// <summary>Sign-in failure detail: the account has no password yet.</summary>
    public const string DetailNoPassword = "no-password";

    /// <summary>Sign-in failure and reset-request detail: a Manager locked the account.</summary>
    public const string DetailManagerLocked = "manager-locked";

    /// <summary>Sign-in failure detail: the account was deleted.</summary>
    public const string DetailDeleted = "deleted";

    /// <summary>Lockout detail: too many wrong passwords.</summary>
    public const string DetailPassword = "password";

    /// <summary>Lockout detail: too many wrong sign-in codes.</summary>
    public const string DetailCode = "code";

    /// <summary>Sessions-revoked detail: the person signed out their other sessions.</summary>
    public const string DetailSignOutOthers = "sign-out-others";

    /// <summary>Sessions-revoked detail: a password reset finished.</summary>
    public const string DetailPasswordReset = "password-reset";

    /// <summary>Sessions-revoked detail: the person changed their password.</summary>
    public const string DetailPasswordChanged = "password-changed";

    /// <summary>Sessions-revoked detail: a Manager changed the account.</summary>
    public const string DetailAccountChanged = "account-changed";

    /// <summary>Sessions-revoked detail: a Manager set a temporary password.</summary>
    public const string DetailTemporaryPassword = "temporary-password";

    /// <summary>Reset-request detail: the reset email went out.</summary>
    public const string DetailSent = "sent";

    /// <summary>Reset-request detail: the hourly cap was reached, so no email went out.</summary>
    public const string DetailCapped = "capped";

    /// <summary>Password-changed detail: the person changed it in My Profile.</summary>
    public const string DetailProfile = "profile";

    /// <summary>Invitation detail: sent by a Manager.</summary>
    public const string DetailManager = "manager";

    /// <summary>Email-change-canceled detail: the new address was taken first.</summary>
    public const string DetailTaken = "taken";

    /// <summary>Email-change-requested detail: the link was sent again.</summary>
    public const string DetailResent = "resent";

    /// <summary>Breach-check detail: the lookup failed while accepting an invitation.</summary>
    public const string DetailInvite = "invite";

    /// <summary>Invitation detail: sent by the bootstrap command.</summary>
    public const string DetailBootstrap = "bootstrap";

    /// <summary>Why a sign-in failed (the detail of <see cref="SignInFailed"/>).</summary>
    public static IReadOnlyList<string> SignInFailureReasons { get; } =
        [DetailUnknownAccount, DetailBadPassword, DetailLocked, DetailDeactivated, DetailUnconfirmed, DetailNoPassword, DetailManagerLocked, DetailDeleted];

    /// <summary>What triggered a lockout (the detail of <see cref="Lockout"/>).</summary>
    public static IReadOnlyList<string> LockoutDetails { get; } = [DetailPassword, DetailCode];

    /// <summary>Why sessions were revoked (the detail of <see cref="SessionsRevoked"/>).</summary>
    public static IReadOnlyList<string> SessionsRevokedDetails { get; } =
        [DetailSignOutOthers, DetailPasswordReset, DetailPasswordChanged, DetailAccountChanged, DetailTemporaryPassword];

    /// <summary>What happened to a reset request (the detail of <see cref="PasswordResetRequested"/>).</summary>
    public static IReadOnlyList<string> ResetRequestDetails { get; } =
        [DetailUnknownAccount, DetailManagerLocked, DetailCapped, DetailSent, DetailDeactivated];

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

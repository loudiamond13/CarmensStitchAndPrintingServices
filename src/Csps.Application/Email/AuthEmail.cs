using Csps.Domain.Identity;

namespace Csps.Application.Email;

/// <summary>The kinds of auth email. The values are stored, so never renumber them.</summary>
public enum AuthEmailKind
{
    /// <summary>The 6-digit sign-in code (D-08).</summary>
    SignInCode = 1,

    /// <summary>Sign-in paused after too many wrong tries (AUTH-07).</summary>
    AccountLocked = 2,

    /// <summary>A password reset link (AUTH-08).</summary>
    PasswordReset = 3,

    /// <summary>Notice that the password changed (AUTH-09).</summary>
    PasswordChanged = 4,

    /// <summary>Notice that a Manager set a temporary password (D-24).</summary>
    ManagerReset = 5,

    /// <summary>Reply to a reset request for a deactivated account (D-20).</summary>
    DeactivatedNotice = 6,

    /// <summary>The invitation to set a first password (D-29).</summary>
    Invite = 7,
}

/// <summary>What was guessed wrong often enough to lock the account.</summary>
public enum LockoutCause
{
    /// <summary>Wrong passwords.</summary>
    Password,

    /// <summary>Wrong sign-in codes.</summary>
    Code,
}

/// <summary>An auth email to queue. Secrets (codes, tokens) are held here only until the outbox encrypts the rendered mail.</summary>
/// <param name="To">The recipient address.</param>
public abstract record AuthEmail(string To)
{
    /// <summary>Gets the kind of email.</summary>
    public abstract AuthEmailKind Kind { get; }

    /// <summary>Returns the moment after which the email is no longer worth sending.</summary>
    /// <param name="createdAt">When the email was queued.</param>
    /// <returns>The code or link expiry, or one day after <paramref name="createdAt"/> for notices.</returns>
    public abstract DateTimeOffset NotAfter(DateTimeOffset createdAt);

    /// <summary>One day, the useful life of an email that carries no code or link.</summary>
    protected static DateTimeOffset NoticeNotAfter(DateTimeOffset createdAt) => createdAt.AddDays(1);
}

/// <summary>The sign-in code email.</summary>
/// <param name="To">The recipient address.</param>
/// <param name="Code">The 6-digit code.</param>
/// <param name="ExpiresAt">When the code stops working.</param>
/// <param name="RequestedAt">When the sign-in was requested.</param>
/// <param name="Device">The coarse browser and device label.</param>
public sealed record SignInCodeEmail(string To, string Code, DateTimeOffset ExpiresAt, DateTimeOffset RequestedAt, DeviceDescription Device)
    : AuthEmail(To)
{
    /// <inheritdoc />
    public override AuthEmailKind Kind => AuthEmailKind.SignInCode;

    /// <inheritdoc />
    public override DateTimeOffset NotAfter(DateTimeOffset createdAt) => ExpiresAt;

    /// <summary>Prints the kind only, so a log or debugger never shows the code.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(SignInCodeEmail);
}

/// <summary>The account-locked email.</summary>
/// <param name="To">The recipient address.</param>
/// <param name="LockedUntil">When sign-in works again.</param>
/// <param name="Cause">What was guessed wrong.</param>
public sealed record AccountLockedEmail(string To, DateTimeOffset LockedUntil, LockoutCause Cause) : AuthEmail(To)
{
    /// <inheritdoc />
    public override AuthEmailKind Kind => AuthEmailKind.AccountLocked;

    /// <inheritdoc />
    public override DateTimeOffset NotAfter(DateTimeOffset createdAt) => NoticeNotAfter(createdAt);
}

/// <summary>The password reset link email.</summary>
/// <param name="To">The recipient address.</param>
/// <param name="Token">The reset token, placed in the link fragment.</param>
/// <param name="ExpiresAt">When the link stops working.</param>
/// <param name="RequestedAt">When the reset was requested.</param>
/// <param name="Device">The coarse browser and device label.</param>
public sealed record PasswordResetEmail(string To, string Token, DateTimeOffset ExpiresAt, DateTimeOffset RequestedAt, DeviceDescription Device)
    : AuthEmail(To)
{
    /// <inheritdoc />
    public override AuthEmailKind Kind => AuthEmailKind.PasswordReset;

    /// <inheritdoc />
    public override DateTimeOffset NotAfter(DateTimeOffset createdAt) => ExpiresAt;

    /// <summary>Prints the kind only, so a log or debugger never shows the token.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(PasswordResetEmail);
}

/// <summary>The password-changed notice.</summary>
/// <param name="To">The recipient address.</param>
/// <param name="ChangedAt">When the password changed.</param>
/// <param name="SessionsEnded">True when every signed-in device was signed out (the reset path).</param>
public sealed record PasswordChangedEmail(string To, DateTimeOffset ChangedAt, bool SessionsEnded) : AuthEmail(To)
{
    /// <inheritdoc />
    public override AuthEmailKind Kind => AuthEmailKind.PasswordChanged;

    /// <inheritdoc />
    public override DateTimeOffset NotAfter(DateTimeOffset createdAt) => NoticeNotAfter(createdAt);
}

/// <summary>The notice that a Manager set a temporary password (D-24; sent from Phase 5).</summary>
/// <param name="To">The recipient address.</param>
/// <param name="ManagerName">The Manager's display name.</param>
/// <param name="ResetAt">When the password was reset.</param>
public sealed record ManagerResetEmail(string To, string ManagerName, DateTimeOffset ResetAt) : AuthEmail(To)
{
    /// <inheritdoc />
    public override AuthEmailKind Kind => AuthEmailKind.ManagerReset;

    /// <inheritdoc />
    public override DateTimeOffset NotAfter(DateTimeOffset createdAt) => NoticeNotAfter(createdAt);
}

/// <summary>The reply to a reset request for a deactivated account (D-20).</summary>
/// <param name="To">The recipient address.</param>
public sealed record DeactivatedNoticeEmail(string To) : AuthEmail(To)
{
    /// <inheritdoc />
    public override AuthEmailKind Kind => AuthEmailKind.DeactivatedNotice;

    /// <inheritdoc />
    public override DateTimeOffset NotAfter(DateTimeOffset createdAt) => NoticeNotAfter(createdAt);
}

/// <summary>The invitation to set a first password (D-29).</summary>
/// <param name="To">The recipient address.</param>
/// <param name="Token">The invite token, placed in the link fragment.</param>
/// <param name="ExpiresAt">When the link stops working.</param>
public sealed record InviteEmail(string To, string Token, DateTimeOffset ExpiresAt) : AuthEmail(To)
{
    /// <inheritdoc />
    public override AuthEmailKind Kind => AuthEmailKind.Invite;

    /// <inheritdoc />
    public override DateTimeOffset NotAfter(DateTimeOffset createdAt) => ExpiresAt;

    /// <summary>Prints the kind only, so a log or debugger never shows the token.</summary>
    /// <returns>The type name.</returns>
    public override string ToString() => nameof(InviteEmail);
}

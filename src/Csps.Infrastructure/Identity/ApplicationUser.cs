using Csps.Domain.Identity;
using Microsoft.AspNetCore.Identity;

namespace Csps.Infrastructure.Identity;

/// <summary>A staff account. <c>UserName</c> always equals <c>Email</c>; the Application layer never sees this type.</summary>
public sealed class ApplicationUser : IdentityUser<Guid>
{
    /// <summary>The longest first or last name.</summary>
    public const int NameMaxLength = 100;

    /// <summary>Given name.</summary>
    public string FirstName { get; set; } = string.Empty;

    /// <summary>Family name.</summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>False once the account is deactivated; an inactive user cannot sign in.</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>True when the next sign-in must end with a new password (D-13).</summary>
    public bool MustChangePassword { get; set; }

    /// <summary>Why the password must change (D-13); null when <see cref="MustChangePassword"/> is false.</summary>
    public PasswordChangeReason? MustChangePasswordReason { get; set; }

    /// <summary>True when the password is to be checked against the breach list at the next sign-in (D-14).</summary>
    public bool BreachRecheckPending { get; set; }

    /// <summary>The edit version: a new value on every profile or roster change, so a stale save is refused (SEC-07).</summary>
    public Guid EditVersion { get; set; } = Guid.NewGuid();

    /// <summary>Who created the account; null reads as System (SEC-08).</summary>
    public Guid? CreatedById { get; set; }

    /// <summary>When the account was created.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }

    /// <summary>Who last edited the account; null reads as System (SEC-08).</summary>
    public Guid? UpdatedById { get; set; }

    /// <summary>When the account was last edited; null if never.</summary>
    public DateTimeOffset? UpdatedAtUtc { get; set; }

    /// <summary>When a Manager locked the account (D-16); null when not locked. Separate from Identity's <c>LockoutEnd</c>.</summary>
    public DateTimeOffset? ManagerLockedAtUtc { get; set; }

    /// <summary>When the account was soft-deleted (D-07); null while it exists.</summary>
    public DateTimeOffset? DeletedAtUtc { get; set; }

    /// <summary>The new email awaiting confirmation (D-24); null when no change is pending.</summary>
    public string? PendingEmail { get; set; }
}

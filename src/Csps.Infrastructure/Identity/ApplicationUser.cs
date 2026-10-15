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
}

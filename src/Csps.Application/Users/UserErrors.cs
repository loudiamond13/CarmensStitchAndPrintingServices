using Csps.Domain.Common;

namespace Csps.Application.Users;

/// <summary>The error values the staff account use cases return.</summary>
public static class UserErrors
{
    /// <summary>The code of a bootstrap refused because an active Manager exists.</summary>
    public const string ManagerExistsCode = "bootstrap.manager-exists";

    /// <summary>The plain-English text of a bootstrap refused because an active Manager exists.</summary>
    public const string ManagerExistsMessage = "An active Manager already exists, so the first Manager cannot be created.";

    /// <summary>The code of a bootstrap whose email already belongs to an account.</summary>
    public const string EmailTakenCode = "bootstrap.email-taken";

    /// <summary>The plain-English text of a bootstrap whose email already belongs to an account.</summary>
    public const string EmailTakenMessage = "An account with that email already exists.";

    /// <summary>Gets the answer for a bootstrap while an active Manager exists.</summary>
    public static Error ManagerExists { get; } = Error.BusinessRule(ManagerExistsCode, ManagerExistsMessage);

    /// <summary>Gets the answer for a bootstrap with an email that is already in use.</summary>
    public static Error EmailTaken { get; } = Error.BusinessRule(EmailTakenCode, EmailTakenMessage);
}

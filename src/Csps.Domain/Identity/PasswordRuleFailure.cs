namespace Csps.Domain.Identity;

/// <summary>The first rule a new password breaks, in the fixed order the rules are checked (D-11, D-15).</summary>
public enum PasswordRuleFailure
{
    /// <summary>Nothing was entered.</summary>
    Empty,

    /// <summary>Fewer than <see cref="PasswordPolicy.MinLength"/> characters.</summary>
    TooShort,

    /// <summary>More than <see cref="PasswordPolicy.MaxLength"/> characters.</summary>
    TooLong,

    /// <summary>A control character such as a tab or a line break.</summary>
    ControlCharacter,

    /// <summary>No number.</summary>
    NoNumber,

    /// <summary>No symbol.</summary>
    NoSymbol,

    /// <summary>Contains the email's local part, the first name or the last name (full mode only).</summary>
    ContainsPersonalInfo,
}

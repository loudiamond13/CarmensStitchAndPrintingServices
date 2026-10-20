using System.Text;

namespace Csps.Domain.Identity;

/// <summary>
/// The owner's password rule (D-11): 8 to 64 characters with at least one number and one symbol. Length counts
/// Unicode code points of the NFC form, which is also the form that is checked, hashed and verified. The web mirror
/// (<c>web/src/utils/passwordRules.ts</c>) gives the same verdicts, and this type is the authority.
/// </summary>
public static class PasswordPolicy
{
    /// <summary>The fewest characters a password may have.</summary>
    public const int MinLength = 8;

    /// <summary>The most characters a password may have.</summary>
    public const int MaxLength = 64;

    /// <summary>Name and email parts shorter than this many characters are ignored (D-15), so "Al" blocks nothing.</summary>
    public const int PersonalInfoMinPartLength = 3;

    /// <summary>The NFC form of <paramref name="password"/>, the one form used to check, hash and verify.</summary>
    public static string Normalize(string password) => password.Normalize(NormalizationForm.FormC);

    /// <summary>The number of Unicode code points in the NFC form.</summary>
    public static int Length(string password) => Normalize(password).EnumerateRunes().Count();

    /// <summary>
    /// Applies only the length, control-character, number and symbol rules (D-21 composition mode).
    /// </summary>
    /// <returns>The first failing rule, or null when the password passes.</returns>
    public static PasswordRuleFailure? CheckComposition(string password)
    {
        var length = 0;
        var hasControl = false;
        var hasNumber = false;
        var hasSymbol = false;

        foreach (var rune in Normalize(password).EnumerateRunes())
        {
            length++;
            if (Rune.IsControl(rune))
            {
                hasControl = true;
            }
            else if (Rune.IsDigit(rune))
            {
                hasNumber = true;
            }
            else if (Rune.IsPunctuation(rune) || Rune.IsSymbol(rune))
            {
                hasSymbol = true;
            }
        }

        if (length == 0)
        {
            return PasswordRuleFailure.Empty;
        }

        if (length < MinLength)
        {
            return PasswordRuleFailure.TooShort;
        }

        if (length > MaxLength)
        {
            return PasswordRuleFailure.TooLong;
        }

        if (hasControl)
        {
            return PasswordRuleFailure.ControlCharacter;
        }

        if (!hasNumber)
        {
            return PasswordRuleFailure.NoNumber;
        }

        return hasSymbol ? null : PasswordRuleFailure.NoSymbol;
    }

    /// <summary>
    /// Applies every rule (D-11, D-15): composition first, then the personal-information rule, which refuses a
    /// password containing, ignoring case, the email's local part, the first name or the last name.
    /// </summary>
    /// <returns>The first failing rule, or null when the password passes.</returns>
    public static PasswordRuleFailure? Check(string password, PersonalInfo personal)
    {
        var failure = CheckComposition(password);
        if (failure is not null)
        {
            return failure;
        }

        var normalized = Normalize(password);
        var at = personal.Email.LastIndexOf('@');
        string?[] parts = [at >= 0 ? personal.Email[..at] : personal.Email, personal.FirstName, personal.LastName];

        foreach (var raw in parts)
        {
            var part = raw is null ? string.Empty : Normalize(raw).Trim();
            if (Length(part) >= PersonalInfoMinPartLength && normalized.Contains(part, StringComparison.OrdinalIgnoreCase))
            {
                return PasswordRuleFailure.ContainsPersonalInfo;
            }
        }

        return null;
    }

    /// <summary>Shown when the new password is empty.</summary>
    public const string NewPasswordRequiredMessage = "Enter a new password.";

    /// <summary>The plain-English message shown for <paramref name="failure"/>.</summary>
    public static string MessageFor(PasswordRuleFailure failure) => failure switch
    {
        PasswordRuleFailure.Empty => NewPasswordRequiredMessage,
        PasswordRuleFailure.TooShort => "Use at least 8 characters.",
        PasswordRuleFailure.TooLong => "Use 64 characters or fewer.",

        // SPEC-GAP: wording for the owner's OQ-7 review.
        PasswordRuleFailure.ControlCharacter => "Remove tabs and line breaks from your password.",
        PasswordRuleFailure.NoNumber => "Add at least one number.",
        PasswordRuleFailure.NoSymbol => "Add at least one symbol, like ! or #.",
        PasswordRuleFailure.ContainsPersonalInfo => "Don't use your name or email in your password.",
        _ => throw new ArgumentOutOfRangeException(nameof(failure), failure, "Unknown password rule failure."),
    };
}

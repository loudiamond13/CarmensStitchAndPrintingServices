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
}

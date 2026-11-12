using System.Diagnostics.CodeAnalysis;
using System.Text;

namespace Csps.Domain.Content;

/// <summary>
/// A Philippine phone number (D-23, PUB-06). The E.164 form is built from parsed digits only, so nothing a person
/// typed except digits can reach a tel: link.
/// </summary>
public sealed record PhilippinePhone
{
    /// <summary>The longest text a person may type for a number.</summary>
    public const int MaxInputLength = 32;

    /// <summary>The message shown when a number is refused (UI-SPEC validation).</summary>
    public const string InvalidMessage = "Enter a phone number, like 0917 123 4567 or 02 8123 4567.";

    private const string CountryCode = "63";

    private PhilippinePhone(string e164) => E164 = e164;

    /// <summary>The number as "+639171234567": a plus sign and digits only.</summary>
    public string E164 { get; }

    /// <summary>The number as people read it, for example "0917 123 4567".</summary>
    public string Display => $"0{E164.AsSpan(3, 3)} {E164.AsSpan(6, 3)} {E164.AsSpan(9)}";

    /// <summary>True for a mobile number.</summary>
    public bool IsMobile => E164[3] == '9';

    /// <summary>Parses what a person typed.</summary>
    /// <param name="text">The typed text.</param>
    /// <param name="phone">The parsed number when this returns true.</param>
    /// <returns>True when the text is a Philippine mobile or landline number.</returns>
    public static bool TryParse(string? text, [NotNullWhen(true)] out PhilippinePhone? phone)
    {
        phone = null;
        if (text is null || text.Length > MaxInputLength)
        {
            return false;
        }

        var national = ToNational(text);
        if (national is not { Length: 11 } || national[1] != '9')
        {
            return false;
        }

        phone = new PhilippinePhone("+" + CountryCode + national[1..]);
        return true;
    }

    // Digits with a leading 0: spaces, dashes, dots and round brackets are dropped, +63 becomes 0. Null for anything else.
    private static string? ToNational(string text)
    {
        var digits = new StringBuilder(text.Length);
        var international = false;
        foreach (var c in text)
        {
            if (char.IsWhiteSpace(c) || c is '-' or '.' or '(' or ')')
            {
                continue;
            }

            if (c == '+' && digits.Length == 0 && !international)
            {
                international = true;
                continue;
            }

            if (!char.IsAsciiDigit(c))
            {
                return null;
            }

            digits.Append(c);
        }

        var all = digits.ToString();
        if (international)
        {
            return all.StartsWith(CountryCode, StringComparison.Ordinal) ? "0" + all[CountryCode.Length..] : null;
        }

        return all.StartsWith('0') ? all : null;
    }
}

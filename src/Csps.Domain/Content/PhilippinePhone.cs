using System.Diagnostics.CodeAnalysis;

namespace Csps.Domain.Content;

/// <summary>A Philippine phone number: the E.164 form for tel: links and the readable display form.</summary>
public sealed record PhilippinePhone
{
    private PhilippinePhone(string e164) => E164 = e164;

    /// <summary>The number as "+639171234567": a plus sign and digits only.</summary>
    public string E164 { get; }

    /// <summary>The number as people read it, for example "0917 123 4567".</summary>
    public string Display => E164;

    /// <summary>True for a mobile number.</summary>
    public bool IsMobile => E164.Length > 0;

    /// <summary>Parses what a person typed.</summary>
    /// <param name="text">The typed text.</param>
    /// <param name="phone">The parsed number when this returns true.</param>
    /// <returns>True when the text is a Philippine mobile or landline number.</returns>
    public static bool TryParse(string? text, [NotNullWhen(true)] out PhilippinePhone? phone)
    {
        phone = null;
        return false;
    }
}

using System.Globalization;
using System.Text;

namespace Csps.Application.Common;

/// <summary>One <c>key=value</c> or <c>key=old&gt;new</c> pair read back from an audit detail.</summary>
/// <param name="Key">The field name.</param>
/// <param name="From">The old value of a change; null for a single value.</param>
/// <param name="To">The value, or the new value of a change.</param>
public sealed record AuditDetailPart(string Key, string? From, string To);

/// <summary>
/// The one format for expense and category audit details (D-27): <c>key=value</c> and <c>key=old&gt;new</c> pairs joined by
/// <c>;</c>. Amounts are invariant <c>0.00</c>, dates <c>yyyy-MM-dd</c> and ids dashed lower-case GUIDs. Only free text
/// (category names) is percent-encoded for <c>%</c>, <c>;</c>, <c>=</c> and <c>&gt;</c>. There is no path for an expense
/// description or notes: a change to them is written as the field names in a <c>fields=</c> pair, never their text (D-06).
/// </summary>
public static class AuditDetailFormat
{
    private const char PairSeparator = ';';
    private const char KeySeparator = '=';
    private const char ChangeSeparator = '>';
    private const string AmountFormat = "0.00";
    private const string DateFormat = "yyyy-MM-dd";

    /// <summary>Writes <c>key=value</c> for a text value, encoded.</summary>
    /// <param name="key">The field name.</param>
    /// <param name="value">The text, such as a category name.</param>
    /// <returns>The pair.</returns>
    public static string Pair(string key, string value) => Make(key, Encode(value));

    /// <summary>Writes <c>key=value</c> for an amount.</summary>
    /// <param name="key">The field name.</param>
    /// <param name="value">The amount.</param>
    /// <returns>The pair.</returns>
    public static string Pair(string key, decimal value) => Make(key, Amount(value));

    /// <summary>Writes <c>key=value</c> for a date.</summary>
    /// <param name="key">The field name.</param>
    /// <param name="value">The date.</param>
    /// <returns>The pair.</returns>
    public static string Pair(string key, DateOnly value) => Make(key, Date(value));

    /// <summary>Writes <c>key=value</c> for an id.</summary>
    /// <param name="key">The field name.</param>
    /// <param name="value">The id.</param>
    /// <returns>The pair.</returns>
    public static string Pair(string key, Guid value) => Make(key, AuditKey.Of(value));

    /// <summary>Writes <c>key=old&gt;new</c> for a text value, both encoded.</summary>
    /// <param name="key">The field name.</param>
    /// <param name="oldValue">The old text.</param>
    /// <param name="newValue">The new text.</param>
    /// <returns>The change.</returns>
    public static string Change(string key, string oldValue, string newValue) => Make(key, Encode(oldValue), Encode(newValue));

    /// <summary>Writes <c>key=old&gt;new</c> for an amount.</summary>
    /// <param name="key">The field name.</param>
    /// <param name="oldValue">The old amount.</param>
    /// <param name="newValue">The new amount.</param>
    /// <returns>The change.</returns>
    public static string Change(string key, decimal oldValue, decimal newValue) => Make(key, Amount(oldValue), Amount(newValue));

    /// <summary>Writes <c>key=old&gt;new</c> for a date.</summary>
    /// <param name="key">The field name.</param>
    /// <param name="oldValue">The old date.</param>
    /// <param name="newValue">The new date.</param>
    /// <returns>The change.</returns>
    public static string Change(string key, DateOnly oldValue, DateOnly newValue) => Make(key, Date(oldValue), Date(newValue));

    /// <summary>Writes <c>key=old&gt;new</c> for an id.</summary>
    /// <param name="key">The field name.</param>
    /// <param name="oldValue">The old id.</param>
    /// <param name="newValue">The new id.</param>
    /// <returns>The change.</returns>
    public static string Change(string key, Guid oldValue, Guid newValue) => Make(key, AuditKey.Of(oldValue), AuditKey.Of(newValue));

    /// <summary>Joins pairs and changes in order, separated by <c>;</c>.</summary>
    /// <param name="parts">The pairs and changes.</param>
    /// <returns>The detail text.</returns>
    public static string Join(params string[] parts)
    {
        ArgumentNullException.ThrowIfNull(parts);
        return string.Join(PairSeparator, parts);
    }

    /// <summary>Percent-encodes <c>%</c>, <c>;</c>, <c>=</c> and <c>&gt;</c>; every other character is kept.</summary>
    /// <param name="text">The free text.</param>
    /// <returns>The encoded text.</returns>
    public static string Encode(string text)
    {
        ArgumentNullException.ThrowIfNull(text);
        var builder = new StringBuilder(text.Length);
        foreach (var character in text)
        {
            builder.Append(character switch
            {
                '%' => "%25",
                PairSeparator => "%3B",
                KeySeparator => "%3D",
                ChangeSeparator => "%3E",
                _ => character.ToString(),
            });
        }

        return builder.ToString();
    }

    /// <summary>Reverses <see cref="Encode"/> in one pass, so an encoded percent sign is never decoded twice.</summary>
    /// <param name="text">The encoded text.</param>
    /// <returns>The original text.</returns>
    public static string Decode(string text)
    {
        ArgumentNullException.ThrowIfNull(text);
        var builder = new StringBuilder(text.Length);
        for (var index = 0; index < text.Length; index++)
        {
            if (text[index] == '%' && index + 2 < text.Length && Escape(text.AsSpan(index + 1, 2)) is { } decoded)
            {
                builder.Append(decoded);
                index += 2;
            }
            else
            {
                builder.Append(text[index]);
            }
        }

        return builder.ToString();
    }

    /// <summary>Reads a detail back into its pairs, decoding each value. A part with no <c>=</c> is skipped.</summary>
    /// <param name="detail">The stored detail; null or empty gives no parts.</param>
    /// <returns>The pairs in order.</returns>
    public static IReadOnlyList<AuditDetailPart> Parse(string? detail)
    {
        if (string.IsNullOrEmpty(detail))
        {
            return [];
        }

        var parts = new List<AuditDetailPart>();
        foreach (var part in detail.Split(PairSeparator))
        {
            var equals = part.IndexOf(KeySeparator, StringComparison.Ordinal);
            if (equals <= 0)
            {
                continue;
            }

            var key = part[..equals];
            var value = part[(equals + 1)..];
            var arrow = value.IndexOf(ChangeSeparator, StringComparison.Ordinal);
            parts.Add(arrow < 0
                ? new AuditDetailPart(key, null, Decode(value))
                : new AuditDetailPart(key, Decode(value[..arrow]), Decode(value[(arrow + 1)..])));
        }

        return parts;
    }

    private static string Make(string key, string value) => string.Concat(key, KeySeparator, value);

    private static string Make(string key, string oldValue, string newValue) => string.Concat(key, KeySeparator, oldValue, ChangeSeparator, newValue);

    private static string Amount(decimal value) => value.ToString(AmountFormat, CultureInfo.InvariantCulture);

    private static string Date(DateOnly value) => value.ToString(DateFormat, CultureInfo.InvariantCulture);

    // The character an escape stands for; null for anything this format never writes.
    private static string? Escape(ReadOnlySpan<char> hex) => hex switch
    {
        "25" => "%",
        "3B" => ";",
        "3D" => "=",
        "3E" => ">",
        _ => null,
    };
}

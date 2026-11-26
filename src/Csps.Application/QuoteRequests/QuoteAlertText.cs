using System.Globalization;
using System.Text;

namespace Csps.Application.QuoteRequests;

/// <summary>The pure text rules of the staff alert for a quote request (D-08, D-32, D-33). Visitor text is cleaned here so it can never add a header or a line.</summary>
public static class QuoteAlertText
{
    /// <summary>The most characters of the visitor's name kept in the subject.</summary>
    public const int SubjectNameLimit = 60;

    /// <summary>The most characters of the visitor's message kept in the email.</summary>
    public const int MessageExcerptLimit = 300;

    private const string Ellipsis = "…";
    private const string SubjectStart = "New quote request from ";

    /// <summary>Gets the subject of the alert: the visitor's name on one line, cut at <see cref="SubjectNameLimit"/> characters with an ellipsis.</summary>
    /// <param name="customerName">The visitor's name.</param>
    /// <returns>The subject line.</returns>
    public static string Subject(string customerName) => SubjectStart + ShortName(customerName);

    /// <summary>Gets the name as one short line, cut for the subject.</summary>
    /// <param name="customerName">The visitor's name.</param>
    /// <returns>The short name.</returns>
    public static string ShortName(string customerName) => Cut(OneLine(customerName), SubjectNameLimit);

    /// <summary>
    /// Puts a visitor's text on one line: every run of line breaks, control characters and spaces becomes one space, and format
    /// characters (bidi marks and overrides, zero-width characters) are dropped, so they cannot reorder the subject.
    /// </summary>
    /// <param name="value">The visitor's text.</param>
    /// <returns>The text on one line.</returns>
    public static string OneLine(string value)
    {
        ArgumentNullException.ThrowIfNull(value);

        var line = new StringBuilder(value.Length);
        var gap = false;
        foreach (var character in value)
        {
            if (char.GetUnicodeCategory(character) == UnicodeCategory.Format)
            {
                continue;
            }

            if (char.IsControl(character) || char.IsWhiteSpace(character))
            {
                gap = line.Length > 0;
                continue;
            }

            if (gap)
            {
                line.Append(' ');
                gap = false;
            }

            line.Append(character);
        }

        return line.ToString();
    }

    /// <summary>
    /// Gets the first <see cref="MessageExcerptLimit"/> characters of the visitor's message. Line breaks are kept as plain new lines;
    /// other control characters are dropped.
    /// </summary>
    /// <param name="message">The message, or null.</param>
    /// <returns>The excerpt with an ellipsis when it was cut, or null when there is no message.</returns>
    public static string? Excerpt(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return null;
        }

        var text = new StringBuilder(message.Length);
        for (var index = 0; index < message.Length; index++)
        {
            var character = message[index];
            switch (character)
            {
                case '\r':
                    text.Append('\n');
                    if (index + 1 < message.Length && message[index + 1] == '\n')
                    {
                        index++;
                    }

                    break;
                case '\n' or '\u2028' or '\u2029':
                    text.Append('\n');
                    break;
                case '\t':
                    text.Append(' ');
                    break;
                default:
                    if (!char.IsControl(character))
                    {
                        text.Append(character);
                    }

                    break;
            }
        }

        var clean = text.ToString().Trim();
        return clean.Length == 0 ? null : Cut(clean, MessageExcerptLimit);
    }

    // Keeps the first limit characters and adds an ellipsis, never leaving half of a surrogate pair.
    private static string Cut(string value, int limit)
    {
        if (value.Length <= limit)
        {
            return value;
        }

        var length = char.IsHighSurrogate(value[limit - 1]) ? limit - 1 : limit;
        return value[..length] + Ellipsis;
    }
}

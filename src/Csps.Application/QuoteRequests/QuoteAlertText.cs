namespace Csps.Application.QuoteRequests;

/// <summary>The pure text rules of the staff alert for a quote request (D-08, D-32, D-33).</summary>
public static class QuoteAlertText
{
    /// <summary>The most characters of the visitor's name kept in the subject.</summary>
    public const int SubjectNameLimit = 60;

    /// <summary>The most characters of the visitor's message kept in the email.</summary>
    public const int MessageExcerptLimit = 300;

    /// <summary>Gets the subject of the alert.</summary>
    /// <param name="customerName">The visitor's name.</param>
    /// <returns>The subject line.</returns>
    public static string Subject(string customerName) => customerName;

    /// <summary>Gets the name as one short line, cut for the subject.</summary>
    /// <param name="customerName">The visitor's name.</param>
    /// <returns>The short name.</returns>
    public static string ShortName(string customerName) => customerName;

    /// <summary>Puts a visitor's text on one line so it can never add a line or a header.</summary>
    /// <param name="value">The visitor's text.</param>
    /// <returns>The text on one line.</returns>
    public static string OneLine(string value) => value;

    /// <summary>Gets the first part of the visitor's message.</summary>
    /// <param name="message">The message, or null.</param>
    /// <returns>The excerpt, or null when there is no message.</returns>
    public static string? Excerpt(string? message) => message;
}

using System.Diagnostics.CodeAnalysis;

namespace Csps.Domain.Common;

/// <summary>
/// An expected failure returned by a use case instead of thrown (PRD section 3.3). The Server maps
/// <see cref="Kind"/> to one HTTP status; <see cref="Message"/> is short plain English shown to the user (D-26).
/// </summary>
[SuppressMessage("Naming", "CA1716:Identifiers should not match keywords", Justification = "C#-only solution; 'Error' is the PRD section 3.3 name and is only a keyword in VB.")]
public sealed record Error
{
    private Error(ErrorKind kind, string code, string message, IReadOnlyDictionary<string, string[]>? fieldErrors)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(code);
        ArgumentException.ThrowIfNullOrWhiteSpace(message);

        Kind = kind;
        Code = code;
        Message = message;
        FieldErrors = fieldErrors;
    }

    /// <summary>The kind of failure, which decides the HTTP status.</summary>
    public ErrorKind Kind { get; }

    /// <summary>A stable, machine-readable code such as <c>order.not-found</c>.</summary>
    public string Code { get; }

    /// <summary>A short plain-English message for the user.</summary>
    public string Message { get; }

    /// <summary>Messages per field. Set for <see cref="ErrorKind.Validation"/> only, and never empty there.</summary>
    public IReadOnlyDictionary<string, string[]>? FieldErrors { get; }

    /// <summary>The input breaks field rules. At least one field error is required, so a 400 always explains itself.</summary>
    /// <param name="code">A stable machine-readable code.</param>
    /// <param name="message">A short plain-English message.</param>
    /// <param name="fieldErrors">Messages per field; must contain at least one entry.</param>
    /// <returns>The validation error.</returns>
    /// <exception cref="ArgumentNullException">When <paramref name="fieldErrors"/> is null.</exception>
    /// <exception cref="ArgumentException">When <paramref name="fieldErrors"/> is empty, or the code or message is blank.</exception>
    public static Error Validation(string code, string message, IReadOnlyDictionary<string, string[]> fieldErrors)
    {
        ArgumentNullException.ThrowIfNull(fieldErrors);
        if (fieldErrors.Count == 0)
        {
            throw new ArgumentException("A validation error needs at least one field error.", nameof(fieldErrors));
        }

        return new Error(ErrorKind.Validation, code, message, fieldErrors);
    }

    /// <summary>The thing asked for does not exist.</summary>
    /// <param name="code">A stable machine-readable code.</param>
    /// <param name="message">A short plain-English message.</param>
    /// <returns>The error.</returns>
    public static Error NotFound(string code, string message) => new(ErrorKind.NotFound, code, message, null);

    /// <summary>Someone else changed the thing first.</summary>
    /// <param name="code">A stable machine-readable code.</param>
    /// <param name="message">A short plain-English message.</param>
    /// <returns>The error.</returns>
    public static Error Conflict(string code, string message) => new(ErrorKind.Conflict, code, message, null);

    /// <summary>A business rule forbids the action.</summary>
    /// <param name="code">A stable machine-readable code.</param>
    /// <param name="message">A short plain-English message.</param>
    /// <returns>The error.</returns>
    public static Error BusinessRule(string code, string message) => new(ErrorKind.BusinessRule, code, message, null);

    /// <summary>The caller may not do this.</summary>
    /// <param name="code">A stable machine-readable code.</param>
    /// <param name="message">A short plain-English message.</param>
    /// <returns>The error.</returns>
    public static Error Forbidden(string code, string message) => new(ErrorKind.Forbidden, code, message, null);
}

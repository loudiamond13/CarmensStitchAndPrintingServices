using System.Diagnostics.CodeAnalysis;

namespace Csps.Domain.Common;

/// <summary>An expected failure (PRD section 3.3). RED stub: no validation yet.</summary>
[SuppressMessage("Naming", "CA1716:Identifiers should not match keywords", Justification = "C#-only solution; 'Error' is the PRD section 3.3 name and is only a keyword in VB.")]
public sealed record Error
{
    private Error(ErrorKind kind, string code, string message, IReadOnlyDictionary<string, string[]>? fieldErrors)
    {
        Kind = kind;
        Code = code;
        Message = message;
        FieldErrors = fieldErrors;
    }

    /// <summary>The kind of failure.</summary>
    public ErrorKind Kind { get; }

    /// <summary>A stable machine-readable code.</summary>
    public string Code { get; }

    /// <summary>A short plain-English message.</summary>
    public string Message { get; }

    /// <summary>Field errors (Validation only).</summary>
    public IReadOnlyDictionary<string, string[]>? FieldErrors { get; }

    /// <summary>Stub.</summary>
    /// <param name="code">Code.</param>
    /// <param name="message">Message.</param>
    /// <param name="fieldErrors">Field errors.</param>
    /// <returns>An error.</returns>
    public static Error Validation(string code, string message, IReadOnlyDictionary<string, string[]> fieldErrors) =>
        new(ErrorKind.Validation, code, message, fieldErrors);

    /// <summary>Stub.</summary>
    /// <param name="code">Code.</param>
    /// <param name="message">Message.</param>
    /// <returns>An error.</returns>
    public static Error NotFound(string code, string message) => new(ErrorKind.Validation, code, message, null);

    /// <summary>Stub.</summary>
    /// <param name="code">Code.</param>
    /// <param name="message">Message.</param>
    /// <returns>An error.</returns>
    public static Error Conflict(string code, string message) => new(ErrorKind.Validation, code, message, null);

    /// <summary>Stub.</summary>
    /// <param name="code">Code.</param>
    /// <param name="message">Message.</param>
    /// <returns>An error.</returns>
    public static Error BusinessRule(string code, string message) => new(ErrorKind.Validation, code, message, null);

    /// <summary>Stub.</summary>
    /// <param name="code">Code.</param>
    /// <param name="message">Message.</param>
    /// <returns>An error.</returns>
    public static Error Forbidden(string code, string message) => new(ErrorKind.Validation, code, message, null);
}

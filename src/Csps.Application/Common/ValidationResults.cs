using Csps.Domain.Common;
using FluentValidation.Results;

namespace Csps.Application.Common;

/// <summary>Turns FluentValidation results into the use-case <see cref="Error"/>.</summary>
public static class ValidationResults
{
    /// <summary>Builds a validation error with camelCase field names (every segment of a nested path) and the messages in the order they were raised.</summary>
    /// <param name="result">A failed validation result.</param>
    /// <param name="code">The machine code.</param>
    /// <param name="message">The text above the field errors.</param>
    /// <returns>The validation error.</returns>
    public static Error ToError(ValidationResult result, string code, string message)
    {
        ArgumentNullException.ThrowIfNull(result);

        var fields = result.Errors
            .GroupBy(static failure => CamelCase(failure.PropertyName), StringComparer.Ordinal)
            .ToDictionary(static group => group.Key, static group => group.Select(static failure => failure.ErrorMessage).ToArray(), StringComparer.Ordinal);
        return Error.Validation(code, message, fields);
    }

    // Every dotted segment of a nested path starts with a lower case letter: Items[1].UnitPrice becomes items[1].unitPrice.
    private static string CamelCase(string path) =>
        string.Join('.', path.Split('.').Select(static segment => segment.Length == 0 ? segment : string.Concat(char.ToLowerInvariant(segment[0]).ToString(), segment.AsSpan(1))));
}

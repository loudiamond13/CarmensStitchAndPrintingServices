using Csps.Application.Common;
using Csps.Domain.Common;
using Csps.Domain.Content;
using FluentValidation.Results;

namespace Csps.Application.Content;

/// <summary>The error values the site content use cases return (CONT-01). Codes start with <c>site-content.</c>.</summary>
public static class SiteContentErrors
{
    /// <summary>The machine code of a form that breaks field rules.</summary>
    public const string InvalidCode = "site-content.invalid-request";

    /// <summary>Turns a failed validation into the 400 that names every broken field.</summary>
    /// <param name="validation">The failed validation.</param>
    /// <returns>The error.</returns>
    public static Error Invalid(ValidationResult validation) =>
        ValidationResults.ToError(validation, InvalidCode, SiteSettings.InvalidMessage);
}

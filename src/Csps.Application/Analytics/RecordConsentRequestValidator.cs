using FluentValidation;

namespace Csps.Application.Analytics;

/// <summary>Checks a consent decision (ANL-07, the server half of OR-3).</summary>
public sealed class RecordConsentRequestValidator : AbstractValidator<RecordConsentRequest>
{
    /// <summary>The message for a missing policy version.</summary>
    public const string PolicyVersionRequired = "The cookie policy version is missing.";

    /// <summary>The message for a policy version that is not digits, a dot and digits.</summary>
    public const string PolicyVersionInvalid = "The cookie policy version must look like 1.0.";

    /// <summary>The message for a source that is not one the browser may send.</summary>
    public const string SourceInvalid = "The source must be bar, settings or map-link.";

    /// <summary>The message for a consent id that is not 32 lowercase letters and digits.</summary>
    public const string ConsentIdInvalid = "The consent id must be 32 lowercase letters and digits.";
}

using Csps.Domain.Analytics;
using FluentValidation;

namespace Csps.Application.Analytics;

/// <summary>
/// Checks a consent decision (ANL-07, the server half of OR-3). The policy version is digits, a dot and digits; the source is one the
/// browser may send (<c>clear</c> is the server's own); the consent id, when sent, is 32 lowercase letters and digits. Whether the version
/// is the current one is the handler's call, not a field rule (D-22).
/// </summary>
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

    private const int ConsentIdLength = 32;

    /// <summary>Creates the validator.</summary>
    public RecordConsentRequestValidator()
    {
        RuleFor(request => request.PolicyVersion)
            .Cascade(CascadeMode.Stop)
            .Must(static version => !string.IsNullOrWhiteSpace(version)).WithMessage(PolicyVersionRequired)
            .Must(ConsentRecord.IsPolicyVersion).WithMessage(PolicyVersionInvalid);
        RuleFor(request => request.Source)
            .Must(static source => source is ConsentSources.Bar or ConsentSources.Settings or ConsentSources.MapLink)
            .WithMessage(SourceInvalid);
        RuleFor(request => request.ConsentId)
            .Must(IsConsentId)
            .WithMessage(ConsentIdInvalid)
            .When(static request => !string.IsNullOrEmpty(request.ConsentId));
    }

    private static bool IsConsentId(string? id) =>
        id is { Length: ConsentIdLength } && id.All(static c => char.IsAsciiDigit(c) || c is >= 'a' and <= 'f');
}

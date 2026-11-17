using Csps.Domain.Common;

namespace Csps.Application.Analytics;

/// <summary>The error values the consent use case returns (ANL-07, D-22).</summary>
public static class ConsentErrors
{
    /// <summary>The code of a request with a missing or malformed field.</summary>
    public const string ValidationCode = "consent.invalid-request";

    /// <summary>The text above the field errors of a bad request.</summary>
    public const string ValidationMessage = "Check the highlighted fields.";

    /// <summary>The code of a decision made under an old cookie policy version (D-22).</summary>
    public const string PolicyChangedCode = "consent.policy-changed";

    /// <summary>The plain-English text for a decision made under an old cookie policy version.</summary>
    public const string PolicyChangedMessage = "The cookie policy has changed. Reload the page and choose again.";

    /// <summary>Gets the 409 for a decision made under an old cookie policy version. The answer also carries the current version.</summary>
    public static Error PolicyChanged { get; } = Error.Conflict(PolicyChangedCode, PolicyChangedMessage);
}

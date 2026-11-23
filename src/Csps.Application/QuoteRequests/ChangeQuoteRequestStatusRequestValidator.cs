using Csps.Application.Common;
using Csps.Domain.QuoteRequests;
using FluentValidation;

namespace Csps.Application.QuoteRequests;

/// <summary>
/// Checks the Change Status action: the status must be one of the five keys staff may set by hand (Converted is not one, D-15), and the
/// version must be the eight-byte row version the page was opened with.
/// </summary>
public sealed class ChangeQuoteRequestStatusRequestValidator : AbstractValidator<ChangeQuoteRequestStatusRequest>
{
    /// <summary>Creates the validator.</summary>
    public ChangeQuoteRequestStatusRequestValidator()
    {
        RuleFor(request => request.Status)
            .Must(static text => TryParseHandSet(text, out _))
            .WithMessage(QuoteRequestRules.StatusInvalid);
        RuleFor(request => request.Version)
            .Must(static text => RowVersions.TryParse(text, out _))
            .WithMessage(RowVersions.InvalidMessage);
    }

    /// <summary>Reads a status key staff may set by hand.</summary>
    /// <param name="text">The key sent by the client.</param>
    /// <param name="status">The status when the key is one of the five.</param>
    /// <returns>True for new, contacted, quoted, closed or spam, ignoring case and spaces around it.</returns>
    public static bool TryParseHandSet(string? text, out QuoteRequestStatus status) =>
        QuoteRequestStatusNames.TryParse(text, out status) && status != QuoteRequestStatus.Converted;
}

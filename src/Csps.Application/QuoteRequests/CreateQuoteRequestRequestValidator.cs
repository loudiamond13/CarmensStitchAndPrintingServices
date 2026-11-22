using Csps.Domain.QuoteRequests;
using FluentValidation;

namespace Csps.Application.QuoteRequests;

/// <summary>
/// Checks the quote form with the rules the browser also applies (OR-3). Every message is a <see cref="QuoteRequestRules"/> constant,
/// so the server and the form say the same words. Lengths are counted after trimming, as the browser counts them.
/// </summary>
public sealed class CreateQuoteRequestRequestValidator : AbstractValidator<CreateQuoteRequestRequest>
{
    /// <summary>Creates the validator.</summary>
    public CreateQuoteRequestRequestValidator()
    {
        RuleFor(request => request.CustomerName)
            .Must(static text => !string.IsNullOrWhiteSpace(text)).WithMessage(QuoteRequestRules.CustomerNameRequired);

        RuleFor(request => request.ContactNumber)
            .Must(static text => !string.IsNullOrWhiteSpace(text) && QuoteRequestRules.TryParseMobile(text.Trim(), out _))
            .WithMessage(QuoteRequestRules.ContactNumberInvalid);
    }
}

using Csps.Domain.Content;
using Csps.Domain.Orders;
using Csps.Domain.QuoteRequests;
using FluentValidation;

namespace Csps.Application.QuoteRequests;

/// <summary>
/// Checks the quote form with the rules the browser also applies (OR-3). Every message is a <see cref="QuoteRequestRules"/> constant,
/// so the server and the form say the same words. Lengths are counted in UTF-16 code units after trimming, as the browser counts
/// them. The name and a Philippine mobile number are required; the email, product, quantity and message are optional. Whether a
/// product line key names a shown line needs the database and runs in the handler.
/// </summary>
public sealed class CreateQuoteRequestRequestValidator : AbstractValidator<CreateQuoteRequestRequest>
{
    /// <summary>Creates the validator.</summary>
    public CreateQuoteRequestRequestValidator()
    {
        RuleFor(request => request.CustomerName)
            .Cascade(CascadeMode.Stop)
            .Must(static text => !string.IsNullOrWhiteSpace(text)).WithMessage(QuoteRequestRules.CustomerNameRequired)
            .Must(static text => text!.Trim().Length <= QuoteRequestRules.CustomerNameMaxLength).WithMessage(QuoteRequestRules.CustomerNameTooLong);

        RuleFor(request => request.TeamName)
            .Must(static text => text is null || text.Trim().Length <= QuoteRequestRules.TeamNameMaxLength).WithMessage(QuoteRequestRules.TeamNameTooLong);

        RuleFor(request => request.ContactNumber)
            .Must(static text => !string.IsNullOrWhiteSpace(text) && QuoteRequestRules.TryParseMobile(text.Trim(), out _))
            .WithMessage(QuoteRequestRules.ContactNumberInvalid);

        RuleFor(request => request.Email)
            .Cascade(CascadeMode.Stop)
            .Must(static text => string.IsNullOrWhiteSpace(text) || text.Trim().Length <= QuoteRequestRules.EmailMaxLength).WithMessage(QuoteRequestRules.EmailTooLong)
            .Must(static text => string.IsNullOrWhiteSpace(text) || OrderRules.IsValidEmail(text.Trim())).WithMessage(QuoteRequestRules.EmailInvalid);

        RuleFor(request => request.ProductChoice)
            .Must(static text => string.IsNullOrWhiteSpace(text) || QuoteProductChoiceNames.TryParse(text, out _)).WithMessage(QuoteRequestRules.ProductInvalid);

        RuleFor(request => request.ProductLineKey)
            .Must(static (request, key) => !IsLineChoice(request.ProductChoice) || IsPlausibleLineKey(key)).WithMessage(QuoteRequestRules.ProductInvalid);

        RuleFor(request => request.Quantity)
            .Must(static text => string.IsNullOrWhiteSpace(text) || QuoteQuantityRangeNames.TryParse(text, out _)).WithMessage(QuoteRequestRules.QuantityInvalid);

        RuleFor(request => request.Message)
            .Must(static text => text is null || text.Trim().Length <= QuoteRequestRules.MessageMaxLength).WithMessage(QuoteRequestRules.MessageTooLong);

        RuleFor(request => request.Photos)
            .Cascade(CascadeMode.Stop)
            .Must(static names => names is null || names.Count <= QuoteRequestRules.MaxPhotos).WithMessage(QuoteRequestRules.PhotosTooMany)
            .Must(static names => names is null || names.All(static name => name is not null)).WithMessage(QuoteRequestRules.PhotosInvalid)
            .Must(static names => names is null || names.All(static name => name.Length <= QuoteRequestRules.PhotoNameMaxLength)).WithMessage(QuoteRequestRules.PhotoNameTooLong);

        RuleFor(request => request.UploadKey)
            .Must(static (request, key) => request.Photos is not { Count: > 0 } || QuoteUploadKey.TryHash(key, out _)).WithMessage(QuoteRequestRules.UploadKeyInvalid);
    }

    // True when the choice is the "line" key; a bad choice reports on its own field.
    private static bool IsLineChoice(string? choice) => QuoteProductChoiceNames.TryParse(choice, out var parsed) && parsed == QuoteProductChoice.Line;

    // A key that is empty or longer than any line key can never name a line, so the database is not asked.
    private static bool IsPlausibleLineKey(string? key) => !string.IsNullOrWhiteSpace(key) && key.Trim().Length <= ProductLine.KeyMaxLength;
}

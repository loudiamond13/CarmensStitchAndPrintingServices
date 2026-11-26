using Csps.Domain.QuoteRequests;
using FluentValidation;

namespace Csps.Application.QuoteRequests;

/// <summary>Checks the Add Note action (D-17): 1 to 1,000 characters after trimming, the same rule the domain and the web form use.</summary>
public sealed class AddQuoteRequestNoteRequestValidator : AbstractValidator<AddQuoteRequestNoteRequest>
{
    /// <summary>Creates the validator.</summary>
    public AddQuoteRequestNoteRequestValidator()
    {
        RuleFor(request => request.Text)
            .Cascade(CascadeMode.Stop)
            .Must(static text => !string.IsNullOrWhiteSpace(text))
            .WithMessage(QuoteRequestRules.NoteRequired)
            .Must(static text => text!.Trim().Length <= QuoteRequestRules.NoteMaxLength)
            .WithMessage(QuoteRequestRules.NoteTooLong);
    }
}

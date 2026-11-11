using Csps.Domain.Money;
using FluentValidation;

namespace Csps.Application.Money;

/// <summary>
/// Checks the Hand Over form with the rules of the Transfer Money form plus a required former staff member (D-17, OR-3). The business
/// today is passed in <see cref="ValidationContext{T}.RootContextData"/> under <see cref="CreateMoneyTransferRequestValidator.TodayKey"/>.
/// What needs the database (who the people are, what the former staff member holds) runs in the handler.
/// </summary>
public sealed class CreateMoneyHandoverRequestValidator : AbstractValidator<CreateMoneyHandoverRequest>
{
    /// <summary>Creates the validator.</summary>
    public CreateMoneyHandoverRequestValidator()
    {
        RuleFor(request => request.FromUserId)
            .Must(static id => id is { } value && value != Guid.Empty).WithMessage(MoneyErrors.FromRequiredMessage);

        RuleFor(request => request.ToUserId)
            .Must(static id => id is { } value && value != Guid.Empty).WithMessage(MoneyRules.ToRequired);

        RuleFor(request => request.Amount)
            .Cascade(CascadeMode.Stop)
            .NotNull().WithMessage(MoneyRules.AmountRequired)
            .Must(static amount => amount > 0m).WithMessage(MoneyRules.AmountTooSmall)
            .Must(static amount => MoneyRules.HasValidScale(amount!.Value)).WithMessage(MoneyRules.AmountDecimals);

        RuleFor(request => request.TransferDate).Custom(CreateMoneyTransferRequestValidator.CheckDate);

        RuleFor(request => request.Note)
            .Must(static note => note is null || MoneyRules.TrimNote(note)!.Length <= MoneyRules.NoteMaxLength).WithMessage(MoneyRules.NoteTooLong);
    }
}

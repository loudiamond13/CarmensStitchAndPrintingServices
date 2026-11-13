using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// The one set of public website rules for the order window, the New Order form and the Edit Order form (OR-3, D-11, D-13), so a save says
/// the same words whichever sent it: the name shown is at most 80 characters, and showing needs the customer's OK. The rules that need the
/// order (a line to show it under, a name when there is no team, a Cancelled order) are checked by the domain when the settings are applied.
/// </summary>
public sealed class OrderPublicWebsiteFieldsValidator : AbstractValidator<IOrderPublicWebsiteFields>
{
    /// <summary>Creates the validator.</summary>
    public OrderPublicWebsiteFieldsValidator()
    {
        RuleFor(fields => fields.PublicName)
            .Must(static name => name is null || name.Trim().Length <= OrderPublicSettings.PublicNameMaxLength).WithMessage(OrderPublicSettings.NameTooLongMessage);

        RuleFor(fields => fields.ShowOnWebsite)
            .Must(static (fields, show) => !show || fields.CustomerConsent).WithMessage(OrderPublicSettings.ConsentRequiredMessage);
    }
}

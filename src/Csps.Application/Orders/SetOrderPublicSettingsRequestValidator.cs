using Csps.Application.Common;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Checks the Public Website window: the version, and the public website rules the order forms share
/// (<see cref="OrderPublicWebsiteFieldsValidator"/>). The domain checks every other rule again when the settings are applied.
/// </summary>
public sealed class SetOrderPublicSettingsRequestValidator : AbstractValidator<SetOrderPublicSettingsRequest>
{
    /// <summary>Creates the validator.</summary>
    public SetOrderPublicSettingsRequestValidator()
    {
        Include(new OrderPublicWebsiteFieldsValidator());

        RuleFor(request => request.Version)
            .Must(static text => RowVersions.TryParse(text, out _)).WithMessage(RowVersions.InvalidMessage);
    }
}

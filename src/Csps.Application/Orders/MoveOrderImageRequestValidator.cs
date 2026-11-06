using Csps.Application.Common;
using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>Checks a photo move: a place from 0 to the most photos an order holds less one, and the order's version. Whether the place is inside this order's photos is checked by the domain.</summary>
public sealed class MoveOrderImageRequestValidator : AbstractValidator<MoveOrderImageRequest>
{
    /// <summary>Creates the validator.</summary>
    public MoveOrderImageRequestValidator()
    {
        RuleFor(request => request.Position)
            .Must(static place => place is >= 0 and < OrderImageRules.MaxImagesPerOrder).WithMessage(OrderImageRules.PositionOutOfRangeMessage);

        RuleFor(request => request.Version)
            .Must(static text => RowVersions.TryParse(text, out _)).WithMessage(RowVersions.InvalidMessage);
    }
}

using Csps.Application.Common;
using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Checks a photo description change: the description is optional and, after trimming, at most 200 characters counted as .NET
/// string length (the length the browser's schema counts too), and the order's version is required.
/// </summary>
public sealed class DescribeOrderImageRequestValidator : AbstractValidator<DescribeOrderImageRequest>
{
    /// <summary>Creates the validator.</summary>
    public DescribeOrderImageRequestValidator()
    {
        RuleFor(request => request.Description)
            .Must(static text => OrderImageRules.CheckDescription(text) is null).WithMessage(OrderImageRules.DescriptionTooLongMessage);

        RuleFor(request => request.Version)
            .Must(static text => RowVersions.TryParse(text, out _)).WithMessage(RowVersions.InvalidMessage);
    }
}

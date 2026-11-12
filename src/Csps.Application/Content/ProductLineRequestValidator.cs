using Csps.Application.Common;
using Csps.Domain.Content;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// The field rules of the product line form (OR-3, CONT-02), with the UI-SPEC messages. They are the domain's own rules
/// (<see cref="ProductLine.Check"/>), so the browser, the validator and the domain never disagree. An edit is marked with
/// <see cref="EditKey"/> in <see cref="ValidationContext{T}.RootContextData"/>: the version is then required. What needs the database (a
/// short name another line uses) runs in the handlers under the site-content lock.
/// </summary>
public sealed class ProductLineRequestValidator : AbstractValidator<ProductLineRequest>
{
    /// <summary>The <see cref="ValidationContext{T}.RootContextData"/> key that marks an edit.</summary>
    public const string EditKey = "edit";

    /// <summary>Creates the validator.</summary>
    public ProductLineRequestValidator()
    {
        RuleFor(request => request).Custom(CheckForm);
    }

    private static void CheckForm(ProductLineRequest request, ValidationContext<ProductLineRequest> context)
    {
        if (context.RootContextData.ContainsKey(EditKey) && !RowVersions.TryParse(request.Version, out _))
        {
            context.AddFailure(nameof(ProductLineRequest.Version), RowVersions.InvalidMessage);
        }

        foreach (var (field, messages) in ProductLine.Check(request.ToValues()))
        {
            context.AddFailure(field, messages[0]);
        }
    }
}

/// <summary>The rule of the move form: the direction is "up" or "down".</summary>
public sealed class MoveProductLineRequestValidator : AbstractValidator<MoveProductLineRequest>
{
    /// <summary>The direction that moves a line towards the start of the order.</summary>
    public const string Up = "up";

    /// <summary>The direction that moves a line towards the end of the order.</summary>
    public const string Down = "down";

    /// <summary>Creates the validator.</summary>
    public MoveProductLineRequestValidator()
    {
        RuleFor(request => request.Direction)
            .Must(static direction => IsDirection(direction))
            .WithMessage(SiteSettings.InvalidMessage);
    }

    /// <summary>Tells whether a text is one of the two directions, ignoring letter case.</summary>
    /// <param name="direction">The text.</param>
    /// <returns>True for "up" or "down".</returns>
    public static bool IsDirection(string? direction) =>
        string.Equals(direction, Up, StringComparison.OrdinalIgnoreCase) || string.Equals(direction, Down, StringComparison.OrdinalIgnoreCase);
}

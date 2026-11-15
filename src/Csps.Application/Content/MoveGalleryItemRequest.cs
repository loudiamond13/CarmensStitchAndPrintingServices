using Csps.Domain.Content;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>The gallery move form: which way an item goes in the one gallery order, and the line the Manager's list is filtered to.</summary>
/// <param name="Direction">"up" or "down".</param>
/// <param name="LineId">The line the list is filtered to; the neighbour is then the next item of that line. Null when the list shows every line.</param>
public sealed record MoveGalleryItemRequest(string? Direction, Guid? LineId = null)
{
    /// <summary>Gets the request used when the body is empty or unreadable.</summary>
    public static MoveGalleryItemRequest Empty { get; } = new((string?)null);
}

/// <summary>The rule of the gallery move form: the direction is "up" or "down".</summary>
public sealed class MoveGalleryItemRequestValidator : AbstractValidator<MoveGalleryItemRequest>
{
    /// <summary>Creates the validator.</summary>
    public MoveGalleryItemRequestValidator()
    {
        RuleFor(request => request.Direction)
            .Must(static direction => MoveProductLineRequestValidator.IsDirection(direction))
            .WithMessage(SiteSettings.InvalidMessage);
    }
}

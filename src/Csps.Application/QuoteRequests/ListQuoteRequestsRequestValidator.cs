using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Application.Users;
using FluentValidation;

namespace Csps.Application.QuoteRequests;

/// <summary>
/// Checks the staff inbox query (SEC-03, WEB-10): the search is at most 100 characters once trimmed, the page is 1 to 100000, the page
/// size is 10, 20, 50 or 100, and the status is <c>open</c>, <c>converted</c>, <c>closed</c>, <c>spam</c> or <c>all</c>. A missing part takes
/// its default.
/// </summary>
public sealed class ListQuoteRequestsRequestValidator : AbstractValidator<ListQuoteRequestsRequest>
{
    /// <summary>The message for a status that is not one of the five.</summary>
    public const string StatusInvalid = "Choose a status.";

    /// <summary>The message for a page size that is not 10, 20, 50 or 100.</summary>
    public const string SizeInvalid = "Use a page size of 10, 20, 50 or 100.";

    private static readonly int[] AllowedSizes = [10, 20, 50, 100];

    /// <summary>Creates the validator.</summary>
    public ListQuoteRequestsRequestValidator()
    {
        RuleFor(static request => request.Q == null ? null : request.Q.Trim()).SearchText().OverridePropertyName(nameof(ListQuoteRequestsRequest.Q));
        RuleFor(request => request.Size).Must(static size => AllowedSizes.Contains(size)).WithMessage(SizeInvalid);
        RuleFor(request => request.Page).InclusiveBetween(1, ListUsersRequestValidator.MaxPage).WithMessage(ListUsersRequestValidator.PageInvalid);
        RuleFor(request => request.Status)
            .Must(static status => string.IsNullOrWhiteSpace(status) || TryParseGroup(status, out _))
            .WithMessage(StatusInvalid);
    }

    /// <summary>Reads the status part of the query; a blank text is the default, <c>open</c>.</summary>
    /// <param name="text">The text sent by the browser.</param>
    /// <param name="group">The group.</param>
    /// <returns>True when the text is blank or one of the five group names.</returns>
    public static bool TryParseGroup(string? text, out QuoteRequestGroup group)
    {
        var trimmed = text?.Trim();
        group = QuoteRequestGroup.Open;
        if (string.IsNullOrEmpty(trimmed))
        {
            return true;
        }

        foreach (var known in Enum.GetValues<QuoteRequestGroup>())
        {
            if (string.Equals(trimmed, known.ToString(), StringComparison.OrdinalIgnoreCase))
            {
                group = known;
                return true;
            }
        }

        return false;
    }
}

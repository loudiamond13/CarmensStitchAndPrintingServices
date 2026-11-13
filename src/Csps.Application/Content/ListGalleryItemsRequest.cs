using Csps.Application.Common;
using Csps.Application.Users;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>The query of the Manager's gallery list (WEB-10): an optional line filter, the page and the page size.</summary>
/// <param name="Line">A product line id; none means every line.</param>
/// <param name="Page">The page number, from 1.</param>
/// <param name="PageSize">Rows per page, from 1 to 100.</param>
public sealed record ListGalleryItemsRequest(string? Line = null, int Page = 1, int PageSize = ListGalleryItemsRequest.DefaultPageSize)
{
    /// <summary>The page size used when the caller sends none.</summary>
    public const int DefaultPageSize = 20;
}

/// <summary>Checks the gallery list query (SEC-03): the shared page size cap, a page of 1 to 100000 and a line that is a dashed id.</summary>
public sealed class ListGalleryItemsRequestValidator : AbstractValidator<ListGalleryItemsRequest>
{
    /// <summary>The message for a line that is not an id.</summary>
    public const string LineInvalid = "Choose a product line from the list.";

    /// <summary>Creates the validator.</summary>
    public ListGalleryItemsRequestValidator()
    {
        RuleFor(request => request.PageSize).PageSize();
        RuleFor(request => request.Page).InclusiveBetween(1, ListUsersRequestValidator.MaxPage).WithMessage(ListUsersRequestValidator.PageInvalid);
        RuleFor(request => request.Line)
            .Must(static line => string.IsNullOrWhiteSpace(line) || TryParseLine(line, out _))
            .WithMessage(LineInvalid);
    }

    /// <summary>Reads a line id in dashed form, ignoring spaces around it.</summary>
    /// <param name="text">The text sent by the browser.</param>
    /// <param name="id">The id when the text is a dashed id.</param>
    /// <returns>True when the text is a non-empty dashed id.</returns>
    public static bool TryParseLine(string? text, out Guid id)
    {
        id = Guid.Empty;
        return text is not null && Guid.TryParseExact(text.Trim(), "D", out id) && id != Guid.Empty;
    }
}

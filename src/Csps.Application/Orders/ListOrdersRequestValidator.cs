using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Application.Users;
using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Checks the order list query (SEC-03, WEB-10): the page size and search use the shared list caps, the page is 1 to 100000, the
/// status is <c>active</c>, <c>all</c> or one of the seven keys, the sort is one of four, the product type is a dashed id, and the
/// dates are real <c>yyyy-MM-dd</c> days with the end not before the start. A missing part takes its default.
/// </summary>
public sealed class ListOrdersRequestValidator : AbstractValidator<ListOrdersRequest>
{
    /// <summary>The highest page number accepted, so the row offset can never overflow.</summary>
    public const int MaxPage = ListUsersRequestValidator.MaxPage;

    /// <summary>The message for a sort that is not one of the four.</summary>
    public const string SortInvalid = "Choose a sort order.";

    /// <summary>The message when the end date is before the start date.</summary>
    public const string DatesOrder = "The end date can't be before the start date.";

    private const string ActiveKey = "active";
    private const string AllKey = "all";

    /// <summary>Creates the validator.</summary>
    public ListOrdersRequestValidator()
    {
        RuleFor(request => request.Q).SearchText();
        RuleFor(request => request.PageSize).PageSize();
        RuleFor(request => request.Page).InclusiveBetween(1, MaxPage).WithMessage(ListUsersRequestValidator.PageInvalid);
        RuleFor(request => request.Status)
            .Must(static status => string.IsNullOrWhiteSpace(status) || TryParseStatus(status, out _, out _))
            .WithMessage(OrderRules.StatusInvalid);
        RuleFor(request => request.Sort)
            .Must(static sort => string.IsNullOrWhiteSpace(sort) || TryParseSort(sort, out _))
            .WithMessage(SortInvalid);
        RuleFor(request => request.ProductType)
            .Must(static productType => string.IsNullOrWhiteSpace(productType) || TryParseProductType(productType, out _))
            .WithMessage(OrderRules.ProductTypeRequired);
        RuleFor(request => request.From).Custom(CheckFrom);
        RuleFor(request => request.To).Custom(CheckTo);
    }

    /// <summary>Reads the status part of the query; a blank text is the default, <c>active</c>.</summary>
    /// <param name="text">The text sent by the browser.</param>
    /// <param name="scope">Which statuses to keep.</param>
    /// <param name="status">The one status when <paramref name="scope"/> is <see cref="OrderListScope.One"/>.</param>
    /// <returns>True when the text is blank, <c>active</c>, <c>all</c> or one of the seven status keys.</returns>
    public static bool TryParseStatus(string? text, out OrderListScope scope, out OrderStatus? status)
    {
        status = null;
        var trimmed = text?.Trim();
        if (string.IsNullOrEmpty(trimmed) || string.Equals(trimmed, ActiveKey, StringComparison.OrdinalIgnoreCase))
        {
            scope = OrderListScope.Active;
            return true;
        }

        if (string.Equals(trimmed, AllKey, StringComparison.OrdinalIgnoreCase))
        {
            scope = OrderListScope.All;
            return true;
        }

        scope = OrderListScope.One;
        if (OrderStatusNames.TryParse(trimmed, out var one))
        {
            status = one;
            return true;
        }

        return false;
    }

    /// <summary>Reads the sort part of the query; a blank text is the default, <c>due</c>.</summary>
    /// <param name="text">The text sent by the browser.</param>
    /// <param name="sort">The sort.</param>
    /// <returns>True when the text is blank or one of due, newest, balance or total.</returns>
    public static bool TryParseSort(string? text, out OrderListSort sort)
    {
        var trimmed = text?.Trim();
        sort = OrderListSort.Due;
        if (string.IsNullOrEmpty(trimmed))
        {
            return true;
        }

        foreach (var known in Enum.GetValues<OrderListSort>())
        {
            if (string.Equals(trimmed, known.ToString(), StringComparison.OrdinalIgnoreCase))
            {
                sort = known;
                return true;
            }
        }

        return false;
    }

    /// <summary>Reads a product type id in dashed form, ignoring spaces around it.</summary>
    /// <param name="text">The text sent by the browser.</param>
    /// <param name="id">The id when the text is a dashed id.</param>
    /// <returns>True when the text is a non-empty dashed id.</returns>
    public static bool TryParseProductType(string? text, out Guid id)
    {
        id = Guid.Empty;
        return text is not null && Guid.TryParseExact(text.Trim(), "D", out id) && id != Guid.Empty;
    }

    private static void CheckFrom(string? from, ValidationContext<ListOrdersRequest> context)
    {
        if (!string.IsNullOrWhiteSpace(from) && !OrderDetailsFieldsValidator.TryParseDate(from, out _))
        {
            context.AddFailure(OrderRules.DateInvalid);
        }
    }

    private static void CheckTo(string? to, ValidationContext<ListOrdersRequest> context)
    {
        if (string.IsNullOrWhiteSpace(to))
        {
            return;
        }

        if (!OrderDetailsFieldsValidator.TryParseDate(to, out var end))
        {
            context.AddFailure(OrderRules.DateInvalid);
            return;
        }

        if (OrderDetailsFieldsValidator.TryParseDate(context.InstanceToValidate.From, out var start) && end < start)
        {
            context.AddFailure(DatesOrder);
        }
    }
}

using Csps.Application.Common;
using Csps.Application.Users;
using Csps.Domain.Expenses;
using FluentValidation;

namespace Csps.Application.Expenses;

/// <summary>
/// Checks the expense list query (SEC-03, WEB-10): the page size and search use the shared list caps, the page is 1 to 100000, the
/// category is a dashed id, and the dates are real <c>yyyy-MM-dd</c> days sent as a pair with the start on or before the end.
/// </summary>
public sealed class ListCompanyExpensesRequestValidator : AbstractValidator<ListCompanyExpensesRequest>
{
    /// <summary>The highest page number accepted, so the row offset can never overflow.</summary>
    public const int MaxPage = ListUsersRequestValidator.MaxPage;

    /// <summary>The message for a page outside the range.</summary>
    public const string PageInvalid = ListUsersRequestValidator.PageInvalid;

    /// <summary>The message for a category that is not an id.</summary>
    public const string CategoryInvalid = "Choose a category from the list.";

    /// <summary>The message for a date that is not a real day.</summary>
    public const string DateInvalid = "Enter a real date.";

    /// <summary>The message when only one of the two dates is sent.</summary>
    public const string DatesPair = "Enter both dates, or neither.";

    /// <summary>The message when the start date is after the end date.</summary>
    public const string DatesOrder = "The start date must be on or before the end date.";

    /// <summary>Creates the validator.</summary>
    public ListCompanyExpensesRequestValidator()
    {
        RuleFor(request => request.Q).SearchText();
        RuleFor(request => request.PageSize).PageSize();
        RuleFor(request => request.Page).InclusiveBetween(1, MaxPage).WithMessage(PageInvalid);
        RuleFor(request => request.Category)
            .Must(static category => string.IsNullOrWhiteSpace(category) || TryParseCategory(category, out _))
            .WithMessage(CategoryInvalid);
        RuleFor(request => request.From).Custom(CheckFrom);
        RuleFor(request => request.To).Custom(CheckTo);
    }

    /// <summary>Reads a category id in dashed form, ignoring spaces around it.</summary>
    /// <param name="text">The text sent by the browser.</param>
    /// <param name="id">The id when the text is a dashed id.</param>
    /// <returns>True when the text is a non-empty dashed id.</returns>
    public static bool TryParseCategory(string? text, out Guid id)
    {
        id = Guid.Empty;
        return text is not null && Guid.TryParseExact(text.Trim(), "D", out id) && id != Guid.Empty;
    }

    private static void CheckFrom(string? from, ValidationContext<ListCompanyExpensesRequest> context)
    {
        var request = context.InstanceToValidate;
        if (string.IsNullOrWhiteSpace(from))
        {
            if (!string.IsNullOrWhiteSpace(request.To))
            {
                context.AddFailure(DatesPair);
            }

            return;
        }

        if (!CreateCompanyExpenseRequestValidator.TryParseDate(from, out var start))
        {
            context.AddFailure(DateInvalid);
            return;
        }

        if (CreateCompanyExpenseRequestValidator.TryParseDate(request.To, out var end) && start > end)
        {
            context.AddFailure(DatesOrder);
        }
    }

    private static void CheckTo(string? to, ValidationContext<ListCompanyExpensesRequest> context)
    {
        if (string.IsNullOrWhiteSpace(to))
        {
            if (!string.IsNullOrWhiteSpace(context.InstanceToValidate.From))
            {
                context.AddFailure(DatesPair);
            }

            return;
        }

        if (!CreateCompanyExpenseRequestValidator.TryParseDate(to, out _))
        {
            context.AddFailure(DateInvalid);
        }
    }
}

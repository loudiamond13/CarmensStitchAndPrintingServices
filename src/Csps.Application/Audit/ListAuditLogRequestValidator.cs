using Csps.Application.Common;
using FluentValidation;

namespace Csps.Application.Audit;

/// <summary>Checks the audit-log query: the page and the page size follow the shared list rules (SEC-03).</summary>
public sealed class ListAuditLogRequestValidator : AbstractValidator<ListAuditLogRequest>
{
    /// <summary>The highest page number accepted, so the row offset can never overflow.</summary>
    public const int MaxPage = 100_000;

    /// <summary>The message for a page outside the range.</summary>
    public const string PageInvalid = "Use a page from 1 to 100000.";

    /// <summary>Creates the validator.</summary>
    public ListAuditLogRequestValidator()
    {
        RuleFor(request => request.PageSize).PageSize();
        RuleFor(request => request.Page).InclusiveBetween(1, MaxPage).WithMessage(PageInvalid);
    }
}

using System.Globalization;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using FluentValidation;

namespace Csps.Application.Audit;

/// <summary>
/// Checks the audit-log query (the server half of OR-3). Dates are real calendar days inside the kept window and not in the future;
/// the actor and target are user ids (the actor may be <c>system</c>); the action is a known code; the page and size follow the shared
/// list rules (SEC-03).
/// </summary>
public sealed class ListAuditLogRequestValidator : AbstractValidator<ListAuditLogRequest>
{
    /// <summary>The highest page number accepted, so the row offset can never overflow.</summary>
    public const int MaxPage = 100_000;

    /// <summary>The message for a page outside the range.</summary>
    public const string PageInvalid = "Use a page from 1 to 100000.";

    /// <summary>The message for a date that is not a real calendar day.</summary>
    public const string DateInvalid = "Enter a real date.";

    /// <summary>The message for a start date after the end date.</summary>
    public const string RangeOrderInvalid = "The start date must be on or before the end date.";

    /// <summary>The message for an actor or target that is not a user id.</summary>
    public const string PersonInvalid = "Choose a person from the list.";

    /// <summary>The message for an action that is not a known code.</summary>
    public const string ActionInvalid = "Choose an action from the list.";

    /// <summary>Creates the validator.</summary>
    /// <param name="calendar">The business calendar: today and the start of the kept window.</param>
    public ListAuditLogRequestValidator(IBusinessCalendar calendar)
    {
        ArgumentNullException.ThrowIfNull(calendar);

        RuleFor(request => request.PageSize).PageSize();
        RuleFor(request => request.Page).InclusiveBetween(1, MaxPage).WithMessage(PageInvalid);
        RuleFor(request => request.Actor)
            .Must(static actor => AuditLogFilters.IsBlank(actor) || actor == AuditLogFilters.SystemActor || AuditLogFilters.TryParseId(actor, out _))
            .WithMessage(PersonInvalid);
        RuleFor(request => request.Target)
            .Must(static target => AuditLogFilters.IsBlank(target) || AuditLogFilters.TryParseId(target, out _))
            .WithMessage(PersonInvalid);
        RuleFor(request => request.Action)
            .Must(static action => AuditLogFilters.IsBlank(action) || AuditActions.All.Contains(action!))
            .WithMessage(ActionInvalid);
        RuleFor(request => request).CustomAsync((request, context, cancellationToken) => CheckDatesAsync(calendar, request, context, cancellationToken));
    }

    private static async Task CheckDatesAsync(
        IBusinessCalendar calendar, ListAuditLogRequest request, ValidationContext<ListAuditLogRequest> context, CancellationToken cancellationToken)
    {
        var hasFrom = !AuditLogFilters.IsBlank(request.From);
        var hasTo = !AuditLogFilters.IsBlank(request.To);
        var fromReal = AuditLogFilters.TryParseDay(request.From, out var from);
        var toReal = AuditLogFilters.TryParseDay(request.To, out var to);
        if (hasFrom && !fromReal)
        {
            context.AddFailure(nameof(ListAuditLogRequest.From), DateInvalid);
        }

        if (hasTo && !toReal)
        {
            context.AddFailure(nameof(ListAuditLogRequest.To), DateInvalid);
        }

        if (!fromReal && !toReal)
        {
            return;
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var floor = clock.Today.AddMonths(-AuditRetention.Months);
        var window = $"Choose a date from {floor.ToString("MMM d, yyyy", CultureInfo.InvariantCulture)} to today.";
        var fromInWindow = fromReal && from >= floor && from <= clock.Today;
        var toInWindow = toReal && to >= floor && to <= clock.Today;
        if (fromReal && !fromInWindow)
        {
            context.AddFailure(nameof(ListAuditLogRequest.From), window);
        }

        if (toReal && !toInWindow)
        {
            context.AddFailure(nameof(ListAuditLogRequest.To), window);
        }

        if (fromInWindow && toInWindow && from > to)
        {
            context.AddFailure(nameof(ListAuditLogRequest.From), RangeOrderInvalid);
        }
    }
}

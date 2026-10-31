using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Time;
using FluentValidation;

namespace Csps.Application.Audit;

/// <summary>
/// Use case: a Manager reads the audit log (AUDIT-02, D-26). With no dates the range is today and the 6 business days before it. Every
/// event is listed (D-28). The log is read only and there is no export (D-29).
/// </summary>
public sealed class ListAuditLogHandler(IAuditLogReader reader, IBusinessCalendar calendar, IValidator<ListAuditLogRequest> validator)
{
    private const int DefaultDays = 7;

    /// <summary>Lists one page of audit entries, newest first.</summary>
    /// <param name="request">The query.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The page, or a 400 naming the bad fields.</returns>
    public async Task<Result<AuditLogResponse>> HandleAsync(ListAuditLogRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<AuditLogResponse>(ValidationResults.ToError(validation, AuthErrors.ValidationCode, AuthErrors.ValidationMessage));
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var (start, end) = RangeOf(request, clock);
        var query = new AuditLogQuery(
            start,
            end,
            ActorOf(request.Actor),
            AuditLogFilters.IsBlank(request.Action) ? null : request.Action,
            AuditLogFilters.TryParseId(request.Target, out var target) ? target : null,
            request.Page,
            request.PageSize);

        var page = await reader.ListAsync(query, cancellationToken).ConfigureAwait(false);
        IReadOnlyList<AuditLogItem> items = [.. page.Items.Select(Map)];
        return Result.Success(new AuditLogResponse(items, page.Total, request.Page, request.PageSize));
    }

    // Both dates: as given. Neither: the last 7 business days. Only a start: up to today. Only an end: from the start of the kept window.
    // The validator has checked the dates, but its clock read was earlier than this one, so a start can never end up after the end.
    private static (DateTimeOffset StartUtc, DateTimeOffset EndUtcExclusive) RangeOf(ListAuditLogRequest request, BusinessClock clock)
    {
        var hasFrom = AuditLogFilters.TryParseDay(request.From, out var fromDay);
        var hasTo = AuditLogFilters.TryParseDay(request.To, out var toDay);
        var to = hasTo ? toDay : clock.Today;
        var from = hasFrom ? fromDay : hasTo ? clock.Today.AddMonths(-AuditRetention.Months) : clock.Today.AddDays(1 - DefaultDays);
        return clock.UtcRange(from <= to ? from : to, to);
    }

    private static AuditActorFilter? ActorOf(string? actor) =>
        AuditLogFilters.IsBlank(actor) ? null
        : actor == AuditLogFilters.SystemActor ? new AuditActorFilter(null)
        : new AuditActorFilter(Guid.ParseExact(actor!, "D"));

    private static AuditLogItem Map(AuditLogEntryView entry) =>
        new(
            entry.Id,
            entry.OccurredAt,
            DoneByOf(entry),
            entry.Action,
            entry.Target,
            entry.Detail,
            NetworkOf(entry.IpPrefix),
            entry.Device,
            entry.Reference,
            entry.Changes,
            entry.Snapshot,
            entry.OrderSnapshot,
            entry.OrderNumber);

    // The stored prefix is the network address; the viewer shows it with its length, /24 for IPv4 and /48 for IPv6 (D-24).
    private static string? NetworkOf(string? prefix) =>
        prefix is null ? null : prefix.Contains(':', StringComparison.Ordinal) ? prefix + "/48" : prefix + "/24";

    // The signed-in actor; for an anonymous self-service event the person it is about; a failed sign-in with no account is an unknown
    // account; anything else was the system.
    private static DoneBy DoneByOf(AuditLogEntryView entry)
    {
        if (entry.Actor is { } actor)
        {
            return new DoneBy(DoneByKinds.User, actor);
        }

        if (AuditActions.SelfService.Contains(entry.Action))
        {
            if (entry.Target is { } subject)
            {
                return new DoneBy(DoneByKinds.User, subject);
            }

            if (entry.Action == AuditActions.SignInFailed && entry.TargetType is null)
            {
                return new DoneBy(DoneByKinds.UnknownAccount, null);
            }
        }

        return new DoneBy(DoneByKinds.System, null);
    }
}

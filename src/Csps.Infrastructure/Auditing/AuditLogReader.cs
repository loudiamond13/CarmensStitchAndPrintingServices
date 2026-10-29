using Csps.Application.Audit;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Domain.OrderLists;
using Csps.Infrastructure.Common;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Auditing;

/// <summary>
/// <see cref="IAuditLogReader"/> over the audit table: untracked LINQ reads only, so the viewer can never change the append-only log
/// (T-05-86). A page is read newest first, then the people it names are read from their own rows in one lookup each.
/// </summary>
/// <param name="context">The scoped database context.</param>
internal sealed class AuditLogReader(CspsDbContext context) : IAuditLogReader
{
    private const string UserTarget = "User";
    private const string SessionTarget = "UserSession";
    private const string OrderTarget = "Order";
    private const string SoftDeleteFilter = "SoftDelete";
    private const string ExpenseActionPrefix = "company-expense.";
    private const string OrderPaymentActionPrefix = "order-payment.";
    private const string OrderRefundActionPrefix = "order-refund.";
    private const string OrderExpenseActionPrefix = "order-expense.";

    public async Task<AuditLogPage> ListAsync(AuditLogQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        var matches = await FilterAsync(query, cancellationToken).ConfigureAwait(false);
        var total = await matches.CountAsync(cancellationToken).ConfigureAwait(false);

        var rows = await matches
            .OrderByDescending(entry => entry.OccurredAtUtc)
            .ThenByDescending(entry => entry.Id)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(entry => new
            {
                entry.Id,
                entry.OccurredAtUtc,
                entry.ActorUserId,
                entry.Action,
                entry.TargetType,
                entry.TargetId,
                entry.Detail,
                entry.IpPrefix,
                entry.UserAgentFamily,
                entry.CorrelationId,
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        // A session target names its owner, so look the owners up first.
        var sessionIds = rows
            .Where(row => row.TargetType == SessionTarget)
            .Select(row => ParseId(row.TargetId))
            .OfType<Guid>()
            .Distinct()
            .ToList();
        var sessionOwners = sessionIds.Count == 0
            ? []
            : await context.UserSessions
                .AsNoTracking()
                .Where(session => sessionIds.Contains(session.Id))
                .Select(session => new { session.Id, session.UserId })
                .ToDictionaryAsync(session => session.Id, session => session.UserId, cancellationToken)
                .ConfigureAwait(false);

        Guid? TargetUser(string? targetType, string? targetId) => targetType switch
        {
            UserTarget => ParseId(targetId),
            SessionTarget when ParseId(targetId) is { } sessionId && sessionOwners.TryGetValue(sessionId, out var owner) => owner,
            _ => null,
        };

        // Expense and category details are read into typed lines; the payers and categories they name are looked up once for the page.
        var parsed = rows.Select(row => AuditChangeLines.For(row.Action, row.Detail)).ToList();
        var categoryIds = parsed.SelectMany(changes => changes.CategoryIds()).Distinct().ToList();
        IReadOnlyDictionary<Guid, string> categories = categoryIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await context.ExpenseCategories
                .AsNoTracking()
                .Where(category => categoryIds.Contains(category.Id))
                .Select(category => new { category.Id, category.Name })
                .ToDictionaryAsync(category => category.Id, category => category.Name, cancellationToken)
                .ConfigureAwait(false);

        // The order list entries the lines name, retired ones included, one lookup per list that is named at all.
        var lists = new AuditListNames(
            await NamesAsync(context.ProductTypes, [.. parsed.SelectMany(changes => changes.ProductTypeIds()).Distinct()], cancellationToken).ConfigureAwait(false),
            await NamesAsync(context.PaymentMethods, [.. parsed.SelectMany(changes => changes.PaymentMethodIds()).Distinct()], cancellationToken).ConfigureAwait(false),
            await NamesAsync(context.OrderExpenseCategories, [.. parsed.SelectMany(changes => changes.OrderCategoryIds()).Distinct()], cancellationToken).ConfigureAwait(false));

        // An order entry names its order; the order is looked up once for the page, deleted orders included. A row that is gone leaves
        // the number the entry's own detail holds.
        var orderIds = rows
            .Where(row => row.TargetType == OrderTarget)
            .Select(row => ParseId(row.TargetId))
            .OfType<Guid>()
            .Distinct()
            .ToList();
        var orderNumbers = orderIds.Count == 0
            ? []
            : await context.Orders
                .AsNoTracking()
                .IgnoreQueryFilters([SoftDeleteFilter])
                .Where(order => orderIds.Contains(order.Id))
                .Select(order => new { order.Id, order.Number })
                .ToDictionaryAsync(order => order.Id, order => order.Number, cancellationToken)
                .ConfigureAwait(false);

        var personIds = rows
            .SelectMany(row => new[] { row.ActorUserId, TargetUser(row.TargetType, row.TargetId) })
            .OfType<Guid>()
            .Concat(parsed.SelectMany(changes => changes.PersonIds()))
            .Distinct()
            .ToList();
        var people = personIds.Count == 0
            ? []
            : await context.Users
                .AsNoTracking()
                .Where(user => personIds.Contains(user.Id))
                .Select(user => new { user.Id, user.FirstName, user.LastName, Former = user.DeletedAtUtc != null })
                .ToDictionaryAsync(user => user.Id, cancellationToken)
                .ConfigureAwait(false);

        ActorRef? PersonOf(Guid? id) =>
            id is { } known && people.TryGetValue(known, out var person)
                ? new ActorRef(person.Id, $"{person.FirstName} {person.LastName}", person.Former)
                : null;

        IReadOnlyList<AuditLogEntryView> items =
        [
            .. rows.Select((row, index) =>
            {
                var (changes, snapshot) = AuditChangeLines.Resolve(parsed[index], categories, PersonOf, lists);
                var orderNumber = row.TargetType != OrderTarget
                    ? null
                    : ParseId(row.TargetId) is { } orderId && orderNumbers.TryGetValue(orderId, out var stored) ? stored : parsed[index].OrderNumber;
                return new AuditLogEntryView(
                    row.Id,
                    row.OccurredAtUtc,
                    PersonOf(row.ActorUserId),
                    row.Action,
                    row.TargetType,
                    PersonOf(TargetUser(row.TargetType, row.TargetId) ?? parsed[index].PayerId),
                    row.Detail,
                    row.IpPrefix,
                    row.UserAgentFamily,
                    row.CorrelationId,
                    changes,
                    snapshot,
                    parsed[index].OrderSnapshot,
                    orderNumber);
            }),
        ];
        return new AuditLogPage(items, total);
    }

    public async Task<IReadOnlyList<AuditPerson>> ListPeopleAsync(CancellationToken cancellationToken)
    {
        // Current staff first, then former staff; each group by name. Only names and ids leave the database.
        // D-37: the Legacy / unassigned holder is not someone to filter by.
        var rows = await context.Users
            .AsNoTracking()
            .Where(user => user.Id != LegacyHolder.Id)
            .OrderBy(user => user.DeletedAtUtc != null)
            .ThenBy(user => user.FirstName)
            .ThenBy(user => user.LastName)
            .ThenBy(user => user.Id)
            .Select(user => new { user.Id, user.FirstName, user.LastName, Former = user.DeletedAtUtc != null })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        return [.. rows.Select(row => new AuditPerson(row.Id, $"{row.FirstName} {row.LastName}", row.Former))];
    }

    // The current names of the listed entries; no query at all when none is named.
    private static async Task<IReadOnlyDictionary<Guid, string>> NamesAsync<TEntry>(
        IQueryable<TEntry> entries, List<Guid> ids, CancellationToken cancellationToken)
        where TEntry : OrderListEntry =>
        ids.Count == 0
            ? new Dictionary<Guid, string>()
            : await entries
                .AsNoTracking()
                .Where(entry => ids.Contains(entry.Id))
                .Select(entry => new { entry.Id, entry.Name })
                .ToDictionaryAsync(entry => entry.Id, entry => entry.Name, cancellationToken)
                .ConfigureAwait(false);

    // Applies the range and the three filters in SQL, before any paging.
    private async Task<IQueryable<AuditEntry>> FilterAsync(AuditLogQuery query, CancellationToken cancellationToken)
    {
        var matches = context.AuditLog
            .AsNoTracking()
            .Where(entry => entry.OccurredAtUtc >= query.StartUtc && entry.OccurredAtUtc < query.EndUtcExclusive);

        if (query.Action is { } action)
        {
            matches = matches.Where(entry => entry.Action == action);
        }

        // The codes a person causes without a token: their entries have no actor, so they are matched by the person they are about.
        List<string> selfService = [.. AuditActions.SelfService];

        if (query.Target is { } target)
        {
            var targetKey = AuditKey.Of(target);
            var targetSessions = await SessionKeysAsync(target, cancellationToken).ConfigureAwait(false);

            // An expense event is about its payer, and an order payment, refund, expense or permanent delete about its receiver, refunder
            // or payer: the detail names that person's id, as the current, old or new one or in the delete's people lists.
            var payerPattern = LikePattern.Contains(targetKey);
            matches = matches.Where(entry =>
                (entry.TargetType == UserTarget && entry.TargetId == targetKey)
                || (entry.TargetType == SessionTarget && entry.TargetId != null && targetSessions.Contains(entry.TargetId))
                || ((entry.Action.StartsWith(ExpenseActionPrefix)
                        || entry.Action.StartsWith(OrderPaymentActionPrefix)
                        || entry.Action.StartsWith(OrderRefundActionPrefix)
                        || entry.Action.StartsWith(OrderExpenseActionPrefix)
                        || entry.Action == AuditActions.OrderPermanentlyDeleted)
                    && entry.Detail != null
                    && EF.Functions.Like(entry.Detail, payerPattern, LikePattern.EscapeCharacter)));
        }

        if (query.Actor is { UserId: { } actorId })
        {
            var actorKey = AuditKey.Of(actorId);
            var actorSessions = await SessionKeysAsync(actorId, cancellationToken).ConfigureAwait(false);
            matches = matches.Where(entry =>
                entry.ActorUserId == actorId
                || (entry.ActorUserId == null
                    && selfService.Contains(entry.Action)
                    && ((entry.TargetType == UserTarget && entry.TargetId == actorKey)
                        || (entry.TargetType == SessionTarget && entry.TargetId != null && actorSessions.Contains(entry.TargetId)))));
        }
        else if (query.Actor is not null)
        {
            // The system: no actor, and not a self-service step that names a person or an unknown account (a failed sign-in with no target).
            matches = matches.Where(entry =>
                entry.ActorUserId == null
                && !(selfService.Contains(entry.Action) && (entry.TargetType != null || entry.Action == AuditActions.SignInFailed)));
        }

        return matches;
    }

    // The ids of a person's sessions in the form audit targets use, so their session events can be matched by target id.
    private async Task<List<string>> SessionKeysAsync(Guid userId, CancellationToken cancellationToken)
    {
        var ids = await context.UserSessions
            .AsNoTracking()
            .Where(session => session.UserId == userId)
            .Select(session => session.Id)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        return [.. ids.Select(AuditKey.Of)];
    }

    // Target ids are written as lower-case "D" text (AuditKey.Of); anything else names no one.
    private static Guid? ParseId(string? text) =>
        Guid.TryParseExact(text, "D", out var id) ? id : null;
}

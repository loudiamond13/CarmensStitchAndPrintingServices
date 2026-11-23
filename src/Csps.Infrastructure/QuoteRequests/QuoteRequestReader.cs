using Csps.Application.Ports;
using Csps.Application.Users;
using Csps.Domain.QuoteRequests;
using Csps.Infrastructure.Common;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.QuoteRequests;

/// <summary><see cref="IQuoteRequestReader"/> over EF: untracked reads, no raw SQL.</summary>
internal sealed class QuoteRequestReader(CspsDbContext context) : IQuoteRequestReader
{
    // New, Contacted and Quoted; listed by name so the group never depends on the enum order.
    private static readonly QuoteRequestStatus[] OpenStatuses = [QuoteRequestStatus.New, QuoteRequestStatus.Contacted, QuoteRequestStatus.Quoted];

    public async Task<QuoteRequestListPage> ListAsync(QuoteRequestListQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        var matches = Filter(context.QuoteRequests.AsNoTracking(), query);

        // Command 1: the count over every page. Command 2: the page, newest received first and ending on the id so paging is stable.
        var total = await matches.CountAsync(cancellationToken).ConfigureAwait(false);
        var rows = await matches
            .OrderByDescending(request => request.CreatedAtUtc)
            .ThenByDescending(request => request.Id)
            .Skip((query.Page - 1) * query.Size)
            .Take(query.Size)
            .Select(request => new QuoteRequestListRow(
                request.Id,
                request.CreatedAtUtc,
                request.CustomerName,
                request.TeamName,
                request.ContactNumberE164,
                request.ProductChoice,
                request.ProductTitle,
                request.QuantityRange,
                request.Photos.Count,
                request.Photos.Count(photo => photo.PublicId != null),
                false, // Nothing removes photos until the Spam move (plan 13-16) adds the column this reads.
                request.Status))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        // Command 3: the pill counts, one grouped query over the status that ignores the search and the page.
        var byStatus = await context.QuoteRequests.AsNoTracking()
            .GroupBy(request => request.Status)
            .Select(group => new { Status = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        return new QuoteRequestListPage(rows, total, ToCounts(byStatus.ToDictionary(static row => row.Status, static row => row.Count)));
    }

    public Task<int> CountNewAsync(CancellationToken cancellationToken) =>
        context.QuoteRequests.AsNoTracking().CountAsync(request => request.Status == QuoteRequestStatus.New, cancellationToken);

    // Three commands: the request with its last changer, the photo places, and the history with each mover's current name, so a rename
    // shows at once and a removed person keeps their name.
    public async Task<QuoteRequestDetailView?> GetDetailAsync(Guid id, CancellationToken cancellationToken)
    {
        var header = await (
            from request in context.QuoteRequests.AsNoTracking()
            where request.Id == id
            join changerUser in context.Users on request.UpdatedById equals (Guid?)changerUser.Id into changers
            from changer in changers.DefaultIfEmpty()
            select new
            {
                Request = request,
                ChangerId = (Guid?)changer.Id,
                ChangerFirst = (string?)changer.FirstName,
                ChangerLast = (string?)changer.LastName,
                ChangerFormer = changer.DeletedAtUtc != null,
            })
            .SingleOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);
        if (header is null)
        {
            return null;
        }

        var photos = await context.QuoteRequestPhotos.AsNoTracking()
            .Where(photo => photo.QuoteRequestId == id)
            .OrderBy(photo => photo.Slot)
            .Select(photo => new QuoteRequestPhotoRow(photo.Slot, photo.FileName, photo.PublicId, photo.Width, photo.Height))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var moves = await (
            from change in context.QuoteRequestStatusChanges.AsNoTracking()
            where change.QuoteRequestId == id
            join actorUser in context.Users on change.ChangedById equals (Guid?)actorUser.Id into actors
            from actor in actors.DefaultIfEmpty()
            orderby change.ChangedAtUtc descending, change.Id descending
            select new
            {
                change.FromStatus,
                change.ToStatus,
                change.ChangedAtUtc,
                ActorId = (Guid?)actor.Id,
                ActorFirst = (string?)actor.FirstName,
                ActorLast = (string?)actor.LastName,
                ActorFormer = actor.DeletedAtUtc != null,
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var row = header.Request;
        return new QuoteRequestDetailView(
            row.Id,
            row.CreatedAtUtc,
            row.CustomerName,
            row.TeamName,
            row.ContactNumberE164,
            row.Email,
            row.ProductChoice,
            row.ProductTitle,
            row.QuantityRange,
            row.Message,
            row.Status,
            row.StatusChangedAtUtc,
            photos,
            row.PhotosRemovedAtUtc,
            [
                .. moves.Select(move => new QuoteRequestHistoryRow(
                    move.FromStatus,
                    move.ToStatus,
                    move.ActorId is { } actorId && move.ActorFirst is not null
                        ? new ActorRef(actorId, $"{move.ActorFirst} {move.ActorLast}", move.ActorFormer)
                        : null,
                    move.ChangedAtUtc)),
            ],
            header.ChangerId is { } changerId && header.ChangerFirst is not null
                ? new ActorRef(changerId, $"{header.ChangerFirst} {header.ChangerLast}", header.ChangerFormer)
                : null,
            row.UpdatedAtUtc,
            row.RowVersion);
    }

    private static QuoteRequestCounts ToCounts(Dictionary<QuoteRequestStatus, int> byStatus)
    {
        int Of(QuoteRequestStatus status) => byStatus.GetValueOrDefault(status);
        var open = OpenStatuses.Sum(Of);
        return new QuoteRequestCounts(
            open,
            Of(QuoteRequestStatus.Converted),
            Of(QuoteRequestStatus.Closed),
            Of(QuoteRequestStatus.Spam),
            byStatus.Values.Sum());
    }

    // The status group and the search. A typed wildcard stays literal (CWE-943). The phone is matched on its digits inside the E.164 text.
    private static IQueryable<QuoteRequest> Filter(IQueryable<QuoteRequest> requests, QuoteRequestListQuery query)
    {
        requests = query.Group switch
        {
            QuoteRequestGroup.Converted => requests.Where(request => request.Status == QuoteRequestStatus.Converted),
            QuoteRequestGroup.Closed => requests.Where(request => request.Status == QuoteRequestStatus.Closed),
            QuoteRequestGroup.Spam => requests.Where(request => request.Status == QuoteRequestStatus.Spam),
            QuoteRequestGroup.All => requests,
            _ => requests.Where(request => OpenStatuses.Contains(request.Status)),
        };

        if (query.Search is not { } search)
        {
            return requests;
        }

        var pattern = LikePattern.Contains(search);
        if (query.PhoneDigits is { } digits)
        {
            return requests.Where(request =>
                EF.Functions.Like(request.CustomerName, pattern, LikePattern.EscapeCharacter)
                || EF.Functions.Like(request.TeamName, pattern, LikePattern.EscapeCharacter)
                || request.ContactNumberE164.Contains(digits));
        }

        return requests.Where(request =>
            EF.Functions.Like(request.CustomerName, pattern, LikePattern.EscapeCharacter)
            || EF.Functions.Like(request.TeamName, pattern, LikePattern.EscapeCharacter));
    }
}

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

    private const int DetailReadAttempts = 3;

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
                request.PhotosRemovedAtUtc != null,
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

    // The request and its lists are separate statements, so a status change can land between them. Every move bumps the request's row
    // version, so the version is read again after the lists; when it moved, the request is read again so the status, the photos, the
    // history, the notes and the version come from one save. After the last attempt the latest read is returned, as the order reader does.
    public async Task<QuoteRequestDetailView?> GetDetailAsync(Guid id, CancellationToken cancellationToken)
    {
        QuoteRequestDetailView? view = null;
        for (var attempt = 1; attempt <= DetailReadAttempts; attempt++)
        {
            view = await ReadDetailOnceAsync(id, cancellationToken).ConfigureAwait(false);
            if (view is null)
            {
                return null;
            }

            var current = await context.QuoteRequests.AsNoTracking()
                .Where(request => request.Id == id)
                .Select(request => request.RowVersion)
                .SingleOrDefaultAsync(cancellationToken)
                .ConfigureAwait(false);
            if (current is null)
            {
                return null;
            }

            if (current.AsSpan().SequenceEqual(view.RowVersion))
            {
                return view;
            }
        }

        return view;
    }

    public Task<QuoteOrderPrefillView?> GetOrderPrefillAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult<QuoteOrderPrefillView?>(null);

    // Four commands: the request with its last changer, the photo places, the history with each mover's current name, and the notes
    // with each author's current name, so a rename shows at once and a removed person keeps their name.
    private async Task<QuoteRequestDetailView?> ReadDetailOnceAsync(Guid id, CancellationToken cancellationToken)
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

        var notes = await (
            from note in context.QuoteRequestNotes.AsNoTracking()
            where note.QuoteRequestId == id
            join authorUser in context.Users on note.CreatedById equals authorUser.Id into authors
            from author in authors.DefaultIfEmpty()
            orderby note.CreatedAtUtc descending, note.Id descending
            select new
            {
                note.Id,
                note.Text,
                note.CreatedAtUtc,
                AuthorId = (Guid?)author.Id,
                AuthorFirst = (string?)author.FirstName,
                AuthorLast = (string?)author.LastName,
                AuthorFormer = author.DeletedAtUtc != null,
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
            [
                .. notes.Select(note => new QuoteRequestNoteRow(
                    note.Id,
                    note.Text,
                    note.AuthorId is { } authorId && note.AuthorFirst is not null
                        ? new ActorRef(authorId, $"{note.AuthorFirst} {note.AuthorLast}", note.AuthorFormer)
                        : null,
                    note.CreatedAtUtc)),
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

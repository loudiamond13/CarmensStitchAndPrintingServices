using Csps.Application.Email;

namespace Csps.Application.Ports;

/// <summary>
/// The transactional email outbox (AUTH-13). A handler queues mail in the same unit of work as its business change;
/// the mail is sent only after that commit, and never if the change rolls back.
/// </summary>
public interface IEmailOutbox
{
    /// <summary>
    /// Renders <paramref name="email"/> and adds it to the caller's unit of work. Nothing is saved or sent until the
    /// caller commits (<see cref="IUnitOfWork.SaveChangesAsync"/>).
    /// </summary>
    /// <param name="email">The email to queue.</param>
    /// <param name="cancellationToken">Cancels the rendering.</param>
    /// <returns>A task that completes when the row is added to the unit of work.</returns>
    ValueTask EnqueueAsync(AuthEmail email, CancellationToken cancellationToken);

    /// <summary>Counts the committed emails of one kind to one address since a moment, for per-account email caps.</summary>
    /// <param name="kind">The kind of email.</param>
    /// <param name="toAddress">The recipient address; the comparison ignores case.</param>
    /// <param name="since">The start of the window.</param>
    /// <param name="cancellationToken">Cancels the count.</param>
    /// <returns>How many emails were queued in the window.</returns>
    Task<int> CountRecentAsync(AuthEmailKind kind, string toAddress, DateTimeOffset since, CancellationToken cancellationToken);

    /// <summary>
    /// Forgets a deleted person's old address (IN-08, D-07): every row addressed to <paramref name="oldAddress"/> is readdressed to
    /// <paramref name="replacement"/> with its subject and bodies cleared, and a row still waiting to be sent is expired first, so it is
    /// never sent. Rows are changed on the caller's unit of work; nothing is saved until the caller commits.
    /// </summary>
    /// <param name="oldAddress">The address to forget; the comparison ignores case.</param>
    /// <param name="replacement">The address the rows keep instead.</param>
    /// <param name="now">The current instant, used as the expiry time of rows that had not been sent.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>How many rows were readdressed.</returns>
    Task<int> ScrubRecipientAsync(string oldAddress, string replacement, DateTimeOffset now, CancellationToken cancellationToken);
}

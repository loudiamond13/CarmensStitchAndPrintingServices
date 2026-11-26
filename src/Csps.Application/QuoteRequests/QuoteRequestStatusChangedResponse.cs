namespace Csps.Application.QuoteRequests;

/// <summary>
/// The answer to a status change (D-15). It holds no visitor details or photo addresses, because the idempotency gate keeps it for 24
/// hours where the purge and the delete cannot reach it. The page reads the request again for the history.
/// </summary>
/// <param name="Id">The request id.</param>
/// <param name="Status">The new status key.</param>
/// <param name="StatusChangedAtUtc">When the status changed.</param>
/// <param name="Version">The new row version to send with the next change.</param>
public sealed record QuoteRequestStatusChangedResponse(Guid Id, string Status, DateTimeOffset StatusChangedAtUtc, string Version);

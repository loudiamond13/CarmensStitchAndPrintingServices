using Csps.Application.Common;
using Csps.Application.Users;
using Csps.Domain.Money;

namespace Csps.Application.Money;

/// <summary>One staff money transfer with the people on it, who recorded it and its version (MONEY-04). It never carries a balance.</summary>
/// <param name="Id">The transfer id.</param>
/// <param name="From">The sender; for a hand-over, the former staff member.</param>
/// <param name="To">The recipient.</param>
/// <param name="Amount">The amount in pesos.</param>
/// <param name="TransferDate">The day the money changed hands.</param>
/// <param name="Note">The note; null when none.</param>
/// <param name="IsHandover">True when a Manager recorded it for a former staff member (D-17).</param>
/// <param name="RecordedBy">Who recorded it; null reads as System.</param>
/// <param name="RecordedAtUtc">When it was recorded.</param>
/// <param name="IsDeleted">True once it is in the bin.</param>
/// <param name="DeletedBy">Who deleted it; null while it counts.</param>
/// <param name="DeletedAtUtc">When it was deleted; null while it counts.</param>
/// <param name="Version">The base64 of the eight-byte row version a later change must send back.</param>
public sealed record MoneyTransferResponse(
    Guid Id,
    ActorRef From,
    ActorRef To,
    decimal Amount,
    DateOnly TransferDate,
    string? Note,
    bool IsHandover,
    ActorRef? RecordedBy,
    DateTimeOffset RecordedAtUtc,
    bool IsDeleted,
    ActorRef? DeletedBy,
    DateTimeOffset? DeletedAtUtc,
    string Version)
{
    /// <summary>Builds the response from a saved transfer and the people on it.</summary>
    /// <param name="transfer">The saved transfer.</param>
    /// <param name="from">The sender.</param>
    /// <param name="to">The recipient.</param>
    /// <param name="recordedBy">Who recorded it.</param>
    /// <param name="deletedBy">Who deleted it, when it is deleted.</param>
    /// <returns>The response.</returns>
    public static MoneyTransferResponse Of(MoneyTransfer transfer, ActorRef from, ActorRef to, ActorRef? recordedBy, ActorRef? deletedBy)
    {
        ArgumentNullException.ThrowIfNull(transfer);
        ArgumentNullException.ThrowIfNull(from);
        ArgumentNullException.ThrowIfNull(to);
        return new MoneyTransferResponse(
            transfer.Id,
            from,
            to,
            transfer.Amount,
            transfer.TransferDate,
            transfer.Note,
            transfer.IsHandover,
            recordedBy,
            transfer.CreatedAtUtc,
            transfer.IsDeleted,
            deletedBy,
            transfer.DeletedAtUtc,
            RowVersions.ToText(transfer.RowVersion));
    }
}

/// <summary>A saved transfer and the sender's new money on hand. The recipient's balance is never in the answer (OD-19, D-49).</summary>
/// <param name="Transfer">The saved transfer.</param>
/// <param name="SenderBalance">The sender's money on hand after the transfer.</param>
public sealed record MoneyTransferSavedResponse(MoneyTransferResponse Transfer, decimal SenderBalance);

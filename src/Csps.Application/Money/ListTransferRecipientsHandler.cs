using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Users;
using Csps.Domain.Common;
using Csps.Domain.Money;

namespace Csps.Application.Money;

/// <summary>
/// Use case: either role reads who may receive a transfer (D-19, D-49, D-56). Every active Admin and Manager is offered, a
/// Manager-locked or not-yet-set-up one included, then every deactivated or deleted one who is owed money. The answer holds names
/// and status words only; the leavers' balances are read to choose them and never leave this handler.
/// </summary>
public sealed class ListTransferRecipientsHandler(IStaffMoneyReader reader, IRequestContext requestContext)
{
    /// <summary>Lists the people the transfer window may offer.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The people, active ones first and then the owed leavers, each group by first name, last name, then id; or a 401 when the token names no account.</returns>
    public async Task<Result<IReadOnlyList<TransferRecipientResponse>>> HandleAsync(CancellationToken cancellationToken)
    {
        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure<IReadOnlyList<TransferRecipientResponse>>(AuthErrors.SessionEnded);
        }

        // The reader returns the people already sorted, and the splits below keep that order.
        var people = await reader.ListStaffPeopleAsync(cancellationToken).ConfigureAwait(false);
        var current = people.Where(person => StatusOf(person) is MoneyPartyStatus.Active).ToList();
        var former = people.Where(person => StatusOf(person) is MoneyPartyStatus.Deactivated or MoneyPartyStatus.Deleted).ToList();
        var sums = former.Count == 0
            ? []
            : await reader.GetSumsAsync([.. former.Select(person => person.Id)], cancellationToken).ConfigureAwait(false);

        IReadOnlyList<TransferRecipientResponse> offered =
        [
            .. current.Select(person => new TransferRecipientResponse(person.Id, person.Name, TransferRecipientResponse.ActiveStatus, person.Id == callerId)),
            .. former
                .Where(person => (sums.FirstOrDefault(row => row.UserId == person.Id)?.Balance() ?? 0m) < 0m)
                .Select(person => new TransferRecipientResponse(
                    person.Id,
                    person.Name,
                    StatusOf(person) is MoneyPartyStatus.Deleted ? TransferRecipientResponse.DeletedStatus : TransferRecipientResponse.DeactivatedStatus,
                    person.Id == callerId)),
        ];
        return Result.Success(offered);
    }

    private static MoneyPartyStatus StatusOf(StaffPerson person) => MoneyParties.FromPerson(person, 0m).Status;
}

using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Money;

namespace Csps.Application.Money;

/// <summary>
/// Use case: a Manager reads what every staff member holds (MONEY-03, D-42 to D-44, D-56). Every active Admin and Manager is listed, a
/// Manager-locked or not-yet-set-up one included, by name; then every deactivated or deleted one whose balance is not 0.00, by name.
/// The legacy holder and accounts with no staff role never appear. Only Managers reach this handler; the route's policy enforces that.
/// </summary>
/// <param name="reader">The staff money read port.</param>
/// <param name="requestContext">The signed-in user.</param>
public sealed class ListStaffBalancesHandler(IStaffMoneyReader reader, IRequestContext requestContext)
{
    /// <summary>Lists everyone's money on hand with the total.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The people and the total, or a 401 when the token names no account.</returns>
    public async Task<Result<StaffBalancesResponse>> HandleAsync(CancellationToken cancellationToken)
    {
        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure<StaffBalancesResponse>(AuthErrors.SessionEnded);
        }

        // The reader returns the people already sorted by name; the two groups below keep that order.
        var people = await reader.ListStaffPeopleAsync(cancellationToken).ConfigureAwait(false);
        var sums = people.Count == 0
            ? []
            : await reader.GetSumsAsync([.. people.Select(person => person.Id)], cancellationToken).ConfigureAwait(false);
        var balances = sums.ToDictionary(row => row.UserId, row => row.Balance());

        var parties = people
            .Select(person => (Person: person, Party: MoneyParties.FromPerson(person, balances.GetValueOrDefault(person.Id))))
            .ToList();
        var current = parties.Where(entry => entry.Party.Status is MoneyPartyStatus.Active);
        var former = parties.Where(entry => entry.Party.IsLeaver && entry.Party.Balance != 0m);

        IReadOnlyList<StaffBalanceRow> rows =
        [
            .. current.Concat(former).Select(entry => new StaffBalanceRow(
                entry.Person.Id,
                entry.Person.Name,
                entry.Person.Role,
                MoneyParties.StatusWord(entry.Party.Status),
                entry.Party.Balance,
                entry.Person.Id == callerId)),
        ];
        return Result.Success(new StaffBalancesResponse(rows, rows.Sum(row => row.Balance)));
    }
}

namespace Csps.Application.Money;

/// <summary>Everyone's money on hand and what staff hold together, for a Manager (MONEY-03, D-42 to D-44).</summary>
/// <param name="Items">The people: active Admins and Managers by name, then former staff whose balance is not 0.00 by name.</param>
/// <param name="Total">The sum of the listed balances; below zero when staff are owed more than they hold.</param>
public sealed record StaffBalancesResponse(IReadOnlyList<StaffBalanceRow> Items, decimal Total);

/// <summary>One person's row in the all-staff list.</summary>
/// <param name="UserId">The person.</param>
/// <param name="Name">Their display name, first then last.</param>
/// <param name="Role">Their role, <c>Admin</c> or <c>Manager</c>.</param>
/// <param name="Status">One of <c>active</c>, <c>deactivated</c> or <c>deleted</c>.</param>
/// <param name="Balance">Their money on hand; below zero when they are owed money.</param>
/// <param name="IsYou">True for the signed-in person.</param>
public sealed record StaffBalanceRow(Guid UserId, string Name, string Role, string Status, decimal Balance, bool IsYou);

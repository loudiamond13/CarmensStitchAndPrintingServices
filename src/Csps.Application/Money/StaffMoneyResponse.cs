namespace Csps.Application.Money;

/// <summary>One person's money on hand, worked out on the server on every read (MONEY-01, MONEY-03).</summary>
/// <param name="UserId">The person.</param>
/// <param name="Name">Their display name, first then last.</param>
/// <param name="Role">Their role, <c>Admin</c> or <c>Manager</c>.</param>
/// <param name="Status">One of <c>active</c>, <c>deactivated</c> or <c>deleted</c>.</param>
/// <param name="Balance">Money received plus transfers in, minus transfers out, expenses paid and refunds handed back; below zero when they are owed money.</param>
/// <param name="Today">The business today.</param>
public sealed record StaffMoneyResponse(Guid UserId, string Name, string Role, string Status, decimal Balance, DateOnly Today);

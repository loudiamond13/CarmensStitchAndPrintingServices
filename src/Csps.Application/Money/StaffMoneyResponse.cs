namespace Csps.Application.Money;

/// <summary>One person's money on hand, worked out on the server on every read (MONEY-01).</summary>
/// <param name="UserId">The person.</param>
/// <param name="Name">Their display name, first then last.</param>
/// <param name="Balance">Money received plus transfers in, minus transfers out, expenses paid and refunds handed back; below zero when they are owed money.</param>
/// <param name="Today">The business today.</param>
public sealed record StaffMoneyResponse(Guid UserId, string Name, decimal Balance, DateOnly Today);

namespace Csps.Application.Money;

/// <summary>The audit target type names of the staff money events, written once so the handlers and the log agree.</summary>
public static class MoneyAuditTargets
{
    /// <summary>The target type of a money transfer or hand-over: the entity name.</summary>
    public const string Transfer = "MoneyTransfer";
}

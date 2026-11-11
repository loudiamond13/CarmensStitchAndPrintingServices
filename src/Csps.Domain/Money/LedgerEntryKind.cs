namespace Csps.Domain.Money;

/// <summary>
/// The six kinds of row in a staff member's money ledger (MONEY-02). The numbers are stored in the ledger query and its callers, so
/// they are fixed and never renumbered. There is no value 0.
/// </summary>
public enum LedgerEntryKind
{
    /// <summary>Money received on an order payment; adds to the balance.</summary>
    PaymentReceived = 1,

    /// <summary>Money handed back to a customer on an order refund; takes from the balance.</summary>
    RefundHandedBack = 2,

    /// <summary>Money received from a coworker in a transfer; adds to the balance.</summary>
    TransferIn = 3,

    /// <summary>Money handed to a coworker in a transfer; takes from the balance.</summary>
    TransferOut = 4,

    /// <summary>Money paid for a company expense; takes from the balance.</summary>
    CompanyExpensePaid = 5,

    /// <summary>Money paid for an order expense; takes from the balance.</summary>
    OrderExpensePaid = 6,
}

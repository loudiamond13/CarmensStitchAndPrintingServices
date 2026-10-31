namespace Csps.Domain.Orders;

/// <summary>
/// The seven order statuses (D-01). The numbers are stored data that dashboards, filters and the legacy mapping read, so
/// they are fixed and never renumbered. There is no value 0.
/// </summary>
public enum OrderStatus : byte
{
    /// <summary>Taken but not started.</summary>
    Pending = 1,

    /// <summary>The design mockup is being made or approved.</summary>
    Mockup = 2,

    /// <summary>Being made.</summary>
    InProduction = 3,

    /// <summary>Finished and waiting for the customer.</summary>
    Ready = 4,

    /// <summary>Handed to the customer; a balance may still be owed.</summary>
    Delivered = 5,

    /// <summary>Done and fully settled. An end state: the order is locked.</summary>
    Completed = 6,

    /// <summary>Called off. An end state: the order is locked.</summary>
    Cancelled = 7,
}

/// <summary>What a status change does to the order.</summary>
public enum OrderStatusMove
{
    /// <summary>The order is already in that status; nothing changes.</summary>
    NoChange = 0,

    /// <summary>A normal move.</summary>
    Move = 1,

    /// <summary>The order leaves Completed or Cancelled and unlocks (D-04).</summary>
    Reopen = 2,
}

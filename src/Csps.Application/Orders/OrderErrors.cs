using Csps.Domain.Common;
using Csps.Domain.Orders;

namespace Csps.Application.Orders;

/// <summary>The error values the order use cases return.</summary>
public static class OrderErrors
{
    /// <summary>The machine code of an order form that breaks field rules.</summary>
    public const string ValidationCode = OrderRules.InvalidCode;

    /// <summary>The text above the field errors.</summary>
    public const string ValidationMessage = OrderRules.InvalidMessage;

    /// <summary>The code of an order that does not exist or was deleted.</summary>
    public const string NotFoundCode = "orders.not-found";

    /// <summary>The plain-English text for an order that does not exist or was deleted.</summary>
    public const string NotFoundMessage = "This order was not found or was deleted.";

    /// <summary>The code of a save that could not take the order number lock in time.</summary>
    public const string BusyCode = "orders.busy";

    /// <summary>The plain-English text for a busy order number lock.</summary>
    public const string BusyMessage = "Orders are being saved right now. Try again in a moment.";

    /// <summary>Gets the answer for an order that does not exist or was deleted: a 404 with the same words for both.</summary>
    public static Error NotFound { get; } = Error.NotFound(NotFoundCode, NotFoundMessage);

    /// <summary>Gets the 409 for a lock wait that timed out.</summary>
    public static Error Busy { get; } = Error.Conflict(BusyCode, BusyMessage);
}

using Csps.Application.Users;

namespace Csps.Application.Orders;

/// <summary>A deleted order with every child row, read-only, for a Manager (D-24).</summary>
/// <param name="Order">The order with its items, discounts, payments, refunds, expenses, status history, totals and the business today.</param>
/// <param name="DeletedAt">When it was deleted.</param>
/// <param name="DeletedBy">Who deleted it; null reads as System.</param>
public sealed record DeletedOrderDetailResponse(OrderDetailResponse Order, DateTimeOffset DeletedAt, ActorRef? DeletedBy);

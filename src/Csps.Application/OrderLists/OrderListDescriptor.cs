using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.OrderLists;

namespace Csps.Application.OrderLists;

/// <summary>What the shared list code needs to know about one list (D-19): its route, error codes, messages, audit actions and how an entry is made.</summary>
/// <param name="Kind">Which list.</param>
/// <param name="RouteSegment">The segment after <c>/api/v1/</c>, also the error code prefix.</param>
/// <param name="AuditTargetType">The audit target type of the list's events.</param>
/// <param name="Noun">The singular noun plain-English messages use.</param>
public sealed record OrderListDescriptor(OrderListKind Kind, string RouteSegment, string AuditTargetType, string Noun)
{
    /// <summary>The product types.</summary>
    public static OrderListDescriptor ProductTypes { get; } = new(OrderListKind.ProductType, "product-types", "ProductType", "product type");

    /// <summary>The payment methods.</summary>
    public static OrderListDescriptor PaymentMethods { get; } = new(OrderListKind.PaymentMethod, "payment-methods", "PaymentMethod", "payment method");

    /// <summary>The order expense categories.</summary>
    public static OrderListDescriptor OrderExpenseCategories { get; } = new(OrderListKind.OrderExpenseCategory, "order-expense-categories", "OrderExpenseCategory", "category");

    /// <summary>Gets the machine code of a form that breaks field rules.</summary>
    public string InvalidCode => $"{RouteSegment}.invalid-request";

    /// <summary>Gets the machine code of an entry that does not exist.</summary>
    public string NotFoundCode => $"{RouteSegment}.not-found";

    /// <summary>Gets the plain-English text for an entry that does not exist.</summary>
    public string NotFoundMessage => $"This {Noun} was deleted.";

    /// <summary>Gets the machine code of a delete refused because a row uses the entry.</summary>
    public string InUseCode => $"{RouteSegment}.in-use";

    /// <summary>Gets the plain-English text for a delete refused because a row uses the entry.</summary>
    public string InUseMessage => $"This {Noun} is used by an order, so it can't be deleted. Retire it instead.";

    /// <summary>Gets the audit action of an added entry.</summary>
    public string AddedAction => Kind switch
    {
        OrderListKind.ProductType => AuditActions.ProductTypeAdded,
        OrderListKind.PaymentMethod => AuditActions.PaymentMethodAdded,
        OrderListKind.OrderExpenseCategory => AuditActions.OrderExpenseCategoryAdded,
        _ => throw Unknown(),
    };

    /// <summary>Gets the audit action of a rename.</summary>
    public string RenamedAction => Kind switch
    {
        OrderListKind.ProductType => AuditActions.ProductTypeRenamed,
        OrderListKind.PaymentMethod => AuditActions.PaymentMethodRenamed,
        OrderListKind.OrderExpenseCategory => AuditActions.OrderExpenseCategoryRenamed,
        _ => throw Unknown(),
    };

    /// <summary>Gets the audit action of a recolor.</summary>
    public string RecoloredAction => Kind switch
    {
        OrderListKind.ProductType => AuditActions.ProductTypeRecolored,
        OrderListKind.PaymentMethod => AuditActions.PaymentMethodRecolored,
        OrderListKind.OrderExpenseCategory => AuditActions.OrderExpenseCategoryRecolored,
        _ => throw Unknown(),
    };

    /// <summary>Gets the audit action of a retire.</summary>
    public string RetiredAction => Kind switch
    {
        OrderListKind.ProductType => AuditActions.ProductTypeRetired,
        OrderListKind.PaymentMethod => AuditActions.PaymentMethodRetired,
        OrderListKind.OrderExpenseCategory => AuditActions.OrderExpenseCategoryRetired,
        _ => throw Unknown(),
    };

    /// <summary>Gets the audit action of a reactivation.</summary>
    public string ReactivatedAction => Kind switch
    {
        OrderListKind.ProductType => AuditActions.ProductTypeReactivated,
        OrderListKind.PaymentMethod => AuditActions.PaymentMethodReactivated,
        OrderListKind.OrderExpenseCategory => AuditActions.OrderExpenseCategoryReactivated,
        _ => throw Unknown(),
    };

    /// <summary>Gets the audit action of a delete.</summary>
    public string DeletedAction => Kind switch
    {
        OrderListKind.ProductType => AuditActions.ProductTypeDeleted,
        OrderListKind.PaymentMethod => AuditActions.PaymentMethodDeleted,
        OrderListKind.OrderExpenseCategory => AuditActions.OrderExpenseCategoryDeleted,
        _ => throw Unknown(),
    };

    /// <summary>Gets the descriptor of a list.</summary>
    /// <param name="kind">Which list.</param>
    /// <returns>The descriptor.</returns>
    public static OrderListDescriptor For(OrderListKind kind) => kind switch
    {
        OrderListKind.ProductType => ProductTypes,
        OrderListKind.PaymentMethod => PaymentMethods,
        OrderListKind.OrderExpenseCategory => OrderExpenseCategories,
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown order list."),
    };

    /// <summary>Checks the name and tone and builds a new, active entry of this list.</summary>
    /// <param name="name">The name; required after trimming, at most 40 characters.</param>
    /// <param name="tone">One of the six tones.</param>
    /// <param name="now">The current instant, which makes the key.</param>
    /// <returns>The new, unsaved entry, or a validation error naming the first broken field.</returns>
    public Result<OrderListEntry> CreateEntry(string name, string tone, DateTimeOffset now) => Kind switch
    {
        OrderListKind.ProductType => Widen(ProductType.Create(name, tone, now)),
        OrderListKind.PaymentMethod => Widen(PaymentMethod.Create(name, tone, now)),
        OrderListKind.OrderExpenseCategory => Widen(OrderExpenseCategory.Create(name, tone, now)),
        _ => throw Unknown(),
    };

    private ArgumentOutOfRangeException Unknown() => new(nameof(Kind), Kind, "Unknown order list.");

    private static Result<OrderListEntry> Widen<TEntry>(Result<TEntry> created)
        where TEntry : OrderListEntry =>
        created.IsFailure ? Result.Failure<OrderListEntry>(created.Error) : Result.Success<OrderListEntry>(created.Value);
}

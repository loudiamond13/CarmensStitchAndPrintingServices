using Csps.Domain.OrderLists;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>Maps the order expense categories (D-17) to the <c>OrderExpenseCategories</c> table.</summary>
internal sealed class OrderExpenseCategoryConfiguration() : OrderListEntryConfiguration<OrderExpenseCategory>("OrderExpenseCategories", OrderListSeed.OrderExpenseCategories);

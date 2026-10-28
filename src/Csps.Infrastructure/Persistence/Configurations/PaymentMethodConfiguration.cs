using Csps.Domain.OrderLists;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>Maps the payment methods (D-16) to the <c>PaymentMethods</c> table.</summary>
internal sealed class PaymentMethodConfiguration() : OrderListEntryConfiguration<PaymentMethod>("PaymentMethods", OrderListSeed.PaymentMethods);

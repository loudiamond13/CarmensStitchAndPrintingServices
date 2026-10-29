using Csps.Domain.Common;
using Csps.Domain.Orders;

namespace Csps.Application.Orders;

/// <summary>Use case: tooling imports one legacy order (ORD-21). Not built yet.</summary>
[System.Diagnostics.CodeAnalysis.SuppressMessage("Performance", "CA1822:Mark members as static", Justification = "Placeholder until the import is built.")]
public sealed class ImportOrderHandler
{
    /// <summary>Imports the order.</summary>
    /// <param name="snapshot">The legacy order.</param>
    /// <param name="rules">The relaxations to apply.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The new order id, or the error.</returns>
    public Task<Result<Guid>> HandleAsync(OrderImportSnapshot snapshot, OrderImportRules rules, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        ArgumentNullException.ThrowIfNull(rules);
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult(Result.Failure<Guid>(Error.BusinessRule("orders.import-pending", "The import is not built yet.")));
    }
}

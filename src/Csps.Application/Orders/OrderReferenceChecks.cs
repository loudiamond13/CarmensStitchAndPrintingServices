using Csps.Application.Ports;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using FluentValidation.Results;

namespace Csps.Application.Orders;

/// <summary>The database-backed checks on an order form, merged into the same 400 as the static rules.</summary>
public static class OrderReferenceChecks
{
    /// <summary>
    /// Adds a failure on <c>productTypeId</c> when one product type does not exist or is retired (D-18). A missing id is skipped:
    /// the static rules already refused it.
    /// </summary>
    /// <param name="lists">The order lists.</param>
    /// <param name="productTypeId">The submitted product type.</param>
    /// <param name="validation">The validation result to add the failure to.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>A task that completes when the check is done.</returns>
    public static async Task AddProductTypeFailureAsync(IOrderLists lists, Guid? productTypeId, ValidationResult validation, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(lists);
        ArgumentNullException.ThrowIfNull(validation);

        if (productTypeId is not { } id || id == Guid.Empty)
        {
            return;
        }

        var states = await lists.GetStatesAsync(OrderListKind.ProductType, [id], cancellationToken).ConfigureAwait(false);
        var message = states.Count == 0 ? OrderRules.ProductTypeRequired : states[0].Retired ? OrderRules.ProductTypeRetired : null;
        if (message is not null)
        {
            validation.Errors.Add(new ValidationFailure(nameof(IOrderItemFields.ProductTypeId), message));
        }
    }

    /// <summary>
    /// Adds a failure for each item whose product type does not exist or is retired (D-18), on the item's own path, using one lookup
    /// for all distinct ids. An item with no product type is skipped: the static rules already refused it.
    /// </summary>
    /// <param name="lists">The order lists.</param>
    /// <param name="items">The submitted items; null means none.</param>
    /// <param name="validation">The validation result to add the failures to.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>A task that completes when the checks are done.</returns>
    public static async Task AddProductTypeFailuresAsync(
        IOrderLists lists,
        IReadOnlyList<OrderItemRequest>? items,
        ValidationResult validation,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(lists);
        ArgumentNullException.ThrowIfNull(validation);

        var ids = (items ?? [])
            .Select(static item => item?.ProductTypeId)
            .Where(static id => id is { } value && value != Guid.Empty)
            .Select(static id => id!.Value)
            .Distinct()
            .ToList();
        if (ids.Count == 0)
        {
            return;
        }

        var states = (await lists.GetStatesAsync(OrderListKind.ProductType, ids, cancellationToken).ConfigureAwait(false))
            .ToDictionary(static state => state.Id);
        for (var index = 0; index < items!.Count; index++)
        {
            if (items[index]?.ProductTypeId is not { } id || id == Guid.Empty)
            {
                continue;
            }

            var path = $"{nameof(CreateOrderRequest.Items)}[{index}].{nameof(OrderItemRequest.ProductTypeId)}";
            if (!states.TryGetValue(id, out var state))
            {
                validation.Errors.Add(new ValidationFailure(path, OrderRules.ProductTypeRequired));
            }
            else if (state.Retired)
            {
                validation.Errors.Add(new ValidationFailure(path, OrderRules.ProductTypeRetired));
            }
        }
    }

    /// <summary>
    /// Adds a failure on <c>paymentMethodId</c> when the payment method does not exist or is retired (D-16). A missing id is skipped:
    /// the static rules already refused it.
    /// </summary>
    /// <param name="lists">The order lists.</param>
    /// <param name="paymentMethodId">The submitted payment method.</param>
    /// <param name="validation">The validation result to add the failure to.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>A task that completes when the check is done.</returns>
    public static async Task AddPaymentMethodFailureAsync(IOrderLists lists, Guid? paymentMethodId, ValidationResult validation, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(lists);
        ArgumentNullException.ThrowIfNull(validation);

        if (paymentMethodId is not { } id || id == Guid.Empty)
        {
            return;
        }

        var states = await lists.GetStatesAsync(OrderListKind.PaymentMethod, [id], cancellationToken).ConfigureAwait(false);
        var message = states.Count == 0 ? OrderRules.PaymentMethodRequired : states[0].Retired ? OrderRules.PaymentMethodRetired : null;
        if (message is not null)
        {
            validation.Errors.Add(new ValidationFailure(nameof(IOrderPaymentFields.PaymentMethodId), message));
        }
    }

    /// <summary>
    /// Adds a failure on <c>receivedByUserId</c> when the person cannot be named as the receiver (ORD-22, D-32): they must be an
    /// active Admin or Manager who has finished set-up, so the Legacy holder and a deactivated, locked or deleted account are
    /// refused. A missing id is skipped: the static rules already refused it.
    /// </summary>
    /// <param name="staff">The staff directory.</param>
    /// <param name="receivedByUserId">The submitted receiver.</param>
    /// <param name="validation">The validation result to add the failure to.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>A task that completes when the check is done.</returns>
    public static async Task AddReceiverFailureAsync(IStaffDirectory staff, Guid? receivedByUserId, ValidationResult validation, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(staff);
        ArgumentNullException.ThrowIfNull(validation);

        if (receivedByUserId is not { } id || id == Guid.Empty)
        {
            return;
        }

        var receiver = await staff.GetStaffStateAsync(id, cancellationToken).ConfigureAwait(false);
        if (receiver is not { CanPay: true })
        {
            validation.Errors.Add(new ValidationFailure(nameof(IOrderPaymentFields.ReceivedByUserId), OrderRules.ReceivedByInactive));
        }
    }
}

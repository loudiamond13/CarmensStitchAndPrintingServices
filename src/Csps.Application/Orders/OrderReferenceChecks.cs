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
    /// Adds a failure for each payment whose method does not exist or is retired (D-16) and for each whose receiver cannot be chosen
    /// (ORD-22, D-32), on the payment's own path such as <c>payments[1].receivedByUserId</c>. One lookup serves all distinct method
    /// ids and one all distinct receivers. A payment with no method or no receiver is skipped: the static rules already refused it.
    /// </summary>
    /// <param name="lists">The order lists.</param>
    /// <param name="staff">The staff directory.</param>
    /// <param name="payments">The submitted payments; null means none.</param>
    /// <param name="validation">The validation result to add the failures to.</param>
    /// <param name="cancellationToken">Cancels the lookups.</param>
    /// <returns>A task that completes when the checks are done.</returns>
    public static async Task AddPaymentFailuresAsync(
        IOrderLists lists,
        IStaffDirectory staff,
        IReadOnlyList<OrderPaymentRequest>? payments,
        ValidationResult validation,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(lists);
        ArgumentNullException.ThrowIfNull(staff);
        ArgumentNullException.ThrowIfNull(validation);

        var methodIds = (payments ?? [])
            .Select(static payment => payment?.PaymentMethodId)
            .Where(static id => id is { } value && value != Guid.Empty)
            .Select(static id => id!.Value)
            .Distinct()
            .ToList();
        Dictionary<Guid, OrderListEntryState> methods = [];
        if (methodIds.Count > 0)
        {
            methods = (await lists.GetStatesAsync(OrderListKind.PaymentMethod, methodIds, cancellationToken).ConfigureAwait(false)).ToDictionary(static state => state.Id);
        }

        var eligible = new Dictionary<Guid, bool>();
        for (var index = 0; index < (payments?.Count ?? 0); index++)
        {
            var payment = payments![index];
            if (payment?.PaymentMethodId is { } methodId && methodId != Guid.Empty)
            {
                var path = $"{nameof(CreateOrderRequest.Payments)}[{index}].{nameof(OrderPaymentRequest.PaymentMethodId)}";
                if (!methods.TryGetValue(methodId, out var method))
                {
                    validation.Errors.Add(new ValidationFailure(path, OrderRules.PaymentMethodRequired));
                }
                else if (method.Retired)
                {
                    validation.Errors.Add(new ValidationFailure(path, OrderRules.PaymentMethodRetired));
                }
            }

            if (payment?.ReceivedByUserId is { } receiverId && receiverId != Guid.Empty)
            {
                if (!eligible.TryGetValue(receiverId, out var canPay))
                {
                    var state = await staff.GetStaffStateAsync(receiverId, cancellationToken).ConfigureAwait(false);
                    canPay = state is { CanPay: true };
                    eligible[receiverId] = canPay;
                }

                if (!canPay)
                {
                    var path = $"{nameof(CreateOrderRequest.Payments)}[{index}].{nameof(OrderPaymentRequest.ReceivedByUserId)}";
                    validation.Errors.Add(new ValidationFailure(path, OrderRules.ReceivedByInactive));
                }
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

    /// <summary>
    /// Adds a failure for each order expense whose category does not exist or is retired (D-17) and for each whose payer cannot be
    /// chosen (ORD-23, D-32), on the expense's own path such as <c>expenses[1].paidByUserId</c>. One lookup serves all distinct
    /// category ids and one all distinct payers. An expense with no category or no payer is skipped: the static rules already
    /// refused it.
    /// </summary>
    /// <param name="lists">The order lists.</param>
    /// <param name="staff">The staff directory.</param>
    /// <param name="expenses">The submitted expenses; null means none.</param>
    /// <param name="validation">The validation result to add the failures to.</param>
    /// <param name="cancellationToken">Cancels the lookups.</param>
    /// <returns>A task that completes when the checks are done.</returns>
    public static async Task AddExpenseFailuresAsync(
        IOrderLists lists,
        IStaffDirectory staff,
        IReadOnlyList<OrderExpenseRequest>? expenses,
        ValidationResult validation,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(lists);
        ArgumentNullException.ThrowIfNull(staff);
        ArgumentNullException.ThrowIfNull(validation);

        var categoryIds = (expenses ?? [])
            .Select(static expense => expense?.OrderExpenseCategoryId)
            .Where(static id => id is { } value && value != Guid.Empty)
            .Select(static id => id!.Value)
            .Distinct()
            .ToList();
        Dictionary<Guid, OrderListEntryState> categories = [];
        if (categoryIds.Count > 0)
        {
            categories = (await lists.GetStatesAsync(OrderListKind.OrderExpenseCategory, categoryIds, cancellationToken).ConfigureAwait(false)).ToDictionary(static state => state.Id);
        }

        var eligible = new Dictionary<Guid, bool>();
        for (var index = 0; index < (expenses?.Count ?? 0); index++)
        {
            var expense = expenses![index];
            if (expense?.OrderExpenseCategoryId is { } categoryId && categoryId != Guid.Empty)
            {
                var path = $"{nameof(CreateOrderRequest.Expenses)}[{index}].{nameof(OrderExpenseRequest.OrderExpenseCategoryId)}";
                if (!categories.TryGetValue(categoryId, out var category))
                {
                    validation.Errors.Add(new ValidationFailure(path, OrderRules.ExpenseCategoryRequired));
                }
                else if (category.Retired)
                {
                    validation.Errors.Add(new ValidationFailure(path, OrderRules.ExpenseCategoryRetired));
                }
            }

            if (expense?.PaidByUserId is { } payerId && payerId != Guid.Empty)
            {
                if (!eligible.TryGetValue(payerId, out var canPay))
                {
                    var state = await staff.GetStaffStateAsync(payerId, cancellationToken).ConfigureAwait(false);
                    canPay = state is { CanPay: true };
                    eligible[payerId] = canPay;
                }

                if (!canPay)
                {
                    var path = $"{nameof(CreateOrderRequest.Expenses)}[{index}].{nameof(OrderExpenseRequest.PaidByUserId)}";
                    validation.Errors.Add(new ValidationFailure(path, OrderRules.PaidByInactive));
                }
            }
        }
    }

    /// <summary>
    /// Adds a failure on <c>orderExpenseCategoryId</c> when the order expense category does not exist or is retired (D-17). A missing
    /// id is skipped: the static rules already refused it.
    /// </summary>
    /// <param name="lists">The order lists.</param>
    /// <param name="categoryId">The submitted category.</param>
    /// <param name="validation">The validation result to add the failure to.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>A task that completes when the check is done.</returns>
    public static async Task AddExpenseCategoryFailureAsync(IOrderLists lists, Guid? categoryId, ValidationResult validation, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(lists);
        ArgumentNullException.ThrowIfNull(validation);

        if (categoryId is not { } id || id == Guid.Empty)
        {
            return;
        }

        var states = await lists.GetStatesAsync(OrderListKind.OrderExpenseCategory, [id], cancellationToken).ConfigureAwait(false);
        var message = states.Count == 0 ? OrderRules.ExpenseCategoryRequired : states[0].Retired ? OrderRules.ExpenseCategoryRetired : null;
        if (message is not null)
        {
            validation.Errors.Add(new ValidationFailure(nameof(IOrderExpenseFields.OrderExpenseCategoryId), message));
        }
    }

    /// <summary>
    /// Adds a failure on <c>paidByUserId</c> when the person cannot be named as the payer (ORD-23, D-32): they must be an active
    /// Admin or Manager who has finished set-up, so the Legacy holder and a deactivated, locked or deleted account are refused, and
    /// there is no company payer. A missing id is skipped: the static rules already refused it.
    /// </summary>
    /// <param name="staff">The staff directory.</param>
    /// <param name="paidByUserId">The submitted payer.</param>
    /// <param name="validation">The validation result to add the failure to.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>A task that completes when the check is done.</returns>
    public static async Task AddPayerFailureAsync(IStaffDirectory staff, Guid? paidByUserId, ValidationResult validation, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(staff);
        ArgumentNullException.ThrowIfNull(validation);

        if (paidByUserId is not { } id || id == Guid.Empty)
        {
            return;
        }

        var payer = await staff.GetStaffStateAsync(id, cancellationToken).ConfigureAwait(false);
        if (payer is not { CanPay: true })
        {
            validation.Errors.Add(new ValidationFailure(nameof(IOrderExpenseFields.PaidByUserId), OrderRules.PaidByInactive));
        }
    }
}

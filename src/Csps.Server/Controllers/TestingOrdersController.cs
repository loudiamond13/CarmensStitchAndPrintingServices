#if CSPS_TESTING
using System.Text.Json;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Domain.Orders;
using Csps.Server.Http;
using Csps.Server.Security;
using Csps.Server.Testing;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>
/// Lets E2E specs seed an order with a chosen number, status, items, payments and expenses (ORD-21, D-37). It exists in the Testing
/// environment of a Debug build only. The order goes in through the legacy import handler with the default rules, so the number is
/// kept as given, any of the seven statuses is allowed, and every figure is worked out by the server. The body uses the member names
/// of the create call plus <c>number</c>.
/// </summary>
/// <param name="import">The legacy import handler.</param>
/// <param name="calendar">The business calendar, for the order date when none is sent.</param>
[TestingOnly]
[ApiController]
[Route("api/testing/orders")]
[AllowAnonymous]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class TestingOrdersController(ImportOrderHandler import, IBusinessCalendar calendar) : ControllerBase
{
    private const string DefaultCustomerName = "Test Customer";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>The body of the create call.</summary>
    /// <param name="Number">The order number, kept as given; required.</param>
    /// <param name="Status">One of pending, mockup, production, ready, delivered, completed or cancelled; pending when not sent.</param>
    /// <param name="CustomerName">The customer; "Test Customer" when not sent.</param>
    /// <param name="TeamName">The team or club.</param>
    /// <param name="ContactNumber">The contact number.</param>
    /// <param name="Email">The email address.</param>
    /// <param name="Address">The address.</param>
    /// <param name="OrderDate">The order date as <c>yyyy-MM-dd</c>; the business today when not sent.</param>
    /// <param name="DueDate">The due date as <c>yyyy-MM-dd</c>.</param>
    /// <param name="Notes">Free notes.</param>
    /// <param name="Items">The lines.</param>
    /// <param name="Discounts">The discounts.</param>
    /// <param name="Payments">The payments, each with its receiver.</param>
    /// <param name="Expenses">The order expenses, each with its payer.</param>
    public sealed record TestingOrderRequest(
        string? Number = null,
        string? Status = null,
        string? CustomerName = null,
        string? TeamName = null,
        string? ContactNumber = null,
        string? Email = null,
        string? Address = null,
        string? OrderDate = null,
        string? DueDate = null,
        string? Notes = null,
        IReadOnlyList<OrderItemRequest>? Items = null,
        IReadOnlyList<OrderDiscountRequest>? Discounts = null,
        IReadOnlyList<OrderPaymentRequest>? Payments = null,
        IReadOnlyList<OrderExpenseRequest>? Expenses = null);

    /// <summary>The new order.</summary>
    /// <param name="Id">The order id.</param>
    public sealed record TestingOrderCreated(Guid Id);

    /// <summary>Imports an order.</summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>201 with the id, 400 listing the fields that failed, or 422 <c>orders.number-taken</c>.</returns>
    [HttpPost]
    [IdempotencyExempt("Testing-only test data, compiled out of Release.")]
    [ProducesResponseType<TestingOrderCreated>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Create(CancellationToken cancellationToken)
    {
        // Read here, not bound, so a missing or malformed body is the same plain 400 for every caller.
        TestingOrderRequest? request;
        try
        {
            request = await JsonSerializer.DeserializeAsync<TestingOrderRequest>(Request.Body, JsonOptions, cancellationToken).ConfigureAwait(false);
        }
        catch (JsonException)
        {
            request = null;
        }

        request ??= new TestingOrderRequest();
        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var broken = new Dictionary<string, string[]>(StringComparer.Ordinal);
        RejectNullMembers(broken, OrderRules.ItemsField, request.Items);
        RejectNullMembers(broken, OrderRules.DiscountsField, request.Discounts);
        RejectNullMembers(broken, OrderRules.PaymentsField, request.Payments);
        RejectNullMembers(broken, OrderRules.ExpensesField, request.Expenses);
        if (broken.Count > 0)
        {
            return Rejected(OrderRules.InvalidMessage, broken);
        }

        var status = OrderStatus.Pending;
        if (request.Status is not null && !OrderStatusNames.TryParse(request.Status, out status))
        {
            broken[OrderRules.StatusField] = [OrderRules.StatusInvalid];
        }

        var orderDate = clock.Today;
        if (request.OrderDate is not null && !OrderDetailsFieldsValidator.TryParseDate(request.OrderDate, out orderDate))
        {
            broken[OrderRules.OrderDateField] = [OrderRules.DateInvalid];
        }

        DateOnly? dueDate = null;
        if (request.DueDate is not null)
        {
            if (OrderDetailsFieldsValidator.TryParseDate(request.DueDate, out var due))
            {
                dueDate = due;
            }
            else
            {
                broken[OrderRules.DueDateField] = [OrderRules.DateInvalid];
            }
        }

        var payments = request.Payments ?? [];
        for (var index = 0; index < payments.Count; index++)
        {
            if (!OrderDetailsFieldsValidator.TryParseDate(payments[index].PaymentDate, out _))
            {
                broken[$"payments[{index}].paymentDate"] = [OrderRules.DateInvalid];
            }
        }

        var expenses = request.Expenses ?? [];
        for (var index = 0; index < expenses.Count; index++)
        {
            if (!OrderDetailsFieldsValidator.TryParseDate(expenses[index].ExpenseDate, out _))
            {
                broken[$"expenses[{index}].expenseDate"] = [OrderRules.DateInvalid];
            }
        }

        if (broken.Count > 0)
        {
            return Rejected(OrderRules.InvalidMessage, broken);
        }

        var result = await import.HandleAsync(ToSnapshot(request, status, orderDate, dueDate), OrderImportRules.Default, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static id => TypedResults.Json(new TestingOrderCreated(id), JsonOptions, statusCode: StatusCodes.Status201Created));
    }

    // A body such as {"payments":[null]} deserializes, so a null member is turned away here, on its list.
    private static void RejectNullMembers<T>(Dictionary<string, string[]> broken, string field, IReadOnlyList<T>? members)
        where T : class
    {
        if (members is not null && members.Any(static member => member is null))
        {
            broken[field] = [OrderRules.InvalidMessage];
        }
    }

    private static OrderImportSnapshot ToSnapshot(TestingOrderRequest request, OrderStatus status, DateOnly orderDate, DateOnly? dueDate) => new(
        request.Number ?? string.Empty,
        new OrderDetails(request.CustomerName ?? DefaultCustomerName, request.TeamName, request.ContactNumber, request.Email, request.Address, orderDate, dueDate, request.Notes),
        status,
        [.. (request.Items ?? []).Select(static item => new NewOrderItem(item.ProductTypeId ?? Guid.Empty, item.Description ?? string.Empty, item.SizeVariant, item.Quantity ?? 0, item.UnitPrice ?? 0m))])
    {
        Discounts = [.. (request.Discounts ?? []).Select(ToDiscount)],
        Payments = [.. (request.Payments ?? []).Select(ToPayment)],
        Expenses = [.. (request.Expenses ?? []).Select(ToExpense)],
    };

    private static NewOrderDiscount ToDiscount(OrderDiscountRequest discount) =>
        new(DiscountKindNames.TryParse(discount.Kind, out var kind) ? kind : default, discount.Value ?? 0m, discount.Reason ?? string.Empty);

    private static NewOrderPayment ToPayment(OrderPaymentRequest payment) => new(
        OrderDetailsFieldsValidator.TryParseDate(payment.PaymentDate, out var date) ? date : default,
        payment.Amount ?? 0m,
        payment.PaymentMethodId ?? Guid.Empty,
        payment.Reference,
        payment.Notes,
        payment.ReceivedByUserId ?? Guid.Empty);

    private static NewOrderExpense ToExpense(OrderExpenseRequest expense) => new(
        OrderDetailsFieldsValidator.TryParseDate(expense.ExpenseDate, out var date) ? date : default,
        expense.Amount ?? 0m,
        expense.OrderExpenseCategoryId ?? Guid.Empty,
        expense.Description,
        expense.PaidByUserId ?? Guid.Empty);

    private ProblemHttpResult Rejected(string detail, Dictionary<string, string[]> errors) =>
        TypedResults.Problem(CspsProblemDetails.Build(HttpContext, StatusCodes.Status400BadRequest, detail, errors));
}
#endif

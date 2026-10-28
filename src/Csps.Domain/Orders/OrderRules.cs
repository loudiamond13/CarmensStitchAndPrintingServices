using System.Net.Mail;
using Csps.Domain.Common;
using Csps.Domain.Expenses;

namespace Csps.Domain.Orders;

/// <summary>
/// The limits and plain-English field messages of an order (D-18, D-21, D-22, D-30), shared by the domain, the validators and the
/// tests so every layer says the same words. Lengths are UTF-16 code units after trimming, the same measure as a browser string
/// length. Phase 8 mirrors these in zod.
/// </summary>
public static class OrderRules
{
    /// <summary>The longest customer name.</summary>
    public const int CustomerNameMaxLength = 100;

    /// <summary>The longest team name.</summary>
    public const int TeamNameMaxLength = 100;

    /// <summary>The longest contact number.</summary>
    public const int ContactNumberMaxLength = 30;

    /// <summary>The longest email address.</summary>
    public const int EmailMaxLength = 254;

    /// <summary>The longest address.</summary>
    public const int AddressMaxLength = 300;

    /// <summary>The longest notes text.</summary>
    public const int NotesMaxLength = 2000;

    /// <summary>The longest item description.</summary>
    public const int ItemDescriptionMaxLength = 200;

    /// <summary>The longest size or variant.</summary>
    public const int SizeVariantMaxLength = 100;

    /// <summary>The smallest item quantity.</summary>
    public const int QuantityMin = 1;

    /// <summary>The largest item quantity.</summary>
    public const int QuantityMax = 10_000;

    /// <summary>The most items one order may have.</summary>
    public const int MaxItems = 100;

    /// <summary>The most discounts one order may have (D-15).</summary>
    public const int MaxDiscounts = 20;

    /// <summary>The largest percentage discount.</summary>
    public const decimal PercentMax = 100m;

    /// <summary>The longest discount reason.</summary>
    public const int DiscountReasonMaxLength = 100;

    /// <summary>The most payments one order may have (D-30).</summary>
    public const int MaxPayments = 100;

    /// <summary>The longest payment reference.</summary>
    public const int PaymentReferenceMaxLength = 100;

    /// <summary>The longest payment notes text.</summary>
    public const int PaymentNotesMaxLength = 500;

    /// <summary>The most order expenses one order may have (D-30).</summary>
    public const int MaxExpenses = 100;

    /// <summary>How many days after the business today an order expense may be dated (D-30).</summary>
    public const int ExpenseDaysAhead = ExpenseRules.DaysAhead;

    /// <summary>The longest order expense description.</summary>
    public const int ExpenseDescriptionMaxLength = 200;

    /// <summary>The most decimal places a money amount may have.</summary>
    public const int MoneyScale = 2;

    /// <summary>The date format of the wire and the audit log.</summary>
    public const string DateFormat = "yyyy-MM-dd";

    /// <summary>The field name of the customer name.</summary>
    public const string CustomerNameField = "customerName";

    /// <summary>The field name of the team name.</summary>
    public const string TeamNameField = "teamName";

    /// <summary>The field name of the contact number.</summary>
    public const string ContactNumberField = "contactNumber";

    /// <summary>The field name of the email.</summary>
    public const string EmailField = "email";

    /// <summary>The field name of the address.</summary>
    public const string AddressField = "address";

    /// <summary>The field name of the order date.</summary>
    public const string OrderDateField = "orderDate";

    /// <summary>The field name of the due date.</summary>
    public const string DueDateField = "dueDate";

    /// <summary>The field name of the notes.</summary>
    public const string NotesField = "notes";

    /// <summary>The field name of the status.</summary>
    public const string StatusField = "status";

    /// <summary>The field name of the item list.</summary>
    public const string ItemsField = "items";

    /// <summary>The field name of an item's product type.</summary>
    public const string ProductTypeIdField = "productTypeId";

    /// <summary>The field name of an item's description.</summary>
    public const string DescriptionField = "description";

    /// <summary>The field name of an item's size or variant.</summary>
    public const string SizeVariantField = "sizeVariant";

    /// <summary>The field name of an item's quantity.</summary>
    public const string QuantityField = "quantity";

    /// <summary>The field name of an item's unit price.</summary>
    public const string UnitPriceField = "unitPrice";

    /// <summary>The field name of the discount list.</summary>
    public const string DiscountsField = "discounts";

    /// <summary>The field name of a discount's kind.</summary>
    public const string DiscountKindField = "kind";

    /// <summary>The field name of a discount's value.</summary>
    public const string DiscountValueField = "value";

    /// <summary>The field name of a discount's reason.</summary>
    public const string DiscountReasonField = "reason";

    /// <summary>The field name of the payment list.</summary>
    public const string PaymentsField = "payments";

    /// <summary>The field name of a payment's date.</summary>
    public const string PaymentDateField = "paymentDate";

    /// <summary>The field name of a payment's amount.</summary>
    public const string PaymentAmountField = "amount";

    /// <summary>The field name of a payment's method.</summary>
    public const string PaymentMethodField = "paymentMethodId";

    /// <summary>The field name of a payment's reference.</summary>
    public const string PaymentReferenceField = "reference";

    /// <summary>The field name of a payment's notes.</summary>
    public const string PaymentNotesField = "notes";

    /// <summary>The field name of the person who received a payment.</summary>
    public const string ReceivedByField = "receivedByUserId";

    /// <summary>The field name of the order expense list.</summary>
    public const string ExpensesField = "expenses";

    /// <summary>The field name of an order expense's date.</summary>
    public const string ExpenseDateField = "expenseDate";

    /// <summary>The field name of an order expense's amount.</summary>
    public const string ExpenseAmountField = "amount";

    /// <summary>The field name of an order expense's category.</summary>
    public const string ExpenseCategoryField = "orderExpenseCategoryId";

    /// <summary>The field name of an order expense's description.</summary>
    public const string ExpenseDescriptionField = "description";

    /// <summary>The field name of the person who paid an order expense.</summary>
    public const string PaidByField = "paidByUserId";

    /// <summary>The machine code of an order form that breaks field rules.</summary>
    public const string InvalidCode = "orders.invalid-request";

    /// <summary>The text above the field errors.</summary>
    public const string InvalidMessage = "Check the highlighted fields.";

    /// <summary>The message for a missing customer name.</summary>
    public const string CustomerNameRequired = "Enter the customer's name.";

    /// <summary>The message for a customer name over the limit.</summary>
    public const string CustomerNameTooLong = "Keep the customer name to 100 characters or fewer.";

    /// <summary>The message for a team name over the limit.</summary>
    public const string TeamNameTooLong = "Keep the team name to 100 characters or fewer.";

    /// <summary>The message for a missing contact number.</summary>
    public const string ContactNumberRequired = "Enter a contact number.";

    /// <summary>The message for a contact number over the limit.</summary>
    public const string ContactNumberTooLong = "Keep the contact number to 30 characters or fewer.";

    /// <summary>The message for a contact number with characters other than digits, spaces and + - ( ).</summary>
    public const string ContactNumberInvalid = "Use digits, spaces and + - ( ) only.";

    /// <summary>The message for an email over the limit.</summary>
    public const string EmailTooLong = "Keep the email to 254 characters or fewer.";

    /// <summary>The message for an email that is not an address.</summary>
    public const string EmailInvalid = "Enter a valid email address.";

    /// <summary>The message for an address over the limit.</summary>
    public const string AddressTooLong = "Keep the address to 300 characters or fewer.";

    /// <summary>The message for notes over the limit.</summary>
    public const string NotesTooLong = "Keep notes to 2,000 characters or fewer.";

    /// <summary>The message for a missing order date.</summary>
    public const string OrderDateRequired = "Enter the order date.";

    /// <summary>The message for a date that is not a real calendar day.</summary>
    public const string DateInvalid = "Enter a real date.";

    /// <summary>The message for a missing due date.</summary>
    public const string DueDateRequired = "Enter the due date.";

    /// <summary>The message for a due date before the order date.</summary>
    public const string DueDateBeforeOrderDate = "The due date can't be before the order date.";

    /// <summary>The message for a status name that is not one of the seven.</summary>
    public const string StatusInvalid = "Choose a status.";

    /// <summary>The message for a new order started as Completed or Cancelled (D-22).</summary>
    public const string StatusNotActive = "Create the order first, then complete or cancel it.";

    /// <summary>The machine code of a change to a Completed or Cancelled order (D-05).</summary>
    public const string LockedCode = "orders.locked";

    /// <summary>Builds the message for a change to an order in an end state (D-05).</summary>
    /// <param name="status">The end state the order is in.</param>
    /// <returns>For example "This order is completed. Reopen it to make changes."</returns>
    public static string Locked(OrderStatus status) =>
        $"This order is {(status == OrderStatus.Completed ? "completed" : "cancelled")}. Reopen it to make changes.";

    /// <summary>The message for an order with no items.</summary>
    public const string ItemsRequired = "Add at least one item.";

    /// <summary>The message for an order with more than <see cref="MaxItems"/> items.</summary>
    public const string ItemsTooMany = "An order can have at most 100 items.";

    /// <summary>The message for an item that is missing from the list.</summary>
    public const string ItemRequired = "Fill in this item.";

    /// <summary>The message for a missing or unknown product type.</summary>
    public const string ProductTypeRequired = "Choose a product type.";

    /// <summary>The message for a retired product type chosen on a new item (D-18).</summary>
    public const string ProductTypeRetired = "This product type was retired. Choose another one.";

    /// <summary>The message for a missing item description.</summary>
    public const string DescriptionRequired = "Describe the item.";

    /// <summary>The message for an item description over the limit.</summary>
    public const string DescriptionTooLong = "Keep the description to 200 characters or fewer.";

    /// <summary>The message for a size or variant over the limit.</summary>
    public const string SizeVariantTooLong = "Keep the size or variant to 100 characters or fewer.";

    /// <summary>The message for a quantity outside 1 to 10,000.</summary>
    public const string QuantityOutOfRange = "Enter a quantity from 1 to 10,000.";

    /// <summary>The message for a missing unit price.</summary>
    public const string UnitPriceRequired = "Enter a unit price.";

    /// <summary>The message for a unit price outside ₱0.00 to ₱1,000,000.00.</summary>
    public const string UnitPriceOutOfRange = "Enter a unit price from ₱0.00 to ₱1,000,000.00.";

    /// <summary>The message for a money amount with more than two decimal places.</summary>
    public const string MoneyDecimals = "Use at most 2 decimal places.";

    /// <summary>The message for a discount that is missing from the list.</summary>
    public const string DiscountRequired = "Fill in this discount.";

    /// <summary>The message for a discount kind that is not fixed or percentage.</summary>
    public const string DiscountKindInvalid = "Choose fixed or percentage.";

    /// <summary>The message for a missing discount value.</summary>
    public const string DiscountValueRequired = "Enter a discount value.";

    /// <summary>The message for a fixed discount outside ₱0.01 to ₱1,000,000.00.</summary>
    public const string FixedDiscountOutOfRange = "Enter a discount from ₱0.01 to ₱1,000,000.00.";

    /// <summary>The message for a percentage discount outside 0.01 to 100.</summary>
    public const string PercentDiscountOutOfRange = "Enter a percentage above 0 and up to 100.";

    /// <summary>The message for a missing discount reason.</summary>
    public const string DiscountReasonRequired = "Enter a reason for the discount.";

    /// <summary>The message for a discount reason over the limit.</summary>
    public const string DiscountReasonTooLong = "Keep the reason to 100 characters or fewer.";

    /// <summary>The message for an order with more than <see cref="MaxDiscounts"/> discounts.</summary>
    public const string DiscountsTooMany = "An order can have at most 20 discounts.";

    /// <summary>The message for discounts that add up to more than the items total.</summary>
    public const string DiscountAboveSubtotalMessage = "The discounts would be more than the items total. Lower or remove a discount first.";

    /// <summary>The message for a payment that is missing from the list.</summary>
    public const string PaymentRequired = "Fill in this payment.";

    /// <summary>The message for a missing payment date.</summary>
    public const string PaymentDateRequired = "Enter the payment date.";

    /// <summary>The message for a payment dated after the business today.</summary>
    public const string PaymentDateInFuture = "The payment date can't be in the future.";

    /// <summary>The message for a missing payment amount.</summary>
    public const string PaymentAmountRequired = "Enter the amount.";

    /// <summary>The message for a payment amount outside ₱0.01 to ₱1,000,000.00.</summary>
    public const string PaymentAmountOutOfRange = "Enter an amount from ₱0.01 to ₱1,000,000.00.";

    /// <summary>The message for a missing or unknown payment method.</summary>
    public const string PaymentMethodRequired = "Choose a payment method.";

    /// <summary>The message for a retired payment method chosen on a new or changed payment (D-16).</summary>
    public const string PaymentMethodRetired = "This payment method was retired. Choose another one.";

    /// <summary>The message for a payment reference over the limit.</summary>
    public const string PaymentReferenceTooLong = "Keep the reference to 100 characters or fewer.";

    /// <summary>The message for payment notes over the limit.</summary>
    public const string PaymentNotesTooLong = "Keep notes to 500 characters or fewer.";

    /// <summary>The message for a missing receiver (ORD-22).</summary>
    public const string ReceivedByRequired = "Choose who received the money.";

    /// <summary>The message for a receiver who cannot be chosen (ORD-22, D-32).</summary>
    public const string ReceivedByInactive = "This person can't be chosen because their account isn't active. Choose someone else.";

    /// <summary>The message for a payment on an order with nothing left to pay.</summary>
    public const string NothingOwed = "Nothing is owed on this order.";

    /// <summary>The message for payments that add up to more than the order total.</summary>
    public const string PaymentsAboveTotalMessage = "The payments would be more than the order total. Lower a payment first.";

    /// <summary>The message for an order with more than <see cref="MaxPayments"/> payments.</summary>
    public const string PaymentsTooMany = "An order can have at most 100 payments.";

    /// <summary>The message for an order expense that is missing from the list.</summary>
    public const string ExpenseRequired = "Fill in this expense.";

    /// <summary>The message for a missing payer (ORD-23).</summary>
    public const string PaidByRequired = ExpenseRules.PaidByRequired;

    /// <summary>The message for a payer who cannot be chosen (ORD-23, D-32).</summary>
    public const string PaidByInactive = ExpenseRules.PaidByInactive;

    /// <summary>The message for a missing or unknown order expense category.</summary>
    public const string ExpenseCategoryRequired = ExpenseRules.CategoryRequired;

    /// <summary>The message for a retired order expense category chosen on a new or changed expense (D-17).</summary>
    public const string ExpenseCategoryRetired = ExpenseRules.CategoryRetired;

    /// <summary>The message for an order with more than <see cref="MaxExpenses"/> expenses.</summary>
    public const string ExpensesTooMany = "An order can have at most 100 expenses.";

    /// <summary>The machine code of an order expense id that is not on the order in the route.</summary>
    public const string ExpenseNotFoundCode = "orders.expense-not-found";

    /// <summary>The plain-English text for an order expense that is not on the order in the route.</summary>
    public const string ExpenseNotFoundMessage = "This expense was not found on this order.";

    /// <summary>The machine code of an add that would take the order above <see cref="MaxExpenses"/>.</summary>
    public const string TooManyExpensesCode = "orders.too-many-expenses";

    /// <summary>The machine code of a payment id that is not on the order in the route.</summary>
    public const string PaymentNotFoundCode = "orders.payment-not-found";

    /// <summary>The plain-English text for a payment that is not on the order in the route.</summary>
    public const string PaymentNotFoundMessage = "This payment was not found on this order.";

    /// <summary>The machine code of an add that would take the order above <see cref="MaxPayments"/>.</summary>
    public const string TooManyPaymentsCode = "orders.too-many-payments";

    /// <summary>The machine code of a discount id that is not on the order in the route.</summary>
    public const string DiscountNotFoundCode = "orders.discount-not-found";

    /// <summary>The plain-English text for a discount that is not on the order in the route.</summary>
    public const string DiscountNotFoundMessage = "This discount was not found on this order.";

    /// <summary>The machine code of an add that would take the order above <see cref="MaxDiscounts"/>.</summary>
    public const string TooManyDiscountsCode = "orders.too-many-discounts";

    /// <summary>The machine code of a change that would leave the discounts above the items total.</summary>
    public const string DiscountAboveSubtotalCode = "orders.discount-above-subtotal";

    /// <summary>The machine code of an item id that is not on the order in the route.</summary>
    public const string ItemNotFoundCode = "orders.item-not-found";

    /// <summary>The plain-English text for an item that is not on the order in the route.</summary>
    public const string ItemNotFoundMessage = "This item was not found on this order.";

    /// <summary>The machine code of a removal that would leave the order with no items.</summary>
    public const string LastItemCode = "orders.last-item";

    /// <summary>The plain-English text for a removal that would leave the order with no items.</summary>
    public const string LastItemMessage = "An order needs at least one item. Add another item before removing this one.";

    /// <summary>The machine code of an add that would take the order above <see cref="MaxItems"/>.</summary>
    public const string TooManyItemsCode = "orders.too-many-items";

    /// <summary>The largest unit price (D-30).</summary>
    public static readonly decimal UnitPriceMax = 1_000_000.00m;

    /// <summary>The largest fixed discount.</summary>
    public static readonly decimal FixedDiscountMax = 1_000_000.00m;

    /// <summary>The largest order expense amount (D-30).</summary>
    public static readonly decimal ExpenseAmountMax = 1_000_000.00m;

    /// <summary>The largest payment amount (D-30).</summary>
    public static readonly decimal PaymentAmountMax = 1_000_000.00m;

    /// <summary>Gets the 404 for an order expense id that is not on the order.</summary>
    public static Error ExpenseNotFound { get; } = Error.NotFound(ExpenseNotFoundCode, ExpenseNotFoundMessage);

    /// <summary>Gets the 422 for adding an order expense to an order that already has the most.</summary>
    public static Error TooManyExpenses { get; } = Error.BusinessRule(TooManyExpensesCode, ExpensesTooMany);

    /// <summary>Gets the 404 for a payment id that is not on the order.</summary>
    public static Error PaymentNotFound { get; } = Error.NotFound(PaymentNotFoundCode, PaymentNotFoundMessage);

    /// <summary>Gets the 422 for adding a payment to an order that already has the most.</summary>
    public static Error TooManyPayments { get; } = Error.BusinessRule(TooManyPaymentsCode, PaymentsTooMany);

    /// <summary>Gets the 404 for a discount id that is not on the order.</summary>
    public static Error DiscountNotFound { get; } = Error.NotFound(DiscountNotFoundCode, DiscountNotFoundMessage);

    /// <summary>Gets the 422 for adding a discount to an order that already has the most.</summary>
    public static Error TooManyDiscounts { get; } = Error.BusinessRule(TooManyDiscountsCode, DiscountsTooMany);

    /// <summary>Gets the 422 for an item change that would leave the discounts above the items total.</summary>
    public static Error DiscountAboveSubtotal { get; } = Error.BusinessRule(DiscountAboveSubtotalCode, DiscountAboveSubtotalMessage);

    /// <summary>Gets the 404 for an item id that is not on the order.</summary>
    public static Error ItemNotFound { get; } = Error.NotFound(ItemNotFoundCode, ItemNotFoundMessage);

    /// <summary>Gets the 422 for removing the last item.</summary>
    public static Error LastItem { get; } = Error.BusinessRule(LastItemCode, LastItemMessage);

    /// <summary>Gets the 422 for adding an item to an order that already has the most.</summary>
    public static Error TooManyItems { get; } = Error.BusinessRule(TooManyItemsCode, ItemsTooMany);

    /// <summary>Builds the field path of an item member, for example <c>items[1].quantity</c>.</summary>
    /// <param name="index">The zero-based place of the item.</param>
    /// <param name="field">The member name, such as <see cref="QuantityField"/>.</param>
    /// <returns>The path.</returns>
    public static string ItemPath(int index, string field) => $"{ItemsField}[{index}].{field}";

    /// <summary>Builds the field path of a discount member, for example <c>discounts[0].value</c>, or just the member name for a single-discount form.</summary>
    /// <param name="index">The zero-based place of the discount in a list; null for a single-discount form.</param>
    /// <param name="field">The member name, such as <see cref="DiscountValueField"/>.</param>
    /// <returns>The path.</returns>
    public static string DiscountPath(int? index, string field) => index is { } place ? $"{DiscountsField}[{place}].{field}" : field;

    /// <summary>Builds the field path of a payment member, for example <c>payments[1].receivedByUserId</c>, or just the member name for a single-payment form.</summary>
    /// <param name="index">The zero-based place of the payment in a list; null for a single-payment form.</param>
    /// <param name="field">The member name, such as <see cref="ReceivedByField"/>.</param>
    /// <returns>The path.</returns>
    public static string PaymentPath(int? index, string field) => index is { } place ? $"{PaymentsField}[{place}].{field}" : field;

    /// <summary>Builds the field path of an order expense member, for example <c>expenses[0].paidByUserId</c>, or just the member name for a single-expense form.</summary>
    /// <param name="index">The zero-based place of the expense in a list; null for a single-expense form.</param>
    /// <param name="field">The member name, such as <see cref="PaidByField"/>.</param>
    /// <returns>The path.</returns>
    public static string ExpensePath(int? index, string field) => index is { } place ? $"{ExpensesField}[{place}].{field}" : field;

    /// <summary>Builds the message for a payment above what may still be paid.</summary>
    /// <param name="allowed">The most the payment may be, in pesos.</param>
    /// <returns>For example <c>This is more than the balance. Enter ₱9,327.50 or less.</c>, or the nothing-owed message when nothing may be paid.</returns>
    public static string PaymentAboveBalance(decimal allowed) =>
        allowed <= 0m ? NothingOwed : $"This is more than the balance. Enter {Pesos.Format(allowed)} or less.";

    /// <summary>Tells whether a money amount has no more than <see cref="MoneyScale"/> decimal places.</summary>
    /// <param name="amount">The amount.</param>
    /// <returns>True when rounding to two places changes nothing.</returns>
    public static bool HasValidScale(decimal amount) => decimal.Round(amount, MoneyScale) == amount;

    /// <summary>Tells whether a contact number holds only digits, spaces and + - ( ).</summary>
    /// <param name="text">The trimmed text.</param>
    /// <returns>True when every character is allowed.</returns>
    public static bool IsValidContactNumber(string text)
    {
        ArgumentNullException.ThrowIfNull(text);
        return text.All(static character => char.IsAsciiDigit(character) || character is ' ' or '+' or '-' or '(' or ')');
    }

    /// <summary>Tells whether text is a plain email address with a dotted domain, no display name and no spaces.</summary>
    /// <param name="text">The trimmed text.</param>
    /// <returns>True for an address such as <c>name@example.com</c>.</returns>
    public static bool IsValidEmail(string text)
    {
        ArgumentNullException.ThrowIfNull(text);
        return MailAddress.TryCreate(text, out var address) && address.Address == text && address.Host.Contains('.', StringComparison.Ordinal);
    }

    /// <summary>Checks and cleans the customer and date details, returning the first broken rule.</summary>
    /// <param name="details">The details as given.</param>
    /// <returns>The details with text trimmed and empty optional text turned into null, or a validation error naming the first broken field.</returns>
    public static Result<OrderDetails> CheckDetails(OrderDetails details)
    {
        ArgumentNullException.ThrowIfNull(details);
        ArgumentNullException.ThrowIfNull(details.CustomerName);

        var customerName = details.CustomerName.Trim();
        if (customerName.Length == 0)
        {
            return Reject<OrderDetails>(CustomerNameField, CustomerNameRequired);
        }

        if (customerName.Length > CustomerNameMaxLength)
        {
            return Reject<OrderDetails>(CustomerNameField, CustomerNameTooLong);
        }

        var teamName = Clean(details.TeamName);
        if (teamName is { Length: > TeamNameMaxLength })
        {
            return Reject<OrderDetails>(TeamNameField, TeamNameTooLong);
        }

        var contactNumber = Clean(details.ContactNumber);
        if (contactNumber is null)
        {
            return Reject<OrderDetails>(ContactNumberField, ContactNumberRequired);
        }

        if (contactNumber.Length > ContactNumberMaxLength)
        {
            return Reject<OrderDetails>(ContactNumberField, ContactNumberTooLong);
        }

        if (!IsValidContactNumber(contactNumber))
        {
            return Reject<OrderDetails>(ContactNumberField, ContactNumberInvalid);
        }

        var email = Clean(details.Email);
        if (email is { Length: > EmailMaxLength })
        {
            return Reject<OrderDetails>(EmailField, EmailTooLong);
        }

        if (email is not null && !IsValidEmail(email))
        {
            return Reject<OrderDetails>(EmailField, EmailInvalid);
        }

        var address = Clean(details.Address);
        if (address is { Length: > AddressMaxLength })
        {
            return Reject<OrderDetails>(AddressField, AddressTooLong);
        }

        if (details.DueDate is not { } dueDate)
        {
            return Reject<OrderDetails>(DueDateField, DueDateRequired);
        }

        if (dueDate < details.OrderDate)
        {
            return Reject<OrderDetails>(DueDateField, DueDateBeforeOrderDate);
        }

        var notes = Clean(details.Notes);
        if (notes is { Length: > NotesMaxLength })
        {
            return Reject<OrderDetails>(NotesField, NotesTooLong);
        }

        return Result.Success(new OrderDetails(customerName, teamName, contactNumber, email, address, details.OrderDate, dueDate, notes));
    }

    /// <summary>Checks and cleans one item, returning the first broken rule under the item's path.</summary>
    /// <param name="index">The zero-based place of the item, used in the field path.</param>
    /// <param name="item">The item as given.</param>
    /// <returns>The item with text trimmed and an empty size or variant turned into null, or a validation error naming the first broken field.</returns>
    public static Result<NewOrderItem> CheckItem(int index, NewOrderItem item)
    {
        ArgumentNullException.ThrowIfNull(item);
        ArgumentNullException.ThrowIfNull(item.Description);

        if (item.ProductTypeId == Guid.Empty)
        {
            return Reject<NewOrderItem>(ItemPath(index, ProductTypeIdField), ProductTypeRequired);
        }

        var description = item.Description.Trim();
        if (description.Length == 0)
        {
            return Reject<NewOrderItem>(ItemPath(index, DescriptionField), DescriptionRequired);
        }

        if (description.Length > ItemDescriptionMaxLength)
        {
            return Reject<NewOrderItem>(ItemPath(index, DescriptionField), DescriptionTooLong);
        }

        var sizeVariant = Clean(item.SizeVariant);
        if (sizeVariant is { Length: > SizeVariantMaxLength })
        {
            return Reject<NewOrderItem>(ItemPath(index, SizeVariantField), SizeVariantTooLong);
        }

        if (item.Quantity is < QuantityMin or > QuantityMax)
        {
            return Reject<NewOrderItem>(ItemPath(index, QuantityField), QuantityOutOfRange);
        }

        if (item.UnitPrice < 0m || item.UnitPrice > UnitPriceMax)
        {
            return Reject<NewOrderItem>(ItemPath(index, UnitPriceField), UnitPriceOutOfRange);
        }

        if (!HasValidScale(item.UnitPrice))
        {
            return Reject<NewOrderItem>(ItemPath(index, UnitPriceField), MoneyDecimals);
        }

        return Result.Success(item with { Description = description, SizeVariant = sizeVariant });
    }

    /// <summary>Checks and cleans one discount, returning the first broken rule under the discount's path.</summary>
    /// <param name="index">The zero-based place of the discount in a list, used in the field path; null for a single-discount form.</param>
    /// <param name="discount">The discount as given.</param>
    /// <returns>The discount with the reason trimmed, or a validation error naming the first broken field.</returns>
    public static Result<NewOrderDiscount> CheckDiscount(int? index, NewOrderDiscount discount)
    {
        ArgumentNullException.ThrowIfNull(discount);
        ArgumentNullException.ThrowIfNull(discount.Reason);

        if (!Enum.IsDefined(discount.Kind))
        {
            return Reject<NewOrderDiscount>(DiscountPath(index, DiscountKindField), DiscountKindInvalid);
        }

        var fixedKind = discount.Kind == DiscountKind.Fixed;
        var inRange = discount.Value > 0m && discount.Value <= (fixedKind ? FixedDiscountMax : PercentMax);
        if (!inRange)
        {
            return Reject<NewOrderDiscount>(DiscountPath(index, DiscountValueField), fixedKind ? FixedDiscountOutOfRange : PercentDiscountOutOfRange);
        }

        if (!HasValidScale(discount.Value))
        {
            return Reject<NewOrderDiscount>(DiscountPath(index, DiscountValueField), MoneyDecimals);
        }

        var reason = discount.Reason.Trim();
        if (reason.Length == 0)
        {
            return Reject<NewOrderDiscount>(DiscountPath(index, DiscountReasonField), DiscountReasonRequired);
        }

        if (reason.Length > DiscountReasonMaxLength)
        {
            return Reject<NewOrderDiscount>(DiscountPath(index, DiscountReasonField), DiscountReasonTooLong);
        }

        return Result.Success(discount with { Reason = reason });
    }

    /// <summary>Checks and cleans one payment, returning the first broken rule under the payment's path. Whether the method and the receiver exist and may be chosen needs the database and runs in the handlers.</summary>
    /// <param name="index">The zero-based place of the payment in a list, used in the field path; null for a single-payment form.</param>
    /// <param name="payment">The payment as given.</param>
    /// <param name="today">The business today; a payment may not be dated after it.</param>
    /// <returns>The payment with the reference and notes trimmed and empty ones turned into null, or a validation error naming the first broken field.</returns>
    public static Result<NewOrderPayment> CheckPayment(int? index, NewOrderPayment payment, DateOnly today)
    {
        ArgumentNullException.ThrowIfNull(payment);

        if (payment.PaymentMethodId == Guid.Empty)
        {
            return Reject<NewOrderPayment>(PaymentPath(index, PaymentMethodField), PaymentMethodRequired);
        }

        if (payment.PaymentDate > today)
        {
            return Reject<NewOrderPayment>(PaymentPath(index, PaymentDateField), PaymentDateInFuture);
        }

        if (payment.Amount <= 0m || payment.Amount > PaymentAmountMax)
        {
            return Reject<NewOrderPayment>(PaymentPath(index, PaymentAmountField), PaymentAmountOutOfRange);
        }

        if (!HasValidScale(payment.Amount))
        {
            return Reject<NewOrderPayment>(PaymentPath(index, PaymentAmountField), MoneyDecimals);
        }

        var reference = Clean(payment.Reference);
        if (reference is { Length: > PaymentReferenceMaxLength })
        {
            return Reject<NewOrderPayment>(PaymentPath(index, PaymentReferenceField), PaymentReferenceTooLong);
        }

        var notes = Clean(payment.Notes);
        if (notes is { Length: > PaymentNotesMaxLength })
        {
            return Reject<NewOrderPayment>(PaymentPath(index, PaymentNotesField), PaymentNotesTooLong);
        }

        if (payment.ReceivedByUserId == Guid.Empty)
        {
            return Reject<NewOrderPayment>(PaymentPath(index, ReceivedByField), ReceivedByRequired);
        }

        return Result.Success(payment with { Reference = reference, Notes = notes });
    }

    /// <summary>
    /// Checks and cleans one order expense, returning the first broken rule under the expense's path. The date may be any past day
    /// and up to 30 days after the business today. Whether the category and the payer exist and may be chosen needs the database and
    /// runs in the handlers.
    /// </summary>
    /// <param name="index">The zero-based place of the expense in a list, used in the field path; null for a single-expense form.</param>
    /// <param name="expense">The expense as given.</param>
    /// <param name="today">The business today.</param>
    /// <returns>The expense with the description trimmed and an empty one turned into null, or a validation error naming the first broken field.</returns>
    public static Result<NewOrderExpense> CheckExpense(int? index, NewOrderExpense expense, DateOnly today)
    {
        ArgumentNullException.ThrowIfNull(expense);

        if (expense.OrderExpenseCategoryId == Guid.Empty)
        {
            return Reject<NewOrderExpense>(ExpensePath(index, ExpenseCategoryField), ExpenseCategoryRequired);
        }

        var latest = ExpenseRules.Latest(today);
        if (expense.ExpenseDate > latest)
        {
            return Reject<NewOrderExpense>(ExpensePath(index, ExpenseDateField), ExpenseRules.DateTooFar(latest));
        }

        if (expense.Amount <= 0m)
        {
            return Reject<NewOrderExpense>(ExpensePath(index, ExpenseAmountField), ExpenseRules.AmountTooSmall);
        }

        if (expense.Amount > ExpenseAmountMax)
        {
            return Reject<NewOrderExpense>(ExpensePath(index, ExpenseAmountField), ExpenseRules.AmountTooLarge);
        }

        if (!HasValidScale(expense.Amount))
        {
            return Reject<NewOrderExpense>(ExpensePath(index, ExpenseAmountField), MoneyDecimals);
        }

        var description = Clean(expense.Description);
        if (description is { Length: > ExpenseDescriptionMaxLength })
        {
            return Reject<NewOrderExpense>(ExpensePath(index, ExpenseDescriptionField), ExpenseRules.DescriptionTooLong);
        }

        if (expense.PaidByUserId == Guid.Empty)
        {
            return Reject<NewOrderExpense>(ExpensePath(index, PaidByField), PaidByRequired);
        }

        return Result.Success(expense with { Description = description });
    }

    /// <summary>Builds a validation error for one field.</summary>
    /// <typeparam name="T">The result type.</typeparam>
    /// <param name="field">The field name or path.</param>
    /// <param name="message">The plain-English message.</param>
    /// <returns>A failed result.</returns>
    public static Result<T> Reject<T>(string field, string message) =>
        Result.Failure<T>(Error.Validation(InvalidCode, InvalidMessage, new Dictionary<string, string[]> { [field] = [message] }));

    // Trims, and turns empty text into null.
    private static string? Clean(string? text)
    {
        var trimmed = text?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}

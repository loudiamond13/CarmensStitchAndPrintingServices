using System.Net.Mail;
using Csps.Domain.Common;

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

using Csps.Application.Common;
using Csps.Domain.Common;
using Csps.Domain.OrderLists;
using FluentValidation.Results;

namespace Csps.Application.OrderLists;

/// <summary>The error values and messages the order list use cases return (D-19). Codes and nouns come from the list's <see cref="OrderListDescriptor"/>.</summary>
public static class OrderListErrors
{
    /// <summary>The message for a name that another entry of the list, retired ones included, already holds.</summary>
    public const string NameTaken = "That name is already used. Choose another one.";

    /// <summary>Gets the 404 for an entry that does not exist.</summary>
    /// <param name="descriptor">The list.</param>
    /// <returns>The error.</returns>
    public static Error NotFound(OrderListDescriptor descriptor)
    {
        ArgumentNullException.ThrowIfNull(descriptor);
        return Error.NotFound(descriptor.NotFoundCode, descriptor.NotFoundMessage);
    }

    /// <summary>Gets the 422 for a delete refused because a row uses the entry.</summary>
    /// <param name="descriptor">The list.</param>
    /// <returns>The error.</returns>
    public static Error InUse(OrderListDescriptor descriptor)
    {
        ArgumentNullException.ThrowIfNull(descriptor);
        return Error.BusinessRule(descriptor.InUseCode, descriptor.InUseMessage);
    }

    /// <summary>Gets the failure for a name that is already used.</summary>
    /// <returns>The failure, on <c>name</c>.</returns>
    public static ValidationFailure NameTakenFailure() => new(nameof(OrderListEntryRequest.Name), NameTaken);

    /// <summary>Turns a failed validation into the list's 400.</summary>
    /// <param name="descriptor">The list.</param>
    /// <param name="validation">The failed validation.</param>
    /// <returns>The error.</returns>
    public static Error Invalid(OrderListDescriptor descriptor, ValidationResult validation)
    {
        ArgumentNullException.ThrowIfNull(descriptor);
        return ValidationResults.ToError(validation, descriptor.InvalidCode, OrderListEntry.InvalidMessage);
    }
}

using System.Globalization;
using Csps.Domain.Common;

namespace Csps.Domain.Orders;

/// <summary>The photo rules of an order (ORD-04, D-08, D-12): the most photos an order holds and the description limit, with their messages.</summary>
public static class OrderImageRules
{
    /// <summary>The most photos one order holds (D-08).</summary>
    public const int MaxImagesPerOrder = 5;

    /// <summary>The longest description, in characters, after trimming (D-12).</summary>
    public const int DescriptionMaxLength = 200;

    /// <summary>The field name a description error is reported on.</summary>
    public const string DescriptionField = "description";

    /// <summary>The machine code of an add that would take the order above <see cref="MaxImagesPerOrder"/>.</summary>
    public const string LimitCode = "orders.images-full";

    /// <summary>The message for an order that already holds <see cref="MaxImagesPerOrder"/> photos.</summary>
    public const string TooManyMessage = "This order already has 5 photos.";

    /// <summary>The machine code of a description over <see cref="DescriptionMaxLength"/>.</summary>
    public const string DescriptionTooLongCode = "orders.image-description-too-long";

    /// <summary>The message for a description over <see cref="DescriptionMaxLength"/>.</summary>
    public const string DescriptionTooLongMessage = "Keep the description to 200 characters or fewer.";

    /// <summary>The field name a place error is reported on.</summary>
    public const string PositionField = "position";

    /// <summary>The machine code of a photo id that is not on the order in the route.</summary>
    public const string ImageNotFoundCode = "orders.image-not-found";

    /// <summary>The message for a photo that is not on the order in the route.</summary>
    public const string ImageNotFoundMessage = "This photo is no longer on this order.";

    /// <summary>The message for a place outside the order's photos.</summary>
    public const string PositionOutOfRangeMessage = "Choose a place that is on this order.";

    /// <summary>Gets the 404 for a photo that is not on the order.</summary>
    public static Error ImageNotFound { get; } = Error.NotFound(ImageNotFoundCode, ImageNotFoundMessage);

    /// <summary>Gets the error for an order that already holds the most photos.</summary>
    public static Error TooMany { get; } = Error.BusinessRule(LimitCode, TooManyMessage);

    /// <summary>Gets the error for a description that is too long.</summary>
    public static Error DescriptionTooLong { get; } = Error.Validation(
        DescriptionTooLongCode,
        DescriptionTooLongMessage,
        new Dictionary<string, string[]> { [DescriptionField] = [DescriptionTooLongMessage] });

    /// <summary>The description a photo shows when none was typed (D-12, D-30).</summary>
    /// <param name="orderNumber">The order number.</param>
    /// <param name="position">The photo's place in the order, from 0.</param>
    /// <returns>For example <c>Order ORD-2026-0148 photo 1</c>.</returns>
    public static string DefaultDescription(string orderNumber, int position) =>
        string.Create(CultureInfo.InvariantCulture, $"Order {orderNumber} photo {position + 1}");

    /// <summary>Cleans a description for storage: trimmed, and null when it is empty or equals the default text (D-12, D-30).</summary>
    /// <param name="description">The description as typed; may be null.</param>
    /// <param name="orderNumber">The order number.</param>
    /// <param name="position">The photo's place in the order, from 0.</param>
    /// <returns>The text to keep, or null.</returns>
    public static string? NormalizeDescription(string? description, string orderNumber, int position)
    {
        var trimmed = description?.Trim();
        return string.IsNullOrEmpty(trimmed) || string.Equals(trimmed, DefaultDescription(orderNumber, position), StringComparison.Ordinal) ? null : trimmed;
    }

    /// <summary>Checks a description against the limit, after trimming.</summary>
    /// <param name="description">The description as typed; may be null.</param>
    /// <returns>Null when it fits, or the validation error.</returns>
    public static Error? CheckDescription(string? description) =>
        description is not null && description.Trim().Length > DescriptionMaxLength ? DescriptionTooLong : null;
}

/// <summary>What a photo move changed (D-13, D-14, D-19). Places count from 0.</summary>
/// <param name="From">The place the photo had.</param>
/// <param name="To">The place it has now.</param>
/// <param name="NewCoverFrom">The place the new cover photo had before the move; null when the cover is the same photo.</param>
public sealed record OrderImageMove(int From, int To, int? NewCoverFrom);

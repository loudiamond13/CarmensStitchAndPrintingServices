using Csps.Domain.Common;

namespace Csps.Domain.Content;

/// <summary>
/// One public phone number of the shop (D-23). The number is kept in E.164 form, built from parsed digits only. One row is the
/// main number the Call buttons dial. The attribution members are set only by the database layer (SEC-08).
/// </summary>
public sealed class SitePhoneNumber : IAttributedRecord, IPublicContentRecord
{
    /// <summary>The longest stored number (E.164 allows 15 digits and a plus sign).</summary>
    public const int NumberMaxLength = 16;

    /// <summary>The longest label.</summary>
    public const int LabelMaxLength = 20;

    /// <summary>The most numbers the shop can list.</summary>
    public const int MaxCount = 4;

    /// <summary>The message for a label over the limit.</summary>
    public const string LabelTooLongMessage = "Keep the label to 20 characters or fewer.";

    private SitePhoneNumber(Guid id, string number, string? label, bool isMain, int position, DateTimeOffset createdAtUtc)
    {
        Id = id;
        Number = number;
        Label = label;
        IsMain = isMain;
        Position = position;
        CreatedAtUtc = createdAtUtc;
    }

    /// <summary>Primary key.</summary>
    public Guid Id { get; private set; }

    /// <summary>The number as "+639171234567".</summary>
    public string Number { get; private set; }

    /// <summary>An optional label; null when not set.</summary>
    public string? Label { get; private set; }

    /// <summary>True for the main number.</summary>
    public bool IsMain { get; private set; }

    /// <summary>The place in the list, 0 first.</summary>
    public int Position { get; private set; }

    /// <inheritdoc />
    public Guid? CreatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? UpdatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset? UpdatedAtUtc { get; private set; }

    /// <summary>Builds a phone row from what a person typed.</summary>
    /// <param name="number">The typed number; parsed by <see cref="PhilippinePhone"/>.</param>
    /// <param name="label">An optional label; trimmed, and empty becomes none.</param>
    /// <param name="isMain">True for the main number.</param>
    /// <param name="position">The place in the list.</param>
    /// <param name="now">The current instant, which makes the key.</param>
    /// <returns>The new, unsaved row, or a validation error on <c>number</c> or <c>label</c>.</returns>
    public static Result<SitePhoneNumber> Create(string number, string? label, bool isMain, int position, DateTimeOffset now) =>
        throw new NotImplementedException();
}

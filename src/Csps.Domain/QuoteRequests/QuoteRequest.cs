using Csps.Domain.Common;

namespace Csps.Domain.QuoteRequests;

/// <summary>
/// A quote request a visitor sent from the Contact page (INQ-01). The aggregate checks every field rule itself, so no caller can
/// save a request that would not fit the New Order form later. A visitor has no account, so the record has no creator (SEC-08):
/// the stamp reads a missing user as nobody. Who and when come from the clock, never from the request body.
/// </summary>
public sealed class QuoteRequest : IAttributedRecord, IEditVersioned
{
    // Used by EF Core (constructor binding) and by Receive.
    private QuoteRequest(
        Guid id,
        string customerName,
        string? teamName,
        string contactNumberE164,
        string? email,
        QuoteProductChoice? productChoice,
        Guid? productLineId,
        string? productTitle,
        QuoteQuantityRange? quantityRange,
        string? message,
        QuoteRequestStatus status,
        DateTimeOffset statusChangedAtUtc)
    {
        Id = id;
        CustomerName = customerName;
        TeamName = teamName;
        ContactNumberE164 = contactNumberE164;
        Email = email;
        ProductChoice = productChoice;
        ProductLineId = productLineId;
        ProductTitle = productTitle;
        QuantityRange = quantityRange;
        Message = message;
        Status = status;
        StatusChangedAtUtc = statusChangedAtUtc;
        RowVersion = [];
    }

    /// <summary>Gets the primary key, a version 7 id made by the caller from the clock.</summary>
    public Guid Id { get; private set; }

    /// <summary>Gets the visitor's name, trimmed.</summary>
    public string CustomerName { get; private set; }

    /// <summary>Gets the team or organization; null when none.</summary>
    public string? TeamName { get; private set; }

    /// <summary>Gets the mobile number as E.164, such as <c>+639171234567</c>.</summary>
    public string ContactNumberE164 { get; private set; }

    /// <summary>Gets the email address; null when none.</summary>
    public string? Email { get; private set; }

    /// <summary>Gets what the visitor chose in the product list; null when nothing was chosen.</summary>
    public QuoteProductChoice? ProductChoice { get; private set; }

    /// <summary>Gets the chosen product line; null for another choice, or after the line was deleted.</summary>
    public Guid? ProductLineId { get; private set; }

    /// <summary>Gets the title of the chosen line at the moment of the request (D-24); null for another choice.</summary>
    public string? ProductTitle { get; private set; }

    /// <summary>Gets the estimated quantity; null when none was chosen.</summary>
    public QuoteQuantityRange? QuantityRange { get; private set; }

    /// <summary>Gets what the visitor wrote; null when nothing.</summary>
    public string? Message { get; private set; }

    /// <summary>Gets the current status.</summary>
    public QuoteRequestStatus Status { get; private set; }

    /// <summary>Gets when the status last changed, in UTC.</summary>
    public DateTimeOffset StatusChangedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? CreatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? UpdatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset? UpdatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid EditVersion { get; private set; }

    /// <summary>Gets the row version a save must match (409 on a conflict).</summary>
    public byte[] RowVersion { get; private set; }

    /// <summary>Makes a new request at status New, checking every field rule again so no caller can skip one.</summary>
    /// <param name="id">The new id, a version 7 id.</param>
    /// <param name="input">The form.</param>
    /// <param name="now">The current instant, which becomes the creation and status time.</param>
    /// <returns>The new, unsaved request, or a validation error naming the first broken field.</returns>
    public static Result<QuoteRequest> Receive(Guid id, QuoteRequestInput input, DateTimeOffset now)
    {
        var cleaned = QuoteRequestRules.Check(input);
        if (cleaned.IsFailure)
        {
            return Result.Failure<QuoteRequest>(cleaned.Error);
        }

        var form = cleaned.Value;
        return Result.Success(new QuoteRequest(
            id,
            form.CustomerName,
            form.TeamName,
            form.ContactNumber,
            form.Email,
            form.ProductChoice,
            form.ProductLineId,
            form.ProductTitle,
            form.QuantityRange,
            form.Message,
            QuoteRequestStatus.New,
            now)
        {
            CreatedAtUtc = now,
            EditVersion = Guid.CreateVersion7(now),
        });
    }
}

using Csps.Domain.Common;

namespace Csps.Domain.Content;

/// <summary>
/// What a Manager typed for a testimonial, as typed (CONT-03, D-05). <see cref="Testimonial.Check"/> judges it and the testimonial trims
/// the texts it keeps. The stars are a number so that a fraction such as 2.5 is refused with the same message as 0.
/// </summary>
/// <param name="Quote">The customer's words.</param>
/// <param name="Name">The customer's name or team name as shown.</param>
/// <param name="TeamOrRole">The team or role line under the name; null or empty for none.</param>
/// <param name="Stars">The rating, 1 to 5.</param>
/// <param name="IsShown">True to show the testimonial on the website; null keeps it as it is (a new testimonial then starts hidden).</param>
public sealed record TestimonialValues(string? Quote, string? Name, string? TeamOrRole, decimal? Stars, bool? IsShown);

/// <summary>What an edit changed in a testimonial (AUDIT-01).</summary>
/// <param name="Fields">The API names of the changed fields in form order (<c>quote</c>, <c>name</c>, <c>teamOrRole</c>, <c>stars</c>); the shown flag is not one of them.</param>
/// <param name="OldName">The name before.</param>
/// <param name="NewName">The name after.</param>
/// <param name="OldStars">The stars before.</param>
/// <param name="NewStars">The stars after.</param>
/// <param name="NowShown">True when it was hidden and is now shown, false for the other way round, null when the flag did not change.</param>
public sealed record TestimonialChanges(IReadOnlyList<string> Fields, string OldName, string NewName, int OldStars, int NewStars, bool? NowShown)
{
    /// <summary>Gets a value indicating whether anything changed.</summary>
    public bool HasChange => Fields.Count > 0 || NowShown is not null;
}

/// <summary>
/// One customer testimonial the public Home page can show (CONT-03, D-05): the quote, who said it, an optional team or role, a rating of
/// 1 to 5 stars, its place in the list and whether it is shown. A Manager types them in; nothing is ever made up. Who created and changed
/// it, and when, are set only by the database layer (SEC-08). A saved change clears the public cache (PUB-03).
/// </summary>
public sealed class Testimonial : IAttributedRecord, IPublicContentRecord
{
    /// <summary>The longest quote.</summary>
    public const int QuoteMaxLength = 300;

    /// <summary>The longest name.</summary>
    public const int NameMaxLength = 60;

    /// <summary>The longest team or role line.</summary>
    public const int TeamMaxLength = 80;

    /// <summary>The fewest stars.</summary>
    public const int MinStars = 1;

    /// <summary>The most stars.</summary>
    public const int MaxStars = 5;

    /// <summary>The message for a missing quote.</summary>
    public const string QuoteRequiredMessage = "Enter the quote.";

    /// <summary>The message for a quote over the limit.</summary>
    public const string QuoteTooLongMessage = "Keep the quote to 300 characters or fewer.";

    /// <summary>The message for a missing name.</summary>
    public const string NameRequiredMessage = "Enter the name.";

    /// <summary>The message for a name over the limit.</summary>
    public const string NameTooLongMessage = "Keep the name to 60 characters or fewer.";

    /// <summary>The message for a team or role line over the limit.</summary>
    public const string TeamTooLongMessage = "Keep this to 80 characters or fewer.";

    /// <summary>The message for stars that are not a whole number from 1 to 5.</summary>
    public const string StarsInvalidMessage = "Choose 1 to 5 stars.";

    // Used by EF Core (constructor binding) and by Create.
    private Testimonial(Guid id, DateTimeOffset createdAtUtc)
    {
        Id = id;
        CreatedAtUtc = createdAtUtc;
        RowVersion = [];
    }

    /// <summary>Primary key.</summary>
    public Guid Id { get; private set; }

    /// <summary>The customer's words.</summary>
    public string Quote { get; private set; } = string.Empty;

    /// <summary>The name shown under the quote.</summary>
    public string Name { get; private set; } = string.Empty;

    /// <summary>The team or role line under the name; null when not set.</summary>
    public string? TeamOrRole { get; private set; }

    /// <summary>The rating, 1 to 5.</summary>
    public int Stars { get; private set; }

    /// <summary>The display order, from 1.</summary>
    public int Position { get; private set; }

    /// <summary>True while the testimonial can show on the website.</summary>
    public bool IsShown { get; private set; }

    /// <inheritdoc />
    public Guid? CreatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? UpdatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset? UpdatedAtUtc { get; private set; }

    /// <summary>Optimistic-concurrency token maintained by the database (409 on conflict).</summary>
    public byte[] RowVersion { get; private set; }

    /// <summary>
    /// Checks what a Manager typed against the rules, so the request validator and the domain never disagree. A text is judged after
    /// trimming.
    /// </summary>
    /// <param name="values">What was typed.</param>
    /// <returns>The messages by field name; empty when all is fine.</returns>
    public static Dictionary<string, string[]> Check(TestimonialValues values)
    {
        ArgumentNullException.ThrowIfNull(values);

        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        if (string.IsNullOrWhiteSpace(values.Quote))
        {
            errors["quote"] = [QuoteRequiredMessage];
        }

        if (string.IsNullOrWhiteSpace(values.Name))
        {
            errors["name"] = [NameRequiredMessage];
        }

        return errors;
    }

    /// <summary>Builds a new testimonial from what a Manager typed. It is hidden unless <see cref="TestimonialValues.IsShown"/> is true.</summary>
    /// <param name="values">What was typed.</param>
    /// <param name="position">The place in the order, from 1.</param>
    /// <param name="now">The current instant, which makes the id.</param>
    /// <returns>The new, unsaved testimonial, or a validation error naming the broken fields.</returns>
    public static Result<Testimonial> Create(TestimonialValues values, int position, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(values);
        ArgumentOutOfRangeException.ThrowIfLessThan(position, 1);

        var errors = Check(values);
        if (errors.Count > 0)
        {
            return Result.Failure<Testimonial>(Error.Validation(SiteSettings.InvalidCode, SiteSettings.InvalidMessage, errors));
        }

        var testimonial = new Testimonial(Guid.CreateVersion7(now), now)
        {
            Position = position,
            IsShown = values.IsShown ?? false,
        };
        testimonial.Apply(values);
        return Result.Success(testimonial);
    }

    /// <summary>Changes the testimonial to what a Manager typed. A failure changes nothing.</summary>
    /// <param name="values">What was typed; a null <see cref="TestimonialValues.IsShown"/> keeps the testimonial shown or hidden as it is.</param>
    /// <returns>What changed (nothing when the form holds the same values), or a validation error naming the broken fields.</returns>
    public Result<TestimonialChanges> Update(TestimonialValues values)
    {
        ArgumentNullException.ThrowIfNull(values);
        var errors = Check(values);
        if (errors.Count > 0)
        {
            return Result.Failure<TestimonialChanges>(Error.Validation(SiteSettings.InvalidCode, SiteSettings.InvalidMessage, errors));
        }

        var oldName = Name;
        var oldStars = Stars;
        var fields = Apply(values);
        bool? nowShown = null;
        if (values.IsShown is { } shown && shown != IsShown)
        {
            IsShown = shown;
            nowShown = shown;
        }

        return Result.Success(new TestimonialChanges(fields, oldName, Name, oldStars, Stars, nowShown));
    }

    /// <summary>Takes the testimonial off the website.</summary>
    /// <returns>True when it was shown and is now hidden.</returns>
    public bool Hide()
    {
        var changed = IsShown;
        IsShown = false;
        return changed;
    }

    /// <summary>Puts the testimonial on the website.</summary>
    /// <returns>True when it was hidden and is now shown.</returns>
    public bool Show()
    {
        var changed = !IsShown;
        IsShown = true;
        return changed;
    }

    /// <summary>Trades places in the order with another testimonial.</summary>
    /// <param name="other">The other testimonial.</param>
    public void SwapPositionWith(Testimonial other)
    {
        ArgumentNullException.ThrowIfNull(other);
        (Position, other.Position) = (other.Position, Position);
    }

    private static bool Differs(string? current, string? typed, out string? next)
    {
        var trimmed = typed?.Trim();
        next = string.IsNullOrEmpty(trimmed) ? null : trimmed;
        return !string.Equals(current, next, StringComparison.Ordinal);
    }

    // Sets every typed value and names the fields that were different, in form order.
    private List<string> Apply(TestimonialValues values)
    {
        var fields = new List<string>();
        if (Differs(Quote, values.Quote, out var quote))
        {
            Quote = quote!;
            fields.Add("quote");
        }

        if (Differs(Name, values.Name, out var name))
        {
            Name = name!;
            fields.Add("name");
        }

        if (Differs(TeamOrRole, values.TeamOrRole, out var team))
        {
            TeamOrRole = team;
            fields.Add("teamOrRole");
        }

        var stars = values.Stars is { } typed ? (int)typed : 0;
        if (stars != Stars)
        {
            Stars = stars;
            fields.Add("stars");
        }

        return fields;
    }
}

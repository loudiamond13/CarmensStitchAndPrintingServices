using System.Globalization;
using Csps.Application.Common;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// Builds the detail of the <c>testimonial.*</c> audit entries (AUDIT-01, T-11-54). An entry names the person the testimonial is from.
/// A change names every changed field in a <c>fields=</c> pair and then holds <c>name=old&gt;new</c> and <c>stars=old&gt;new</c> for the
/// short values that changed; a pair that would not fit the column is left out, so the entry is always written. The quote and the team
/// line are named and never copied, so the audit log holds no customer words.
/// </summary>
public static class TestimonialAuditDetail
{
    /// <summary>The target type of every testimonial audit entry.</summary>
    public const string TargetType = "Testimonial";

    private const char FieldSeparator = ',';

    /// <summary>Writes the detail of an added, hidden, shown or deleted testimonial: the name.</summary>
    /// <param name="testimonial">The testimonial.</param>
    /// <returns>The detail text.</returns>
    public static string Named(Testimonial testimonial)
    {
        ArgumentNullException.ThrowIfNull(testimonial);
        return AuditDetailFormat.Join(AuditDetailFormat.Pair("name", testimonial.Name));
    }

    /// <summary>Writes the detail of a changed testimonial.</summary>
    /// <param name="change">What changed.</param>
    /// <returns>The detail text.</returns>
    public static string Changed(TestimonialChanges change)
    {
        ArgumentNullException.ThrowIfNull(change);

        var parts = new List<string> { AuditDetailFormat.Pair("fields", string.Join(FieldSeparator, change.Fields)) };
        if (change.Fields.Contains("name"))
        {
            parts.Add(AuditDetailFormat.Change("name", change.OldName, change.NewName));
        }

        if (change.Fields.Contains("stars"))
        {
            parts.Add(AuditDetailFormat.Change("stars", change.OldStars.ToString(CultureInfo.InvariantCulture), change.NewStars.ToString(CultureInfo.InvariantCulture)));
        }

        return AuditDetailFormat.Fit([.. parts]);
    }

    /// <summary>Writes the detail of a move: the name and the old and new place.</summary>
    /// <param name="testimonial">The testimonial that moved.</param>
    /// <param name="oldPosition">The place before.</param>
    /// <returns>The detail text.</returns>
    public static string Moved(Testimonial testimonial, int oldPosition)
    {
        ArgumentNullException.ThrowIfNull(testimonial);
        return AuditDetailFormat.Join(
            AuditDetailFormat.Pair("name", testimonial.Name),
            AuditDetailFormat.Change(
                "position",
                oldPosition.ToString(CultureInfo.InvariantCulture),
                testimonial.Position.ToString(CultureInfo.InvariantCulture)));
    }
}

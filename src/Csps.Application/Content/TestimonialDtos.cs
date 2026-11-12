using Csps.Application.Common;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>One testimonial as the Manager's Testimonials tab reads it (CONT-03, D-05).</summary>
/// <param name="Id">The testimonial id.</param>
/// <param name="Quote">The customer's words.</param>
/// <param name="Name">The name shown under the quote.</param>
/// <param name="TeamOrRole">The team or role line; null when not set.</param>
/// <param name="Stars">The rating, 1 to 5.</param>
/// <param name="Position">The place in the order, from 1.</param>
/// <param name="IsShown">True while the testimonial can show on the website.</param>
/// <param name="Version">The text an edit must send back.</param>
public sealed record TestimonialDto(Guid Id, string Quote, string Name, string? TeamOrRole, int Stars, int Position, bool IsShown, string Version)
{
    /// <summary>Maps a testimonial to the DTO (manual mapping, PRD section 3.3).</summary>
    /// <param name="testimonial">The testimonial.</param>
    /// <returns>The DTO.</returns>
    public static TestimonialDto From(Testimonial testimonial)
    {
        ArgumentNullException.ThrowIfNull(testimonial);
        return new TestimonialDto(
            testimonial.Id,
            testimonial.Quote,
            testimonial.Name,
            testimonial.TeamOrRole,
            testimonial.Stars,
            testimonial.Position,
            testimonial.IsShown,
            RowVersions.ToText(testimonial.RowVersion));
    }
}

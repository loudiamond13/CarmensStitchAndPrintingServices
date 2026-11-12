using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// The testimonial form (CONT-03, SEC-07), for adding and for editing. Any other member in the body is ignored: the order, who changed
/// the testimonial and when come from the server (SEC-08).
/// </summary>
/// <param name="Quote">The customer's words, required, at most 300 characters.</param>
/// <param name="Name">The name, required, at most 60 characters.</param>
/// <param name="TeamOrRole">The team or role line, at most 80 characters; empty for none.</param>
/// <param name="Stars">The rating, a whole number from 1 to 5.</param>
/// <param name="IsShown">True to show the testimonial on the website. A new testimonial is hidden when this is missing; an edit keeps it as it is when this is missing.</param>
/// <param name="Version">The version the form was opened with; required when editing, ignored when adding.</param>
public sealed record TestimonialRequest(string? Quote, string? Name, string? TeamOrRole, decimal? Stars, bool? IsShown, string? Version)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing part.</summary>
    public static TestimonialRequest Empty { get; } = new(null, null, null, null, null, null);

    /// <summary>Gets what the form holds, for the domain.</summary>
    /// <returns>The values.</returns>
    public TestimonialValues ToValues() => new(Quote, Name, TeamOrRole, Stars, IsShown);
}

/// <summary>The move form: which way a testimonial goes in the order.</summary>
/// <param name="Direction">"up" or "down".</param>
public sealed record MoveTestimonialRequest(string? Direction)
{
    /// <summary>Gets the request used when the body is empty or unreadable.</summary>
    public static MoveTestimonialRequest Empty { get; } = new((string?)null);
}

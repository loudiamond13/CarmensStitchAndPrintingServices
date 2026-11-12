using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager lists every testimonial, shown and hidden, in display order, each with the version an edit must send back
/// (CONT-03). The list is read from the database, not the public cache.
/// </summary>
/// <param name="testimonials">The testimonial store.</param>
public sealed class ListTestimonialsHandler(ITestimonials testimonials)
{
    /// <summary>Returns the testimonials.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The testimonials in display order.</returns>
    public async Task<Result<IReadOnlyList<TestimonialDto>>> HandleAsync(CancellationToken cancellationToken)
    {
        var rows = await testimonials.ListAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success<IReadOnlyList<TestimonialDto>>([.. rows.Select(TestimonialDto.From)]);
    }
}

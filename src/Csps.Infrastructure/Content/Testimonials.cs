using Csps.Application.Ports;
using Csps.Domain.Content;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Content;

/// <summary>
/// <see cref="ITestimonials"/> over EF: the list read is untracked, and the rows a handler changes are loaded as tracked rows and saved by
/// the unit of work, so the stamp, audit and cache-clearing interceptors all run. The staff read is never cached.
/// </summary>
internal sealed class Testimonials(CspsDbContext context) : ITestimonials
{
    public async Task<IReadOnlyList<Testimonial>> ListAsync(CancellationToken cancellationToken) =>
        await context.Testimonials
            .AsNoTracking()
            .OrderBy(testimonial => testimonial.Position)
            .ThenBy(testimonial => testimonial.Id)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

    public Task<Testimonial?> FindAsync(Guid id, CancellationToken cancellationToken) =>
        context.Testimonials.SingleOrDefaultAsync(testimonial => testimonial.Id == id, cancellationToken);

    // Positions are made unique by the add and the swap, which both run under the site-content lock.
    public Task<Testimonial?> FindNeighbourAsync(Testimonial testimonial, bool up, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(testimonial);
        var position = testimonial.Position;
        return up
            ? context.Testimonials.Where(other => other.Position < position).OrderByDescending(other => other.Position).ThenBy(other => other.Id).FirstOrDefaultAsync(cancellationToken)
            : context.Testimonials.Where(other => other.Position > position).OrderBy(other => other.Position).ThenBy(other => other.Id).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<int> GetNextPositionAsync(CancellationToken cancellationToken) =>
        (await context.Testimonials.MaxAsync(testimonial => (int?)testimonial.Position, cancellationToken).ConfigureAwait(false) ?? 0) + 1;

    public void Add(Testimonial testimonial) => context.Testimonials.Add(testimonial);

    public void Remove(Testimonial testimonial) => context.Testimonials.Remove(testimonial);
}

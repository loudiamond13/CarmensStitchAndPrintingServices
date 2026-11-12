using Csps.Domain.Content;

namespace Csps.Application.Ports;

/// <summary>
/// Access to the testimonials a Manager edits (CONT-03, D-05). Application never sees EF: reads map to the domain rows, and writes go
/// through tracked rows that the unit of work saves with their versions checked.
/// </summary>
public interface ITestimonials
{
    /// <summary>Reads every testimonial, shown and hidden, in display order (position, then id).</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The testimonials.</returns>
    Task<IReadOnlyList<Testimonial>> ListAsync(CancellationToken cancellationToken);

    /// <summary>Loads one testimonial as a tracked row, so a change to it is saved by the unit of work.</summary>
    /// <param name="id">The testimonial id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The testimonial, or null when there is none.</returns>
    Task<Testimonial?> FindAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Loads the testimonial next to a testimonial in the display order as a tracked row.</summary>
    /// <param name="testimonial">The testimonial that moves.</param>
    /// <param name="up">True for the one before it, false for the one after it.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The neighbour, or null when the testimonial is already at that end.</returns>
    Task<Testimonial?> FindNeighbourAsync(Testimonial testimonial, bool up, CancellationToken cancellationToken);

    /// <summary>Gives the place at the end of the display order.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>One more than the highest position, or 1 when there are none.</returns>
    Task<int> GetNextPositionAsync(CancellationToken cancellationToken);

    /// <summary>Marks a new testimonial for insert. The next save writes it.</summary>
    /// <param name="testimonial">The new testimonial.</param>
    void Add(Testimonial testimonial);

    /// <summary>Marks a tracked testimonial for removal. The next save deletes it.</summary>
    /// <param name="testimonial">The tracked testimonial.</param>
    void Remove(Testimonial testimonial);
}

using System.Globalization;
using Csps.Domain.Content;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the customer testimonials (D-05, CONT-03). The one rule that fits a row lives in a CHECK constraint, not a trigger (OR-7): the
/// stars are 1 to 5. No row is ever inserted by the migration, so a fresh database shows no testimonial.
/// </summary>
internal sealed class TestimonialConfiguration : IEntityTypeConfiguration<Testimonial>
{
    public void Configure(EntityTypeBuilder<Testimonial> builder)
    {
        builder.ToTable("Testimonials", table =>
            table.HasCheckConstraint(
                "CK_Testimonials_Stars",
                string.Create(CultureInfo.InvariantCulture, $"[Stars] BETWEEN {Testimonial.MinStars} AND {Testimonial.MaxStars}")));

        builder.HasKey(testimonial => testimonial.Id);
        builder.Property(testimonial => testimonial.Id).ValueGeneratedNever();

        builder.Property(testimonial => testimonial.Quote).IsRequired().IsUnicode().HasMaxLength(Testimonial.QuoteMaxLength);
        builder.Property(testimonial => testimonial.Name).IsRequired().IsUnicode().HasMaxLength(Testimonial.NameMaxLength);
        builder.Property(testimonial => testimonial.TeamOrRole).IsUnicode().HasMaxLength(Testimonial.TeamMaxLength);
        builder.Property(testimonial => testimonial.CreatedAtUtc).IsRequired();
        builder.Property(testimonial => testimonial.RowVersion).IsRowVersion();

        // The public read lists the shown testimonials in order, and the Manager's list shows all in order.
        builder.HasIndex(testimonial => new { testimonial.Position, testimonial.Id }).HasDatabaseName("IX_Testimonials_Position");
    }
}

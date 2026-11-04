using Csps.Infrastructure.Images;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the ImageDeletions table (JOB-02, D-20): the stored files waiting to be removed. The public id is indexed but not unique, and
/// the next-attempt time is indexed so the job finds due rows without a scan. There is no row version: a lease is taken by a
/// conditional update, and there is no trigger (OR-7).
/// </summary>
internal sealed class ImageDeletionConfiguration : IEntityTypeConfiguration<ImageDeletion>
{
    public void Configure(EntityTypeBuilder<ImageDeletion> builder)
    {
        builder.ToTable("ImageDeletions");

        builder.HasKey(row => row.Id);
        builder.Property(row => row.Id).ValueGeneratedOnAdd();

        builder.Property(row => row.PublicId).IsRequired().IsUnicode().HasMaxLength(ImageDeletion.PublicIdMaxLength);
        builder.Property(row => row.DeliveryType).IsRequired().IsUnicode(false).HasMaxLength(ImageDeletion.DeliveryTypeMaxLength);
        builder.Property(row => row.Reason).HasConversion<byte>();
        builder.Property(row => row.EnqueuedAtUtc).IsRequired();
        builder.Property(row => row.Attempts).IsRequired();
        builder.Property(row => row.NextAttemptAtUtc).IsRequired();
        builder.Property(row => row.LastFailureCode).IsUnicode(false).HasMaxLength(ImageDeletion.FailureCodeMaxLength);

        builder.HasIndex(row => row.PublicId).HasDatabaseName("IX_ImageDeletions_PublicId");
        builder.HasIndex(row => row.NextAttemptAtUtc).HasDatabaseName("IX_ImageDeletions_NextAttemptAtUtc");
    }
}

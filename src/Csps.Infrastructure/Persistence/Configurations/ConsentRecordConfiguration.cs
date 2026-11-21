using Csps.Domain.Analytics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the ConsentRecords table (ANL-07): one row per cookie decision, never edited. Nothing writes it any more (D-80); the retention job
/// only deletes old rows. No row version, no JSON column, no trigger (OR-7). It holds no address and no browser name (PRD section 5.4).
/// The index on the decision time serves the 13-month cleanup.
/// </summary>
internal sealed class ConsentRecordConfiguration : IEntityTypeConfiguration<ConsentRecord>
{
    public void Configure(EntityTypeBuilder<ConsentRecord> builder)
    {
        builder.ToTable("ConsentRecords");

        builder.HasKey(record => record.Id);
        builder.Property(record => record.Id).ValueGeneratedNever();
        builder.Property(record => record.ConsentId).IsRequired();
        builder.Property(record => record.PolicyVersion).IsRequired().IsUnicode(false).HasMaxLength(ConsentRecord.PolicyVersionMaxLength);
        builder.Property(record => record.Stats);
        builder.Property(record => record.Map).IsRequired();
        builder.Property(record => record.Gpc).IsRequired();
        builder.Property(record => record.Source).IsRequired();
        builder.Property(record => record.DecidedAtUtc).IsRequired();
        builder.HasIndex(record => record.DecidedAtUtc);
    }
}

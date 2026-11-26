using Csps.Domain.QuoteRequests;
using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the QuoteRequestNotes table (D-17): add-only staff notes that leave with their request. The author link never cascades, so
/// removing a user never removes or rewrites a note (SEC-08). No trigger (OR-7).
/// </summary>
internal sealed class QuoteRequestNoteConfiguration : IEntityTypeConfiguration<QuoteRequestNote>
{
    public void Configure(EntityTypeBuilder<QuoteRequestNote> builder)
    {
        builder.ToTable("QuoteRequestNotes");

        builder.HasKey(note => note.Id);
        builder.Property(note => note.Id).ValueGeneratedNever();

        builder.Property(note => note.Text).HasMaxLength(QuoteRequestRules.NoteMaxLength).IsRequired();
        builder.Property(note => note.CreatedAtUtc).IsRequired();

        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(note => note.CreatedById).OnDelete(DeleteBehavior.NoAction);

        builder.HasIndex(note => new { note.QuoteRequestId, note.CreatedAtUtc }).HasDatabaseName("IX_QuoteRequestNotes_QuoteRequestId_CreatedAtUtc");
        builder.HasIndex(note => note.CreatedById).HasDatabaseName("IX_QuoteRequestNotes_CreatedById");
    }
}

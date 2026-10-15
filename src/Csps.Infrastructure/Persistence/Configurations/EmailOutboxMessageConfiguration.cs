using Csps.Infrastructure.Email;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>Maps the email outbox (AUTH-13). The three protected columns hold Data Protection ciphertext, never clear text.</summary>
internal sealed class EmailOutboxMessageConfiguration : IEntityTypeConfiguration<EmailOutboxMessage>
{
    public void Configure(EntityTypeBuilder<EmailOutboxMessage> builder)
    {
        builder.ToTable("EmailOutbox");

        builder.HasKey(message => message.Id);
        builder.Property(message => message.Id).ValueGeneratedNever();

        builder.Property(message => message.Kind).HasConversion<byte>();
        builder.Property(message => message.ToAddress).IsRequired().IsUnicode().HasMaxLength(EmailOutboxMessage.ToAddressMaxLength);

        // nvarchar(max): the encrypted HTML part is long.
        builder.Property(message => message.ProtectedSubject).IsUnicode();
        builder.Property(message => message.ProtectedText).IsUnicode();
        builder.Property(message => message.ProtectedHtml).IsUnicode();

        builder.Property(message => message.LastErrorCode).IsUnicode(false).HasMaxLength(EmailOutboxMessage.ErrorCodeMaxLength);
        builder.Property(message => message.RowVersion).IsRowVersion();

        // The dispatcher's "what is due" scan and the per-account send counts.
        builder.HasIndex(message => new { message.SentAt, message.FailedAt, message.ExpiredAt, message.NextAttemptAt })
            .HasDatabaseName("IX_EmailOutbox_Due");
        builder.HasIndex(message => new { message.Kind, message.ToAddress, message.CreatedAt })
            .HasDatabaseName("IX_EmailOutbox_Kind_ToAddress_CreatedAt");
    }
}

using Csps.Domain.Content;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps the shop's public phone numbers (D-23): the E.164 number is unique, and a filtered unique index lets only one row be the main
/// number. There is no foreign key and no trigger (OR-7); the rules live in the domain and in these two indexes.
/// </summary>
internal sealed class SitePhoneNumberConfiguration : IEntityTypeConfiguration<SitePhoneNumber>
{
    public void Configure(EntityTypeBuilder<SitePhoneNumber> builder)
    {
        builder.ToTable("SitePhoneNumbers");

        // The domain sets the key (a version 7 id), so EF must treat a new row as Added.
        builder.HasKey(phone => phone.Id);
        builder.Property(phone => phone.Id).ValueGeneratedNever();

        builder.Property(phone => phone.Number).IsRequired().IsUnicode().HasMaxLength(SitePhoneNumber.NumberMaxLength);
        builder.Property(phone => phone.Label).IsUnicode().HasMaxLength(SitePhoneNumber.LabelMaxLength);
        builder.Property(phone => phone.CreatedAtUtc).IsRequired();

        builder.HasIndex(phone => phone.Number).IsUnique().HasDatabaseName("UX_SitePhoneNumbers_Number");
        builder.HasIndex(phone => phone.IsMain).IsUnique().HasFilter("[IsMain] = 1").HasDatabaseName("UX_SitePhoneNumbers_Main");
    }
}

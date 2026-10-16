using Csps.Application.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Csps.Infrastructure.Persistence.Configurations;

/// <summary>
/// The two staff roles ship with the migration as schema reference data (D-08 allows it: nothing seeds at startup).
/// Ids and concurrency stamps are fixed so the model snapshot never changes between runs.
/// </summary>
internal sealed class RoleConfiguration : IEntityTypeConfiguration<IdentityRole<Guid>>
{
    private static readonly Guid AdminId = new("6f3c0d52-7a1e-4b8a-9c24-5d1e8b7a3f01");
    private static readonly Guid ManagerId = new("a8d94e17-3c5b-4f62-8e09-b2c6d4f1a702");

    public void Configure(EntityTypeBuilder<IdentityRole<Guid>> builder)
    {
        builder.HasData(
            new IdentityRole<Guid>
            {
                Id = AdminId,
                Name = Roles.Admin,
                NormalizedName = "ADMIN",
                ConcurrencyStamp = "5b0c1e2a-9d34-4a7f-8c61-0e3f7a2d9b11",
            },
            new IdentityRole<Guid>
            {
                Id = ManagerId,
                Name = Roles.Manager,
                NormalizedName = "MANAGER",
                ConcurrencyStamp = "c47e8f90-2b1d-4e36-a5d8-7f9a0b3c6e22",
            });
    }
}

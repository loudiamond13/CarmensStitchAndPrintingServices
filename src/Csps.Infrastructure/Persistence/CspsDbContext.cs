using Csps.Domain.Auditing;
using Csps.Domain.Content;
using Csps.Infrastructure.Identity;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Persistence;

/// <summary>
/// The CSPS EF Core context, which also holds the Identity tables (staff accounts and roles). Configuration is Fluent only, one <c>IEntityTypeConfiguration</c> per entity
/// in <c>Persistence/Configurations</c>. The schema comes from migrations alone; nothing migrates or seeds
/// at application startup (D-08).
/// </summary>
/// <param name="options">Options built through <see cref="CspsDbContextOptions.Configure"/>.</param>
public sealed class CspsDbContext(DbContextOptions<CspsDbContext> options) : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options), IDataProtectionKeyContext
{
    /// <summary>The SiteSettings singleton (one row, Id 1).</summary>
    public DbSet<SiteSettings> SiteSettings => Set<SiteSettings>();

    /// <summary>The append-only audit log. Add entries only; the database rejects changes and removals.</summary>
    public DbSet<AuditEntry> AuditLog => Set<AuditEntry>();

    /// <summary>The Data Protection key ring, written only by the framework; each key is certificate-encrypted XML (SEC-04).</summary>
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(CspsDbContext).Assembly);
    }
}

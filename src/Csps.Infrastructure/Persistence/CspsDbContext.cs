using Csps.Domain.Content;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Persistence;

/// <summary>
/// The CSPS EF Core context. Configuration is Fluent only, one <c>IEntityTypeConfiguration</c> per entity
/// in <c>Persistence/Configurations</c>. The schema comes from migrations alone; nothing migrates or seeds
/// at application startup (D-08).
/// </summary>
/// <param name="options">Options built through <see cref="CspsDbContextOptions.Configure"/>.</param>
public sealed class CspsDbContext(DbContextOptions<CspsDbContext> options) : DbContext(options)
{
    /// <summary>The SiteSettings singleton (one row, Id 1).</summary>
    public DbSet<SiteSettings> SiteSettings => Set<SiteSettings>();

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);
    }
}

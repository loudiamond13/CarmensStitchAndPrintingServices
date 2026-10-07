using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Csps.Infrastructure.Persistence;

/// <summary>
/// Lets the <c>dotnet ef</c> tools create <see cref="CspsDbContext"/> without starting the web host and
/// without any environment variable (variables are never set machine-wide on this shared machine).
/// It always targets the local development database, <c>CSPS_Dev</c> on the dedicated <c>(localdb)\CSPS</c>
/// instance. Production schema changes go through reviewed idempotent scripts, never through this factory.
/// </summary>
public sealed class CspsDesignTimeDbContextFactory : IDesignTimeDbContextFactory<CspsDbContext>
{
    /// <summary>Integrated-security connection string of the local development database (no secret).</summary>
    public const string DevelopmentConnectionString = @"Server=(localdb)\CSPS;Database=CSPS_Dev;Integrated Security=true";

    /// <inheritdoc />
    public CspsDbContext CreateDbContext(string[] args)
    {
        var builder = new DbContextOptionsBuilder<CspsDbContext>();
        CspsDbContextOptions.Configure(builder, DevelopmentConnectionString);
        return new CspsDbContext(builder.Options);
    }
}

using Csps.Infrastructure.Auditing;
using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace Csps.Infrastructure.Persistence;

/// <summary>
/// The single way to configure <see cref="CspsDbContext"/> options. Used by dependency injection, the
/// design-time factory, the test fixture and the dev seed, so all of them get the same compatibility level,
/// migrations assembly and interceptors.
/// </summary>
public static class CspsDbContextOptions
{
    /// <summary>
    /// Configures SQL Server with the pinned compatibility level and this assembly's migrations, and adds the
    /// append-only audit-log interceptor (FND-10).
    /// </summary>
    /// <param name="builder">The options builder to configure.</param>
    /// <param name="connectionString">The SQL Server connection string.</param>
    /// <returns>The same builder, for chaining.</returns>
    public static DbContextOptionsBuilder Configure(DbContextOptionsBuilder builder, string connectionString)
    {
        ArgumentNullException.ThrowIfNull(builder);
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);

        builder.AddInterceptors(AuditLogAppendOnlyInterceptor.Instance);

        // Without a host (dotnet ef, tests, tools) Identity would build its model as schema version 1.
        if (builder.Options.FindExtension<CoreOptionsExtension>()?.ApplicationServiceProvider is null)
        {
            builder.UseApplicationServiceProvider(IdentityRegistration.ModelServices);
        }

        return builder.UseSqlServer(
            connectionString,
            sql => sql
                .UseCompatibilityLevel(SqlCompatibility.Level)
                .MigrationsAssembly(typeof(CspsDbContext).Assembly.GetName().Name));
    }
}

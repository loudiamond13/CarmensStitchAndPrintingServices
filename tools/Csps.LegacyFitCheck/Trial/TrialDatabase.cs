using Csps.Infrastructure.Persistence;
using Csps.LegacyFitCheck.Source;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;

namespace Csps.LegacyFitCheck.Trial;

/// <summary>Creates, migrates, checks and drops the throwaway trial database, only ever under a name the guard accepts.</summary>
internal static class TrialDatabase
{
    /// <summary>Builds the connection string of the trial database from the server template.</summary>
    public static string ConnectionStringFor(string serverTemplate, string name)
    {
        EnsureDisposable(name);
        return new SqlConnectionStringBuilder(serverTemplate) { InitialCatalog = name }.ConnectionString;
    }

    /// <summary>Creates the database, applies every migration and checks its compatibility level.</summary>
    public static async Task CreateAsync(string serverTemplate, string name, CancellationToken cancellationToken)
    {
        var context = OpenContext(serverTemplate, name);
        await using (context.ConfigureAwait(false))
        {
            await context.GetService<IRelationalDatabaseCreator>().CreateAsync(cancellationToken).ConfigureAwait(false);
            await context.Database.MigrateAsync(cancellationToken).ConfigureAwait(false);
        }

        await CheckCompatibilityAsync(serverTemplate, name, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// Reads the compatibility level of the database from the server catalog with LINQ and throws unless it equals
    /// <see cref="SqlCompatibility.Level"/>. The tool never sets the level.
    /// </summary>
    public static async Task CheckCompatibilityAsync(string serverTemplate, string name, CancellationToken cancellationToken)
    {
        EnsureDisposable(name);
        var catalog = LegacyDbContext.Open(LegacySource.Prepare(serverTemplate));
        await using (catalog.ConfigureAwait(false))
        {
            var level = await catalog.CatalogDatabases
                .Where(row => row.Name == name)
                .Select(static row => (int?)row.CompatibilityLevel)
                .SingleOrDefaultAsync(cancellationToken)
                .ConfigureAwait(false);
            if (level != SqlCompatibility.Level)
            {
                throw new InvalidOperationException("The trial database compatibility level is not the level CSPS pins.");
            }
        }
    }

    /// <summary>Drops the database.</summary>
    public static async Task DropAsync(string serverTemplate, string name)
    {
        var context = OpenContext(serverTemplate, name);
        await using (context.ConfigureAwait(false))
        {
            SqlConnection.ClearAllPools();
            await context.Database.EnsureDeletedAsync(CancellationToken.None).ConfigureAwait(false);
        }
    }

    /// <summary>Tells whether the database exists.</summary>
    public static async Task<bool> ExistsAsync(string serverTemplate, string name, CancellationToken cancellationToken)
    {
        var context = OpenContext(serverTemplate, name);
        await using (context.ConfigureAwait(false))
        {
            return await context.GetService<IRelationalDatabaseCreator>().ExistsAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    private static CspsDbContext OpenContext(string serverTemplate, string name)
    {
        var builder = new DbContextOptionsBuilder<CspsDbContext>();
        CspsDbContextOptions.Configure(builder, ConnectionStringFor(serverTemplate, name));
        return new CspsDbContext(builder.Options);
    }

    private static void EnsureDisposable(string name)
    {
        if (!TrialDatabaseName.IsDisposable(name))
        {
            throw new InvalidOperationException("The trial database name is not a CSPS_Test_{guid} name.");
        }
    }
}

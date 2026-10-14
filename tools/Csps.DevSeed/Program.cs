using System.Globalization;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Seeding;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;

// The explicit dev-seed command (D-08, FND-04). Exit codes: 0 done, 1 failed, 2 refused by the guard, 64 usage error.
// It only ever touches CSPS_Dev or CSPS_E2E, and only on (localdb)\MSSQLLocalDB or a loopback container (127.0.0.1,<port> or
// localhost,<port>): the guard runs on the final connection string before any connection opens. Seed content is fake
// or a bracketed placeholder; this tool never reads _local/.
const int Succeeded = 0;
const int Failed = 1;
const int Refused = 2;
const int UsageError = 64;

DevSeedOptions options;
try
{
    options = DevSeedOptions.Parse(args);
}
catch (ArgumentException error)
{
    await Console.Error.WriteLineAsync(error.Message).ConfigureAwait(false);
    return UsageError;
}

var check = DevSeedTargetGuard.Check(options.ConnectionString);
if (!check.Allowed)
{
    await Console.Error.WriteLineAsync($"Refused: {check.Reason}").ConfigureAwait(false);
    return Refused;
}

try
{
    var builder = new DbContextOptionsBuilder<CspsDbContext>();
    CspsDbContextOptions.Configure(builder, options.ConnectionString);
    var db = new CspsDbContext(builder.Options);
    await using (db.ConfigureAwait(false))
    {
        if (options.Reset)
        {
            await db.Database.EnsureDeletedAsync().ConfigureAwait(false);
            Console.WriteLine($"Dropped {check.DatabaseName}.");
        }

        // Create the database first so it can be pinned to the same compatibility level as EF's SQL and the
        // test databases (D-13); SQL Server would otherwise create it at the server default.
        var creator = db.GetService<IRelationalDatabaseCreator>();
        if (!await creator.ExistsAsync().ConfigureAwait(false))
        {
            await creator.CreateAsync().ConfigureAwait(false);
            Console.WriteLine($"Created {check.DatabaseName}.");
        }

        // ALTER DATABASE takes no parameters; the only value spliced in is the compile-time int constant.
#pragma warning disable EF1003
        await db.Database.ExecuteSqlRawAsync(
            "ALTER DATABASE CURRENT SET COMPATIBILITY_LEVEL = " + SqlCompatibility.Level.ToString(CultureInfo.InvariantCulture) + ";")
            .ConfigureAwait(false);
#pragma warning restore EF1003

        await db.Database.MigrateAsync().ConfigureAwait(false);
        Console.WriteLine($"Migrated {check.DatabaseName} (compatibility level {SqlCompatibility.Level}).");

        var results = await new DevSeeder(DevSeedSteps.All, TimeProvider.System).RunAsync(db).ConfigureAwait(false);
        foreach (var result in results)
        {
            Console.WriteLine($"  [{result.Order}] {result.Name}: {(result.Changed ? "changed" : "unchanged")}");
        }
    }

    Console.WriteLine("Dev seed finished.");
    return Succeeded;
}
catch (Exception error)
{
    await Console.Error.WriteLineAsync($"Failed: {error.Message}").ConfigureAwait(false);
    return Failed;
}

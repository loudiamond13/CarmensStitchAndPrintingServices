using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.Seeding;

/// <summary>
/// Command-line options of <c>tools/Csps.DevSeed</c>. Parsing never decides whether a database is allowed;
/// <see cref="DevSeedTargetGuard"/> checks the final connection string afterwards.
/// </summary>
public sealed class DevSeedOptions
{
    /// <summary>The default target: <c>CSPS_Dev</c> on the dedicated <c>(localdb)\CSPS</c> instance.</summary>
    public const string DefaultConnectionString = @"Server=(localdb)\CSPS;Database=CSPS_Dev;Integrated Security=true";

    /// <summary>One-line usage text.</summary>
    public const string Usage =
        "Usage: dotnet run --project tools/Csps.DevSeed -- [--reset] [--database CSPS_Dev|CSPS_E2E] [--connection <connection string>]";

    private const string ResetFlag = "--reset";
    private const string DatabaseFlag = "--database";
    private const string ConnectionFlag = "--connection";

    private DevSeedOptions(bool reset, string connectionString)
    {
        Reset = reset;
        ConnectionString = connectionString;
    }

    /// <summary>Drop the database before migrating and seeding.</summary>
    public bool Reset { get; }

    /// <summary>The connection string the command will use, before the guard runs.</summary>
    public string ConnectionString { get; }

    /// <summary>Parses the command-line arguments. Flags are case-sensitive.</summary>
    /// <param name="args">The arguments after <c>--</c>.</param>
    /// <returns>The options.</returns>
    /// <exception cref="ArgumentException">An argument is unknown, repeated or missing its value, or both
    /// <c>--database</c> and <c>--connection</c> were given.</exception>
    public static DevSeedOptions Parse(string[] args)
    {
        ArgumentNullException.ThrowIfNull(args);

        var reset = false;
        string? database = null;
        string? connection = null;

        for (var index = 0; index < args.Length; index++)
        {
            switch (args[index])
            {
                case ResetFlag:
                    if (reset)
                    {
                        throw UsageError($"{ResetFlag} was given more than once.");
                    }

                    reset = true;
                    break;
                case DatabaseFlag:
                    database = TakeValue(args, ref index, DatabaseFlag, database);
                    break;
                case ConnectionFlag:
                    connection = TakeValue(args, ref index, ConnectionFlag, connection);
                    break;
                default:
                    throw UsageError($"Unknown argument '{args[index]}'.");
            }
        }

        if (database is not null && connection is not null)
        {
            throw UsageError($"Give either {DatabaseFlag} or {ConnectionFlag}, not both.");
        }

        var connectionString = connection
            ?? (database is null
                ? DefaultConnectionString
                : new SqlConnectionStringBuilder(DefaultConnectionString) { InitialCatalog = database }.ConnectionString);

        return new DevSeedOptions(reset, connectionString);
    }

    private static string TakeValue(string[] args, ref int index, string flag, string? current)
    {
        if (current is not null)
        {
            throw UsageError($"{flag} was given more than once.");
        }

        var valueIndex = index + 1;
        if (valueIndex >= args.Length
            || string.IsNullOrWhiteSpace(args[valueIndex])
            || args[valueIndex].StartsWith("--", StringComparison.Ordinal))
        {
            throw UsageError($"{flag} needs a value.");
        }

        index = valueIndex;
        return args[valueIndex];
    }

    private static ArgumentException UsageError(string message) => new($"{message} {Usage}");
}

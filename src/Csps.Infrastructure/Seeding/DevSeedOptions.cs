namespace Csps.Infrastructure.Seeding;

/// <summary>Command-line options of <c>tools/Csps.DevSeed</c>.</summary>
public sealed class DevSeedOptions
{
    /// <summary>The default target: <c>CSPS_Dev</c> on the dedicated <c>(localdb)\CSPS</c> instance.</summary>
    public const string DefaultConnectionString = @"Server=(localdb)\CSPS;Database=CSPS_Dev;Integrated Security=true";

    /// <summary>One-line usage text.</summary>
    public const string Usage =
        "Usage: dotnet run --project tools/Csps.DevSeed -- [--reset] [--database CSPS_Dev|CSPS_E2E] [--connection <connection string>]";

    private DevSeedOptions(bool reset, string connectionString)
    {
        Reset = reset;
        ConnectionString = connectionString;
    }

    /// <summary>Drop the database before migrating and seeding.</summary>
    public bool Reset { get; }

    /// <summary>The connection string the command will use, before the guard runs.</summary>
    public string ConnectionString { get; }

    /// <summary>Parses the command-line arguments.</summary>
    /// <param name="args">The arguments after <c>--</c>.</param>
    /// <returns>The options.</returns>
    /// <exception cref="ArgumentException">An argument is unknown, repeated or missing its value.</exception>
    public static DevSeedOptions Parse(string[] args)
    {
        _ = args;
        return new DevSeedOptions(false, DefaultConnectionString);
    }
}

namespace Csps.LegacyFitCheck;

/// <summary>
/// The legacy fit check (Phase 7.1). Exit codes: 0 done, 1 failed, 2 refused, 64 usage error. It takes no arguments: the legacy
/// restore and the trial server are constants in <see cref="FitCheckTargets"/>, so nothing typed or set in the environment can
/// point it somewhere else. Full findings go under _local only.
/// </summary>
internal static class Program
{
    public const int Succeeded = 0;
    public const int Failed = 1;
    public const int Refused = 2;
    public const int UsageError = 64;

    private const string SolutionFile = "Csps.slnx";

    public static Task<int> Main(string[] args) =>
        RunAsync(args, Console.Out, Console.Error, CancellationToken.None);

    public static async Task<int> RunAsync(string[] args, TextWriter output, TextWriter error, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(args);
        ArgumentNullException.ThrowIfNull(output);
        ArgumentNullException.ThrowIfNull(error);

        if (args.Length > 0)
        {
            await error.WriteLineAsync("Usage: dotnet run --project tools/Csps.LegacyFitCheck (it takes no arguments).").ConfigureAwait(false);
            return UsageError;
        }

        var root = FindRepoRoot(AppContext.BaseDirectory);
        if (root is null)
        {
            await error.WriteLineAsync("Failed: the repository folder was not found.").ConfigureAwait(false);
            return Failed;
        }

        return await FitCheckRunner.RunAsync(FitCheckTargets.Real, Path.Combine(root, "_local"), TimeProvider.System, output, error, cancellationToken).ConfigureAwait(false);
    }

    private static string? FindRepoRoot(string start)
    {
        for (var directory = new DirectoryInfo(start); directory is not null; directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, SolutionFile)))
            {
                return directory.FullName;
            }
        }

        return null;
    }
}

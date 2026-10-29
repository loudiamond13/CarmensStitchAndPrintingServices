namespace Csps.LegacyFitCheck;

/// <summary>Entry point (placeholder until the tracer is built).</summary>
internal static class Program
{
    public const int Succeeded = 0;
    public const int Failed = 1;
    public const int Refused = 2;
    public const int UsageError = 64;

    public static Task<int> Main(string[] args) =>
        RunAsync(args, Console.Out, Console.Error, CancellationToken.None);

    public static Task<int> RunAsync(string[] args, TextWriter output, TextWriter error, CancellationToken cancellationToken) =>
        Task.FromResult(Succeeded);
}

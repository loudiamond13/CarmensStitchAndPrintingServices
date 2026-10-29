namespace Csps.LegacyFitCheck;

/// <summary>The end-to-end run (placeholder until the tracer is built).</summary>
internal static class FitCheckRunner
{
    public static Task<int> RunAsync(
        FitCheckTargets targets,
        string localRoot,
        TimeProvider time,
        TextWriter output,
        TextWriter error,
        CancellationToken cancellationToken,
        FitCheckHooks? hooks = null) => Task.FromResult(1);
}

namespace Csps.LegacyFitCheck;

/// <summary>Seams for tests to watch a run.</summary>
/// <param name="AfterTrialCreated">Called with the trial database name once it exists.</param>
internal sealed record FitCheckHooks(Func<string, CancellationToken, Task>? AfterTrialCreated = null);

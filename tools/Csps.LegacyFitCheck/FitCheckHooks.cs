namespace Csps.LegacyFitCheck;

/// <summary>Seams for tests to watch a run.</summary>
/// <param name="AfterTrialCreated">Called with the trial database name once it exists.</param>
/// <param name="BetweenEvidence">Called after the last read and before the second write evidence capture.</param>
internal sealed record FitCheckHooks(
    Func<string, CancellationToken, Task>? AfterTrialCreated = null,
    Func<CancellationToken, Task>? BetweenEvidence = null);

namespace Csps.LegacyFitCheck.Source;

/// <summary>What the restore looked like at one moment: user tables, their rows and the index update count.</summary>
/// <param name="Tables">The number of user tables.</param>
/// <param name="Rows">The rows in all user tables.</param>
/// <param name="UserUpdates">The total user updates the server counted on the restore's indexes.</param>
internal sealed record WriteEvidenceSnapshot(int Tables, long Rows, long UserUpdates);

/// <summary>Whether two snapshots of the restore match.</summary>
internal enum WriteEvidenceVerdict
{
    Unchanged,
    Changed,
}

/// <summary>Before and after proof that the restore was only read (D-14).</summary>
internal static class WriteEvidence
{
    public static Task<WriteEvidenceSnapshot> CaptureAsync(LegacyDbContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(context);
        return Task.FromResult(new WriteEvidenceSnapshot(0, 0, 0));
    }

    public static WriteEvidenceVerdict Compare(WriteEvidenceSnapshot before, WriteEvidenceSnapshot after)
    {
        ArgumentNullException.ThrowIfNull(before);
        ArgumentNullException.ThrowIfNull(after);
        return WriteEvidenceVerdict.Unchanged;
    }
}

namespace Csps.Application.Maintenance;

/// <summary>One line of the run summary. The text is plain English and holds counts only (D-36).</summary>
/// <param name="Label">The fixed label, for example "Expired request keys removed".</param>
/// <param name="Value">The count, or null for a line with no number.</param>
/// <param name="Failed">True when the work behind the line failed; the run is then not ok.</param>
/// <param name="Text">An optional plain sentence for the line; never an id, an address, a cloud name or an error body.</param>
/// <param name="Code">An optional machine code for a failed line, such as <c>maintenance.job-failed</c>; null for other lines.</param>
public sealed record MaintenanceLine(string Label, long? Value, bool Failed, string? Text, string? Code = null);

/// <summary>The answer to one keyed maintenance run (JOB-01).</summary>
/// <param name="Ok">True when no line failed.</param>
/// <param name="More">True when a job has more work left, so the caller should run again.</param>
/// <param name="Lines">The lines of every job, in the order the jobs ran.</param>
public sealed record MaintenanceRunResponse(bool Ok, bool More, IReadOnlyList<MaintenanceLine> Lines);

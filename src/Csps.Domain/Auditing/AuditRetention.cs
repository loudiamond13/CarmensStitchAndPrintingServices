namespace Csps.Domain.Auditing;

/// <summary>How long audit entries are kept (D-32). The purge job deletes older rows, and the viewer offers no date earlier than this.</summary>
public static class AuditRetention
{
    /// <summary>The number of months an entry is kept: the owner's 8-month rule.</summary>
    public const int Months = 8;
}

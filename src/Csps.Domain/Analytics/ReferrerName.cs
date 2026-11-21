namespace Csps.Domain.Analytics;

/// <summary>The length limit of the source column that the kept analytics tables read (D-28, D-56, D-80).</summary>
public static class ReferrerName
{
    /// <summary>The longest host name that is stored.</summary>
    public const int MaxLength = 253;
}

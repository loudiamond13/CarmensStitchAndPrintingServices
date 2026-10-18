namespace Csps.Domain.Common;

/// <summary>
/// A record with an edit version that changes on every staff edit (SEC-07). The attribution stamp uses it to tell a staff
/// edit from a bookkeeping write, so only a staff edit sets the "last changed" values.
/// </summary>
public interface IEditVersioned
{
    /// <summary>Gets the edit version: a new value on every staff edit.</summary>
    Guid EditVersion { get; }
}

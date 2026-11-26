namespace Csps.Application.Ports;

/// <summary>The quote requests one sender (a mobile number or an email) saved in a recent window (D-37).</summary>
/// <param name="Times">When each was received, oldest first.</param>
public sealed record QuoteSenderRecent(IReadOnlyList<DateTimeOffset> Times)
{
    /// <summary>Gets how many requests the sender saved in the window.</summary>
    public int Count => Times.Count;
}

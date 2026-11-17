namespace Csps.Application.Ports;

/// <summary>The random salt of each business day, used to hash address prefixes (ANL-05, D-07).</summary>
public interface IAnalyticsSalts
{
    /// <summary>Returns the day's salt: 32 random bytes made on first use and then the same for every caller that day.</summary>
    /// <param name="day">The business day.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The 32-byte salt.</returns>
    Task<byte[]> ForDayAsync(DateOnly day, CancellationToken cancellationToken);
}

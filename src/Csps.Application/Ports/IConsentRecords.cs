using Csps.Domain.Analytics;

namespace Csps.Application.Ports;

/// <summary>Where consent decisions are kept (ANL-07). Records are only added; the unit of work saves them.</summary>
public interface IConsentRecords
{
    /// <summary>Adds one decision to be saved with the unit of work.</summary>
    /// <param name="record">The decision.</param>
    void Add(ConsentRecord record);
}

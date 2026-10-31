namespace Csps.Domain.Orders;

/// <summary>The last order number given out in one business year (ORD-14, D-23). One row per year.</summary>
public sealed class OrderNumberCounter
{
    // Used by EF Core (constructor binding) and by Start.
    private OrderNumberCounter(int year, int lastValue)
    {
        Year = year;
        LastValue = lastValue;
    }

    /// <summary>Gets the business year.</summary>
    public int Year { get; private set; }

    /// <summary>Gets the last sequence given out; 0 before the first order of the year.</summary>
    public int LastValue { get; private set; }

    /// <summary>Starts the counter of a year at zero.</summary>
    /// <param name="year">The business year.</param>
    /// <returns>The new counter.</returns>
    public static OrderNumberCounter Start(int year) => new(year, 0);

    /// <summary>Gives out the next sequence.</summary>
    /// <returns>The new <see cref="LastValue"/>, starting at 1.</returns>
    public int Next() => ++LastValue;

    /// <summary>Lifts the counter to at least a value, so an imported number is never given out again. It never lowers the counter.</summary>
    /// <param name="value">The highest sequence already in use.</param>
    public void EnsureAtLeast(int value) => LastValue = Math.Max(LastValue, value);
}

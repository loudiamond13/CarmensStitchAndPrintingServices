namespace Csps.Domain.Analytics;

/// <summary>Turns counts into whole percents for the stats lists.</summary>
public static class Shares
{
    /// <summary>Whole percents that add up to 100 (all zeros when every count is zero). Leftover points go to the largest remainders, the earlier item first on a tie.</summary>
    public static IReadOnlyList<int> LargestRemainder(IReadOnlyList<long> counts) => throw new NotImplementedException();
}

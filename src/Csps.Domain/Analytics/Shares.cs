namespace Csps.Domain.Analytics;

/// <summary>Turns counts into whole percents for the stats lists.</summary>
public static class Shares
{
    /// <summary>Whole percents that add up to 100 (all zeros when every count is zero). Leftover points go to the largest remainders, the earlier item first on a tie.</summary>
    public static IReadOnlyList<int> LargestRemainder(IReadOnlyList<long> counts)
    {
        var total = counts.Sum();
        if (total == 0)
        {
            return counts.Select(_ => 0).ToArray();
        }

        var percents = counts.Select(count => (int)(count * 100 / total)).ToArray();
        var missing = 100 - percents.Sum();

        var byRemainder = Enumerable.Range(0, counts.Count)
            .OrderByDescending(index => counts[index] * 100 % total)
            .ThenBy(index => index);

        foreach (var index in byRemainder.Take(missing))
        {
            percents[index]++;
        }

        return percents;
    }
}

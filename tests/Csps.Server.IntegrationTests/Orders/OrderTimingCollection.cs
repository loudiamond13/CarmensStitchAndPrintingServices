namespace Csps.Server.IntegrationTests.Orders;

/// <summary>The order timing test runs with nothing else in the assembly running beside it, so other classes never share its CPU or database.</summary>
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class OrderTimingRunsAlone
{
    /// <summary>The collection name.</summary>
    public const string Name = "Order list timing, run alone";
}

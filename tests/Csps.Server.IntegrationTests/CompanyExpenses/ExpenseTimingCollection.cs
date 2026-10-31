namespace Csps.Server.IntegrationTests.CompanyExpenses;

/// <summary>The expense timing test runs with nothing else in the assembly running beside it, so other classes never share its CPU or database.</summary>
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class ExpenseTimingRunsAlone
{
    /// <summary>The collection name.</summary>
    public const string Name = "Expense list timing, run alone";
}

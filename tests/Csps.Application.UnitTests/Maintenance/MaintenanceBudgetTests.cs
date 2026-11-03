using Csps.Application.Maintenance;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Application.UnitTests.Maintenance;

/// <summary>JOB-01: the pass budget is measured with the injected clock and lasts 90 seconds by default.</summary>
public sealed class MaintenanceBudgetTests
{
    [Fact]
    public void TheDefaultBudgetIsNinetySeconds()
    {
        MaintenanceBudget.DefaultDuration.ShouldBe(TimeSpan.FromSeconds(90));
    }

    [Fact]
    public void ABudgetIsNotSpentUntilItsDeadline()
    {
        var clock = new FakeTimeProvider();
        var budget = new MaintenanceBudget(clock);

        budget.IsSpent.ShouldBeFalse();
        budget.Remaining.ShouldBe(TimeSpan.FromSeconds(90));

        clock.Advance(TimeSpan.FromSeconds(89));
        budget.IsSpent.ShouldBeFalse();
        budget.Remaining.ShouldBe(TimeSpan.FromSeconds(1));

        clock.Advance(TimeSpan.FromSeconds(1));
        budget.IsSpent.ShouldBeTrue();
        budget.Remaining.ShouldBe(TimeSpan.Zero);

        clock.Advance(TimeSpan.FromMinutes(5));
        budget.Remaining.ShouldBe(TimeSpan.Zero);
    }

    [Fact]
    public void ACustomDurationIsHonoured()
    {
        var clock = new FakeTimeProvider();
        var budget = new MaintenanceBudget(clock, TimeSpan.FromSeconds(10));

        clock.Advance(TimeSpan.FromSeconds(10));

        budget.IsSpent.ShouldBeTrue();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public void ADurationThatIsNotPositiveIsRefused(int seconds)
    {
        Should.Throw<ArgumentOutOfRangeException>(() => new MaintenanceBudget(new FakeTimeProvider(), TimeSpan.FromSeconds(seconds)));
    }

    [Fact]
    public void ANullClockIsRefused()
    {
        Should.Throw<ArgumentNullException>(() => new MaintenanceBudget(null!));
    }
}

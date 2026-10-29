namespace Csps.LegacyFitCheck.Tests;

public sealed class ProgramTests
{
    [Fact]
    public async Task AnyArgumentIsAUsageErrorBeforeAnythingConnects()
    {
        using var output = new StringWriter();
        using var error = new StringWriter();

        var exit = await Program.RunAsync(["--source", "x"], output, error, TestContext.Current.CancellationToken);

        exit.ShouldBe(Program.UsageError);
        error.ToString().ShouldStartWith("Usage:");
        output.ToString().ShouldBeEmpty();
    }
}

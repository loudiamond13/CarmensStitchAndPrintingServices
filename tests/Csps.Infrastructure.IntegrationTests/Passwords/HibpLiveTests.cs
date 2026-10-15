using System.Security.Cryptography;
using Csps.Application.Ports;
using Csps.Infrastructure.Passwords;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Csps.Infrastructure.IntegrationTests.Passwords;

/// <summary>
/// An opt-in smoke test of the real Pwned Passwords service. It is skipped unless <c>CSPS_LIVE_HIBP=1</c> is set for
/// the process, so the default run never touches the internet.
/// </summary>
public sealed class HibpLiveTests
{
    private const string EnableVariable = "CSPS_LIVE_HIBP";

    [Fact]
    public async Task TheLiveServiceKnowsPasswordAndDoesNotKnowARandomPassword()
    {
        Assert.SkipUnless(
            Environment.GetEnvironmentVariable(EnableVariable) == "1",
            $"Set {EnableVariable}=1 for this process to call the real Pwned Passwords service.");

        var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings { EnvironmentName = Environments.Production });
        builder.Services.AddCspsPasswordChecks(builder.Environment);
        using var host = builder.Build();
        using var scope = host.Services.CreateScope();
        var checker = scope.ServiceProvider.GetRequiredService<IPwnedPasswords>();
        var random = RandomNumberGenerator.GetString("abcdefghijklmnopqrstuvwxyz0123456789", 40);

        (await checker.CheckAsync("password", TestContext.Current.CancellationToken)).ShouldBe(BreachCheckResult.Breached);
        (await checker.CheckAsync(random, TestContext.Current.CancellationToken)).ShouldBe(BreachCheckResult.NotBreached);
    }
}

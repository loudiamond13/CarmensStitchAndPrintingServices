using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Infrastructure.Passwords;
using Csps.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.IntegrationTests.Passwords;

/// <summary>AUTH-11, D-14: the HIBP client waits at most about three seconds, and each environment gets the right checker.</summary>
public sealed class PasswordCheckRegistrationTests
{
    [Fact]
    public void TheRealClientIsRegisteredOutsideTestingWithAThreeSecondLimit()
    {
        using var host = Build(Environments.Production);

        using var scope = host.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<IPwnedPasswords>().ShouldBeOfType<HibpPwnedPasswords>();
        scope.ServiceProvider.GetRequiredService<PasswordRules>().ShouldNotBeNull();

        var options = host.Services.GetRequiredService<IOptionsMonitor<HttpStandardResilienceOptions>>()
            .Get(PasswordCheckRegistration.HttpClientName + "-standard");
        options.TotalRequestTimeout.Timeout.ShouldBe(TimeSpan.FromSeconds(3));
        options.AttemptTimeout.Timeout.ShouldBe(TimeSpan.FromSeconds(2));
    }

#if DEBUG
    [Theory]
    [InlineData("Pwned#Pass2026", BreachCheckResult.Breached)]
    [InlineData("Hibp-Down#2026", BreachCheckResult.Unavailable)]
    [InlineData("Tela-Sukat-7381", BreachCheckResult.NotBreached)]
    [InlineData("password", BreachCheckResult.NotBreached)]
    public async Task TestingGetsTheOfflineStandInWithTwoDocumentedSamples(string password, BreachCheckResult expected)
    {
        using var host = Build(CspsApiFactory.EnvironmentName);

        using var scope = host.Services.CreateScope();
        var checker = scope.ServiceProvider.GetRequiredService<IPwnedPasswords>();

        // By name: the stand-in does not exist in Release builds, and this file must still compile there.
        checker.GetType().Name.ShouldBe("TestingPwnedPasswords");
        (await checker.CheckAsync(password, TestContext.Current.CancellationToken)).ShouldBe(expected);
    }
#else
    [Fact]
    public void TestingIsRefusedInAReleaseBuild()
    {
        var failure = Should.Throw<InvalidOperationException>(() => Build(CspsApiFactory.EnvironmentName));

        failure.Message.ShouldContain("QUAL-05");
    }
#endif

    [Fact]
    public void TheCommonPasswordListIsRegisteredAsASingleton()
    {
        using var host = Build(Environments.Production);

        var first = host.Services.GetRequiredService<ICommonPasswords>();

        first.ShouldBeOfType<CommonPasswordList>();
        host.Services.GetRequiredService<ICommonPasswords>().ShouldBeSameAs(first);
    }

    private static IHost Build(string environment)
    {
        var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings { EnvironmentName = environment });
        builder.Services.AddCspsPasswordChecks(builder.Environment);
        return builder.Build();
    }
}

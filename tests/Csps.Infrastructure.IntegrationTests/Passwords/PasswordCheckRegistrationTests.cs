using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Infrastructure.Passwords;
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

    private static IHost Build(string environment)
    {
        var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings { EnvironmentName = environment });
        builder.Services.AddCspsPasswordChecks(builder.Environment);
        return builder.Build();
    }
}

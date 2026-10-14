using System.Globalization;
using Csps.Server.Logging;
using Csps.Testing;
using Microsoft.Extensions.DependencyInjection;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Compact;
using Serilog.Parsing;

namespace Csps.Server.IntegrationTests.Logging;

/// <summary>
/// FND-07, CWE-532 and CWE-117: secrets never reach the logs, matched by exact name or suffix (never by substring,
/// so <c>StatusCode</c> survives), and a value with CR/LF cannot forge a second log line.
/// </summary>
public sealed class SensitiveDataMaskingTests
{
    private const string SecretValue = "hunter2-SECRET";

    [Theory]
    [InlineData("Password")]
    [InlineData("password")]
    [InlineData("NewPassword")]
    [InlineData("Code")]
    [InlineData("Otp")]
    [InlineData("ApiKey")]
    [InlineData("Authorization")]
    [InlineData("Cookie")]
    [InlineData("ConnectionString")]
    [InlineData("CertificatePassword")]
    [InlineData("CertificateBase64")]
    [InlineData("SigningKey")]
    [InlineData("Secret")]
    [InlineData("ClientSecret")]
    [InlineData("Token")]
    [InlineData("RefreshToken")]
    [InlineData("PasswordHash")]
    [InlineData("passwordhash")]
    [InlineData("SecurityStamp")]
    public void SecretNamesAreSensitive(string name) => SensitiveDataMasking.IsSensitive(name).ShouldBeTrue();

    [Theory]
    [InlineData("StatusCode")]
    [InlineData("ZipCode")]
    [InlineData("RequestPath")]
    [InlineData("TokenCount")]
    [InlineData("Elapsed")]
    [InlineData("")]
    public void OrdinaryNamesAreNotSensitive(string name) => SensitiveDataMasking.IsSensitive(name).ShouldBeFalse();

    [Fact]
    public void EnricherMasksTopLevelProperties()
    {
        var sink = new CollectingSink();
        using (var logger = new LoggerConfiguration().Enrich.With<SensitiveDataMaskingEnricher>().WriteTo.Sink(sink).CreateLogger())
        {
            logger.Information("{Password} {StatusCode}", SecretValue, 200);
        }

        var logEvent = sink.Events.ShouldHaveSingleItem();
        LogEvents.Scalar(logEvent, "Password").ShouldBe(SensitiveDataMasking.Mask);
        LogEvents.Scalar(logEvent, "StatusCode").ShouldBe(200);
        logEvent.RenderMessage(CultureInfo.InvariantCulture).ShouldNotContain(SecretValue);
    }

    [Fact]
    public void EnricherMasksDictionaryEntriesByKey()
    {
        var sink = new CollectingSink();
        var values = new Dictionary<string, string>(StringComparer.Ordinal) { ["Email"] = "staff@example.com", ["Password"] = SecretValue };
        using (var logger = new LoggerConfiguration().Enrich.With<SensitiveDataMaskingEnricher>().WriteTo.Sink(sink).CreateLogger())
        {
            logger.Information("{@Values}", values);
        }

        var dictionary = sink.Events.ShouldHaveSingleItem().Properties["Values"].ShouldBeOfType<DictionaryValue>();
        var entries = dictionary.Elements.ToDictionary(static entry => (string)entry.Key.Value!, static entry => ((ScalarValue)entry.Value).Value, StringComparer.Ordinal);
        entries["Email"].ShouldBe("staff@example.com");
        entries["Password"].ShouldBe(SensitiveDataMasking.Mask);
    }

    [Fact]
    public void PolicyMasksInsideDestructuredObjects()
    {
        var sink = new CollectingSink();
        using (var logger = new LoggerConfiguration().Destructure.With<SensitiveDataDestructuringPolicy>().WriteTo.Sink(sink).CreateLogger())
        {
            logger.Information("{@Login}", NewLogin());
        }

        var login = sink.Events.ShouldHaveSingleItem().Properties["Login"].ShouldBeOfType<StructureValue>();
        AssertMaskedLogin(login);
    }

    [Fact]
    public void ApiPipelineMasksSecrets()
    {
        using var factory = new CspsApiFactory();
        var logger = factory.Services.GetRequiredService<Serilog.ILogger>();

        logger.Information("Masking probe {Password} {@Login}", SecretValue, NewLogin());

        var logEvent = factory.Sink.Events
            .Where(static e => e.MessageTemplate.Text.StartsWith("Masking probe", StringComparison.Ordinal))
            .ShouldHaveSingleItem();
        LogEvents.Scalar(logEvent, "Password").ShouldBe(SensitiveDataMasking.Mask);
        AssertMaskedLogin(logEvent.Properties["Login"].ShouldBeOfType<StructureValue>());
        Render(logEvent).ShouldNotContain(SecretValue);
    }

    [Fact]
    public async Task QueryStringIsNotLogged()
    {
        const string Path = "/api/v1/nope";
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri($"{Path}?token={SecretValue}", UriKind.Relative), TestContext.Current.CancellationToken);

        var logEvent = await LogEvents.RequestCompletionAsync(factory.Sink, Path, TestContext.Current.CancellationToken);
        LogEvents.Scalar(logEvent, "RequestPath").ShouldBe(Path);
        factory.Sink.Events.Select(Render).ShouldAllBe(static line => !line.Contains(SecretValue, StringComparison.Ordinal));
    }

    [Fact]
    public void CompactJsonEscapesNewlines()
    {
        var template = new MessageTemplateParser().Parse("{Value}");
        var logEvent = new LogEvent(
            new DateTimeOffset(2026, 10, 7, 0, 0, 0, TimeSpan.Zero),
            LogEventLevel.Information,
            exception: null,
            template,
            [new LogEventProperty("Value", new ScalarValue("line1\r\nFAKE ENTRY"))]);

        var output = Render(logEvent);

        output.ShouldNotContain('\r');
        output.ShouldNotContain('\n');
        output.ShouldContain(@"line1\r\nFAKE ENTRY");
    }

    private static LoginAttempt NewLogin() => new("staff@example.com", SecretValue, new Credentials(SecretValue));

    private static void AssertMaskedLogin(StructureValue login)
    {
        var properties = login.Properties.ToDictionary(static p => p.Name, static p => p.Value, StringComparer.Ordinal);
        properties["Email"].ShouldBeOfType<ScalarValue>().Value.ShouldBe("staff@example.com");
        properties["Password"].ShouldBeOfType<ScalarValue>().Value.ShouldBe(SensitiveDataMasking.Mask);
        var credentials = properties["Credentials"].ShouldBeOfType<StructureValue>();
        credentials.Properties.ShouldHaveSingleItem().Value.ShouldBeOfType<ScalarValue>().Value.ShouldBe(SensitiveDataMasking.Mask);
    }

    /// <summary>Formats one event exactly as the log file does, without the trailing newline.</summary>
    private static string Render(LogEvent logEvent)
    {
        using var writer = new StringWriter(CultureInfo.InvariantCulture);
        new CompactJsonFormatter().Format(logEvent, writer);
        return writer.ToString().TrimEnd('\r', '\n');
    }

    /// <summary>A login request shape with a secret at the top level and one nested inside.</summary>
    private sealed record LoginAttempt(string Email, string Password, Credentials Credentials);

    /// <summary>A nested object whose only property is a secret.</summary>
    private sealed record Credentials(string RefreshToken);
}

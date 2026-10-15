using System.Globalization;
using MailKit.Security;
using Csps.Application.Ports;
using Csps.Infrastructure.Email;
using Csps.Infrastructure.IntegrationTests.Auditing;
using Csps.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using MimeKit;

namespace Csps.Infrastructure.IntegrationTests.Email;

/// <summary>
/// D-26, D-27, QUAL-05: mail leaves only over TLS from the business sender, the SMTP settings are checked when the
/// host starts (never echoing a value), and the Testing environment gets the in-memory sink instead of SMTP.
/// </summary>
public sealed class MailKitTransportTests
{
    private const string SecretPassword = "never-print-this-password-9f3a";

    private static readonly EmailSenderOptions Sender = new() { FromAddress = "no-reply@cspstailoring.com", FromName = "Carmen's Stitch & Printing" };

    [Fact]
    public void MessageComesFromTheBusinessSenderWithNoReplyToAndTextBeforeHtml()
    {
        var email = new OutgoingEmail("paolo.garcia@gmail.com", "048213 is your CSPS sign-in code", "plain 048213", "<p>html 048213</p>");

        var message = MailKitTransport.BuildMessage(email, Sender);

        message.From.Mailboxes.ShouldHaveSingleItem().Name.ShouldBe("Carmen's Stitch & Printing");
        message.From.Mailboxes.Single().Address.ShouldBe("no-reply@cspstailoring.com");
        message.To.Mailboxes.ShouldHaveSingleItem().Address.ShouldBe("paolo.garcia@gmail.com");
        message.ReplyTo.ShouldBeEmpty();
        message.Headers.Contains(HeaderId.ReplyTo).ShouldBeFalse();
        message.Subject.ShouldBe("048213 is your CSPS sign-in code");

        var body = message.Body.ShouldBeOfType<MultipartAlternative>();
        body.Count.ShouldBe(2);
        var text = body[0].ShouldBeOfType<TextPart>();
        var html = body[1].ShouldBeOfType<TextPart>();
        text.ContentType.MimeType.ShouldBe("text/plain");
        text.Text.Trim().ShouldBe("plain 048213");
        html.ContentType.MimeType.ShouldBe("text/html");
        html.Text.Trim().ShouldBe("<p>html 048213</p>");
    }

    [Fact]
    public void OnlyRequiredTlsModesAreReachable()
    {
        MailKitTransport.SocketOptionsFor(SmtpSecurity.StartTls).ShouldBe(SecureSocketOptions.StartTls);
        MailKitTransport.SocketOptionsFor(SmtpSecurity.SslOnConnect).ShouldBe(SecureSocketOptions.SslOnConnect);
        Should.Throw<ArgumentOutOfRangeException>(() => MailKitTransport.SocketOptionsFor((SmtpSecurity)42));
    }

    [Theory]
    [InlineData("StartTls", SmtpSecurity.StartTls)]
    [InlineData("SslOnConnect", SmtpSecurity.SslOnConnect)]
    public void TheTwoTlsNamesParse(string name, SmtpSecurity expected)
    {
        var options = Full();
        options.Security = name;

        options.TryGetSecurity(out var security).ShouldBeTrue();
        security.ShouldBe(expected);
    }

    [Fact]
    public void FullSmtpSettingsPass()
    {
        new SmtpOptions.Validator().Validate(name: null, Full()).Succeeded.ShouldBeTrue();
        new SmtpOptions.Validator().Validate(name: null, Full(security: "SslOnConnect", port: 465)).Succeeded.ShouldBeTrue();
    }

    [Fact]
    public void EmptyHostFailsNamingTheSetting()
    {
        var result = new SmtpOptions.Validator().Validate(name: null, Full(host: " "));

        result.Failed.ShouldBeTrue();
        result.FailureMessage.ShouldContain("Smtp:Host");
        result.FailureMessage.ShouldContain("docs/operations/mail-setup.md");
        result.FailureMessage.ShouldNotContain(SecretPassword);
    }

    [Theory]
    [InlineData("None")]
    [InlineData("Auto")]
    [InlineData("StartTlsWhenAvailable")]
    [InlineData("starttls")]
    [InlineData("")]
    [InlineData("1")]
    public void AnythingButTheTwoTlsModesFailsWithoutEchoingTheValue(string security)
    {
        var result = new SmtpOptions.Validator().Validate(name: null, Full(security: security));

        result.Failed.ShouldBeTrue();
        result.FailureMessage.ShouldContain("Smtp:Security");
        result.FailureMessage.ShouldNotContain(SecretPassword);
        if (security.Length > 0)
        {
            result.FailureMessage.ShouldNotContain($"'{security}'");
        }
    }

    [Theory]
    [InlineData("Smtp:UserName")]
    [InlineData("Smtp:Password")]
    [InlineData("Smtp:Port")]
    public void MissingCredentialsOrBadPortFail(string setting)
    {
        var options = setting switch
        {
            "Smtp:UserName" => Full(userName: string.Empty),
            "Smtp:Password" => Full(password: string.Empty),
            _ => Full(port: 70000),
        };

        var result = new SmtpOptions.Validator().Validate(name: null, options);

        result.Failed.ShouldBeTrue();
        result.FailureMessage.ShouldContain(setting);
    }

    [Theory]
    [InlineData("", "Carmen's Stitch & Printing", "Email:FromAddress")]
    [InlineData("not-an-address", "Carmen's Stitch & Printing", "Email:FromAddress")]
    [InlineData("no-reply@cspstailoring.com", " ", "Email:FromName")]
    public void SenderSettingsAreChecked(string address, string name, string expectedSetting)
    {
        var result = new EmailSenderOptions.Validator().Validate(name: null, new EmailSenderOptions { FromAddress = address, FromName = name });

        result.Failed.ShouldBeTrue();
        result.FailureMessage.ShouldContain(expectedSetting);
        new EmailSenderOptions.Validator().Validate(name: null, Sender).Succeeded.ShouldBeTrue();
    }

    [Fact]
    public async Task DevelopmentWithoutSmtpSettingsStopsTheHostAtStart()
    {
        using var host = Build(Environments.Development, smtp: new Dictionary<string, string?> { ["Smtp:Password"] = SecretPassword });

        var failure = await Should.ThrowAsync<OptionsValidationException>(() => host.StartAsync(TestContext.Current.CancellationToken));

        failure.Message.ShouldContain("Smtp:Host");
        failure.Message.ShouldNotContain(SecretPassword);
    }

    [Fact]
    public async Task ProductionWithoutSmtpSettingsStopsTheHostAtStart()
    {
        using var host = Build(Environments.Production, smtp: []);

        var failure = await Should.ThrowAsync<OptionsValidationException>(() => host.StartAsync(TestContext.Current.CancellationToken));

        failure.Message.ShouldContain("Smtp:Host");
    }

    [Theory]
    [InlineData("Development")]
    [InlineData("Production")]
    public async Task OutsideTestingTheTransportIsSmtp(string environment)
    {
        using var host = Build(environment, smtp: FullSmtpSettings());

        await host.StartAsync(TestContext.Current.CancellationToken);

        host.Services.GetRequiredService<IEmailTransport>().ShouldBeOfType<MailKitTransport>();
        await host.StopAsync(TestContext.Current.CancellationToken);
    }

#if DEBUG
    [Fact]
    public async Task TestingGetsTheInMemorySinkAndNeedsNoSmtpSettings()
    {
        using var host = Build(CspsApiFactory.EnvironmentName, smtp: []);

        await host.StartAsync(TestContext.Current.CancellationToken);

        // By name: the sink type does not exist in Release builds, and this file must still compile there.
        host.Services.GetRequiredService<IEmailTransport>().GetType().Name.ShouldBe("InMemoryEmailSink");
        await host.StopAsync(TestContext.Current.CancellationToken);
    }
#else
    [Fact]
    public void TestingIsRefusedInAReleaseBuild()
    {
        var failure = Should.Throw<InvalidOperationException>(() => Build(CspsApiFactory.EnvironmentName, smtp: []));

        failure.Message.ShouldContain("QUAL-05");
    }
#endif

    private static Dictionary<string, string?> FullSmtpSettings() => new()
    {
        ["Smtp:Host"] = "smtp.test.invalid",
        ["Smtp:Port"] = "587",
        ["Smtp:Security"] = "StartTls",
        ["Smtp:UserName"] = "no-reply@cspstailoring.com",
        ["Smtp:Password"] = SecretPassword,
    };

    private static SmtpOptions Full(string host = "smtp.test.invalid", string security = "StartTls", int port = 587, string userName = "no-reply@cspstailoring.com", string password = SecretPassword) =>
        new() { Host = host, Security = security, Port = port, UserName = userName, Password = password };

    // The database is never opened: the dispatcher is off and nothing else touches it at start.
    private static IHost Build(string environment, Dictionary<string, string?> smtp)
    {
        var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings { EnvironmentName = environment, DisableDefaults = true });
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            [DependencyInjection.ConnectionStringKey] = $"Server=(localdb)\\MSSQLLocalDB;Database={TestDatabaseName.NewName()};Integrated Security=true",
            [TestCertificates.CertificateBase64Setting] = TestCertificates.Current.Base64,
            [TestCertificates.CertificatePasswordSetting] = TestCertificates.Current.Password,
            ["App:PublicBaseUrl"] = "https://localhost",
            ["Email:FromAddress"] = Sender.FromAddress,
            ["Email:FromName"] = Sender.FromName,
            ["Email:Dispatcher:Enabled"] = "false",
            ["Email:Dispatcher:SweepInterval"] = TimeSpan.FromSeconds(1).ToString("c", CultureInfo.InvariantCulture),
        });
        builder.Configuration.AddInMemoryCollection(smtp);
        builder.Services.AddSingleton<IRequestContext>(new FixedRequestContext());
        builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);
        return builder.Build();
    }
}

using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using Csps.Application.Ports;
using Csps.Infrastructure.Passwords;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;

namespace Csps.Infrastructure.IntegrationTests.Passwords;

/// <summary>
/// AUTH-11, D-12, T-04-58, T-04-59: only the first five characters of the SHA-1 leave the app, to the fixed HIBP
/// address, and every failure reads as Unavailable. No test here reaches the internet.
/// </summary>
public sealed class HibpPwnedPasswordsTests
{
    private const string Password = "Tela-Sukat-7381";
    private const string OtherLine = "0018A45C4D1DEF81644B54AB7F969B88D65:3";

    [Fact]
    public async Task SendsOneRangeRequestWithOnlyTheFiveCharacterPrefix()
    {
        var (prefix, suffix) = Hash(Password);
        var handler = new StubHandler(_ => Respond($"{suffix}:12\r\n{OtherLine}"));
        var client = Create(handler, out _);

        await client.CheckAsync(Password, TestContext.Current.CancellationToken);

        var request = handler.Requests.ShouldHaveSingleItem();
        request.Method.ShouldBe(HttpMethod.Get);
        request.RequestUri!.AbsoluteUri.ShouldBe($"https://api.pwnedpasswords.com/range/{prefix}");
        request.Headers.GetValues("Add-Padding").ShouldBe(["true"]);
        request.Headers.UserAgent.ToString().ShouldNotBeNullOrWhiteSpace();
        request.ToString().ShouldNotContain(suffix);
        request.ToString().ShouldNotContain(Password);
    }

    [Fact]
    public async Task TheAddressIgnoresAnyBaseAddressOnTheClient()
    {
        var handler = new StubHandler(_ => Respond(OtherLine));
        using var http = new HttpClient(handler) { BaseAddress = new Uri("https://evil.example/") };
        var client = new HibpPwnedPasswords(http, new FakeLogger<HibpPwnedPasswords>());

        await client.CheckAsync(Password, TestContext.Current.CancellationToken);

        handler.Requests.ShouldHaveSingleItem().RequestUri!.Host.ShouldBe("api.pwnedpasswords.com");
    }

    [Fact]
    public async Task ASuffixWithACountIsBreached()
    {
        var (_, suffix) = Hash(Password);
        var client = Create(new StubHandler(_ => Respond($"{OtherLine}\r\n{suffix}:12")), out _);

        (await client.CheckAsync(Password, TestContext.Current.CancellationToken)).ShouldBe(BreachCheckResult.Breached);
    }

    [Fact]
    public async Task ASuffixWithCountZeroIsPaddingAndNotBreached()
    {
        var (_, suffix) = Hash(Password);
        var client = Create(new StubHandler(_ => Respond($"{OtherLine}\r\n{suffix}:0")), out _);

        (await client.CheckAsync(Password, TestContext.Current.CancellationToken)).ShouldBe(BreachCheckResult.NotBreached);
    }

    [Fact]
    public async Task ABodyWithoutTheSuffixIsNotBreached()
    {
        var client = Create(new StubHandler(_ => Respond($"{OtherLine}\r\n011053FD0102E94D6AE2F8B83D76FAF94F6:1")), out _);

        (await client.CheckAsync(Password, TestContext.Current.CancellationToken)).ShouldBe(BreachCheckResult.NotBreached);
    }

    [Fact]
    public async Task ThePasswordIsNormalizedBeforeItIsHashed()
    {
        var (prefix, _) = Hash("Caf\u00e9-Tela-7381");
        var handler = new StubHandler(_ => Respond(OtherLine));
        var client = Create(handler, out _);

        await client.CheckAsync("Cafe\u0301-Tela-7381", TestContext.Current.CancellationToken);

        handler.Requests.ShouldHaveSingleItem().RequestUri!.AbsoluteUri.ShouldEndWith(prefix);
    }

    [Theory]
    [InlineData(HttpStatusCode.ServiceUnavailable)]
    [InlineData(HttpStatusCode.Forbidden)]
    [InlineData(HttpStatusCode.TooManyRequests)]
    [InlineData(HttpStatusCode.InternalServerError)]
    public async Task AFailureStatusIsUnavailableAndLogsOnlyTheStatus(HttpStatusCode status)
    {
        var client = Create(new StubHandler(_ => new HttpResponseMessage(status)), out var logger);

        (await client.CheckAsync(Password, TestContext.Current.CancellationToken)).ShouldBe(BreachCheckResult.Unavailable);

        var record = logger.Collector.GetSnapshot().ShouldHaveSingleItem();
        record.Level.ShouldBe(LogLevel.Warning);
        record.Message.ShouldContain(((int)status).ToString(CultureInfo.InvariantCulture));
    }

    [Fact]
    public async Task ANetworkFailureIsUnavailable()
    {
        var client = Create(new StubHandler(_ => throw new HttpRequestException("name resolution failed")), out _);

        (await client.CheckAsync(Password, TestContext.Current.CancellationToken)).ShouldBe(BreachCheckResult.Unavailable);
    }

    [Fact]
    public async Task ATimeoutIsUnavailable()
    {
        var client = Create(new StubHandler(_ => throw new TaskCanceledException("The request timed out.")), out _);

        (await client.CheckAsync(Password, TestContext.Current.CancellationToken)).ShouldBe(BreachCheckResult.Unavailable);
    }

    [Fact]
    public async Task CancellationByTheCallerIsNotSwallowed()
    {
        using var cancelled = new CancellationTokenSource();
        await cancelled.CancelAsync();
        var client = Create(new StubHandler(_ => Respond(OtherLine)), out _);

        await Should.ThrowAsync<OperationCanceledException>(() => client.CheckAsync(Password, cancelled.Token));
    }

    [Theory]
    [InlineData("")]
    [InlineData("<html><body>Bad gateway</body></html>")]
    [InlineData("not-a-hash:12")]
    [InlineData("0018A45C4D1DEF81644B54AB7F969B88D65:many")]
    public async Task AMalformedBodyIsUnavailable(string body)
    {
        var client = Create(new StubHandler(_ => Respond(body)), out _);

        (await client.CheckAsync(Password, TestContext.Current.CancellationToken)).ShouldBe(BreachCheckResult.Unavailable);
    }

    [Fact]
    public async Task NoLogRecordHoldsThePasswordOrAnyHashCharacters()
    {
        var (prefix, suffix) = Hash(Password);
        var logger = new FakeLogger<HibpPwnedPasswords>();
        StubHandler[] handlers =
        [
            new(_ => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)),
            new(_ => throw new HttpRequestException($"failed for {Password} {prefix}{suffix}")),
            new(_ => Respond($"{suffix}:12")),
        ];

        foreach (var handler in handlers)
        {
            using var http = new HttpClient(handler);
            await new HibpPwnedPasswords(http, logger).CheckAsync(Password, TestContext.Current.CancellationToken);
        }

        var text = string.Join('\n', logger.Collector.GetSnapshot().Select(record => record.Message + record.Exception));
        text.ShouldNotContain(Password);
        text.ShouldNotContain(prefix, Case.Insensitive);
        text.ShouldNotContain(suffix, Case.Insensitive);
    }

    [Fact]
    public void ParserFindsTheSuffixIgnoringMalformedLinesAndPadding()
    {
        const string suffix = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";
        var body = $"garbage\r\n:5\r\nSHORT:4\r\n0018A45C4D1DEF81644B54AB7F969B88D65:0\r\n{suffix}:7\r\n";

        HibpRangeParser.Contains(body, suffix).ShouldBeTrue();
        HibpRangeParser.Contains(body, "0018A45C4D1DEF81644B54AB7F969B88D65").ShouldBeFalse();
        HibpRangeParser.Contains(body, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA").ShouldBeFalse();
        HibpRangeParser.Contains(string.Empty, suffix).ShouldBeFalse();
    }

    [Fact]
    public void ParserComparesTheSuffixOrdinallyWithoutAcceptingPartialMatches()
    {
        const string suffix = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";

        HibpRangeParser.Contains($"{suffix}1:7", suffix).ShouldBeFalse();
        HibpRangeParser.Contains($"{suffix.ToLowerInvariant()}:7", suffix).ShouldBeFalse();
        HibpRangeParser.Contains($"{suffix}:-3", suffix).ShouldBeFalse();
    }

    [Theory]
    [InlineData("0018A45C4D1DEF81644B54AB7F969B88D65:3", true)]
    [InlineData("0018A45C4D1DEF81644B54AB7F969B88D65:0", true)]
    [InlineData("<html>", false)]
    [InlineData("", false)]
    [InlineData("0018A45C4D1DEF81644B54AB7F969B88D65:x", false)]
    public void ParserKnowsAWellFormedBody(string body, bool expected) =>
        HibpRangeParser.HasEntries(body).ShouldBe(expected);

    [SuppressMessage("Security", "CA5350:Do Not Use Weak Cryptographic Algorithms", Justification = "The HIBP range protocol is defined over SHA-1.")]
    private static (string Prefix, string Suffix) Hash(string password)
    {
        var hex = Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(password.Normalize(NormalizationForm.FormC))));
        return (hex[..5], hex[5..]);
    }

    private static HttpResponseMessage Respond(string body) => new(HttpStatusCode.OK) { Content = new StringContent(body) };

    private static HibpPwnedPasswords Create(StubHandler handler, out FakeLogger<HibpPwnedPasswords> logger)
    {
        logger = new FakeLogger<HibpPwnedPasswords>();
        return new HibpPwnedPasswords(new HttpClient(handler), logger);
    }

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public List<HttpRequestMessage> Requests { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Requests.Add(request);
            return Task.FromResult(respond(request));
        }
    }
}

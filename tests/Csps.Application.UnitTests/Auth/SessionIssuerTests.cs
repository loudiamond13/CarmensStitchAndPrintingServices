using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Identity;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Auth;

/// <summary>AUTH-05, D-43: starting a session stores only a token hash and a coarse device label, and issues a token that names the session.</summary>
public sealed class SessionIssuerTests
{
    private const string RefreshToken = "refresh-token-0123456789-abcdefghijklmnopqrstuvwxyz";
    private const string ChromeOnAndroid =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

    private static readonly DateTimeOffset Start = new(2026, 10, 14, 8, 0, 0, TimeSpan.Zero);
    private static readonly UserAccount User = new(
        Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10"), "paolo@example.com", "Paolo", "Reyes", "Manager",
        true, true, true, null, false, null);

    [Fact]
    public async Task StartsAPersistentSessionWithOnlyTheTokenHashStored()
    {
        var harness = new Harness();

        var issued = await harness.Issuer.StartAsync(User, persistent: true, TestContext.Current.CancellationToken);

        var (session, token) = harness.Added.ShouldHaveSingleItem();
        session.UserId.ShouldBe(User.Id);
        session.Persistent.ShouldBeTrue();
        session.DeviceLabel.ShouldBe("Chrome on Android");
        session.AbsoluteExpiresAt.ShouldBe(Start.AddDays(90));
        token.SessionId.ShouldBe(session.Id);
        TokenHash.Equal(token.TokenHash, TokenHash.Compute(RefreshToken)).ShouldBeTrue();
        issued.RefreshToken.ShouldBe(RefreshToken);
        issued.CookieExpiresAt.ShouldBe(Start.AddDays(90));
    }

    [Fact]
    public async Task ABrowserSessionEndsInTwelveHoursAndHasNoCookieExpiry()
    {
        var harness = new Harness();

        var issued = await harness.Issuer.StartAsync(User, persistent: false, TestContext.Current.CancellationToken);

        issued.Response.Persistent.ShouldBeFalse();
        issued.Response.SessionExpiresAt.ShouldBe(Start.AddHours(12));
        issued.CookieExpiresAt.ShouldBeNull();
    }

    [Fact]
    public async Task TheAccessTokenIsIssuedForTheUserRoleAndNewSession()
    {
        var harness = new Harness();

        var issued = await harness.Issuer.StartAsync(User, persistent: false, TestContext.Current.CancellationToken);

        harness.AccessTokens.Received(1).Issue(User.Id, "Manager", harness.Added[0].Session.Id);
        issued.Response.AccessToken.ShouldBe("access-token");
        issued.Response.AccessTokenExpiresAt.ShouldBe(Start.AddMinutes(15));
        issued.Response.User.ShouldBe(new SessionUser(User.Id, "paolo@example.com", "Paolo", "Reyes", "Manager"));
    }

    [Fact]
    public async Task ResultsNeverPrintTheirTokens()
    {
        var harness = new Harness();

        var issued = await harness.Issuer.StartAsync(User, persistent: false, TestContext.Current.CancellationToken);

        issued.ToString().ShouldNotContain(RefreshToken);
        issued.Response.ToString().ShouldNotContain("access-token");
        new AccessToken("access-token", Start).ToString().ShouldNotContain("access-token");
    }

    [Fact]
    public async Task ANullUserOrACancelledCallIsRefused()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Issuer.StartAsync(null!, false, TestContext.Current.CancellationToken));
        using var cancelled = new CancellationTokenSource();
        await cancelled.CancelAsync();
        await Should.ThrowAsync<OperationCanceledException>(() => harness.Issuer.StartAsync(User, false, cancelled.Token));
    }

    private sealed class Harness
    {
        public Harness()
        {
            var sessions = Substitute.For<ISessions>();
            sessions.When(store => store.Add(Arg.Any<UserSession>(), Arg.Any<RefreshToken>()))
                .Do(call => Added.Add((call.ArgAt<UserSession>(0), call.ArgAt<RefreshToken>(1))));
            AccessTokens = Substitute.For<IAccessTokenIssuer>();
            AccessTokens.Issue(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<Guid>()).Returns(new AccessToken("access-token", Start.AddMinutes(15)));
            var random = Substitute.For<ISecureRandom>();
            random.NewToken().Returns(RefreshToken);
            var request = Substitute.For<IRequestContext>();
            request.UserAgent.Returns(ChromeOnAndroid);

            Issuer = new SessionIssuer(sessions, AccessTokens, random, request, new AuthSettings(), new FakeTimeProvider(Start));
        }

        public List<(UserSession Session, RefreshToken Token)> Added { get; } = [];

        public IAccessTokenIssuer AccessTokens { get; }

        public SessionIssuer Issuer { get; }
    }
}

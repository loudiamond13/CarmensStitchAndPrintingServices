using System.Net;
using Csps.Application.Auth;
using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Server.Composition;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.Security;
using Csps.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>AUTH-05, IN-04: the access token is a 15-minute HS256 JWT of type at+jwt with sub, role, sid and jti, and the test tokens have the same shape.</summary>
public sealed class AccessTokenTests
{
    private static readonly DateTimeOffset Start = new(2026, 10, 14, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid UserId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");
    private static readonly Guid SessionId = Guid.Parse("8a1d6f40-3b7e-4c52-9d0a-61f3c2b7e955");

    [Fact]
    public void TheIssuerWritesTheTypedTokenWithItsClaimsAndFifteenMinuteLifetime()
    {
        var issuer = NewIssuer(new FakeTimeProvider(Start));

        var access = issuer.Issue(UserId, Roles.Manager, SessionId);

        var token = new JsonWebToken(access.Token);
        token.Typ.ShouldBe("at+jwt");
        token.Alg.ShouldBe("HS256");
        token.Issuer.ShouldBe(TestJwt.Issuer);
        token.Audiences.ShouldHaveSingleItem().ShouldBe(TestJwt.Audience);
        token.GetClaim("sub").Value.ShouldBe(UserId.ToString("D"));
        token.GetClaim("role").Value.ShouldBe(Roles.Manager);
        token.GetClaim("sid").Value.ShouldBe(SessionId.ToString("D"));
        token.GetClaim("jti").Value.ShouldNotBeNullOrWhiteSpace();
        token.ValidFrom.ShouldBe(Start.UtcDateTime);
        token.ValidTo.ShouldBe(Start.AddMinutes(15).UtcDateTime);
        access.ExpiresAt.ShouldBe(Start.AddMinutes(15));
    }

    [Fact]
    public void EveryTokenGetsItsOwnId()
    {
        var issuer = NewIssuer(new FakeTimeProvider(Start));

        var first = new JsonWebToken(issuer.Issue(UserId, Roles.Admin, SessionId).Token).GetClaim("jti").Value;
        var second = new JsonWebToken(issuer.Issue(UserId, Roles.Admin, SessionId).Token).GetClaim("jti").Value;

        first.ShouldNotBe(second);
    }

    [Fact]
    public void TheTestTokenHasTheSameHeaderAndClaims()
    {
        var token = new JsonWebToken(TestTokens.For(Roles.Admin, new FakeTimeProvider(Start), UserId, sessionId: SessionId));

        token.Typ.ShouldBe("at+jwt");
        token.GetClaim("sub").Value.ShouldBe(UserId.ToString("D"));
        token.GetClaim("role").Value.ShouldBe(Roles.Admin);
        token.GetClaim("sid").Value.ShouldBe(SessionId.ToString("D"));
        token.GetClaim("jti").Value.ShouldNotBeNullOrWhiteSpace();
        token.ValidTo.ShouldBe(Start.AddMinutes(15).UtcDateTime);
    }

    [Fact]
    public async Task ATokenFromTheIssuerIsAcceptedByTheHost()
    {
        await using var baseFactory = new CspsApiFactory();
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<ISiteSettingsReader>();
            services.AddScoped<ISiteSettingsReader, FixedSiteSettingsReader>();
        }));
        using var client = factory.CreateClient();
        var access = NewIssuer(TimeProvider.System).Issue(UserId, Roles.Manager, SessionId);
        using var request = ApiRequests.Get("/api/v1/site-settings", access.Token);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public void TheIssuerRefusesAnUnusableKeyAndABlankRole()
    {
        var jwt = Options.Create(new JwtOptions { Issuer = TestJwt.Issuer, Audience = TestJwt.Audience, SigningKey = "short" });

        Should.Throw<InvalidOperationException>(() => new AccessTokenIssuer(jwt, new AuthSettings(), TimeProvider.System));
        Should.Throw<ArgumentException>(() => NewIssuer(TimeProvider.System).Issue(UserId, " ", SessionId));
    }

    private static AccessTokenIssuer NewIssuer(TimeProvider time) => new(
        Options.Create(new JwtOptions { Issuer = TestJwt.Issuer, Audience = TestJwt.Audience, SigningKey = TestJwt.SigningKeyBase64 }),
        new AuthSettings(),
        time);

    // Answers from memory, so a signed-in request succeeds without a database.
    private sealed class FixedSiteSettingsReader : ISiteSettingsReader
    {
        public ValueTask<SiteSettingsSnapshot> GetAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new SiteSettingsSnapshot(
                "Carmen's Stitch & Printing Services", "Asia/Manila", "PHP", "en-PH", string.Empty, string.Empty, string.Empty, string.Empty, "AAAAAAAAB9E="));
    }
}

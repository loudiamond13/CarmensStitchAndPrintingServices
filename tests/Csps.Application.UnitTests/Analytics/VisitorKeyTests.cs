using System.Security.Cryptography;
using System.Text;
using Csps.Application.Analytics;

namespace Csps.Application.UnitTests.Analytics;

/// <summary>ANL-05, T-12-37, T-12-38: the visitor id is stored as a SHA-256 and the address prefix as an HMAC with the day's salt.</summary>
public sealed class VisitorKeyTests
{
    private const string Token = "wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww";

    [Fact]
    public void TheVisitorHashIsTheSha256OfTheTokenBytes()
    {
        var hash = VisitorKey.HashVisitor(Token);

        hash.Length.ShouldBe(32);
        hash.ShouldBe(SHA256.HashData(Encoding.UTF8.GetBytes(Token)));
    }

    [Fact]
    public void TheSameTokenAlwaysGivesTheSameHashAndAnotherTokenAnotherHash()
    {
        VisitorKey.HashVisitor(Token).ShouldBe(VisitorKey.HashVisitor(Token));
        VisitorKey.HashVisitor(Token).ShouldNotBe(VisitorKey.HashVisitor(Token + "x"));
    }

    [Fact]
    public void TheVisitorHashDoesNotContainTheTokenBytes()
    {
        var token = Encoding.UTF8.GetBytes(Token);

        VisitorKey.HashVisitor(Token).AsSpan().IndexOf(token.AsSpan(0, 8)).ShouldBe(-1);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void ANullOrEmptyTokenIsRefused(string? token)
    {
        Should.Throw<ArgumentException>(() => VisitorKey.HashVisitor(token!));
    }

    [Fact]
    public void ANullPrefixGivesNoAddressHash()
    {
        VisitorKey.HashIp(null, Salt(1)).ShouldBeNull();
    }

    [Fact]
    public void TheAddressHashIsTheHmacSha256OfThePrefixWithTheSalt()
    {
        var hash = VisitorKey.HashIp("192.0.2.0", Salt(1)).ShouldNotBeNull();

        hash.Length.ShouldBe(32);
        hash.ShouldBe(HMACSHA256.HashData(Salt(1), Encoding.UTF8.GetBytes("192.0.2.0")));
    }

    [Fact]
    public void TheSamePrefixAndSaltAlwaysGiveTheSameHashAndAnotherSaltOrPrefixGivesAnother()
    {
        var hash = VisitorKey.HashIp("192.0.2.0", Salt(1));

        hash.ShouldBe(VisitorKey.HashIp("192.0.2.0", Salt(1)));
        hash.ShouldNotBe(VisitorKey.HashIp("192.0.2.0", Salt(2)));
        hash.ShouldNotBe(VisitorKey.HashIp("192.0.3.0", Salt(1)));
    }

    [Fact]
    public void TheAddressHashDoesNotContainThePrefixBytes()
    {
        var prefix = Encoding.UTF8.GetBytes("192.0.2.0");

        VisitorKey.HashIp("192.0.2.0", Salt(1)).ShouldNotBeNull().AsSpan().IndexOf(prefix.AsSpan(0, 6)).ShouldBe(-1);
    }

    [Fact]
    public void ANullSaltIsRefused()
    {
        Should.Throw<ArgumentNullException>(() => VisitorKey.HashIp("192.0.2.0", null!));
    }

    private static byte[] Salt(byte fill) => Enumerable.Repeat(fill, 32).ToArray();
}

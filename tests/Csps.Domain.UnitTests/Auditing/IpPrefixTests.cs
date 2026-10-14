using System.Net;
using Csps.Domain.Auditing;

namespace Csps.Domain.UnitTests.Auditing;

public sealed class IpPrefixTests
{
    [Theory]
    [InlineData("203.177.12.45", "203.177.12.0")]
    [InlineData("10.0.0.255", "10.0.0.0")]
    [InlineData("0.0.0.0", "0.0.0.0")]
    [InlineData("255.255.255.255", "255.255.255.0")]
    public void TruncatesIpv4ToSlash24(string address, string expected)
    {
        IpPrefix.From(IPAddress.Parse(address)).ShouldBe(expected);
    }

    [Theory]
    [InlineData("::ffff:203.177.12.45", "203.177.12.0")]
    [InlineData("::ffff:10.0.0.255", "10.0.0.0")]
    public void TreatsIpv4MappedIpv6AsIpv4(string address, string expected)
    {
        IpPrefix.From(IPAddress.Parse(address)).ShouldBe(expected);
    }

    [Theory]
    [InlineData("2001:db8:abcd:12::1", "2001:db8:abcd::")]
    [InlineData("2001:db8:abcd:ffff:ffff:ffff:ffff:ffff", "2001:db8:abcd::")]
    [InlineData("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff", "ffff:ffff:ffff::")]
    [InlineData("::1", "::")]
    public void TruncatesIpv6ToSlash48(string address, string expected)
    {
        IpPrefix.From(IPAddress.Parse(address)).ShouldBe(expected);
    }

    [Fact]
    public void DropsTheIpv6ScopeId()
    {
        var linkLocal = IPAddress.Parse("fe80::1%3");
        linkLocal.ScopeId.ShouldBe(3L);

        IpPrefix.From(linkLocal).ShouldBe("fe80::");
    }

    [Fact]
    public void ReturnsNullForNull()
    {
        IpPrefix.From(null).ShouldBeNull();
    }

    [Theory]
    [InlineData("203.177.12.45")]
    [InlineData("::ffff:203.177.12.45")]
    [InlineData("2001:db8:abcd:12::1")]
    [InlineData("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff")]
    [InlineData("fe80::1%3")]
    public void ResultFitsTheColumn(string address)
    {
        var prefix = IpPrefix.From(IPAddress.Parse(address));

        prefix.ShouldNotBeNull();
        prefix.Length.ShouldBeLessThanOrEqualTo(AuditEntry.IpPrefixMaxLength);
    }

    [Fact]
    public void AuditEntryStoresTheIpv6Prefix()
    {
        var entry = AuditEntry.Create(
            new DateTimeOffset(2026, 10, 7, 1, 2, 3, TimeSpan.Zero),
            actorUserId: null,
            "system.check",
            targetType: null,
            targetId: null,
            IPAddress.Parse("2001:db8:abcd:12::1"),
            userAgent: null,
            "0123456789abcdef0123456789abcdef",
            detail: null);

        entry.IpPrefix.ShouldBe("2001:db8:abcd::");
    }
}

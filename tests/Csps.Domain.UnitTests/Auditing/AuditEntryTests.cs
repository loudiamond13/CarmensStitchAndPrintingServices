using System.Net;
using Csps.Domain.Auditing;

namespace Csps.Domain.UnitTests.Auditing;

public sealed class AuditEntryTests
{
    private const string ChromeDesktop =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

    private const string CorrelationId = "0123456789abcdef0123456789abcdef";

    private static readonly DateTimeOffset OccurredAt = new(2026, 10, 7, 1, 2, 3, TimeSpan.Zero);

    private static readonly Guid Actor = new("6f9619ff-8b86-d011-b42d-00cf4fc964ff");

    [Fact]
    public void CreateMinimizesRequestFacts()
    {
        var entry = AuditEntry.Create(
            OccurredAt,
            Actor,
            "system.check",
            "SiteSettings",
            "1",
            IPAddress.Parse("203.177.12.45"),
            ChromeDesktop,
            CorrelationId,
            "detail");

        entry.IpPrefix.ShouldBe("203.177.12.0");
        entry.UserAgentFamily.ShouldBe("Chrome");
        entry.Id.ShouldBe(0L);
        entry.OccurredAtUtc.ShouldBe(OccurredAt);
        entry.OccurredAtUtc.Offset.ShouldBe(TimeSpan.Zero);
        entry.ActorUserId.ShouldBe(Actor);
        entry.Action.ShouldBe("system.check");
        entry.TargetType.ShouldBe("SiteSettings");
        entry.TargetId.ShouldBe("1");
        entry.CorrelationId.ShouldBe(CorrelationId);
        entry.Detail.ShouldBe("detail");
    }

    [Fact]
    public void CreateAllowsNullOptionalFields()
    {
        var entry = AuditEntry.Create(
            OccurredAt,
            actorUserId: null,
            "auth.sign-in-failed",
            targetType: null,
            targetId: null,
            remoteIp: null,
            userAgent: null,
            CorrelationId,
            detail: null);

        entry.ActorUserId.ShouldBeNull();
        entry.TargetType.ShouldBeNull();
        entry.TargetId.ShouldBeNull();
        entry.IpPrefix.ShouldBeNull();
        entry.UserAgentFamily.ShouldBe("Unknown");
        entry.Detail.ShouldBeNull();
    }

    [Fact]
    public void CreateNeverKeepsTheRawIpOrUserAgent()
    {
        var entry = Valid(remoteIp: IPAddress.Parse("203.177.12.45"), userAgent: ChromeDesktop);

        entry.IpPrefix.ShouldNotBe("203.177.12.45");
        entry.UserAgentFamily.ShouldNotBe(ChromeDesktop);
        entry.UserAgentFamily!.Length.ShouldBeLessThanOrEqualTo(AuditEntry.UserAgentFamilyMaxLength);
        entry.IpPrefix!.Length.ShouldBeLessThanOrEqualTo(AuditEntry.IpPrefixMaxLength);
    }

    [Fact]
    public void CreateRejectsNonUtcTimestamp()
    {
        var manila = new DateTimeOffset(2026, 10, 7, 9, 2, 3, TimeSpan.FromHours(8));

        var ex = Should.Throw<ArgumentException>(() => Valid(occurredAtUtc: manila));

        ex.ParamName.ShouldBe("occurredAtUtc");
    }

    [Theory]
    [InlineData("")]
    [InlineData("system")]
    [InlineData("System.check")]
    [InlineData("system.Check")]
    [InlineData(".system")]
    [InlineData("system.")]
    [InlineData("system..check")]
    [InlineData("system.check!")]
    [InlineData("system.ch eck")]
    [InlineData("system.ch/eck")]
    [InlineData("system.ch:eck")]
    [InlineData("system.ch{eck")]
    [InlineData("system_check.run")]
    public void CreateRejectsBadAction(string action)
    {
        var ex = Should.Throw<ArgumentException>(() => Valid(action: action));

        ex.ParamName.ShouldBe("action");
    }

    [Fact]
    public void CreateRejectsActionOverMaxLength()
    {
        var action = "a." + new string('b', AuditEntry.ActionMaxLength - 1);
        action.Length.ShouldBe(65);

        var ex = Should.Throw<ArgumentException>(() => Valid(action: action));

        ex.ParamName.ShouldBe("action");
    }

    [Theory]
    [InlineData("system.check")]
    [InlineData("auth.sign-in.failed")]
    [InlineData("order2.delete")]
    [InlineData("a.b")]
    public void CreateAcceptsWellFormedAction(string action)
    {
        Valid(action: action).Action.ShouldBe(action);
    }

    [Fact]
    public void CreateAcceptsActionAtMaxLength()
    {
        var action = "a." + new string('b', AuditEntry.ActionMaxLength - 2);

        Valid(action: action).Action.Length.ShouldBe(AuditEntry.ActionMaxLength);
    }

    [Fact]
    public void CreateRejectsNullAction()
    {
        Should.Throw<ArgumentNullException>(() => Valid(action: null!));
    }

    [Theory]
    [InlineData("0123456789abcdef0123456789abcde")]
    [InlineData("0123456789abcdef0123456789abcdef0")]
    [InlineData("0123456789ABCDEF0123456789ABCDEF")]
    [InlineData("0123456789abcdef0123456789abcdeg")]
    [InlineData("0123456789abcdef0123456789abcde/")]
    [InlineData("0123456789abcdef0123456789abcde:")]
    [InlineData("0123456789abcdef-123456789abcdef")]
    [InlineData("")]
    public void CreateRejectsBadCorrelationId(string correlationId)
    {
        var ex = Should.Throw<ArgumentException>(() => Valid(correlationId: correlationId));

        ex.ParamName.ShouldBe("correlationId");
    }

    [Fact]
    public void CreateRejectsNullCorrelationId()
    {
        Should.Throw<ArgumentNullException>(() => Valid(correlationId: null!));
    }

    [Fact]
    public void CreateAcceptsEveryLowercaseHexDigit()
    {
        const string id = "abcdef9876543210fedcba0123456789";

        Valid(correlationId: id).CorrelationId.ShouldBe(id);
    }

    [Fact]
    public void CreateRejectsOverLengthTargetType()
    {
        var ex = Should.Throw<ArgumentException>(
            () => Valid(targetType: new string('t', AuditEntry.TargetTypeMaxLength + 1)));

        ex.ParamName.ShouldBe("targetType");
    }

    [Fact]
    public void CreateRejectsOverLengthTargetId()
    {
        var ex = Should.Throw<ArgumentException>(
            () => Valid(targetId: new string('9', AuditEntry.TargetIdMaxLength + 1)));

        ex.ParamName.ShouldBe("targetId");
    }

    [Fact]
    public void CreateRejectsOverLengthDetail()
    {
        var ex = Should.Throw<ArgumentException>(
            () => Valid(detail: new string('d', AuditEntry.DetailMaxLength + 1)));

        ex.ParamName.ShouldBe("detail");
    }

    [Fact]
    public void CreateAcceptsFieldsAtMaxLength()
    {
        var targetType = new string('t', AuditEntry.TargetTypeMaxLength);
        var targetId = new string('9', AuditEntry.TargetIdMaxLength);
        var detail = new string('d', AuditEntry.DetailMaxLength);

        var entry = Valid(targetType: targetType, targetId: targetId, detail: detail);

        entry.TargetType.ShouldBe(targetType);
        entry.TargetId.ShouldBe(targetId);
        entry.Detail.ShouldBe(detail);
    }

    [Fact]
    public void FieldLimitsMatchTheAuditLogColumns()
    {
        AuditEntry.ActionMaxLength.ShouldBe(64);
        AuditEntry.TargetTypeMaxLength.ShouldBe(64);
        AuditEntry.TargetIdMaxLength.ShouldBe(64);
        AuditEntry.IpPrefixMaxLength.ShouldBe(45);
        AuditEntry.UserAgentFamilyMaxLength.ShouldBe(32);
        AuditEntry.CorrelationIdLength.ShouldBe(32);
        AuditEntry.DetailMaxLength.ShouldBe(400);
    }

    private static AuditEntry Valid(
        DateTimeOffset? occurredAtUtc = null,
        string action = "system.check",
        string? targetType = "SiteSettings",
        string? targetId = "1",
        IPAddress? remoteIp = null,
        string? userAgent = ChromeDesktop,
        string correlationId = CorrelationId,
        string? detail = "detail") =>
        AuditEntry.Create(
            occurredAtUtc ?? OccurredAt,
            Actor,
            action,
            targetType,
            targetId,
            remoteIp ?? IPAddress.Parse("10.1.2.3"),
            userAgent,
            correlationId,
            detail);
}

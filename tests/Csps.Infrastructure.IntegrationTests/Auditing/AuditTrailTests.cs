using System.Net;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Auditing;

/// <summary>
/// FND-10 tracer (D-24, D-25, D-32): the audit trail stores one minimized row, and the database itself refuses to
/// change or remove it. Each test finds its rows by its own fresh correlation id.
/// </summary>
public sealed class AuditTrailTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 10, 7, 1, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AppendWritesMinimizedRow()
    {
        var request = NewRequest();

        await AppendProbeAsync(request);

        var rows = await AuditLogSql.ReadAsync(database, request.CorrelationId);
        rows.Count.ShouldBe(1);
        var row = rows[0];
        row.OccurredAtUtc.ShouldBe(Now);
        row.ActorUserId.ShouldBe(request.UserId);
        row.Action.ShouldBe("system.check");
        row.TargetType.ShouldBe("SiteSettings");
        row.TargetId.ShouldBe("1");
        row.Detail.ShouldBe("probe");
        row.IpPrefix.ShouldBe("203.0.113.0");
        row.UserAgentFamily.ShouldBe("Chrome");
        row.CorrelationId.ShouldBe(request.CorrelationId);
    }

    [Fact]
    public async Task RawUpdateIsRejected()
    {
        var request = NewRequest();
        await AppendProbeAsync(request);
        var row = (await AuditLogSql.ReadAsync(database, request.CorrelationId)).ShouldHaveSingleItem();

        var error = await Should.ThrowAsync<SqlException>(
            () => AuditLogSql.ExecuteAsync(database, "UPDATE dbo.AuditLog SET Detail = N'tampered' WHERE Id = @id;", row.Id));

        error.Number.ShouldBe(51000);
        (await AuditLogSql.ReadAsync(database, request.CorrelationId)).ShouldHaveSingleItem().ShouldBe(row);
    }

    [Fact]
    public async Task RawDeleteIsRejected()
    {
        var request = NewRequest();
        await AppendProbeAsync(request);
        var row = (await AuditLogSql.ReadAsync(database, request.CorrelationId)).ShouldHaveSingleItem();

        var error = await Should.ThrowAsync<SqlException>(
            () => AuditLogSql.ExecuteAsync(database, "DELETE FROM dbo.AuditLog WHERE Id = @id;", row.Id));

        error.Number.ShouldBe(51001);
        (await AuditLogSql.ReadAsync(database, request.CorrelationId)).ShouldHaveSingleItem().ShouldBe(row);
    }

    private static FixedRequestContext NewRequest() => new()
    {
        UserId = Guid.NewGuid(),
        RemoteIp = IPAddress.Parse("203.0.113.45"),
        UserAgent = FixedRequestContext.ChromeUserAgent,
    };

    private Task AppendProbeAsync(FixedRequestContext request) =>
        AuditLogSql.AppendAsync(database, new FakeTimeProvider(Now), request, "system.check", "SiteSettings", "1", "probe");
}

using System.Net;
using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
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

    [Fact]
    public async Task StoresSixToFourClientAsItsIpv4Slash24()
    {
        var request = NewRequest();
        request.RemoteIp = IPAddress.Parse("2002:cbb1:0c2d::1");

        await AppendProbeAsync(request);

        (await AuditLogSql.ReadAsync(database, request.CorrelationId)).ShouldHaveSingleItem().IpPrefix.ShouldBe("203.177.12.0");
    }

    [Fact]
    public async Task RecordStoresNothingUntilTheUnitOfWorkSaves()
    {
        var request = NewRequest();
        var provider = AuditLogSql.BuildProvider(database, new FakeTimeProvider(Now), request);
        await using (provider)
        {
            var scope = provider.CreateAsyncScope();
            await using (scope)
            {
                scope.ServiceProvider.GetRequiredService<IAuditTrail>().Record("system.check", null, null, null);

                (await AuditLogSql.ReadAsync(database, request.CorrelationId)).ShouldBeEmpty();

                await scope.ServiceProvider.GetRequiredService<IUnitOfWork>().SaveChangesAsync(TestContext.Current.CancellationToken);
            }
        }

        (await AuditLogSql.ReadAsync(database, request.CorrelationId)).ShouldHaveSingleItem();
    }

    [Fact]
    public async Task RecordDoesNotFlushUnrelatedTrackedChanges()
    {
        var adHoc = await CspsDatabase.CreateAsync();
        await using (adHoc)
        {
            var request = NewRequest();
            var provider = AuditLogSql.BuildProvider(adHoc, new FakeTimeProvider(Now), request);
            await using (provider)
            {
                var scope = provider.CreateAsyncScope();
                await using (scope)
                {
                    var db = scope.ServiceProvider.GetRequiredService<CspsDbContext>();
                    var settings = await db.SiteSettings.SingleAsync(TestContext.Current.CancellationToken);
                    db.Entry(settings).Property(s => s.BusinessName).CurrentValue = "Unsaved Change";

                    scope.ServiceProvider.GetRequiredService<IAuditTrail>().Record("system.check", null, null, null);

                    (await AuditLogSql.ReadAsync(adHoc, request.CorrelationId)).ShouldBeEmpty();
                    (await ReadBusinessNameAsync(adHoc)).ShouldBe("Carmen's Stitch & Printing Services");
                }
            }
        }
    }

    [Fact]
    public async Task TransactionRollsBackTheWorkAndItsAuditEntryWhenTheWorkThrows()
    {
        var request = NewRequest();
        var provider = AuditLogSql.BuildProvider(database, new FakeTimeProvider(Now), request);
        await using (provider)
        {
            var scope = provider.CreateAsyncScope();
            await using (scope)
            {
                var audit = scope.ServiceProvider.GetRequiredService<IAuditTrail>();
                var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

                await Should.ThrowAsync<InvalidOperationException>(() => unitOfWork.InTransactionAsync<int>(
                    async token =>
                    {
                        audit.Record("system.check", null, null, null);
                        await unitOfWork.SaveChangesAsync(token);
                        throw new InvalidOperationException("boom");
                    },
                    TestContext.Current.CancellationToken));
            }
        }

        (await AuditLogSql.ReadAsync(database, request.CorrelationId)).ShouldBeEmpty();
    }

    [Fact]
    public async Task TransactionCommitsWhenTheWorkSucceeds()
    {
        var request = NewRequest();
        var provider = AuditLogSql.BuildProvider(database, new FakeTimeProvider(Now), request);
        await using (provider)
        {
            var scope = provider.CreateAsyncScope();
            await using (scope)
            {
                var audit = scope.ServiceProvider.GetRequiredService<IAuditTrail>();
                var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

                var result = await unitOfWork.InTransactionAsync(
                    async token =>
                    {
                        audit.Record("system.check", null, null, null);
                        await unitOfWork.SaveChangesAsync(token);
                        return 7;
                    },
                    TestContext.Current.CancellationToken);

                result.ShouldBe(7);
            }
        }

        (await AuditLogSql.ReadAsync(database, request.CorrelationId)).ShouldHaveSingleItem();
    }

    [Fact]
    public async Task TransactionJoinsAnOuterTransactionAndCommitsWithIt()
    {
        var request = NewRequest();
        var provider = AuditLogSql.BuildProvider(database, new FakeTimeProvider(Now), request);
        await using (provider)
        {
            var scope = provider.CreateAsyncScope();
            await using (scope)
            {
                var db = scope.ServiceProvider.GetRequiredService<CspsDbContext>();
                var audit = scope.ServiceProvider.GetRequiredService<IAuditTrail>();
                var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

                var outer = await db.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
                await using (outer)
                {
                    await unitOfWork.InTransactionAsync(
                        async token =>
                        {
                            db.Database.CurrentTransaction.ShouldBeSameAs(outer);
                            audit.Record("system.check", null, null, null);
                            await unitOfWork.SaveChangesAsync(token);
                            return 0;
                        },
                        TestContext.Current.CancellationToken);

                    db.Database.CurrentTransaction.ShouldBeSameAs(outer);

                    await outer.CommitAsync(TestContext.Current.CancellationToken);
                }
            }
        }

        (await AuditLogSql.ReadAsync(database, request.CorrelationId)).ShouldHaveSingleItem();
    }

    [Fact]
    public async Task IndependentRecordSurvivesARollbackWithTheSameFacts()
    {
        var request = NewRequest();
        request.RemoteIp = IPAddress.Parse("2002:cbb1:0c2d::1");
        var provider = AuditLogSql.BuildProvider(database, new FakeTimeProvider(Now), request);
        await using (provider)
        {
            var scope = provider.CreateAsyncScope();
            await using (scope)
            {
                var audit = scope.ServiceProvider.GetRequiredService<IAuditTrail>();
                var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

                await Should.ThrowAsync<InvalidOperationException>(() => unitOfWork.InTransactionAsync<int>(
                    async token =>
                    {
                        await audit.RecordIndependentlyAsync("system.check", "SiteSettings", "1", "probe", token);
                        throw new InvalidOperationException("boom");
                    },
                    TestContext.Current.CancellationToken));
            }
        }

        var row = (await AuditLogSql.ReadAsync(database, request.CorrelationId)).ShouldHaveSingleItem();
        row.OccurredAtUtc.ShouldBe(Now);
        row.ActorUserId.ShouldBe(request.UserId);
        row.Action.ShouldBe("system.check");
        row.TargetType.ShouldBe("SiteSettings");
        row.TargetId.ShouldBe("1");
        row.Detail.ShouldBe("probe");
        row.IpPrefix.ShouldBe("203.177.12.0");
        row.UserAgentFamily.ShouldBe("Chrome");
    }

    [Fact]
    public async Task IndependentRecordDoesNotSaveTheRequestsTrackedChanges()
    {
        var adHoc = await CspsDatabase.CreateAsync();
        await using (adHoc)
        {
            var request = NewRequest();
            var provider = AuditLogSql.BuildProvider(adHoc, new FakeTimeProvider(Now), request);
            await using (provider)
            {
                var scope = provider.CreateAsyncScope();
                await using (scope)
                {
                    var db = scope.ServiceProvider.GetRequiredService<CspsDbContext>();
                    var settings = await db.SiteSettings.SingleAsync(TestContext.Current.CancellationToken);
                    db.Entry(settings).Property(s => s.BusinessName).CurrentValue = "Unsaved Change";

                    await scope.ServiceProvider.GetRequiredService<IAuditTrail>()
                        .RecordIndependentlyAsync("system.check", null, null, null, TestContext.Current.CancellationToken);

                    (await AuditLogSql.ReadAsync(adHoc, request.CorrelationId)).ShouldHaveSingleItem();
                    (await ReadBusinessNameAsync(adHoc)).ShouldBe("Carmen's Stitch & Printing Services");
                    db.Entry(settings).State.ShouldBe(EntityState.Modified);
                }
            }
        }
    }

    private static async Task<string> ReadBusinessNameAsync(CspsDatabase target)
    {
        var connection = new SqlConnection(target.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = "SELECT BusinessName FROM dbo.SiteSettings WHERE Id = 1;";
                return (string)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
            }
        }
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

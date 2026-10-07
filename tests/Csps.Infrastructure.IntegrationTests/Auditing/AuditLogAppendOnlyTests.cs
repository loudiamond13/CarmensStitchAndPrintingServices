using System.Net;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Auditing;

/// <summary>
/// FND-10, D-25, D-32: the audit log stays append-only against TRUNCATE, against EF Core, and against every DELETE
/// except the owner-approved retention purge (session flag csps.audit_purge = 1, rows older than 8 months only).
/// Each test finds its rows by its own fresh correlation id.
/// </summary>
public sealed class AuditLogAppendOnlyTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string PurgeFlagSql = "EXEC sp_set_session_context @key = N'csps.audit_purge', @value = 1, @read_only = 1;";
    private const string DeleteByIdSql = "DELETE FROM dbo.AuditLog WHERE Id = @id;";

    private static readonly string[] TriggerEvents = ["DELETE", "UPDATE"];

    [Fact]
    public async Task TruncateIsRejected()
    {
        var request = NewRequest();
        await AppendAsync(request, TimeProvider.System.GetUtcNow());

        var error = await Should.ThrowAsync<SqlException>(() => AuditLogSql.ExecuteAsync(database, "TRUNCATE TABLE dbo.AuditLog;"));

        error.Message.ShouldContain("FOREIGN KEY");
        (await AuditLogSql.ReadAsync(database, request.CorrelationId)).ShouldHaveSingleItem();
    }

    [Fact]
    public async Task EfModifyIsRejectedBeforeSql()
    {
        var request = NewRequest();
        await AppendAsync(request, TimeProvider.System.GetUtcNow());
        var stored = (await AuditLogSql.ReadAsync(database, request.CorrelationId)).ShouldHaveSingleItem();

        var context = database.CreateContext();
        await using (context)
        {
            var entry = await context.AuditLog.SingleAsync(e => e.CorrelationId == request.CorrelationId, TestContext.Current.CancellationToken);
            context.Entry(entry).Property(e => e.Detail).CurrentValue = "tampered";

            // An InvalidOperationException, not a DbUpdateException wrapping the trigger's error 51000: EF stopped first.
            var error = await Should.ThrowAsync<InvalidOperationException>(() => context.SaveChangesAsync(TestContext.Current.CancellationToken));

            error.Message.ShouldContain("append-only");
        }

        (await AuditLogSql.ReadAsync(database, request.CorrelationId)).ShouldHaveSingleItem().ShouldBe(stored);
    }

    [Fact]
    public async Task EfRemoveIsRejectedBeforeSql()
    {
        var request = NewRequest();
        await AppendAsync(request, TimeProvider.System.GetUtcNow());
        var stored = (await AuditLogSql.ReadAsync(database, request.CorrelationId)).ShouldHaveSingleItem();

        var context = database.CreateContext();
        await using (context)
        {
            var entry = await context.AuditLog.SingleAsync(e => e.CorrelationId == request.CorrelationId, TestContext.Current.CancellationToken);
            context.AuditLog.Remove(entry);

            // The synchronous SaveChanges path is guarded too.
            var error = Should.Throw<InvalidOperationException>(() => context.SaveChanges());

            error.Message.ShouldContain("append-only");
        }

        (await AuditLogSql.ReadAsync(database, request.CorrelationId)).ShouldHaveSingleItem().ShouldBe(stored);
    }

    [Fact]
    public async Task TriggerIsEnabled()
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText =
                    "SELECT t.is_disabled, t.is_instead_of_trigger, e.type_desc FROM sys.triggers AS t "
                    + "JOIN sys.trigger_events AS e ON e.object_id = t.object_id "
                    + "WHERE t.name = N'TR_AuditLog_AppendOnly' AND t.parent_id = OBJECT_ID(N'dbo.AuditLog') ORDER BY e.type_desc;";
                var events = new List<string>();
                var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
                await using (reader)
                {
                    while (await reader.ReadAsync(TestContext.Current.CancellationToken))
                    {
                        reader.GetBoolean(0).ShouldBeFalse("The append-only trigger must be enabled.");
                        reader.GetBoolean(1).ShouldBeFalse("The trigger must be an AFTER trigger.");
                        events.Add(reader.GetString(2));
                    }
                }

                events.ShouldBe(TriggerEvents);
            }
        }
    }

    [Fact]
    public async Task PurgeFlagDeletesOnlyOldRows()
    {
        var now = TimeProvider.System.GetUtcNow();
        var request = NewRequest();
        await AppendAsync(request, now.AddMonths(-9));
        await AppendAsync(request, now);
        var rows = await AuditLogSql.ReadAsync(database, request.CorrelationId);
        rows.Count.ShouldBe(2);
        var (old, recent) = (rows[0], rows[1]);

        // Without the flag even a 9-month-old row is refused.
        (await Should.ThrowAsync<SqlException>(() => AuditLogSql.ExecuteAsync(database, DeleteByIdSql, old.Id))).Number.ShouldBe(51001);

        var purge = await OpenPurgeConnectionAsync();
        await using (purge)
        {
            (await Should.ThrowAsync<SqlException>(() => AuditLogSql.ExecuteAsync(purge, DeleteByIdSql, recent.Id))).Number.ShouldBe(51001);

            await AuditLogSql.ExecuteAsync(purge, DeleteByIdSql, old.Id);
        }

        (await AuditLogSql.ReadAsync(database, request.CorrelationId)).ShouldHaveSingleItem().ShouldBe(recent);
    }

    [Fact]
    public async Task PurgeFlagRefusesRowJustInsideEightMonths()
    {
        var now = TimeProvider.System.GetUtcNow();
        var request = NewRequest();
        await AppendAsync(request, now.AddMonths(-9));
        await AppendAsync(request, now.AddMonths(-8).AddDays(1));
        var rows = await AuditLogSql.ReadAsync(database, request.CorrelationId);
        rows.Count.ShouldBe(2);

        var purge = await OpenPurgeConnectionAsync();
        await using (purge)
        {
            (await Should.ThrowAsync<SqlException>(() => AuditLogSql.ExecuteAsync(purge, DeleteByIdSql, rows[1].Id))).Number.ShouldBe(51001);

            // One statement that mixes an old row with a too-recent one is refused as a whole.
            var mixed = await Should.ThrowAsync<SqlException>(() => AuditLogSql.ExecuteAsync(
                purge,
                $"DELETE FROM dbo.AuditLog WHERE CorrelationId = '{request.CorrelationId}';"));
            mixed.Number.ShouldBe(51001);
        }

        (await AuditLogSql.ReadAsync(database, request.CorrelationId)).ShouldBe(rows);
    }

    [Fact]
    public async Task StoresNoRawIpOrUserAgent()
    {
        var request = NewRequest();
        await AppendAsync(request, TimeProvider.System.GetUtcNow());

        var values = new List<string>();
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = "SELECT * FROM dbo.AuditLog WHERE CorrelationId = @correlationId;";
                command.Parameters.AddWithValue("@correlationId", request.CorrelationId);
                var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
                await using (reader)
                {
                    (await reader.ReadAsync(TestContext.Current.CancellationToken)).ShouldBeTrue();
                    for (var column = 0; column < reader.FieldCount; column++)
                    {
                        values.Add(Convert.ToString(reader.GetValue(column), System.Globalization.CultureInfo.InvariantCulture) ?? string.Empty);
                    }
                }
            }
        }

        values.ShouldNotBeEmpty();
        values.ShouldAllBe(value =>
            !value.Contains("203.0.113.45", StringComparison.Ordinal)
            && !value.Contains(FixedRequestContext.ChromeUserAgent, StringComparison.Ordinal));
        values.ShouldContain("203.0.113.0");
        values.ShouldContain("Chrome");
    }

    [Fact]
    public async Task ResetLeavesAuditLogAlone()
    {
        var request = NewRequest();
        await AppendAsync(request, TimeProvider.System.GetUtcNow());
        var stored = (await AuditLogSql.ReadAsync(database, request.CorrelationId)).ShouldHaveSingleItem();

        await database.ResetAsync();

        (await AuditLogSql.ReadAsync(database, request.CorrelationId)).ShouldHaveSingleItem().ShouldBe(stored);
    }

    private static FixedRequestContext NewRequest() => new()
    {
        UserId = Guid.NewGuid(),
        RemoteIp = IPAddress.Parse("203.0.113.45"),
        UserAgent = FixedRequestContext.ChromeUserAgent,
    };

    private Task AppendAsync(FixedRequestContext request, DateTimeOffset at) =>
        AuditLogSql.AppendAsync(database, new FakeTimeProvider(at), request, "system.check", "SiteSettings", "1", "probe");

    // The purge recipe (docs/operations/audit-log.md): a dedicated non-pooled connection, so the read-only session
    // flag can never leak to a pooled connection the application reuses (research Pitfall 11).
    private async Task<SqlConnection> OpenPurgeConnectionAsync()
    {
        var connection = new SqlConnection(new SqlConnectionStringBuilder(database.ConnectionString) { Pooling = false }.ConnectionString);
        try
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            await AuditLogSql.ExecuteAsync(connection, PurgeFlagSql);
            return connection;
        }
        catch
        {
            await connection.DisposeAsync();
            throw;
        }
    }
}

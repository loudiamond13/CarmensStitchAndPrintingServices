using System.Text.RegularExpressions;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// USER-03, SEC-07, SEC-08: the AddUserManagement migration gives accounts that existed before Phase 5 a creation
/// date (from their audit entry when there is one), a fresh edit version and System attribution, then makes the
/// creation date required. Each test uses its own database.
/// </summary>
public sealed partial class UserManagementMigrationTests
{
    private const string Before = "20261015081003_AddIdempotencyRecords";

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ExistingAccountsGetTheirCreationDateAFreshVersionAndSystemAttribution(bool throughTheReviewedScript)
    {
        var created = new DateTimeOffset(2026, 10, 17, 10, 0, 0, TimeSpan.Zero);
        var withAudit = Guid.NewGuid();
        var withoutAudit = Guid.NewGuid();
        var database = await CspsDatabase.CreateEmptyAsync(SqlCompatibility.Level);
        await using (database)
        {
            var context = database.CreateContext();
            await using (context)
            {
                var migrator = context.GetService<IMigrator>();
                await migrator.MigrateAsync(Before, TestContext.Current.CancellationToken);
                var connection = new SqlConnection(database.ConnectionString);
                await using (connection)
                {
                    await connection.OpenAsync(TestContext.Current.CancellationToken);
                    await InsertUserAsync(connection, withAudit);
                    await InsertUserAsync(connection, withoutAudit);
                    await InsertAuditAsync(connection, "user.bootstrap-manager-created", withAudit, created.AddHours(1));
                    await InsertAuditAsync(connection, "user.invited", withAudit, created.AddDays(1));
                    await InsertAuditAsync(connection, "user.bootstrap-manager-created", withAudit, created);
                    await InsertAuditAsync(connection, "auth.signed-in", withoutAudit, created.AddDays(-10));
                }

                var started = TimeProvider.System.GetUtcNow();
                if (throughTheReviewedScript)
                {
                    // The owner ships the idempotent script, so the backfill must also work as script text.
                    await ApplyScriptAsync(
                        database.ConnectionString,
                        migrator.GenerateScript(fromMigration: Before, options: MigrationsSqlGenerationOptions.Idempotent));
                }
                else
                {
                    await migrator.MigrateAsync(cancellationToken: TestContext.Current.CancellationToken);
                }

                var read = new SqlConnection(database.ConnectionString);
                await using (read)
                {
                    await read.OpenAsync(TestContext.Current.CancellationToken);
                    var a = await ReadAsync(read, withAudit);
                    var b = await ReadAsync(read, withoutAudit);

                    a.CreatedAtUtc.ShouldBe(created);
                    b.CreatedAtUtc.ShouldBeInRange(started.AddMinutes(-1), TimeProvider.System.GetUtcNow().AddMinutes(1));
                    a.EditVersion.ShouldNotBe(Guid.Empty);
                    b.EditVersion.ShouldNotBe(Guid.Empty);
                    a.EditVersion.ShouldNotBe(b.EditVersion);
                    a.CreatedById.ShouldBeNull();
                    a.UpdatedById.ShouldBeNull();
                    b.CreatedById.ShouldBeNull();
                    b.UpdatedById.ShouldBeNull();

                    (await ScalarAsync(read, "SELECT is_nullable FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.AspNetUsers') AND name = N'CreatedAtUtc';"))
                        .ShouldBe(false);
                }
            }
        }
    }

    private static async Task ApplyScriptAsync(string connectionString, string script)
    {
        var connection = new SqlConnection(connectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            foreach (var batch in GoSeparator().Split(script).Where(static batch => !string.IsNullOrWhiteSpace(batch)))
            {
                var command = connection.CreateCommand();
                await using (command)
                {
                    command.CommandText = batch;
                    await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
                }
            }
        }
    }

    private static async Task InsertUserAsync(SqlConnection connection, Guid id)
    {
        var command = connection.CreateCommand();
        await using (command)
        {
            command.CommandText =
                """
                INSERT INTO dbo.AspNetUsers
                    (Id, FirstName, LastName, IsActive, MustChangePassword, BreachRecheckPending, UserName, NormalizedUserName, Email,
                     NormalizedEmail, EmailConfirmed, SecurityStamp, ConcurrencyStamp, PhoneNumberConfirmed, TwoFactorEnabled, LockoutEnabled, AccessFailedCount)
                VALUES
                    (@id, N'Test', N'User', 1, 0, 0, @name, @normalized, @name, @normalized, 1, N'stamp', N'concurrency', 0, 0, 1, 0);
                """;
            command.Parameters.AddWithValue("@id", id);
            command.Parameters.AddWithValue("@name", $"user.{id:N}@example.com");
            command.Parameters.AddWithValue("@normalized", $"USER.{id:N}@EXAMPLE.COM".ToUpperInvariant());
            await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        }
    }

    private static async Task InsertAuditAsync(SqlConnection connection, string action, Guid targetId, DateTimeOffset occurred)
    {
        var command = connection.CreateCommand();
        await using (command)
        {
            command.CommandText =
                """
                INSERT INTO dbo.AuditLog (Action, CorrelationId, OccurredAtUtc, TargetType, TargetId)
                VALUES (@action, @correlation, @occurred, N'User', @target);
                """;
            command.Parameters.AddWithValue("@action", action);
            command.Parameters.AddWithValue("@correlation", Guid.NewGuid().ToString("N"));
            command.Parameters.AddWithValue("@occurred", occurred);
            command.Parameters.AddWithValue("@target", targetId.ToString("D"));
            await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        }
    }

    private static async Task<(DateTimeOffset CreatedAtUtc, Guid EditVersion, Guid? CreatedById, Guid? UpdatedById)> ReadAsync(SqlConnection connection, Guid id)
    {
        var command = connection.CreateCommand();
        await using (command)
        {
            command.CommandText = "SELECT CreatedAtUtc, EditVersion, CreatedById, UpdatedById FROM dbo.AspNetUsers WHERE Id = @id;";
            command.Parameters.AddWithValue("@id", id);
            var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
            await using (reader)
            {
                (await reader.ReadAsync(TestContext.Current.CancellationToken)).ShouldBeTrue();
                return (
                    reader.GetDateTimeOffset(0),
                    reader.GetGuid(1),
                    reader.IsDBNull(2) ? null : reader.GetGuid(2),
                    reader.IsDBNull(3) ? null : reader.GetGuid(3));
            }
        }
    }

    private static async Task<object?> ScalarAsync(SqlConnection connection, string sql)
    {
        var command = connection.CreateCommand();
        await using (command)
        {
            command.CommandText = sql;
            return await command.ExecuteScalarAsync(TestContext.Current.CancellationToken);
        }
    }

    [GeneratedRegex(@"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex GoSeparator();
}

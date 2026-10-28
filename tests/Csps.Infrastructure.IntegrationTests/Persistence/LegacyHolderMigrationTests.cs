using System.Globalization;
using Csps.Domain.Identity;
using Csps.Testing;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>D-37: the migration seeds one Legacy / unassigned holder row that cannot sign in, and the test reset puts it back.</summary>
public sealed class LegacyHolderMigrationTests
{
    [Fact]
    public async Task AFreshlyMigratedDatabaseHasTheHolderWithEveryColumnSetExplicitly()
    {
        var database = await CspsDatabase.CreateAsync();
        await using (database)
        {
            var row = await ReadHolderAsync(database);

            row.FirstName.ShouldBe("Legacy");
            row.LastName.ShouldBe("/ unassigned");
            row.IsActive.ShouldBeFalse();
            row.Email.ShouldBeNull();
            row.NormalizedEmail.ShouldBeNull();
            row.UserName.ShouldBeNull();
            row.NormalizedUserName.ShouldBeNull();
            row.PasswordHash.ShouldBeNull();
            row.EmailConfirmed.ShouldBeFalse();
            row.EditVersion.ShouldBe(LegacyHolder.EditVersion);
            row.SecurityStamp.ShouldBe(LegacyHolder.SecurityStamp);
            row.ConcurrencyStamp.ShouldBe(LegacyHolder.ConcurrencyStamp);
            row.CreatedAtUtc.ShouldBe(LegacyHolder.CreatedAtUtc);
            row.MustChangePassword.ShouldBeFalse();
            row.BreachRecheckPending.ShouldBeFalse();
            row.LockoutEnabled.ShouldBeFalse();
            row.TwoFactorEnabled.ShouldBeFalse();
            row.ManagerLockedAtUtc.ShouldBeNull();
            row.DeletedAtUtc.ShouldBeNull();
            row.CreatedById.ShouldBeNull();
        }
    }

    [Fact]
    public async Task TheHolderHasNoRoleAndTheDisplayNameReadsLegacySlashUnassigned()
    {
        var database = await CspsDatabase.CreateAsync();
        await using (database)
        {
            (await ScalarAsync(database, $"SELECT COUNT(*) FROM AspNetUserRoles WHERE UserId = '{LegacyHolder.Id:D}'")).ShouldBe(0);
            LegacyHolder.DisplayName.ShouldBe("Legacy / unassigned");
            $"{LegacyHolder.FirstName} {LegacyHolder.LastName}".ShouldBe(LegacyHolder.DisplayName);
        }
    }

    [Fact]
    public async Task TheTestResetBringsTheHolderBack()
    {
        var database = await CspsDatabase.CreateAsync();
        await using (database)
        {
            await database.ResetAsync();

            (await ScalarAsync(database, $"SELECT COUNT(*) FROM AspNetUsers WHERE Id = '{LegacyHolder.Id:D}'")).ShouldBe(1);
            (await ScalarAsync(database, "SELECT COUNT(*) FROM AspNetUsers")).ShouldBe(1);
        }
    }

    private static async Task<int> ScalarAsync(CspsDatabase database, string sql)
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = sql;
                return Convert.ToInt32(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken), CultureInfo.InvariantCulture);
            }
        }
    }

    // Raw SQL so the test sees the stored columns, not what the EF model defaults to.
    private static async Task<HolderRow> ReadHolderAsync(CspsDatabase database)
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = """
                    SELECT FirstName, LastName, IsActive, Email, NormalizedEmail, UserName, NormalizedUserName, PasswordHash, EmailConfirmed,
                           EditVersion, SecurityStamp, ConcurrencyStamp, CreatedAtUtc, MustChangePassword, BreachRecheckPending,
                           LockoutEnabled, TwoFactorEnabled, ManagerLockedAtUtc, DeletedAtUtc, CreatedById
                    FROM AspNetUsers WHERE Id = @id
                    """;
                command.Parameters.AddWithValue("@id", LegacyHolder.Id);
                var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
                await using (reader)
                {
                    (await reader.ReadAsync(TestContext.Current.CancellationToken)).ShouldBeTrue("the holder row is missing");
                    return new HolderRow(
                        reader.GetString(0),
                        reader.GetString(1),
                        reader.GetBoolean(2),
                        reader.IsDBNull(3) ? null : reader.GetString(3),
                        reader.IsDBNull(4) ? null : reader.GetString(4),
                        reader.IsDBNull(5) ? null : reader.GetString(5),
                        reader.IsDBNull(6) ? null : reader.GetString(6),
                        reader.IsDBNull(7) ? null : reader.GetString(7),
                        reader.GetBoolean(8),
                        reader.GetGuid(9),
                        reader.GetString(10),
                        reader.GetString(11),
                        reader.GetDateTimeOffset(12),
                        reader.GetBoolean(13),
                        reader.GetBoolean(14),
                        reader.GetBoolean(15),
                        reader.GetBoolean(16),
                        reader.IsDBNull(17) ? null : reader.GetDateTimeOffset(17),
                        reader.IsDBNull(18) ? null : reader.GetDateTimeOffset(18),
                        reader.IsDBNull(19) ? null : reader.GetGuid(19));
                }
            }
        }
    }

    private sealed record HolderRow(
        string FirstName,
        string LastName,
        bool IsActive,
        string? Email,
        string? NormalizedEmail,
        string? UserName,
        string? NormalizedUserName,
        string? PasswordHash,
        bool EmailConfirmed,
        Guid EditVersion,
        string SecurityStamp,
        string ConcurrencyStamp,
        DateTimeOffset CreatedAtUtc,
        bool MustChangePassword,
        bool BreachRecheckPending,
        bool LockoutEnabled,
        bool TwoFactorEnabled,
        DateTimeOffset? ManagerLockedAtUtc,
        DateTimeOffset? DeletedAtUtc,
        Guid? CreatedById);
}

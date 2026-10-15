using System.Net;
using Csps.Server.IntegrationTests.Auth;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Idempotency;

/// <summary>
/// SEC-06, D-40: a covered POST repeated with the same Idempotency-Key and body gets the first answer back and does
/// not run again. The key, route and user decide what a repeat is; the record commits with the business change.
/// </summary>
public sealed class IdempotencyTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string ForgotRoute = "POST /api/v1/auth/password/forgot";

    [Fact]
    public async Task ARepeatedForgotPostQueuesOneEmailAndGetsTheFirstAnswerBack()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var key = Guid.NewGuid();

        using var first = await AuthClient.ForgotPasswordAsync(client, staff.Email, idempotencyKey: key);
        using var second = await AuthClient.ForgotPasswordAsync(client, staff.Email, idempotencyKey: key);

        first.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        first.Headers.Contains(AuthClient.ReplayedHeader).ShouldBeFalse();
        second.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        second.Headers.GetValues(AuthClient.ReplayedHeader).ShouldHaveSingleItem().ShouldBe("true");

        (await AuthClient.WaitForEmailsAsync(client, staff.Email)).ShouldHaveSingleItem();
        await using var context = database.CreateContext();
        (await context.EmailOutbox.CountAsync(m => m.ToAddress == staff.Email, TestContext.Current.CancellationToken)).ShouldBe(1);
        (await context.AccountTokens.CountAsync(t => t.UserId == staff.Id, TestContext.Current.CancellationToken)).ShouldBe(1);

        var record = (await ReadRecordsAsync(context, key)).ShouldHaveSingleItem();
        record.StatusCode.ShouldBe(202);
        record.UserId.ShouldBeNull();
        record.Route.ShouldBe(ForgotRoute);
        record.RequestHashLength.ShouldBe(32);
    }

    private static async Task<IReadOnlyList<StoredRecord>> ReadRecordsAsync(DbContext context, Guid key)
    {
        var connection = context.Database.GetDbConnection();
        await context.Database.OpenConnectionAsync(TestContext.Current.CancellationToken);
        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT [UserId], [Route], [StatusCode], DATALENGTH([RequestHash]) FROM [IdempotencyRecords] WHERE [Key] = @key";
            var parameter = command.CreateParameter();
            parameter.ParameterName = "@key";
            parameter.Value = key;
            command.Parameters.Add(parameter);

            var rows = new List<StoredRecord>();
            await using var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
            while (await reader.ReadAsync(TestContext.Current.CancellationToken))
            {
                rows.Add(new StoredRecord(
                    await reader.IsDBNullAsync(0, TestContext.Current.CancellationToken) ? null : reader.GetGuid(0),
                    reader.GetString(1),
                    reader.GetInt32(2),
                    reader.GetInt32(3)));
            }

            return rows;
        }
        finally
        {
            await context.Database.CloseConnectionAsync();
        }
    }

    private sealed record StoredRecord(Guid? UserId, string Route, int StatusCode, int RequestHashLength);
}

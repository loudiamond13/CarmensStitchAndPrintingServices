using Csps.Testing;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Security;

/// <summary>
/// SEC-04, D-15: the Data Protection key ring lives in the database, encrypted with the configured certificate, so a
/// payload protected before an app-pool recycle is still readable after it. Each test uses its own ad-hoc
/// <c>CSPS_Test_&lt;guid&gt;</c> database, because key rows are what the tests count.
/// </summary>
public sealed class DataProtectionTests
{
    private const string Purpose = "Csps.Tests";
    private const string Payload = "hello";

    // -1 means the table does not exist; dynamic SQL so the batch compiles either way.
    private const string CountKeysSql =
        "IF OBJECT_ID(N'dbo.DataProtectionKeys', N'U') IS NULL SELECT -1; ELSE EXEC(N'SELECT COUNT(*) FROM dbo.DataProtectionKeys;');";

    [Fact]
    public async Task KeyRingSurvivesRestart()
    {
        await using var database = await CspsDatabase.CreateAsync();

        string protectedPayload;
        await using (var first = CspsApiFactory.ForDatabase(database.ConnectionString))
        {
            protectedPayload = Protector(first).Protect(Payload);
        }

        // The key ring is in the database, not in this machine's user profile (the IIS app pool has none).
        (await CountKeysAsync(database)).ShouldBe(1);

        await using var second = CspsApiFactory.ForDatabase(database.ConnectionString);
        Protector(second).Unprotect(protectedPayload).ShouldBe(Payload);
    }

    private static IDataProtector Protector(CspsApiFactory factory) =>
        factory.Services.GetRequiredService<IDataProtectionProvider>().CreateProtector(Purpose);

    private static async Task<int> CountKeysAsync(CspsDatabase database)
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = CountKeysSql;
                var count = await command.ExecuteScalarAsync(TestContext.Current.CancellationToken);
                return Convert.ToInt32(count, System.Globalization.CultureInfo.InvariantCulture);
            }
        }
    }
}

using System.Text.RegularExpressions;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Configurations;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>OR-7, D-06: the audit log's append-only trigger is the only trigger, in a migrated database and in the production script.</summary>
public sealed partial class TriggerInventoryTests
{
    [Fact]
    public async Task TheOnlyTriggerIsTheAuditLogAppendOnlyGuard()
    {
        var database = await CspsDatabase.CreateAsync();
        await using (database)
        {
            var names = new List<string>();
            var connection = new SqlConnection(database.ConnectionString);
            await using (connection)
            {
                await connection.OpenAsync(TestContext.Current.CancellationToken);
                var command = connection.CreateCommand();
                await using (command)
                {
                    command.CommandText = "SELECT name FROM sys.triggers ORDER BY name;";
                    var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
                    await using (reader)
                    {
                        while (await reader.ReadAsync(TestContext.Current.CancellationToken))
                        {
                            names.Add(reader.GetString(0));
                        }
                    }
                }
            }

            names.ShouldBe([AuditEntryConfiguration.TriggerName], "OR-7: no trigger except the audit log guard may exist.");
        }
    }

    [Fact]
    public async Task TheProductionScriptCreatesOnlyTheAuditTrigger()
    {
        var database = await CspsDatabase.CreateEmptyAsync(SqlCompatibility.Level);
        await using (database)
        {
            string script;
            var context = database.CreateContext();
            await using (context)
            {
                script = context.GetService<IMigrator>().GenerateScript(options: MigrationsSqlGenerationOptions.Idempotent);
            }

            var statements = CreateTriggerStatements(script);

            statements.Count.ShouldBe(1, "OR-7: the production script may create only the audit log trigger.");
            statements[0].ShouldContain(AuditEntryConfiguration.TriggerName);
        }
    }

    private static List<string> CreateTriggerStatements(string script) =>
        [.. CreateTrigger().Matches(script).Select(match => script.Substring(match.Index, Math.Min(match.Length + 80, script.Length - match.Index)))];

    [GeneratedRegex(@"CREATE\s+(OR\s+ALTER\s+)?TRIGGER", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex CreateTrigger();
}

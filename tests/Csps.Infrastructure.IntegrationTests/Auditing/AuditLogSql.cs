using Csps.Application.Ports;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting.Internal;

namespace Csps.Infrastructure.IntegrationTests.Auditing;

/// <summary>One stored audit row, read back with plain SQL (not through EF).</summary>
public sealed record AuditRow(
    long Id,
    DateTimeOffset OccurredAtUtc,
    Guid? ActorUserId,
    string Action,
    string? TargetType,
    string? TargetId,
    string? IpPrefix,
    string? UserAgentFamily,
    string CorrelationId,
    string? Detail);

/// <summary>Shared helpers for the audit tests: compose the trail like the Server does, and read or change rows with raw SQL.</summary>
internal static class AuditLogSql
{
    /// <summary>Builds Infrastructure exactly as the Server does, with the given clock and request facts.</summary>
    public static ServiceProvider BuildProvider(CspsDatabase database, TimeProvider time, IRequestContext request)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { [DependencyInjection.ConnectionStringKey] = database.ConnectionString })
            .Build();

        var services = new ServiceCollection();
        services.AddSingleton(time);
        services.AddSingleton(request);
        services.AddInfrastructure(configuration, new HostingEnvironment { EnvironmentName = CspsApiFactory.EnvironmentName });

        return services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true, ValidateOnBuild = true });
    }

    /// <summary>Records one entry through the real <see cref="IAuditTrail"/> registration and commits it with the unit of work.</summary>
    public static async Task AppendAsync(
        CspsDatabase database,
        TimeProvider time,
        IRequestContext request,
        string action,
        string? targetType,
        string? targetId,
        string? detail)
    {
        var provider = BuildProvider(database, time, request);
        await using (provider)
        {
            var scope = provider.CreateAsyncScope();
            await using (scope)
            {
                scope.ServiceProvider.GetRequiredService<IAuditTrail>().Record(action, targetType, targetId, detail);
                await scope.ServiceProvider.GetRequiredService<IUnitOfWork>().SaveChangesAsync(TestContext.Current.CancellationToken);
            }
        }
    }

    /// <summary>Reads every row with the given correlation id, ordered by id.</summary>
    public static async Task<List<AuditRow>> ReadAsync(CspsDatabase database, string correlationId)
    {
        var rows = new List<AuditRow>();
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText =
                    "SELECT Id, OccurredAtUtc, ActorUserId, Action, TargetType, TargetId, IpPrefix, UserAgentFamily, CorrelationId, Detail "
                    + "FROM dbo.AuditLog WHERE CorrelationId = @correlationId ORDER BY Id;";
                command.Parameters.AddWithValue("@correlationId", correlationId);
                var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
                await using (reader)
                {
                    while (await reader.ReadAsync(TestContext.Current.CancellationToken))
                    {
                        rows.Add(new AuditRow(
                            reader.GetInt64(0),
                            reader.GetDateTimeOffset(1),
                            reader.IsDBNull(2) ? null : reader.GetGuid(2),
                            reader.GetString(3),
                            reader.IsDBNull(4) ? null : reader.GetString(4),
                            reader.IsDBNull(5) ? null : reader.GetString(5),
                            reader.IsDBNull(6) ? null : reader.GetString(6),
                            reader.IsDBNull(7) ? null : reader.GetString(7),
                            reader.GetString(8),
                            reader.IsDBNull(9) ? null : reader.GetString(9)));
                    }
                }
            }
        }

        return rows;
    }

    /// <summary>Runs one statement with an optional <c>@id</c> parameter on a new connection.</summary>
    public static async Task ExecuteAsync(CspsDatabase database, string sql, long? id = null)
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            await ExecuteAsync(connection, sql, id);
        }
    }

    /// <summary>Runs one statement with an optional <c>@id</c> parameter on an open connection.</summary>
    public static async Task ExecuteAsync(SqlConnection connection, string sql, long? id = null)
    {
        var command = connection.CreateCommand();
        await using (command)
        {
            command.CommandText = sql;
            if (id is { } value)
            {
                command.Parameters.AddWithValue("@id", value);
            }

            await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        }
    }
}

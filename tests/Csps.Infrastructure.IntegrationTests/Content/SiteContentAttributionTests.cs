using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Infrastructure.IntegrationTests.Content;

/// <summary>
/// SEC-08: a save of the site settings or a phone row is stamped with the signed-in user and the clock by the one stamp interceptor,
/// through the settings' existing <c>CreatedByUserId</c> and <c>UpdatedByUserId</c> columns.
/// </summary>
public sealed class SiteContentAttributionTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly Guid Editor = Guid.Parse("7a1f0e2c-3b4d-4c5e-8f60-123456789abc");

    [Fact]
    public async Task AnEditStampsTheSettingsRowAndTheNewPhoneRowsWithTheSignedInUser()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Bare());
        await using var services = PublicContentServices.Build(database.ConnectionString, actor: new FixedActor(Editor));

        await using (var scope = services.CreateAsyncScope())
        {
            await PublicContentSeeding.SaveAsync(
                scope.ServiceProvider.GetRequiredService<CspsDbContext>(),
                PublicContentSeeding.Demo("A stamped line"),
                PublicContentSeeding.DefaultNow);
        }

        await using var reading = database.CreateContext();
        var settings = await reading.SiteSettings.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        settings.UpdatedById.ShouldBe(Editor);
        settings.UpdatedAtUtc.ShouldNotBeNull();
        var phones = await reading.SitePhoneNumbers.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken);
        phones.Count.ShouldBe(2);
        phones.ShouldAllBe(phone => phone.CreatedById == Editor);
    }

    [Fact]
    public async Task TheStampsLandInTheOldColumnNamesAndNoNewColumnIsAdded()
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText =
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = N'SiteSettings' AND COLUMN_NAME IN (N'CreatedByUserId', N'UpdatedByUserId', N'CreatedById', N'UpdatedById');";
                var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
                await using (reader)
                {
                    var columns = new List<string>();
                    while (await reader.ReadAsync(TestContext.Current.CancellationToken))
                    {
                        columns.Add(reader.GetString(0));
                    }

                    columns.ShouldBe(["CreatedByUserId", "UpdatedByUserId"], ignoreOrder: true);
                }
            }
        }
    }

    private sealed class FixedActor(Guid id) : ICurrentActor
    {
        public Guid? UserId => id;
    }
}

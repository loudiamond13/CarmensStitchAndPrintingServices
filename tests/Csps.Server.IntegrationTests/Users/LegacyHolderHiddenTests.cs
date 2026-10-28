using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Users;

/// <summary>D-32, D-37, T-07-23, T-07-24, CWE-284: the Legacy / unassigned holder exists in every database but is never listed, chosen, changed or signed in.</summary>
public sealed class LegacyHolderHiddenTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Theory]
    [InlineData(Roles.Admin)]
    [InlineData(Roles.Manager)]
    public async Task TheStaffLookupNeverListsTheHolder(string role)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var caller = await TestSessions.StartAsync(factory, role);
        await HolderExistsAsync(database);

        using var response = await client.SendAsync(ApiRequests.Get("/api/v1/staff", caller.AccessToken), TestContext.Current.CancellationToken);

        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, body);
        using var document = JsonDocument.Parse(body);
        document.RootElement.EnumerateArray().Select(item => item.GetProperty("id").GetGuid()).ShouldNotContain(LegacyHolder.Id);
        body.ShouldNotContain(LegacyHolder.DisplayName);
    }

    [Fact]
    public async Task TheHolderRowComesBackAfterATestReset()
    {
        var own = await CspsDatabase.CreateAsync();
        await using (own)
        {
            await own.ResetAsync();

            await HolderExistsAsync(own);
        }
    }

    private static async Task HolderExistsAsync(CspsDatabase target)
    {
        await using var context = target.CreateContext();
        var holder = await context.Users.AsNoTracking().SingleAsync(user => user.Id == LegacyHolder.Id, TestContext.Current.CancellationToken);
        holder.IsActive.ShouldBeFalse();
    }
}

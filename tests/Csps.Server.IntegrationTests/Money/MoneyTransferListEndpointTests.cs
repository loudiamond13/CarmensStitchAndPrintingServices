using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Money;

/// <summary>MONEY-03, D-31, D-48: a Manager lists every transfer, an Admin only the ones they sent or received, and deleted ones only for a Manager who asks.</summary>
public sealed class MoneyTransferListEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly October4 = new(2026, 10, 4);
    private static readonly DateOnly October5 = new(2026, 10, 5);
    private static readonly DateOnly October6 = new(2026, 10, 6);
    private static readonly DateOnly October7 = new(2026, 10, 7);

    [Fact]
    public async Task AManagerSeesEveryCountedTransferNewestFirstWithAllTheFields()
    {
        await using var world = await StartWorldAsync();

        var body = await ReadAsync(world.Client, world.Carmen.AccessToken);

        var items = body.GetProperty("items").EnumerateArray().ToList();
        items.Select(item => item.GetProperty("id").GetGuid()).ShouldBe([world.HandoverId, world.PaoloToCarmenId, world.CarmenToLizaId]);
        body.GetProperty("total").GetInt32().ShouldBe(3);
        body.GetProperty("page").GetInt32().ShouldBe(1);
        body.GetProperty("pageSize").GetInt32().ShouldBe(20);

        var last = items[2];
        last.GetProperty("from").GetProperty("id").GetGuid().ShouldBe(world.Carmen.UserId);
        last.GetProperty("from").GetProperty("name").GetString().ShouldBe("Carmen Reyes");
        last.GetProperty("to").GetProperty("id").GetGuid().ShouldBe(world.Liza.UserId);
        last.GetProperty("amount").GetDecimal().ShouldBe(500.00m);
        last.GetProperty("transferDate").GetString().ShouldBe("2026-10-04");
        last.GetProperty("note").GetString().ShouldBe("Float for the week");
        last.GetProperty("isHandover").GetBoolean().ShouldBeFalse();
        last.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(world.Carmen.UserId);
        last.GetProperty("version").GetString().ShouldNotBeNullOrEmpty();
        last.GetProperty("isDeleted").GetBoolean().ShouldBeFalse();
        last.GetProperty("deletedBy").ValueKind.ShouldBe(JsonValueKind.Null);
        last.GetProperty("deletedAtUtc").ValueKind.ShouldBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task AHandoverCarriesItsMarkAndTheManagerWhoRecordedIt()
    {
        await using var world = await StartWorldAsync();

        var body = await ReadAsync(world.Client, world.Carmen.AccessToken);

        var handover = body.GetProperty("items")[0];
        handover.GetProperty("isHandover").GetBoolean().ShouldBeTrue();
        handover.GetProperty("from").GetProperty("id").GetGuid().ShouldBe(world.Jomar);
        handover.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(world.Carmen.UserId);
    }

    [Fact]
    public async Task AManagerWhoAsksForDeletedAlsoSeesTheDeletedOneWithItsMarks()
    {
        await using var world = await StartWorldAsync();

        var body = await ReadAsync(world.Client, world.Carmen.AccessToken, "deleted=true");

        var items = body.GetProperty("items").EnumerateArray().ToList();
        items.Select(item => item.GetProperty("id").GetGuid()).ShouldBe([world.HandoverId, world.PaoloToCarmenId, world.DeletedId, world.CarmenToLizaId]);
        body.GetProperty("total").GetInt32().ShouldBe(4);
        var deleted = items[2];
        deleted.GetProperty("isDeleted").GetBoolean().ShouldBeTrue();
        deleted.GetProperty("deletedBy").GetProperty("id").GetGuid().ShouldBe(world.Paolo.UserId);
        deleted.GetProperty("deletedAtUtc").GetDateTimeOffset().ShouldBe(Now.AddMinutes(2));
        deleted.GetProperty("amount").GetDecimal().ShouldBe(50.00m);
    }

    [Fact]
    public async Task AManagerWhoSendsDeletedFalseGetsTheSameAnswerAsOneWhoSendsNothing()
    {
        await using var world = await StartWorldAsync();

        var plain = await ReadAsync(world.Client, world.Carmen.AccessToken);
        var explicitFalse = await ReadAsync(world.Client, world.Carmen.AccessToken, "deleted=false");

        explicitFalse.GetRawText().ShouldBe(plain.GetRawText());
    }

    [Fact]
    public async Task AnAdminSeesOnlyTheTransfersTheySentOrReceivedAndNeverADeletedOne()
    {
        await using var world = await StartWorldAsync();

        using var response = await MoneyFixtures.GetTransferListAsync(world.Client, world.Liza.AccessToken);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        var body = JsonDocument.Parse(text).RootElement;
        body.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("id").GetGuid()).ShouldBe([world.HandoverId, world.CarmenToLizaId]);
        body.GetProperty("total").GetInt32().ShouldBe(2);
        text.ShouldNotContain(world.PaoloToCarmenId.ToString("D"));
        text.ShouldNotContain(world.DeletedId.ToString("D"));
        text.ShouldNotContain("\"isDeleted\":true");
    }

    [Fact]
    public async Task AnAdminWhoAsksForDeletedTransfersGets403AndTheSentence()
    {
        await using var world = await StartWorldAsync();

        using var response = await MoneyFixtures.GetTransferListAsync(world.Client, world.Liza.AccessToken, "deleted=true");

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("detail").GetString().ShouldBe("Only Managers can see deleted transfers.");
    }

    [Fact]
    public async Task AnAdminWithOneTransferSeesOneAndAnAdminWithNoneSeesAnEmptyPage()
    {
        await using var world = await StartWorldAsync();

        var body = await ReadAsync(world.Client, world.Paolo.AccessToken, "deleted=false");

        body.GetProperty("items").GetArrayLength().ShouldBe(1);
        var quiet = await MoneyFixtures.StartStaffAsync(world.Factory, database, Roles.Admin, "Quiet", "Person");
        var empty = await ReadAsync(world.Client, quiet.AccessToken);
        empty.GetProperty("items").GetArrayLength().ShouldBe(0);
        empty.GetProperty("total").GetInt32().ShouldBe(0);
    }

    [Fact]
    public async Task PagesCarryTheSameOrderAndTheTotal()
    {
        await using var world = await StartWorldAsync();

        var first = await ReadAsync(world.Client, world.Carmen.AccessToken, "page=1&pageSize=2");
        var second = await ReadAsync(world.Client, world.Carmen.AccessToken, "page=2&pageSize=2");

        first.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("id").GetGuid()).ShouldBe([world.HandoverId, world.PaoloToCarmenId]);
        second.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("id").GetGuid()).ShouldBe([world.CarmenToLizaId]);
        second.GetProperty("total").GetInt32().ShouldBe(3);
        second.GetProperty("page").GetInt32().ShouldBe(2);
        second.GetProperty("pageSize").GetInt32().ShouldBe(2);
    }

    [Fact]
    public async Task TransfersOnTheSameDayComeNewestRecordedFirst()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var earlier = await MoneySeeding.AddTransferAsync(database, new SeedTransfer(carmen.UserId, liza.UserId, 10.00m, October4), Now);
        var later = await MoneySeeding.AddTransferAsync(database, new SeedTransfer(carmen.UserId, liza.UserId, 20.00m, October4), Now.AddMinutes(5));
        var older = await MoneySeeding.AddTransferAsync(database, new SeedTransfer(carmen.UserId, liza.UserId, 30.00m, October4.AddDays(-1)), Now.AddMinutes(9));

        var body = await ReadAsync(client, carmen.AccessToken);

        body.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("id").GetGuid()).ShouldBe([later, earlier, older]);
    }

    [Fact]
    public async Task APersonWhoLeftIsMarkedAsFormerStaffOnTheirTransfers()
    {
        await using var world = await StartWorldAsync();
        await MoneyFixtures.DeleteAccountAsync(database, world.Jomar, Now);

        var body = await ReadAsync(world.Client, world.Carmen.AccessToken);

        var handover = body.GetProperty("items")[0];
        handover.GetProperty("from").GetProperty("name").GetString().ShouldBe("Jomar Santos");
        handover.GetProperty("from").GetProperty("formerStaff").GetBoolean().ShouldBeTrue();
        handover.GetProperty("to").GetProperty("formerStaff").GetBoolean().ShouldBeFalse();
    }

    [Theory]
    [InlineData("pageSize=101", "pageSize", "Use a page size from 1 to 100.")]
    [InlineData("pageSize=0", "pageSize", "Use a page size from 1 to 100.")]
    [InlineData("page=0", "page", "Use a page from 1 to 100000.")]
    [InlineData("page=100001", "page", "Use a page from 1 to 100000.")]
    public async Task APageOrPageSizeOutOfRangeAnswers400WithTheSharedMessage(string query, string field, string message)
    {
        await using var world = await StartWorldAsync();

        using var response = await MoneyFixtures.GetTransferListAsync(world.Client, world.Carmen.AccessToken, query);

        (await MoneyFixtures.ReadFieldErrorsAsync(response, field)).ShouldBe([message]);
    }

    [Fact]
    public async Task TheLimitsThemselvesAreAccepted()
    {
        await using var world = await StartWorldAsync();

        using var response = await MoneyFixtures.GetTransferListAsync(world.Client, world.Carmen.AccessToken, "page=100000&pageSize=100");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AnAnonymousCallerGets401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await MoneyFixtures.GetTransferListAsync(client, null);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task TheAnswerIsNeverCached()
    {
        await using var world = await StartWorldAsync();

        using var response = await MoneyFixtures.GetTransferListAsync(world.Client, world.Carmen.AccessToken);

        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
    }

    private static async Task<JsonElement> ReadAsync(HttpClient client, string token, string? query = null)
    {
        using var response = await MoneyFixtures.GetTransferListAsync(client, token, query);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        return JsonDocument.Parse(text).RootElement.Clone();
    }

    // Carmen (Manager) sent Liza 500.00 on Oct 4 with a note; Paolo sent Carmen 120.00 on Oct 6; Paolo's 50.00 to Jomar on Oct 5 is deleted;
    // and Carmen handed 200.00 from Jomar (deactivated) to Liza on Oct 7.
    private async Task<World> StartWorldAsync()
    {
        await database.ResetAsync();
        var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var paolo = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Paolo", "Garcia");
        var jomar = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Jomar", "Santos");
        var carmenToLiza = await MoneySeeding.AddTransferAsync(database, new SeedTransfer(carmen.UserId, liza.UserId, 500.00m, October4) { Note = "Float for the week" }, Now);
        var deleted = await MoneySeeding.AddTransferAsync(database, new SeedTransfer(paolo.UserId, jomar.UserId, 50.00m, October5) { Deleted = true }, Now.AddMinutes(1));
        var paoloToCarmen = await MoneySeeding.AddTransferAsync(database, new SeedTransfer(paolo.UserId, carmen.UserId, 120.00m, October6), Now.AddMinutes(2));
        var handover = await MoneySeeding.AddTransferAsync(
            database,
            new SeedTransfer(jomar.UserId, liza.UserId, 200.00m, October7) { IsHandover = true, CreatedById = carmen.UserId },
            Now.AddMinutes(3));
        await MoneyFixtures.DeactivateAccountAsync(database, jomar.UserId);
        return new World(factory, client, carmen, liza, paolo, jomar.UserId, carmenToLiza, deleted, paoloToCarmen, handover);
    }

    private sealed record World(
        CspsApiFactory Factory,
        HttpClient Client,
        StartedSession Carmen,
        StartedSession Liza,
        StartedSession Paolo,
        Guid Jomar,
        Guid CarmenToLizaId,
        Guid DeletedId,
        Guid PaoloToCarmenId,
        Guid HandoverId) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await Factory.DisposeAsync();
        }
    }
}

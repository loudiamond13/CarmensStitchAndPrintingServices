using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Money;

/// <summary>
/// MONEY-03, OD-19, CWE-639, CWE-204: an Admin reads only their own money and is refused for anyone else before any lookup; a Manager
/// reads every staff member, former staff included, and learns of a missing person with a 404.
/// </summary>
public sealed class StaffMoneyAccessEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AnAdminGets403ForARandomIdOnBothRoutesAndNothingIsRevealed()
    {
        await using var world = await StartWorldAsync();
        var random = Guid.NewGuid();

        using var money = await MoneyFixtures.GetStaffMoneyAsync(world.Client, world.Liza.AccessToken, random);
        using var ledger = await MoneyFixtures.GetStaffLedgerAsync(world.Client, world.Liza.AccessToken, random);

        await AssertOwnMoneyOnlyAsync(money);
        await AssertOwnMoneyOnlyAsync(ledger);
    }

    [Fact]
    public async Task AnAdminGets403ForACoworkerIdOnBothRoutesAndTheCoworkersFigureIsNotInTheBody()
    {
        await using var world = await StartWorldAsync();

        foreach (var coworker in new[] { world.Carmen.UserId, world.Paolo.UserId, world.Jomar, LegacyHolder.Id })
        {
            using var money = await MoneyFixtures.GetStaffMoneyAsync(world.Client, world.Liza.AccessToken, coworker);
            using var ledger = await MoneyFixtures.GetStaffLedgerAsync(world.Client, world.Liza.AccessToken, coworker);

            var moneyText = await AssertOwnMoneyOnlyAsync(money);
            var ledgerText = await AssertOwnMoneyOnlyAsync(ledger);
            moneyText.ShouldNotContain("7777");
            ledgerText.ShouldNotContain("7777");
        }
    }

    [Fact]
    public async Task ARealCoworkerAndARandomIdGiveAnAdminTheSameAnswer()
    {
        await using var world = await StartWorldAsync();

        using var real = await MoneyFixtures.GetStaffMoneyAsync(world.Client, world.Liza.AccessToken, world.Paolo.UserId);
        using var random = await MoneyFixtures.GetStaffMoneyAsync(world.Client, world.Liza.AccessToken, Guid.NewGuid());

        var realProblem = await ProblemJson.ReadAsync(real, TestContext.Current.CancellationToken);
        var randomProblem = await ProblemJson.ReadAsync(random, TestContext.Current.CancellationToken);
        real.StatusCode.ShouldBe(random.StatusCode);
        realProblem.GetProperty("code").GetString().ShouldBe(randomProblem.GetProperty("code").GetString());
        realProblem.GetProperty("detail").GetString().ShouldBe(randomProblem.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task AnAdminsOwnIdAnswers200EqualToTheMeAnswerOnBothRoutes()
    {
        await using var world = await StartWorldAsync();

        var me = await ReadTextAsync(await MoneyFixtures.GetMeAsync(world.Client, world.Liza.AccessToken));
        var own = await ReadTextAsync(await MoneyFixtures.GetStaffMoneyAsync(world.Client, world.Liza.AccessToken, world.Liza.UserId));
        var meLedger = await ReadTextAsync(await MoneyFixtures.GetLedgerAsync(world.Client, world.Liza.AccessToken));
        var ownLedger = await ReadTextAsync(await MoneyFixtures.GetStaffLedgerAsync(world.Client, world.Liza.AccessToken, world.Liza.UserId));

        own.ShouldBe(me);
        ownLedger.ShouldBe(meLedger);
    }

    [Fact]
    public async Task TheMeAnswerNamesTheCallersRoleAndStatus()
    {
        await using var world = await StartWorldAsync();

        var liza = await MoneyFixtures.ReadMeAsync(world.Client, world.Liza.AccessToken);
        var carmen = await MoneyFixtures.ReadMeAsync(world.Client, world.Carmen.AccessToken);

        liza.GetProperty("role").GetString().ShouldBe("Admin");
        liza.GetProperty("status").GetString().ShouldBe("active");
        carmen.GetProperty("role").GetString().ShouldBe("Manager");
        carmen.GetProperty("status").GetString().ShouldBe("active");
    }

    [Fact]
    public async Task AManagerReadsADeactivatedPersonsFigureAndLedger()
    {
        await using var world = await StartWorldAsync();

        var money = await ReadJsonAsync(await MoneyFixtures.GetStaffMoneyAsync(world.Client, world.Carmen.AccessToken, world.Jomar));
        var ledger = await ReadJsonAsync(await MoneyFixtures.GetStaffLedgerAsync(world.Client, world.Carmen.AccessToken, world.Jomar));

        money.GetProperty("userId").GetGuid().ShouldBe(world.Jomar);
        money.GetProperty("name").GetString().ShouldBe("Jomar Santos");
        money.GetProperty("role").GetString().ShouldBe("Admin");
        money.GetProperty("status").GetString().ShouldBe("deactivated");
        money.GetProperty("balance").GetDecimal().ShouldBe(-333.33m);
        money.GetProperty("today").GetString().ShouldNotBeNullOrEmpty();
        ledger.GetProperty("balance").GetDecimal().ShouldBe(-333.33m);
        ledger.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("kind").GetString()).ShouldBe(["company-expense"]);
    }

    [Fact]
    public async Task AManagerReadsADeletedPersonAndAnActiveCoworker()
    {
        await using var world = await StartWorldAsync();
        await MoneyFixtures.DeleteAccountAsync(database, world.Jomar, Now);

        var deleted = await ReadJsonAsync(await MoneyFixtures.GetStaffMoneyAsync(world.Client, world.Carmen.AccessToken, world.Jomar));
        var active = await ReadJsonAsync(await MoneyFixtures.GetStaffMoneyAsync(world.Client, world.Carmen.AccessToken, world.Paolo.UserId));

        deleted.GetProperty("status").GetString().ShouldBe("deleted");
        deleted.GetProperty("balance").GetDecimal().ShouldBe(-333.33m);
        active.GetProperty("status").GetString().ShouldBe("active");
        active.GetProperty("balance").GetDecimal().ShouldBe(7777.77m);
    }

    [Fact]
    public async Task AManagerGets404ForARandomIdTheLegacyHolderAndAnAccountWithNoStaffRole()
    {
        await using var world = await StartWorldAsync();

        foreach (var missing in new[] { Guid.NewGuid(), LegacyHolder.Id, world.Roleless })
        {
            using var money = await MoneyFixtures.GetStaffMoneyAsync(world.Client, world.Carmen.AccessToken, missing);
            using var ledger = await MoneyFixtures.GetStaffLedgerAsync(world.Client, world.Carmen.AccessToken, missing);

            await AssertPersonNotFoundAsync(money);
            await AssertPersonNotFoundAsync(ledger);
        }
    }

    [Fact]
    public async Task AManagerMayAskForAnotherPersonsDeletedTransfersAndAnAdminMayNotEvenForTheirOwn()
    {
        await using var world = await StartWorldAsync();

        var jomarLedger = await ReadJsonAsync(await MoneyFixtures.GetStaffLedgerAsync(world.Client, world.Carmen.AccessToken, world.Jomar, "deleted=true"));
        using var ownDeleted = await MoneyFixtures.GetStaffLedgerAsync(world.Client, world.Liza.AccessToken, world.Liza.UserId, "deleted=true");
        using var coworkerDeleted = await MoneyFixtures.GetStaffLedgerAsync(world.Client, world.Liza.AccessToken, world.Jomar, "deleted=true");

        jomarLedger.GetProperty("includesDeleted").GetBoolean().ShouldBeTrue();
        jomarLedger.GetProperty("items").EnumerateArray().Count(item => item.GetProperty("isDeleted").GetBoolean()).ShouldBe(1);
        ownDeleted.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        coworkerDeleted.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task NoOtherFiguresReachAnAdminOnAnyMoneyReadRefusalOrRefusedTransfer()
    {
        await using var world = await StartWorldAsync();
        var today = await ExpenseFixtures.TodayAsync(world.Factory);
        var token = world.Liza.AccessToken;
        var bodies = new List<string>();

        foreach (var route in new[] { MoneyFixtures.MeRoute, MoneyFixtures.LedgerRoute, MoneyFixtures.TransfersRoute, MoneyFixtures.RecipientsRoute })
        {
            using var request = ApiRequests.Get(route, token);
            using var response = await world.Client.SendAsync(request, TestContext.Current.CancellationToken);
            var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.OK, $"{route}: {text}");
            bodies.Add(text);
        }

        using var all = await MoneyFixtures.GetStaffBalancesAsync(world.Client, token);
        all.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        bodies.Add(await all.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        foreach (var coworker in new[] { world.Carmen.UserId, world.Paolo.UserId, world.Jomar })
        {
            using var money = await MoneyFixtures.GetStaffMoneyAsync(world.Client, token, coworker);
            using var ledger = await MoneyFixtures.GetStaffLedgerAsync(world.Client, token, coworker);
            bodies.Add(await AssertOwnMoneyOnlyAsync(money));
            bodies.Add(await AssertOwnMoneyOnlyAsync(ledger));
        }

        // Jomar is owed 333.33, so 500.00 is refused; an Admin learns the limit exists but not the figure (D-49).
        using var refused = await MoneyFixtures.PostTransferAsync(world.Client, token, world.Jomar, 500.00m, today);
        refused.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        bodies.Add(await refused.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));

        bodies.Count.ShouldBe(12);
        foreach (var body in bodies)
        {
            body.ShouldNotContain("7777.77");
            body.ShouldNotContain("333.33");
            body.ShouldNotContain("4242.42");
            body.ShouldNotContain("1234.56");
            body.ShouldNotContain(world.DeletedTransferId.ToString("D"));
            body.ShouldNotContain(world.AdminsDeletedTransferId.ToString("D"));
            body.ShouldNotContain(world.OthersTransferId.ToString("D"));
            body.ShouldNotContain("\"isDeleted\":true");
        }
    }

    [Fact]
    public async Task AnAnonymousCallerGets401OnBothRoutes()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var money = await MoneyFixtures.GetStaffMoneyAsync(client, null, Guid.NewGuid());
        using var ledger = await MoneyFixtures.GetStaffLedgerAsync(client, null, Guid.NewGuid());

        money.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        ledger.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    private static async Task<string> AssertOwnMoneyOnlyAsync(HttpResponseMessage response)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        var text = await ProblemJson.ReadWithoutTraceIdAsync(response, TestContext.Current.CancellationToken);
        using var problem = JsonDocument.Parse(text);
        problem.RootElement.GetProperty("detail").GetString().ShouldBe("You can only see your own money.");
        return text;
    }

    private static async Task AssertPersonNotFoundAsync(HttpResponseMessage response)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("detail").GetString().ShouldBe("This person wasn't found.");
    }

    private static async Task<string> ReadTextAsync(HttpResponseMessage response)
    {
        using (response)
        {
            var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
            return text;
        }
    }

    private static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await ReadTextAsync(response)).RootElement.Clone();

    // Carmen (Manager), Liza (Admin), Paolo (Admin) holds 7,777.77, Jomar (Admin, deactivated) is owed 333.33 and has one deleted transfer
    // from Paolo, a role-less account, and the legacy holder (Admin role, 111.11 received). Liza also has a deleted transfer from Carmen
    // (4,242.42), and two other Admins, Ramon and Tess, share a counted transfer (1,234.56) that Liza is not part of, so the Admin
    // rules (never deleted, only her own transfers) are what keep both out of her reads.
    private async Task<World> StartWorldAsync()
    {
        await database.ResetAsync();
        var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var client = factory.CreateClient();
        var today = await ExpenseFixtures.TodayAsync(factory);
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var paolo = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Paolo", "Garcia");
        var jomar = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Jomar", "Santos");
        var ramon = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Ramon", "Cruz");
        var tess = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Tess", "Lim");
        var roleless = await OrderSeeding.AddStaffAsync(database, "Noel", Now, "Abad");
        await MoneyFixtures.AddRoleAsync(database, LegacyHolder.Id, Roles.Admin);
        await MoneyFixtures.SeedPaymentAsync(database, paolo.UserId, "ORD-2026-0001", 7777.77m, today, Now);
        await MoneyFixtures.SeedCompanyExpenseAsync(database, jomar.UserId, jomar.UserId, 333.33m, today, Now);
        await MoneyFixtures.SeedPaymentAsync(database, LegacyHolder.Id, "ORD-2026-0002", 111.11m, today, Now);
        await MoneyFixtures.SeedPaymentAsync(database, liza.UserId, "ORD-2026-0003", 1000.00m, today, Now);
        await MoneySeeding.AddTransferAsync(database, new SeedTransfer(carmen.UserId, liza.UserId, 25.00m, today), Now);
        var deletedId = await MoneySeeding.AddTransferAsync(database, new SeedTransfer(paolo.UserId, jomar.UserId, 50.00m, today) { Deleted = true }, Now);
        var adminsDeletedId = await MoneySeeding.AddTransferAsync(database, new SeedTransfer(carmen.UserId, liza.UserId, 4242.42m, today) { Deleted = true }, Now);
        var othersId = await MoneySeeding.AddTransferAsync(database, new SeedTransfer(ramon.UserId, tess.UserId, 1234.56m, today), Now);
        await MoneyFixtures.DeactivateAccountAsync(database, jomar.UserId);
        return new World(factory, client, carmen, liza, paolo, jomar.UserId, roleless, deletedId, adminsDeletedId, othersId);
    }

    private sealed record World(CspsApiFactory Factory, HttpClient Client, StartedSession Carmen, StartedSession Liza, StartedSession Paolo, Guid Jomar, Guid Roleless, Guid DeletedTransferId, Guid AdminsDeletedTransferId, Guid OthersTransferId)
        : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await Factory.DisposeAsync();
        }
    }
}

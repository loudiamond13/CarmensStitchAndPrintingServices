using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.OrderLists;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.Orders;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.OrderLists;

/// <summary>
/// D-16 to D-20, D-31, Pitfall 7, T-07-49 to T-07-52: Managers own the three order lists. They add, rename, recolor, retire, bring
/// back and delete entries; names are unique; the order expense Others is protected; a used entry can only be retired; every change
/// is audited; an Admin is refused.
/// </summary>
public sealed class OrderListsManagementTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly Guid OthersId = OrderListSeed.OrderExpenseOthersId;

    public static TheoryData<string> Routes => OrderListFixtures.Routes;

    [Fact]
    public async Task AManagerAddsAProductTypeAndStaffCanUseItOnANewOrderAtOnce()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var name = OrderListFixtures.UniqueName("Hoodie");

        using var response = await OrderListFixtures.PostAsync(client, OrderListFixtures.ProductTypes, manager.AccessToken, new { name = $" {name} ", tone = "info" });

        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.Created, text);
        using var document = JsonDocument.Parse(text);
        var created = document.RootElement;
        var id = created.GetProperty("id").GetGuid();
        created.GetProperty("name").GetString().ShouldBe(name);
        created.GetProperty("tone").GetString().ShouldBe("info");
        created.GetProperty("status").GetString().ShouldBe("active");
        created.GetProperty("isOthers").GetBoolean().ShouldBeFalse();
        created.GetProperty("useCount").GetInt32().ShouldBe(0);
        created.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        Convert.FromBase64String(created.GetProperty("version").GetString().ShouldNotBeNull()).Length.ShouldBe(8);
        response.Headers.Location.ShouldNotBeNull().ToString().ShouldBe($"/api/v1/product-types/{id:D}");

        var names = (await OrderListFixtures.ReadListAsync(client, OrderListFixtures.ProductTypes, admin.AccessToken)).Select(item => item.GetProperty("name").GetString()).ToList();
        names.IndexOf("Custom Design").ShouldBeLessThan(names.IndexOf(name));
        names.IndexOf(name).ShouldBeLessThan(names.IndexOf("Long Sleeves"));

        var today = await OrderFixtures.TodayAsync(factory);
        using var order = await OrderFixtures.PostAsync(client, admin.AccessToken, OrderFixtures.ValidBody(id, today));
        order.StatusCode.ShouldBe(HttpStatusCode.Created, await order.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));

        await using var context = database.CreateContext();
        var key = id.ToString("D");
        var entry = await context.AuditLog.AsNoTracking().SingleAsync(row => row.TargetId == key && row.Action == "product-type.added", TestContext.Current.CancellationToken);
        entry.TargetType.ShouldBe("ProductType");
        entry.ActorUserId.ShouldBe(manager.UserId);
        entry.Detail.ShouldBe($"name={name};tone=info");
    }

    [Fact]
    public async Task AnAdminCannotAddAProductTypeAndNothingIsWritten()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var name = OrderListFixtures.UniqueName("Admin try");

        using var response = await OrderListFixtures.PostAsync(client, OrderListFixtures.ProductTypes, admin.AccessToken, new { name, tone = "info" });

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        await using var context = database.CreateContext();
        (await context.ProductTypes.CountAsync(entry => entry.Name == name, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task AManagerAddsAnEntryAndItAppearsInTheListInAToZPlaceWithAUseCountOfZero(string route)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var name = OrderListFixtures.UniqueName("Mmm");

        var created = await OrderListFixtures.CreateAsync(client, route, manager.AccessToken, $" {name} ", "success");

        created.GetProperty("name").GetString().ShouldBe(name);
        created.GetProperty("useCount").GetInt32().ShouldBe(0);
        var list = await OrderListFixtures.ReadListAsync(client, route, manager.AccessToken);
        var names = list.Select(item => item.GetProperty("name").GetString()).ToList();
        names.Count(item => item == name).ShouldBe(1);
        AssertAToZ(route, names);

        list.Single(item => item.GetProperty("name").GetString() == name).GetProperty("useCount").GetInt32().ShouldBe(0);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task ASecondEntryWithTheSameNameInAnotherCaseIs400OnNameAndASeededNameIsTakenToo(string route)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var name = OrderListFixtures.UniqueName("Dyeing");
        await OrderListFixtures.CreateAsync(client, route, manager.AccessToken, name, "info");
        var seeded = (await OrderListFixtures.ReadListAsync(client, route, manager.AccessToken))[0].GetProperty("name").GetString()!;

        using var again = await OrderListFixtures.PostAsync(client, route, manager.AccessToken, new { name = $" {name.ToUpperInvariant()} ", tone = "info" });
        using var seededAgain = await OrderListFixtures.PostAsync(client, route, manager.AccessToken, new { name = seeded.ToLowerInvariant(), tone = "info" });

        foreach (var response in new[] { again, seededAgain })
        {
            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
            problem.GetProperty("code").GetString().ShouldBe($"{Segment(route)}.invalid-request");
            OrderListFixtures.FieldErrors(problem, "name").ShouldBe(["That name is already used. Choose another one."]);
        }
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task AToneOutsideTheSixAndABlankNameAndAMissingBodyAre400WithPlainMessages(string route)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var badTone = await OrderListFixtures.PostAsync(client, route, manager.AccessToken, new { name = OrderListFixtures.UniqueName("Printing"), tone = "danger" });
        using var missing = await OrderListFixtures.PostAsync(client, route, manager.AccessToken, body: null);

        badTone.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var toneProblem = await ProblemJson.ReadAsync(badTone, TestContext.Current.CancellationToken);
        OrderListFixtures.FieldErrors(toneProblem, "tone").ShouldBe(["Choose a badge color."]);
        OrderListFixtures.FieldErrors(toneProblem, "name").ShouldBeEmpty();
        missing.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var missingProblem = await ProblemJson.ReadAsync(missing, TestContext.Current.CancellationToken);
        OrderListFixtures.FieldErrors(missingProblem, "name").ShouldBe([$"Enter a {Noun(route)} name."]);
        OrderListFixtures.FieldErrors(missingProblem, "tone").ShouldBe(["Choose a badge color."]);
    }

    [Fact]
    public async Task AFortyCharacterNameIsAcceptedAndAFortyOneCharacterNameIsNot()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var forty = $"B{Guid.NewGuid():N}".PadRight(40, 'x');

        using var accepted = await OrderListFixtures.PostAsync(client, OrderListFixtures.PaymentMethods, manager.AccessToken, new { name = forty, tone = "info" });
        using var refused = await OrderListFixtures.PostAsync(client, OrderListFixtures.PaymentMethods, manager.AccessToken, new { name = forty + "y", tone = "info" });

        accepted.StatusCode.ShouldBe(HttpStatusCode.Created);
        refused.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        OrderListFixtures.FieldErrors(await ProblemJson.ReadAsync(refused, TestContext.Current.CancellationToken), "name").ShouldBe(["Keep the name to 40 characters or fewer."]);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task AnAdminIsRefusedOnEveryManagerRouteAndKeepsTheList(string route)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var created = await OrderListFixtures.CreateAsync(client, route, manager.AccessToken, OrderListFixtures.UniqueName("Guarded"), "info");
        var id = created.GetProperty("id").GetGuid();

        using var add = await OrderListFixtures.PostAsync(client, route, admin.AccessToken, new { name = OrderListFixtures.UniqueName("Nope"), tone = "info" });
        using var get = await OrderListFixtures.GetAsync(client, route, admin.AccessToken, id);
        using var put = await OrderListFixtures.PutAsync(client, route, admin.AccessToken, id, OrderListFixtures.BodyFrom(created));
        using var retire = await OrderListFixtures.RetireAsync(client, route, admin.AccessToken, id);
        using var reactivate = await OrderListFixtures.ReactivateAsync(client, route, admin.AccessToken, id);
        using var delete = await OrderListFixtures.DeleteAsync(client, route, admin.AccessToken, id);
        var list = await OrderListFixtures.ReadListAsync(client, route, admin.AccessToken);

        foreach (var response in new[] { add, get, put, retire, reactivate, delete })
        {
            response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        }

        list.Count(item => item.GetProperty("id").GetGuid() == id).ShouldBe(1);
        (await OrderListFixtures.ReadDetailAsync(client, route, manager.AccessToken, id)).GetProperty("status").GetString().ShouldBe("active");
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task AManagerReadsAnEntryWithItsRecorderAndAnUnknownIdIs404(string route)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var created = await OrderListFixtures.CreateAsync(client, route, manager.AccessToken, OrderListFixtures.UniqueName("Recorded"), "info");

        var detail = await OrderListFixtures.ReadDetailAsync(client, route, manager.AccessToken, created.GetProperty("id").GetGuid());
        using var unknown = await OrderListFixtures.GetAsync(client, route, manager.AccessToken, Guid.NewGuid());

        detail.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        detail.GetProperty("recordedBy").GetProperty("formerStaff").GetBoolean().ShouldBeFalse();
        OrderFixtures.IsNull(detail, "lastChangedBy").ShouldBeTrue();
        OrderFixtures.IsNull(detail, "lastChangedAt").ShouldBeTrue();
        unknown.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(unknown, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe($"{Segment(route)}.not-found");
    }

    [Fact]
    public async Task ASeededEntryReadsWithSystemAsRecorder()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        var detail = await OrderListFixtures.ReadDetailAsync(client, OrderListFixtures.PaymentMethods, manager.AccessToken, OrderFixtures.CashId);

        detail.GetProperty("name").GetString().ShouldBe("Cash");
        OrderFixtures.IsNull(detail, "recordedBy").ShouldBeTrue();
        detail.GetProperty("recordedAt").GetDateTimeOffset().ShouldBe(OrderListSeed.SeededAtUtc);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task ARenameAndRecolorShowInTheListInNewPlaceWithANewVersionAndTwoAuditRows(string route)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var created = await OrderListFixtures.CreateAsync(client, route, manager.AccessToken, OrderListFixtures.UniqueName("Zeta"), "info");
        var id = created.GetProperty("id").GetGuid();
        var renamed = OrderListFixtures.UniqueName("Aardvark");
        var body = OrderListFixtures.BodyFrom(created);
        body["name"] = $" {renamed} ";
        body["tone"] = "warning";

        using var response = await OrderListFixtures.PutAsync(client, route, manager.AccessToken, id, body);

        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        document.RootElement.GetProperty("name").GetString().ShouldBe(renamed);
        document.RootElement.GetProperty("tone").GetString().ShouldBe("warning");
        document.RootElement.GetProperty("version").GetString().ShouldNotBe(created.GetProperty("version").GetString());
        document.RootElement.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        var names = (await OrderListFixtures.ReadListAsync(client, route, manager.AccessToken)).Select(item => item.GetProperty("name").GetString()).ToList();
        names.Count(item => item == renamed).ShouldBe(1);
        AssertAToZ(route, names);
        (await OrderListFixtures.AuditCountAsync(database, id, $"{AuditPrefix(route)}.renamed")).ShouldBe(1);
        (await OrderListFixtures.AuditCountAsync(database, id, $"{AuditPrefix(route)}.recolored")).ShouldBe(1);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task AnEditWithAStaleVersionIs409AndANameAnotherEntryHoldsIs400(string route)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var first = await OrderListFixtures.CreateAsync(client, route, manager.AccessToken, OrderListFixtures.UniqueName("Alpha"), "info");
        var second = await OrderListFixtures.CreateAsync(client, route, manager.AccessToken, OrderListFixtures.UniqueName("Beta"), "info");
        var firstId = first.GetProperty("id").GetGuid();
        var staleBody = OrderListFixtures.BodyFrom(first);
        var recolor = OrderListFixtures.BodyFrom(first);
        recolor["tone"] = "success";
        using var recolored = await OrderListFixtures.PutAsync(client, route, manager.AccessToken, firstId, recolor);
        staleBody["name"] = OrderListFixtures.UniqueName("Gamma");
        var taken = OrderListFixtures.BodyFrom(await OrderListFixtures.ReadDetailAsync(client, route, manager.AccessToken, firstId));
        taken["name"] = second.GetProperty("name").GetString()!.ToUpperInvariant();

        using var stale = await OrderListFixtures.PutAsync(client, route, manager.AccessToken, firstId, staleBody);
        using var duplicate = await OrderListFixtures.PutAsync(client, route, manager.AccessToken, firstId, taken);

        recolored.StatusCode.ShouldBe(HttpStatusCode.OK);
        stale.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemJson.ReadAsync(stale, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("edit.stale");
        duplicate.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        OrderListFixtures.FieldErrors(await ProblemJson.ReadAsync(duplicate, TestContext.Current.CancellationToken), "name").ShouldBe(["That name is already used. Choose another one."]);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task AFormWithNoChangeKeepsTheVersionAndWritesNoAuditAndABadFormIs400(string route)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var created = await OrderListFixtures.CreateAsync(client, route, manager.AccessToken, OrderListFixtures.UniqueName("Steady"), "info");
        var id = created.GetProperty("id").GetGuid();

        using var same = await OrderListFixtures.PutAsync(client, route, manager.AccessToken, id, OrderListFixtures.BodyFrom(created));
        using var bad = await OrderListFixtures.PutAsync(client, route, manager.AccessToken, id, new { name = " ", tone = "danger", version = "nope" });
        using var unknown = await OrderListFixtures.PutAsync(client, route, manager.AccessToken, Guid.NewGuid(), OrderListFixtures.BodyFrom(created));

        same.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await same.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        document.RootElement.GetProperty("version").GetString().ShouldBe(created.GetProperty("version").GetString());
        (await OrderListFixtures.AuditCountAsync(database, id, $"{AuditPrefix(route)}.renamed")).ShouldBe(0);
        bad.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(bad, TestContext.Current.CancellationToken);
        OrderListFixtures.FieldErrors(problem, "name").ShouldBe([$"Enter a {Noun(route)} name."]);
        OrderListFixtures.FieldErrors(problem, "tone").ShouldBe(["Choose a badge color."]);
        OrderListFixtures.FieldErrors(problem, "version").ShouldBe(["Reload the form and try again."]);
        unknown.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task RetiringKeepsTheEntryListedAsRetiredRefusesNewUseKeepsOldRowsAndReactivatingAllowsUseAgain(string route)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var created = await OrderListFixtures.CreateAsync(client, route, manager.AccessToken, OrderListFixtures.UniqueName("Seasonal"), "info");
        var id = created.GetProperty("id").GetGuid();
        var used = await UseAsync(factory, client, manager, route, id);

        using var retire = await OrderListFixtures.RetireAsync(client, route, manager.AccessToken, id);
        using var retireAgain = await OrderListFixtures.RetireAsync(client, route, manager.AccessToken, id);

        retire.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        retireAgain.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var retiredItem = (await OrderListFixtures.ReadListAsync(client, route, manager.AccessToken)).Single(item => item.GetProperty("id").GetGuid() == id);
        retiredItem.GetProperty("status").GetString().ShouldBe("retired");
        retiredItem.GetProperty("useCount").GetInt32().ShouldBe(1);
        (await OrderListFixtures.AuditCountAsync(database, id, $"{AuditPrefix(route)}.retired")).ShouldBe(1);

        var (refused, field) = await AttemptUseAsync(factory, client, manager, route, id);
        using var refusedResponse = refused;
        refused.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        OrderListFixtures.FieldErrors(await ProblemJson.ReadAsync(refused, TestContext.Current.CancellationToken), field)
            .ShouldBe([$"This {Noun(route)} was retired. Choose another one."]);
        await KeepRetiredAsync(client, manager, route, used);

        using var reactivate = await OrderListFixtures.ReactivateAsync(client, route, manager.AccessToken, id);
        using var reactivateAgain = await OrderListFixtures.ReactivateAsync(client, route, manager.AccessToken, id);

        reactivate.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        reactivateAgain.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await OrderListFixtures.AuditCountAsync(database, id, $"{AuditPrefix(route)}.reactivated")).ShouldBe(1);
        var (allowed, _) = await AttemptUseAsync(factory, client, manager, route, id);
        using var allowedResponse = allowed;
        allowed.StatusCode.ShouldBeOneOf(HttpStatusCode.OK, HttpStatusCode.Created);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task RetiringOrReactivatingAnUnknownEntryIs404(string route)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var retire = await OrderListFixtures.RetireAsync(client, route, manager.AccessToken, Guid.NewGuid());
        using var reactivate = await OrderListFixtures.ReactivateAsync(client, route, manager.AccessToken, Guid.NewGuid());
        using var delete = await OrderListFixtures.DeleteAsync(client, route, manager.AccessToken, Guid.NewGuid());

        foreach (var response in new[] { retire, reactivate, delete })
        {
            response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
            (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe($"{Segment(route)}.not-found");
        }
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task ANeverUsedEntryCanBeDeletedAndAUsedOneCannotAndTheCountShowsIt(string route)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var unused = (await OrderListFixtures.CreateAsync(client, route, manager.AccessToken, OrderListFixtures.UniqueName("Unused"), "info")).GetProperty("id").GetGuid();
        var usedId = (await OrderListFixtures.CreateAsync(client, route, manager.AccessToken, OrderListFixtures.UniqueName("Busy"), "info")).GetProperty("id").GetGuid();
        await UseAsync(factory, client, manager, route, usedId);

        using var deleted = await OrderListFixtures.DeleteAsync(client, route, manager.AccessToken, unused);
        using var refused = await OrderListFixtures.DeleteAsync(client, route, manager.AccessToken, usedId);

        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        using var gone = await OrderListFixtures.GetAsync(client, route, manager.AccessToken, unused);
        gone.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        refused.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        var problem = await ProblemJson.ReadAsync(refused, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe($"{Segment(route)}.in-use");
        problem.GetProperty("detail").GetString().ShouldBe($"This {Noun(route)} is used by an order, so it can't be deleted. Retire it instead.");
        (await OrderListFixtures.ReadDetailAsync(client, route, manager.AccessToken, usedId)).GetProperty("useCount").GetInt32().ShouldBe(1);
        (await OrderListFixtures.AuditCountAsync(database, unused, $"{AuditPrefix(route)}.deleted")).ShouldBe(1);
        (await OrderListFixtures.AuditCountAsync(database, usedId, $"{AuditPrefix(route)}.deleted")).ShouldBe(0);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task AnEntryUsedOnlyByASoftDeletedOrderStillCountsAndCannotBeDeleted(string route)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var id = (await OrderListFixtures.CreateAsync(client, route, manager.AccessToken, OrderListFixtures.UniqueName("Ghost"), "info")).GetProperty("id").GetGuid();
        var used = await UseAsync(factory, client, manager, route, id);
        using var softDelete = await OrderFixtures.DeleteAsync(client, manager.AccessToken, used.GetProperty("id").GetGuid());
        softDelete.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        using var refused = await OrderListFixtures.DeleteAsync(client, route, manager.AccessToken, id);

        refused.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemJson.ReadAsync(refused, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe($"{Segment(route)}.in-use");
        var listed = (await OrderListFixtures.ReadListAsync(client, route, manager.AccessToken)).Single(item => item.GetProperty("id").GetGuid() == id);
        listed.GetProperty("useCount").GetInt32().ShouldBe(1);
    }

    [Fact]
    public async Task OthersCanBeRecoloredButNeverRenamedRetiredOrDeleted()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var route = OrderListFixtures.OrderExpenseCategories;
        var detail = await OrderListFixtures.ReadDetailAsync(client, route, manager.AccessToken, OthersId);
        detail.GetProperty("isOthers").GetBoolean().ShouldBeTrue();
        var rename = OrderListFixtures.BodyFrom(detail);
        rename["name"] = "Misc";
        var recolor = OrderListFixtures.BodyFrom(detail);
        recolor["tone"] = detail.GetProperty("tone").GetString() == "success" ? "info" : "success";

        using var renamed = await OrderListFixtures.PutAsync(client, route, manager.AccessToken, OthersId, rename);
        using var recolored = await OrderListFixtures.PutAsync(client, route, manager.AccessToken, OthersId, recolor);
        using var retired = await OrderListFixtures.RetireAsync(client, route, manager.AccessToken, OthersId);
        using var deleted = await OrderListFixtures.DeleteAsync(client, route, manager.AccessToken, OthersId);

        renamed.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemJson.ReadAsync(renamed, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("order-expense-categories.protected");
        recolored.StatusCode.ShouldBe(HttpStatusCode.OK);
        retired.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        deleted.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        foreach (var response in new[] { retired, deleted })
        {
            (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("order-expense-categories.protected");
        }

        var after = await OrderListFixtures.ReadDetailAsync(client, route, manager.AccessToken, OthersId);
        after.GetProperty("name").GetString().ShouldBe("Others");
        after.GetProperty("status").GetString().ShouldBe("active");
        after.GetProperty("tone").GetString().ShouldBe(recolor["tone"]);
        (await OrderListFixtures.ReadListAsync(client, route, manager.AccessToken))[^1].GetProperty("name").GetString().ShouldBe("Others");
    }

    [Fact]
    public async Task SendingOthersItsOwnNameWithANewToneIs200()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var route = OrderListFixtures.OrderExpenseCategories;
        var body = OrderListFixtures.BodyFrom(await OrderListFixtures.ReadDetailAsync(client, route, manager.AccessToken, OthersId));
        body["name"] = " Others ";

        using var response = await OrderListFixtures.PutAsync(client, route, manager.AccessToken, OthersId, body);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task TheListShowsAUseCountForEveryEntryToEitherRole()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var id = (await OrderListFixtures.CreateAsync(client, OrderListFixtures.ProductTypes, manager.AccessToken, OrderListFixtures.UniqueName("Counted"), "info")).GetProperty("id").GetGuid();
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(id, today);
        body["items"] = new[] { OrderFixtures.Item(id), OrderFixtures.Item(id, "Second line") };
        await OrderFixtures.CreateAsync(client, manager.AccessToken, body);

        var list = await OrderListFixtures.ReadListAsync(client, OrderListFixtures.ProductTypes, admin.AccessToken);

        list.Single(item => item.GetProperty("id").GetGuid() == id).GetProperty("useCount").GetInt32().ShouldBe(2);
        list.ShouldAllBe(item => item.GetProperty("useCount").GetInt32() >= 0);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task TwoAddsOfOneNameInDifferentCaseSentTogetherGiveOneCreatedAndOneNameError(string route)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var first = await TestSessions.StartAsync(factory, Roles.Manager);
        var second = await TestSessions.StartAsync(factory, Roles.Manager);

        for (var round = 1; round <= 10; round++)
        {
            var name = OrderListFixtures.UniqueName($"Cheque{round}");
            var (a, b) = await ConcurrentRequests.SendTogetherAsync(
                () => OrderListFixtures.PostAsync(client, route, first.AccessToken, new { name, tone = "info" }),
                () => OrderListFixtures.PostAsync(client, route, second.AccessToken, new { name = name.ToUpperInvariant(), tone = "warning" }));
            using var firstResponse = a;
            using var secondResponse = b;

            var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
            statuses.Count(static status => status == HttpStatusCode.Created).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            statuses.Count(static status => status == HttpStatusCode.BadRequest).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            var loser = firstResponse.StatusCode == HttpStatusCode.BadRequest ? firstResponse : secondResponse;
            OrderListFixtures.FieldErrors(await ProblemJson.ReadAsync(loser, TestContext.Current.CancellationToken), "name").ShouldBe(["That name is already used. Choose another one."], $"round {round}");
            var normalized = name.ToUpperInvariant();
            await using var context = database.CreateContext();
            var count = route switch
            {
                OrderListFixtures.ProductTypes => await context.ProductTypes.CountAsync(entry => entry.NormalizedName == normalized, TestContext.Current.CancellationToken),
                OrderListFixtures.PaymentMethods => await context.PaymentMethods.CountAsync(entry => entry.NormalizedName == normalized, TestContext.Current.CancellationToken),
                _ => await context.OrderExpenseCategories.CountAsync(entry => entry.NormalizedName == normalized, TestContext.Current.CancellationToken),
            };
            count.ShouldBe(1, $"round {round}");
        }
    }

    [Fact]
    public async Task ADeleteSentTogetherWithAnOrderThatUsesTheEntryEndsInOneClearWinnerNeverA500()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var deletedWins = 0;
        var useWins = 0;

        for (var round = 1; round <= 10; round++)
        {
            var id = (await OrderListFixtures.CreateAsync(client, OrderListFixtures.ProductTypes, manager.AccessToken, OrderListFixtures.UniqueName($"Fleeting{round}"), "info")).GetProperty("id").GetGuid();
            var (delete, use) = await ConcurrentRequests.SendTogetherAsync(
                () => OrderListFixtures.DeleteAsync(client, OrderListFixtures.ProductTypes, manager.AccessToken, id),
                () => OrderFixtures.PostAsync(client, staff.AccessToken, OrderFixtures.ValidBody(id, today)));
            using var deleteResponse = delete;
            using var useResponse = use;

            var label = $"round {round}: delete {(int)deleteResponse.StatusCode}, use {(int)useResponse.StatusCode}";
            if (deleteResponse.StatusCode == HttpStatusCode.NoContent)
            {
                deletedWins++;
                useResponse.StatusCode.ShouldBe(HttpStatusCode.BadRequest, label);
                var problem = await ProblemJson.ReadAsync(useResponse, TestContext.Current.CancellationToken);
                OrderFixtures.FieldErrors(problem, "items[0].productTypeId").Single().ShouldBeOneOf(["This product type was deleted.", "Choose a product type."]);
            }
            else
            {
                useWins++;
                deleteResponse.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity, label);
                (await ProblemJson.ReadAsync(deleteResponse, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("product-types.in-use", label);
                useResponse.StatusCode.ShouldBe(HttpStatusCode.Created, label);
            }

            await using var context = database.CreateContext();
            var stillThere = await context.ProductTypes.AnyAsync(entry => entry.Id == id, TestContext.Current.CancellationToken);
            var used = await context.Orders.AnyAsync(order => order.Items.Any(item => item.ProductTypeId == id), TestContext.Current.CancellationToken);
            (stillThere || !used).ShouldBeTrue(label);
        }

        (deletedWins + useWins).ShouldBe(10);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task EveryChangeWritesExactlyOneAuditEntryOfTheRightActionAndTargetTypeByTheManager(string route)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var prefix = AuditPrefix(route);
        var target = OrderListFixtures.Lists.Single(list => list.Route == route).TargetType;
        var name = OrderListFixtures.UniqueName("Audited");
        var created = await OrderListFixtures.CreateAsync(client, route, manager.AccessToken, name, "info");
        var id = created.GetProperty("id").GetGuid();
        var rename = OrderListFixtures.BodyFrom(created);
        rename["name"] = $"{name}x"[..Math.Min(40, name.Length + 1)];
        rename["tone"] = "warning";

        (await OrderListFixtures.PutAsync(client, route, manager.AccessToken, id, rename)).Dispose();
        (await OrderListFixtures.RetireAsync(client, route, manager.AccessToken, id)).Dispose();
        (await OrderListFixtures.RetireAsync(client, route, manager.AccessToken, id)).Dispose();
        (await OrderListFixtures.ReactivateAsync(client, route, manager.AccessToken, id)).Dispose();
        (await OrderListFixtures.ReactivateAsync(client, route, manager.AccessToken, id)).Dispose();
        (await OrderListFixtures.DeleteAsync(client, route, manager.AccessToken, id)).Dispose();

        await using var context = database.CreateContext();
        var key = id.ToString("D");
        var rows = await context.AuditLog.AsNoTracking().Where(row => row.TargetId == key).OrderBy(row => row.Id).ToListAsync(TestContext.Current.CancellationToken);
        rows.Select(row => row.Action).ShouldBe(
            [$"{prefix}.added", $"{prefix}.renamed", $"{prefix}.recolored", $"{prefix}.retired", $"{prefix}.reactivated", $"{prefix}.deleted"]);
        rows.ShouldAllBe(row => row.TargetType == target && row.ActorUserId == manager.UserId);
        rows[1].Detail.ShouldBe($"name={name}>{rename["name"]}");
        rows[2].Detail.ShouldBe("tone=info>warning");
        rows[3].Detail.ShouldBe($"name={rename["name"]}");
    }

    // A to Z ignoring letter case; in the order expense categories Others comes last.
    private static void AssertAToZ(string route, IReadOnlyList<string?> names)
    {
        var body = names.Where(item => route != OrderListFixtures.OrderExpenseCategories || item != "Others").ToList();
        body.ShouldBe(body.Order(StringComparer.OrdinalIgnoreCase).ToList());
        if (route == OrderListFixtures.OrderExpenseCategories)
        {
            names[^1].ShouldBe("Others");
        }
    }

    private static string Segment(string route) => route[(route.LastIndexOf('/') + 1)..];

    private static string Noun(string route) => OrderListDescriptorFor(route).Noun;

    private static string AuditPrefix(string route) => OrderListFixtures.Lists.Single(list => list.Route == route).AuditPrefix;

    private static (string Noun, OrderListKind Kind) OrderListDescriptorFor(string route) => route switch
    {
        OrderListFixtures.ProductTypes => ("product type", OrderListKind.ProductType),
        OrderListFixtures.PaymentMethods => ("payment method", OrderListKind.PaymentMethod),
        _ => ("category", OrderListKind.OrderExpenseCategory),
    };

    // Puts one row on the entry: an order with an item, or an order with a payment or an expense. Returns the order as saved.
    private static async Task<JsonElement> UseAsync(CspsApiFactory factory, HttpClient client, StartedSession manager, string route, Guid entryId)
    {
        var today = await OrderFixtures.TodayAsync(factory);
        if (route == OrderListFixtures.ProductTypes)
        {
            return await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(entryId, today));
        }

        var order = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        return route == OrderListFixtures.PaymentMethods
            ? await OrderFixtures.AddPaymentAndReadAsync(client, manager.AccessToken, order, today, 100.00m, entryId, manager.UserId)
            : await OrderFixtures.AddExpenseAndReadAsync(client, manager.AccessToken, order, today, entryId, 100.00m, manager.UserId);
    }

    // Tries to put a new row on the entry and returns the raw answer and the field a refusal names.
    private static async Task<(HttpResponseMessage Response, string Field)> AttemptUseAsync(CspsApiFactory factory, HttpClient client, StartedSession manager, string route, Guid entryId)
    {
        var today = await OrderFixtures.TodayAsync(factory);
        if (route == OrderListFixtures.ProductTypes)
        {
            return (await OrderFixtures.PostAsync(client, manager.AccessToken, OrderFixtures.ValidBody(entryId, today)), "items[0].productTypeId");
        }

        var order = await OrderFixtures.CreateAsync(client, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var orderId = order.GetProperty("id").GetGuid();
        var version = order.GetProperty("version").GetString();
        if (route == OrderListFixtures.PaymentMethods)
        {
            return (await OrderFixtures.AddPaymentAsync(client, manager.AccessToken, orderId, OrderFixtures.PaymentBody(today, 100.00m, entryId, manager.UserId, version)), "paymentMethodId");
        }

        return (await OrderFixtures.AddExpenseAsync(client, manager.AccessToken, orderId, OrderFixtures.ExpenseBody(today, entryId, null, 100.00m, manager.UserId, version)), "orderExpenseCategoryId");
    }

    // A row that already uses a retired entry can still be saved without changing the entry.
    private static async Task KeepRetiredAsync(HttpClient client, StartedSession manager, string route, JsonElement order)
    {
        var orderId = order.GetProperty("id").GetGuid();
        var version = order.GetProperty("version").GetString();
        HttpResponseMessage response;
        if (route == OrderListFixtures.ProductTypes)
        {
            var item = order.GetProperty("items")[0];
            response = await OrderFixtures.PutItemAsync(
                client, manager.AccessToken, orderId, item.GetProperty("id").GetGuid(),
                OrderFixtures.ItemBody(item.GetProperty("productType").GetProperty("id").GetGuid(), version, "Renamed line"));
        }
        else if (route == OrderListFixtures.PaymentMethods)
        {
            var payment = order.GetProperty("payments")[0];
            response = await OrderFixtures.PutPaymentAsync(
                client, manager.AccessToken, orderId, payment.GetProperty("id").GetGuid(),
                OrderFixtures.PaymentBody(
                    DateOnly.Parse(payment.GetProperty("paymentDate").GetString()!, System.Globalization.CultureInfo.InvariantCulture),
                    150.00m,
                    payment.GetProperty("method").GetProperty("id").GetGuid(),
                    manager.UserId,
                    version));
        }
        else
        {
            var expense = order.GetProperty("expenses")[0];
            response = await OrderFixtures.PutExpenseAsync(
                client, manager.AccessToken, orderId, expense.GetProperty("id").GetGuid(),
                OrderFixtures.ExpenseBody(
                    DateOnly.Parse(expense.GetProperty("expenseDate").GetString()!, System.Globalization.CultureInfo.InvariantCulture),
                    expense.GetProperty("category").GetProperty("id").GetGuid(),
                    "Edited note",
                    150.00m,
                    manager.UserId,
                    version));
        }

        using (response)
        {
            response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }
    }
}

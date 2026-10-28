using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>SEC-08, ORD-14, ORD-20, T-07-09, CWE-915: who recorded an order, its number and its totals come from the token, the clock and the server, never from the request.</summary>
public sealed class OrderAttributionTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task ForgedAttributionNumberTotalsAndDeletionMembersInTheBodyAreIgnored()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var caller = await TestSessions.StartAsync(factory, Roles.Admin);
        var other = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var body = OrderFixtures.ValidBody(OrderFixtures.BasketballId, today);
        body["createdById"] = other.UserId;
        body["createdAt"] = "1999-01-01T00:00:00Z";
        body["createdAtUtc"] = "1999-01-01T00:00:00Z";
        body["updatedById"] = other.UserId;
        body["updatedAt"] = "1999-01-01T00:00:00Z";
        body["updatedAtUtc"] = "1999-01-01T00:00:00Z";
        body["deletedAtUtc"] = "1999-01-01T00:00:00Z";
        body["deletedById"] = other.UserId;
        body["number"] = "ORD-1999-9999";
        body["rowVersion"] = "AAAAAAAAAAE=";
        body["version"] = "AAAAAAAAAAE=";
        body["totals"] = new Dictionary<string, object?> { ["subtotal"] = 1.00m, ["total"] = 1.00m, ["balance"] = 1.00m, ["paid"] = 9999.00m };
        body["subtotal"] = 1.00m;
        body["total"] = 1.00m;
        body["balance"] = 1.00m;
        body["statusHistory"] = new[] { new Dictionary<string, object?> { ["to"] = "completed", ["changedBy"] = other.UserId } };
        var before = TimeProvider.System.GetUtcNow();

        var created = await OrderFixtures.CreateAsync(client, caller.AccessToken, body);

        var after = TimeProvider.System.GetUtcNow();
        await using var context = database.CreateContext();
        var id = created.GetProperty("id").GetGuid();
        var row = await context.Orders.IgnoreQueryFilters(["SoftDelete"]).AsNoTracking()
            .Include(order => order.Items)
            .Include(order => order.StatusChanges)
            .AsSplitQuery()
            .SingleAsync(order => order.Id == id, TestContext.Current.CancellationToken);
        row.CreatedById.ShouldBe(caller.UserId);
        row.CreatedAtUtc.ShouldBeInRange(before.AddSeconds(-1), after.AddSeconds(1));
        row.UpdatedById.ShouldBeNull();
        row.UpdatedAtUtc.ShouldBeNull();
        row.DeletedAtUtc.ShouldBeNull();
        row.DeletedById.ShouldBeNull();
        row.IsDeleted.ShouldBeFalse();
        row.RowVersion.Length.ShouldBe(8);
        row.Number.ShouldBe($"ORD-{today.Year}-0001");
        row.Totals.Subtotal.ShouldBe(9750.00m);
        row.Totals.Total.ShouldBe(9750.00m);
        row.Totals.Paid.ShouldBe(0.00m);
        row.Totals.Balance.ShouldBe(9750.00m);
        row.Items.ShouldAllBe(item => item.CreatedById == caller.UserId && item.UpdatedById == null);
        var history = row.StatusChanges.ShouldHaveSingleItem();
        history.ToStatus.ShouldBe(Csps.Domain.Orders.OrderStatus.Pending);
        history.ChangedById.ShouldBe(caller.UserId);
        created.GetProperty("recordedBy").GetProperty("id").GetGuid().ShouldBe(caller.UserId);
        created.GetProperty("recordedAt").GetDateTimeOffset().ShouldBeInRange(before.AddSeconds(-1), after.AddSeconds(1));
        OrderFixtures.IsNull(created, "lastChangedBy").ShouldBeTrue();
        OrderFixtures.IsNull(created, "lastChangedAt").ShouldBeTrue();
    }

    [Fact]
    public async Task ARowWithNoCreatorReadsRecordedByNull()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var caller = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, caller.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        await using (var context = database.CreateContext())
        {
            var changed = await context.Orders.Where(order => order.Id == id)
                .ExecuteUpdateAsync(set => set.SetProperty(order => order.CreatedById, (Guid?)null), TestContext.Current.CancellationToken);
            changed.ShouldBe(1);
        }

        var read = await OrderFixtures.ReadDetailAsync(client, caller.AccessToken, id);

        OrderFixtures.IsNull(read, "recordedBy").ShouldBeTrue();
    }

    [Fact]
    public async Task ADeletedRecorderKeepsTheirNameAndIsMarkedFormerStaff()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var recorder = await TestSessions.StartAsync(factory, Roles.Admin);
        var reader = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var created = await OrderFixtures.CreateAsync(client, recorder.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var id = created.GetProperty("id").GetGuid();
        await using (var context = database.CreateContext())
        {
            var changed = await context.Users.Where(user => user.Id == recorder.UserId)
                .ExecuteUpdateAsync(set => set.SetProperty(user => user.DeletedAtUtc, TimeProvider.System.GetUtcNow()), TestContext.Current.CancellationToken);
            changed.ShouldBe(1);
        }

        var read = await OrderFixtures.ReadDetailAsync(client, reader.AccessToken, id);

        var actor = read.GetProperty("recordedBy");
        actor.GetProperty("id").GetGuid().ShouldBe(recorder.UserId);
        actor.GetProperty("formerStaff").GetBoolean().ShouldBeTrue();
        actor.GetProperty("name").GetString().ShouldNotBeNullOrWhiteSpace();
        read.GetProperty("statusHistory").EnumerateArray().Single().GetProperty("changedBy").GetProperty("formerStaff").GetBoolean().ShouldBeTrue();
    }
}

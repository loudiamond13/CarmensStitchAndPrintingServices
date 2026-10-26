using System.Globalization;
using System.Net;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.CompanyExpenses;

/// <summary>
/// CEXP-02, D-01, D-02, D-31, D-27, T-06-31, T-06-32, T-06-34: a Manager soft-deletes an expense and it stops counting everywhere,
/// the row and its history stay, one audit entry is written, and an Admin is refused.
/// </summary>
public sealed class CompanyExpenseDeletionTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task AManagerDeletesAnExpenseAndItLeavesTheListItsTotalTheKpisAndTheDetail()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var label = $"Delete {Guid.NewGuid():N}";
        var body = ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today);
        body["description"] = label;
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, body);
        var id = created.GetProperty("id").GetGuid();
        var listedBefore = await ExpenseFixtures.ReadPageAsync(client, manager.AccessToken, $"q={label}");
        var kpisBefore = await ExpenseFixtures.ReadKpisAsync(client, manager.AccessToken);
        listedBefore.Total.ShouldBe(1);
        listedBefore.PeriodTotal.ShouldBe(640.00m);

        using var response = await ExpenseFixtures.DeleteAsync(client, manager.AccessToken, id);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var listedAfter = await ExpenseFixtures.ReadPageAsync(client, manager.AccessToken, $"q={label}");
        listedAfter.Total.ShouldBe(0);
        listedAfter.Items.ShouldBeEmpty();
        listedAfter.PeriodTotal.ShouldBe(0m);
        var kpisAfter = await ExpenseFixtures.ReadKpisAsync(client, manager.AccessToken);
        kpisAfter.ThisMonth.Total.ShouldBe(kpisBefore.ThisMonth.Total - 640.00m);
        kpisAfter.ThisMonth.Count.ShouldBe(kpisBefore.ThisMonth.Count - 1);
        using var read = await ExpenseFixtures.GetAsync(client, manager.AccessToken, id);
        read.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var edit = ExpenseFixtures.BodyFrom(created);
        edit["amount"] = 700m;
        using var put = await ExpenseFixtures.PutAsync(client, manager.AccessToken, id, edit);
        put.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task TheRowStaysWithTheDeleteMarkerAndTheManagerAsLastChangedBy()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var recorder = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, recorder.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, recorder.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        var before = TimeProvider.System.GetUtcNow();

        using var response = await ExpenseFixtures.DeleteAsync(client, manager.AccessToken, id);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var after = TimeProvider.System.GetUtcNow();
        await using var context = database.CreateContext();
        var row = await context.CompanyExpenses.IgnoreQueryFilters(["SoftDelete"]).AsNoTracking()
            .SingleAsync(expense => expense.Id == id, TestContext.Current.CancellationToken);
        row.IsDeleted.ShouldBeTrue();
        row.DeletedById.ShouldBe(manager.UserId);
        row.DeletedAtUtc.ShouldNotBeNull().ShouldBeInRange(before.AddSeconds(-1), after.AddSeconds(1));
        row.UpdatedById.ShouldBe(manager.UserId);
        row.UpdatedAtUtc.ShouldNotBeNull().ShouldBeInRange(before.AddSeconds(-1), after.AddSeconds(1));
        row.CreatedById.ShouldBe(recorder.UserId);
        row.Description.ShouldBe("Thread and needles");
        row.Amount.ShouldBe(640.00m);
    }

    [Fact]
    public async Task TheDeleteWritesOneAuditEntryWithTheSnapshotAndNoDescriptionOrNotes()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var body = ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today);
        body["description"] = "Zebra stripe fabric";
        body["notes"] = "Paid cash to Aling Nena";
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, body);
        var id = created.GetProperty("id").GetGuid();

        using var response = await ExpenseFixtures.DeleteAsync(client, manager.AccessToken, id);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var key = id.ToString("D");
        await using var context = database.CreateContext();
        var entry = await context.AuditLog.AsNoTracking()
            .SingleAsync(row => row.TargetId == key && row.Action == "company-expense.deleted", TestContext.Current.CancellationToken);
        entry.TargetType.ShouldBe("CompanyExpense");
        entry.ActorUserId.ShouldBe(manager.UserId);
        entry.Detail.ShouldBe(
            $"date={today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)};category={ExpenseFixtures.SuppliesId:D};amount=640.00;payer={manager.UserId:D}");
        entry.Detail.ShouldNotBeNull().ShouldNotContain("Zebra", Case.Insensitive);
        entry.Detail.ShouldNotContain("Nena", Case.Insensitive);
    }

    [Fact]
    public async Task ASecondDeleteIs404AndWritesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        using (var first = await ExpenseFixtures.DeleteAsync(client, manager.AccessToken, id))
        {
            first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        using var second = await ExpenseFixtures.DeleteAsync(client, manager.AccessToken, id);

        second.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(second, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("company-expenses.not-found");
        var key = id.ToString("D");
        await using var context = database.CreateContext();
        (await context.AuditLog.CountAsync(row => row.TargetId == key && row.Action == "company-expense.deleted", TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task AnUnknownIdIs404()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var response = await ExpenseFixtures.DeleteAsync(client, manager.AccessToken, Guid.NewGuid());

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task AnAdminIsRefusedEvenOnAnExpenseTheyRecordedAndNothingChanges()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, admin.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, admin.UserId, today));
        var id = created.GetProperty("id").GetGuid();

        using var response = await ExpenseFixtures.DeleteAsync(client, admin.AccessToken, id);
        using var anonymous = await ExpenseFixtures.DeleteAsync(client, null, id);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        var stored = await ExpenseFixtures.ReadDetailAsync(client, admin.AccessToken, id);
        stored.GetProperty("id").GetGuid().ShouldBe(id);
        var key = id.ToString("D");
        await using var context = database.CreateContext();
        (await context.AuditLog.CountAsync(row => row.TargetId == key && row.Action == "company-expense.deleted", TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task TwoDeletesSentTogetherGiveOneNoContentOneNotFoundAndOneAuditEntry()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var m1 = await TestSessions.StartAsync(factory, Roles.Manager);
        var m2 = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);

        for (var round = 1; round <= 5; round++)
        {
            var created = await ExpenseFixtures.CreateAsync(client, m1.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, m1.UserId, today));
            var id = created.GetProperty("id").GetGuid();

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => ExpenseFixtures.DeleteAsync(client, m1.AccessToken, id),
                () => ExpenseFixtures.DeleteAsync(client, m2.AccessToken, id));
            using var firstResponse = first;
            using var secondResponse = second;

            var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
            statuses.Count(static status => status == HttpStatusCode.NoContent).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            statuses.Count(static status => status == HttpStatusCode.NotFound).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            var key = id.ToString("D");
            await using var context = database.CreateContext();
            (await context.AuditLog.CountAsync(row => row.TargetId == key && row.Action == "company-expense.deleted", TestContext.Current.CancellationToken))
                .ShouldBe(1, $"round {round}");
        }
    }

    [Fact]
    public async Task AnEditFormSavedAfterASoftDeleteGets404()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        var openedForm = ExpenseFixtures.BodyFrom(created);
        using (var deleted = await ExpenseFixtures.DeleteAsync(client, manager.AccessToken, id))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        openedForm["amount"] = 999m;
        using var late = await ExpenseFixtures.PutAsync(client, manager.AccessToken, id, openedForm);

        late.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ARestoreBringsTheExpenseBackIntoTheListItsTotalAndTheKpisAndStampsTheRestoringManager()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var deleter = await TestSessions.StartAsync(factory, Roles.Manager);
        var restorer = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var label = $"Restore {Guid.NewGuid():N}";
        var body = ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, deleter.UserId, today);
        body["description"] = label;
        var created = await ExpenseFixtures.CreateAsync(client, deleter.AccessToken, body);
        var id = created.GetProperty("id").GetGuid();
        var kpisLive = await ExpenseFixtures.ReadKpisAsync(client, deleter.AccessToken);
        using (var deleted = await ExpenseFixtures.DeleteAsync(client, deleter.AccessToken, id))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var before = TimeProvider.System.GetUtcNow();
        using var response = await ExpenseFixtures.RestoreAsync(client, restorer.AccessToken, id);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var after = TimeProvider.System.GetUtcNow();
        var listed = await ExpenseFixtures.ReadPageAsync(client, restorer.AccessToken, $"q={label}");
        listed.Total.ShouldBe(1);
        listed.PeriodTotal.ShouldBe(640.00m);
        var kpisBack = await ExpenseFixtures.ReadKpisAsync(client, restorer.AccessToken);
        kpisBack.ThisMonth.Total.ShouldBe(kpisLive.ThisMonth.Total);
        kpisBack.ThisMonth.Count.ShouldBe(kpisLive.ThisMonth.Count);
        var detail = await ExpenseFixtures.ReadDetailAsync(client, restorer.AccessToken, id);
        detail.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(restorer.UserId);
        await using var context = database.CreateContext();
        var row = await context.CompanyExpenses.IgnoreQueryFilters(["SoftDelete"]).AsNoTracking()
            .SingleAsync(expense => expense.Id == id, TestContext.Current.CancellationToken);
        row.DeletedAtUtc.ShouldBeNull();
        row.DeletedById.ShouldBeNull();
        row.UpdatedById.ShouldBe(restorer.UserId);
        row.UpdatedAtUtc.ShouldNotBeNull().ShouldBeInRange(before.AddSeconds(-1), after.AddSeconds(1));
    }

    [Fact]
    public async Task ARestoreWritesOneAuditEntryWithTheSnapshotAndNoText()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var body = ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today);
        body["description"] = "Zebra stripe fabric";
        body["notes"] = "Paid cash to Aling Nena";
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, body);
        var id = created.GetProperty("id").GetGuid();
        (await ExpenseFixtures.DeleteAsync(client, manager.AccessToken, id)).Dispose();

        using var response = await ExpenseFixtures.RestoreAsync(client, manager.AccessToken, id);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var key = id.ToString("D");
        await using var context = database.CreateContext();
        var entry = await context.AuditLog.AsNoTracking()
            .SingleAsync(row => row.TargetId == key && row.Action == "company-expense.restored", TestContext.Current.CancellationToken);
        entry.TargetType.ShouldBe("CompanyExpense");
        entry.ActorUserId.ShouldBe(manager.UserId);
        entry.Detail.ShouldBe(
            $"date={today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)};category={ExpenseFixtures.SuppliesId:D};amount=640.00;payer={manager.UserId:D}");
        entry.Detail.ShouldNotBeNull().ShouldNotContain("Zebra", Case.Insensitive);
        entry.Detail.ShouldNotContain("Nena", Case.Insensitive);
    }

    [Fact]
    public async Task RestoringALiveExpenseIsNoContentAndWritesAndAuditsNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));
        var id = created.GetProperty("id").GetGuid();

        using var response = await ExpenseFixtures.RestoreAsync(client, manager.AccessToken, id);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var key = id.ToString("D");
        await using var context = database.CreateContext();
        (await context.AuditLog.CountAsync(row => row.TargetId == key && row.Action == "company-expense.restored", TestContext.Current.CancellationToken)).ShouldBe(0);
        var row = await context.CompanyExpenses.IgnoreQueryFilters(["SoftDelete"]).AsNoTracking()
            .SingleAsync(expense => expense.Id == id, TestContext.Current.CancellationToken);
        row.UpdatedById.ShouldBeNull();
        row.UpdatedAtUtc.ShouldBeNull();
        var stored = await ExpenseFixtures.ReadDetailAsync(client, manager.AccessToken, id);
        stored.GetProperty("version").GetString().ShouldBe(created.GetProperty("version").GetString());
    }

    [Fact]
    public async Task RestoringAnUnknownIdIs404()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var response = await ExpenseFixtures.RestoreAsync(client, manager.AccessToken, Guid.NewGuid());

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("company-expenses.not-found");
    }

    [Fact]
    public async Task TheSameRestoreWithTheSameKeyReplaysTheStoredNoContentAndRunsOnce()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        (await ExpenseFixtures.DeleteAsync(client, manager.AccessToken, id)).Dispose();
        var key = Guid.NewGuid();
        using (var first = await ExpenseFixtures.RestoreAsync(client, manager.AccessToken, id, key))
        {
            first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        (await ExpenseFixtures.DeleteAsync(client, manager.AccessToken, id)).Dispose();
        using var replay = await ExpenseFixtures.RestoreAsync(client, manager.AccessToken, id, key);

        replay.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        replay.Headers.GetValues("Idempotent-Replayed").ShouldBe(["true"]);
        using var read = await ExpenseFixtures.GetAsync(client, manager.AccessToken, id);
        read.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var target = id.ToString("D");
        await using var context = database.CreateContext();
        (await context.AuditLog.CountAsync(row => row.TargetId == target && row.Action == "company-expense.restored", TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task ARestoreWithoutAKeyIs400ForAManagerAndAnAdminIsRefusedFirst()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today));
        var id = created.GetProperty("id").GetGuid();
        (await ExpenseFixtures.DeleteAsync(client, manager.AccessToken, id)).Dispose();

        using var noKey = await ExpenseFixtures.RestoreAsync(client, manager.AccessToken, id, withKey: false);
        using var asAdmin = await ExpenseFixtures.RestoreAsync(client, admin.AccessToken, id);
        using var anonymous = await ExpenseFixtures.RestoreAsync(client, null, id);

        noKey.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        asAdmin.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        using var stillDeleted = await ExpenseFixtures.GetAsync(client, manager.AccessToken, id);
        stillDeleted.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task APermanentDeleteRemovesALiveOrASoftDeletedRowForGoodAndASecondCallIs404(bool softDeletedFirst)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var label = $"Permanent {Guid.NewGuid():N}";
        var body = ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today);
        body["description"] = label;
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, body);
        var id = created.GetProperty("id").GetGuid();
        if (softDeletedFirst)
        {
            (await ExpenseFixtures.DeleteAsync(client, manager.AccessToken, id)).Dispose();
        }

        using var response = await ExpenseFixtures.PermanentDeleteAsync(client, manager.AccessToken, id);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using (var context = database.CreateContext())
        {
            (await context.CompanyExpenses.IgnoreQueryFilters(["SoftDelete"]).CountAsync(expense => expense.Id == id, TestContext.Current.CancellationToken)).ShouldBe(0);
        }

        (await ExpenseFixtures.ReadPageAsync(client, manager.AccessToken, $"q={label}")).Total.ShouldBe(0);
        (await ExpenseFixtures.ReadDeletedPageAsync(client, manager.AccessToken, $"q={label}")).Total.ShouldBe(0);
        using var second = await ExpenseFixtures.PermanentDeleteAsync(client, manager.AccessToken, id);
        second.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(second, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("company-expenses.not-found");
        var key = id.ToString("D");
        await using var after = database.CreateContext();
        (await after.AuditLog.CountAsync(row => row.TargetId == key && row.Action == "company-expense.permanently-deleted", TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task ThePermanentDeleteAuditEntrySurvivesTheRowWithTheSnapshotAndNoText()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var body = ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, manager.UserId, today);
        body["description"] = "Zebra stripe fabric";
        body["notes"] = "Paid cash to Aling Nena";
        var created = await ExpenseFixtures.CreateAsync(client, manager.AccessToken, body);
        var id = created.GetProperty("id").GetGuid();

        using var response = await ExpenseFixtures.PermanentDeleteAsync(client, manager.AccessToken, id);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var key = id.ToString("D");
        await using var context = database.CreateContext();
        var entry = await context.AuditLog.AsNoTracking()
            .SingleAsync(row => row.TargetId == key && row.Action == "company-expense.permanently-deleted", TestContext.Current.CancellationToken);
        entry.TargetType.ShouldBe("CompanyExpense");
        entry.ActorUserId.ShouldBe(manager.UserId);
        entry.Detail.ShouldBe(
            $"date={today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)};category={ExpenseFixtures.SuppliesId:D};amount=640.00;payer={manager.UserId:D}");
        entry.Detail.ShouldNotBeNull().ShouldNotContain("Zebra", Case.Insensitive);
        entry.Detail.ShouldNotContain("Nena", Case.Insensitive);
        (await context.CompanyExpenses.IgnoreQueryFilters(["SoftDelete"]).CountAsync(expense => expense.Id == id, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task APermanentDeleteOfAnUnknownIdIs404()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var response = await ExpenseFixtures.PermanentDeleteAsync(client, manager.AccessToken, Guid.NewGuid());

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task AnAdminCannotPermanentlyDeleteEvenWhatTheyRecordedAndNothingChanges()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var created = await ExpenseFixtures.CreateAsync(client, admin.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, admin.UserId, today));
        var id = created.GetProperty("id").GetGuid();

        using var asAdmin = await ExpenseFixtures.PermanentDeleteAsync(client, admin.AccessToken, id);
        using var anonymous = await ExpenseFixtures.PermanentDeleteAsync(client, null, id);

        asAdmin.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        var stored = await ExpenseFixtures.ReadDetailAsync(client, admin.AccessToken, id);
        stored.GetProperty("id").GetGuid().ShouldBe(id);
        var key = id.ToString("D");
        await using var context = database.CreateContext();
        (await context.AuditLog.CountAsync(row => row.TargetId == key && row.Action == "company-expense.permanently-deleted", TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task TwoPermanentDeletesSentTogetherGiveOneNoContentOneNotFoundAndOneAuditEntry()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var m1 = await TestSessions.StartAsync(factory, Roles.Manager);
        var m2 = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);

        for (var round = 1; round <= 5; round++)
        {
            var created = await ExpenseFixtures.CreateAsync(client, m1.AccessToken, ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, m1.UserId, today));
            var id = created.GetProperty("id").GetGuid();

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => ExpenseFixtures.PermanentDeleteAsync(client, m1.AccessToken, id),
                () => ExpenseFixtures.PermanentDeleteAsync(client, m2.AccessToken, id));
            using var firstResponse = first;
            using var secondResponse = second;

            var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
            statuses.Count(static status => status == HttpStatusCode.NoContent).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            statuses.Count(static status => status == HttpStatusCode.NotFound).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            var key = id.ToString("D");
            await using var context = database.CreateContext();
            (await context.AuditLog.CountAsync(row => row.TargetId == key && row.Action == "company-expense.permanently-deleted", TestContext.Current.CancellationToken))
                .ShouldBe(1, $"round {round}");
        }
    }
}

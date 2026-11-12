using System.Net;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// CONT-03, D-05, SEC-07, SEC-08, AUDIT-01, PUB-03: a Manager lists, adds, edits, moves, hides, shows and deletes testimonials through
/// <c>/api/v1/testimonials</c>, every change is audited without copying the customer's words, and the public Home data follows at once.
/// An Admin gets 403 on every route.
/// </summary>
public sealed class TestimonialEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task AManagerListsShownAndHiddenTestimonialsInDisplayOrderWithTheirVersions()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        await rig.AddAsync(TestimonialBody.Named("Ana", "Quote from Ana."));
        await rig.AddAsync(TestimonialBody.Named("Ben", "Quote from Ben.", shown: false));

        var items = await rig.ListAsync();

        items.Select(item => item.Name).ShouldBe(["Ana", "Ben"]);
        items.Select(item => item.Position).ShouldBe([1, 2]);
        items.Select(item => item.IsShown).ShouldBe([true, false]);
        items.ShouldAllBe(item => item.Version.Length > 0 && item.Stars == 4);
    }

    [Fact]
    public async Task ANewTestimonialStartsHiddenAtTheEndWhenIsShownIsLeftOut()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        await rig.AddAsync(TestimonialBody.Named("Ana", "Quote from Ana."));

        var added = await rig.AddAsync(TestimonialBody.Named("Ben", "Quote from Ben.") with { IsShown = null });

        added.IsShown.ShouldBeFalse();
        added.Position.ShouldBe(2);
        (await rig.PublicNamesAsync()).ShouldBe(["Ana"]);
    }

    [Fact]
    public async Task AnAdminGets403OnEveryRouteAndNothingChanges()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        var admin = await TestSessions.StartAsync(rig.Factory, Roles.Admin);
        var ana = await rig.AddAsync(TestimonialBody.Named("Ana", "Quote from Ana."));

        var responses = new[]
        {
            await rig.GetListAsync(admin),
            await rig.PostAsync(TestimonialBody.Juan, admin),
            await rig.PutAsync(ana.Id, ana.ToBody() with { Stars = 1 }, admin),
            await rig.MoveAsync(ana.Id, "down", admin),
            await rig.HideAsync(ana.Id, admin),
            await rig.ShowAsync(ana.Id, admin),
            await rig.DeleteAsync(ana.Id, admin),
        };
        try
        {
            responses.ShouldAllBe(response => response.StatusCode == HttpStatusCode.Forbidden);
        }
        finally
        {
            foreach (var response in responses)
            {
                response.Dispose();
            }
        }

        var after = (await rig.ListAsync()).ShouldHaveSingleItem();
        after.Stars.ShouldBe(4);
        after.IsShown.ShouldBeTrue();
        after.Version.ShouldBe(ana.Version);
    }

    [Fact]
    public async Task EditingWithAStaleVersionIs409EditStaleAndChangesNothing()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        var ana = await rig.AddAsync(TestimonialBody.Named("Ana", "Quote from Ana."));
        using var winner = await rig.PutAsync(ana.Id, ana.ToBody() with { Stars = 5 });
        winner.StatusCode.ShouldBe(HttpStatusCode.OK);

        using var loser = await rig.PutAsync(ana.Id, ana.ToBody() with { Stars = 1 });

        loser.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemJson.ReadAsync(loser, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("edit.stale");
        (await rig.ListAsync()).ShouldHaveSingleItem().Stars.ShouldBe(5);
    }

    [Fact]
    public async Task AnEditWithoutAVersionIs400UnderVersion()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        var ana = await rig.AddAsync(TestimonialBody.Named("Ana", "Quote from Ana."));

        using var response = await rig.PutAsync(ana.Id, ana.ToBody() with { Version = null });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("errors").GetProperty("version")[0].GetString().ShouldBe("Reload the form and try again.");
    }

    [Fact]
    public async Task StampFieldsSentByTheClientAreIgnoredAndTheServerStampsTheManager()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        var other = await TestSessions.StartAsync(rig.Factory, Roles.Admin);

        using var response = await rig.SendAsync(
            HttpMethod.Post,
            TestimonialRig.Route,
            rig.Manager,
            new
            {
                TestimonialBody.Juan.Quote,
                TestimonialBody.Juan.Name,
                TestimonialBody.Juan.Stars,
                createdById = other.UserId,
                updatedById = other.UserId,
                createdAtUtc = "2000-01-01T00:00:00Z",
                position = 9,
            });

        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var context = database.CreateContext();
        var stored = await context.Testimonials.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        stored.CreatedById.ShouldBe(rig.Manager.UserId);
        stored.CreatedAtUtc.Year.ShouldBeGreaterThanOrEqualTo(2026);
        stored.Position.ShouldBe(1);
    }

    [Fact]
    public async Task ABadFormIs400OnEachFieldWithTheApprovedMessage()
    {
        await using var rig = await TestimonialRig.StartAsync(database);

        using var empty = await rig.PostAsync(new TestimonialBody("", "", null, null, null, null));
        using var tooLong = await rig.PostAsync(new TestimonialBody(new string('q', 301), new string('n', 61), new string('t', 81), 6, null, null));

        empty.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var emptyErrors = (await ProblemJson.ReadAsync(empty, TestContext.Current.CancellationToken)).GetProperty("errors");
        emptyErrors.GetProperty("quote")[0].GetString().ShouldBe("Enter the quote.");
        emptyErrors.GetProperty("name")[0].GetString().ShouldBe("Enter the name.");
        emptyErrors.GetProperty("stars")[0].GetString().ShouldBe("Choose 1 to 5 stars.");
        tooLong.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var longErrors = (await ProblemJson.ReadAsync(tooLong, TestContext.Current.CancellationToken)).GetProperty("errors");
        longErrors.GetProperty("quote")[0].GetString().ShouldBe("Keep the quote to 300 characters or fewer.");
        longErrors.GetProperty("name")[0].GetString().ShouldBe("Keep the name to 60 characters or fewer.");
        longErrors.GetProperty("teamOrRole")[0].GetString().ShouldBe("Keep this to 80 characters or fewer.");
        longErrors.GetProperty("stars")[0].GetString().ShouldBe("Choose 1 to 5 stars.");
        (await rig.ListAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task ThreeHundredCharactersAndOneAndFiveStarsAreStoredExactly()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        var quote = new string('q', 300);

        var low = await rig.AddAsync(TestimonialBody.Named("Low", quote) with { Stars = 1 });
        var high = await rig.AddAsync(TestimonialBody.Named("High", "Short.") with { Stars = 5, TeamOrRole = new string('t', 80) });

        low.Quote.ShouldBe(quote);
        low.Stars.ShouldBe(1);
        high.Stars.ShouldBe(5);
        high.TeamOrRole.ShouldBe(new string('t', 80));
    }

    [Fact]
    public async Task EditingAnUnknownTestimonialIs404()
    {
        await using var rig = await TestimonialRig.StartAsync(database);

        using var response = await rig.PutAsync(Guid.NewGuid(), TestimonialBody.Juan with { Version = Convert.ToBase64String(new byte[8]) });

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task EachChangingSaveWritesItsAuditEntryAndTheQuoteIsNamedNeverCopied()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        var added = await rig.AddAsync(TestimonialBody.Juan with { IsShown = false });
        using var changed = await rig.PutAsync(added.Id, added.ToBody() with { Quote = "Private customer words", Name = "Juan D.", Stars = 4 });
        changed.StatusCode.ShouldBe(HttpStatusCode.OK, await changed.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var edited = await rig.ListAsync();
        using var shown = await rig.PutAsync(added.Id, edited[0].ToBody() with { IsShown = true });
        shown.StatusCode.ShouldBe(HttpStatusCode.OK);

        await using var context = database.CreateContext();
        var entries = await context.AuditLog.AsNoTracking()
            .Where(row => row.ActorUserId == rig.Manager.UserId && row.TargetType == "Testimonial")
            .OrderBy(row => row.Id)
            .ToListAsync(TestContext.Current.CancellationToken);

        entries.Select(row => row.Action).ShouldBe(["testimonial.added", "testimonial.changed", "testimonial.shown"]);
        entries.ShouldAllBe(row => row.TargetId == added.Id.ToString("D"));
        entries[0].Detail.ShouldBe("name=Juan Dela Cruz");
        entries[1].Detail.ShouldBe("fields=quote,name,stars;name=Juan Dela Cruz>Juan D.;stars=5>4");
        entries[1].Detail.ShouldNotBeNull().ShouldNotContain("Private customer words");
        entries[2].Detail.ShouldBe("name=Juan D.");
    }

    [Fact]
    public async Task AQuoteOnlyChangeSaysQuoteChangedAndNeverCopiesTheText()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        var added = await rig.AddAsync(TestimonialBody.Juan);

        using var response = await rig.PutAsync(added.Id, added.ToBody() with { Quote = "A different private quote" });

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        var changed = await context.AuditLog.AsNoTracking().SingleAsync(row => row.ActorUserId == rig.Manager.UserId && row.Action == "testimonial.changed", TestContext.Current.CancellationToken);
        changed.Detail.ShouldBe("fields=quote");
    }

    [Fact]
    public async Task ASaveWithNoChangeWritesNoAuditEntryAndKeepsTheVersion()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        var added = await rig.AddAsync(TestimonialBody.Juan);

        using var response = await rig.PutAsync(added.Id, added.ToBody());

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await rig.ListAsync()).ShouldHaveSingleItem().Version.ShouldBe(added.Version);
        await using var context = database.CreateContext();
        (await context.AuditLog.AsNoTracking().CountAsync(row => row.ActorUserId == rig.Manager.UserId && row.TargetType == "Testimonial" && row.Action == "testimonial.changed", TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task MovingTheSecondTestimonialUpSwapsThemChangesThePublicOrderAndWritesTheMoveAudit()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        await rig.AddAsync(TestimonialBody.Named("Ana", "Quote from Ana."));
        var ben = await rig.AddAsync(TestimonialBody.Named("Ben", "Quote from Ben."));
        var (before, oldEtag) = await rig.PublicHomeAsync();
        before.Dispose();

        using var response = await rig.MoveAsync(ben.Id, "up");

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await rig.ListAsync()).Select(item => item.Name).ShouldBe(["Ben", "Ana"]);
        (await rig.PublicNamesAsync()).ShouldBe(["Ben", "Ana"]);
        var (after, newEtag) = await rig.PublicHomeAsync();
        after.Dispose();
        newEtag.ShouldNotBe(oldEtag);
        await using var context = database.CreateContext();
        var moved = await context.AuditLog.AsNoTracking().SingleAsync(row => row.ActorUserId == rig.Manager.UserId && row.Action == "testimonial.moved", TestContext.Current.CancellationToken);
        moved.ActorUserId.ShouldBe(rig.Manager.UserId);
        moved.TargetId.ShouldBe(ben.Id.ToString("D"));
        moved.Detail.ShouldBe("name=Ben;position=2>1");
    }

    [Fact]
    public async Task MovingTheFirstUpOrTheLastDownIs204ChangesNothingAndWritesNoAudit()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        var ana = await rig.AddAsync(TestimonialBody.Named("Ana", "Quote from Ana."));
        var ben = await rig.AddAsync(TestimonialBody.Named("Ben", "Quote from Ben."));

        using var first = await rig.MoveAsync(ana.Id, "up");
        using var last = await rig.MoveAsync(ben.Id, "down");

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        last.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await rig.ListAsync()).Select(item => item.Name).ShouldBe(["Ana", "Ben"]);
        await using var context = database.CreateContext();
        (await context.AuditLog.AsNoTracking().CountAsync(row => row.ActorUserId == rig.Manager.UserId && row.Action == "testimonial.moved", TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task TheSameMovePostedTwiceWithOneIdempotencyKeyMovesOnce()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        await rig.AddAsync(TestimonialBody.Named("Ana", "Quote from Ana."));
        var ben = await rig.AddAsync(TestimonialBody.Named("Ben", "Quote from Ben."));
        var key = Guid.NewGuid().ToString("D");

        using var first = await rig.MoveAsync(ben.Id, "up", idempotencyKey: key);
        using var repeat = await rig.MoveAsync(ben.Id, "up", idempotencyKey: key);

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        repeat.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await rig.ListAsync()).Select(item => item.Name).ShouldBe(["Ben", "Ana"]);
        await using var context = database.CreateContext();
        (await context.AuditLog.AsNoTracking().CountAsync(row => row.ActorUserId == rig.Manager.UserId && row.Action == "testimonial.moved", TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task ABadDirectionIs400AndAnUnknownTestimonialIs404()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        var ana = await rig.AddAsync(TestimonialBody.Named("Ana", "Quote from Ana."));

        using var bad = await rig.MoveAsync(ana.Id, "sideways");
        using var unknown = await rig.MoveAsync(Guid.NewGuid(), "up");

        bad.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        unknown.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task TwoManagersMovingAtTheSameMomentEndWithEveryPositionUsedOnce()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        var other = await TestSessions.StartAsync(rig.Factory, Roles.Manager);
        await rig.AddAsync(TestimonialBody.Named("Ana", "Quote from Ana."));
        var ben = await rig.AddAsync(TestimonialBody.Named("Ben", "Quote from Ben."));
        var cara = await rig.AddAsync(TestimonialBody.Named("Cara", "Quote from Cara."));

        var (first, second) = await ConcurrentRequests.SendTogetherAsync(
            () => rig.MoveAsync(ben.Id, "up"),
            () => rig.MoveAsync(cara.Id, "up", other));
        using (first)
        using (second)
        {
            first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
            second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var after = await rig.ListAsync();
        after.Select(item => item.Position).Order().ShouldBe([1, 2, 3]);
        after.Select(item => item.Name).Order().ShouldBe(["Ana", "Ben", "Cara"]);
        await using var context = database.CreateContext();
        (await context.AuditLog.AsNoTracking().CountAsync(row => row.Action == "testimonial.moved" && (row.TargetId == ben.Id.ToString("D") || row.TargetId == cara.Id.ToString("D")), TestContext.Current.CancellationToken)).ShouldBe(2);
    }

    [Fact]
    public async Task HidingTakesATestimonialOffTheHomeDataWritesTheAuditAndShowingBringsItBack()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        var ana = await rig.AddAsync(TestimonialBody.Named("Ana", "Quote from Ana."));
        await rig.AddAsync(TestimonialBody.Named("Ben", "Quote from Ben."));

        using var hide = await rig.HideAsync(ana.Id);
        hide.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await rig.PublicNamesAsync()).ShouldBe(["Ben"]);
        using var hideAgain = await rig.HideAsync(ana.Id);
        hideAgain.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        using var show = await rig.ShowAsync(ana.Id);
        show.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        using var showAgain = await rig.ShowAsync(ana.Id);
        showAgain.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await rig.PublicNamesAsync()).ShouldBe(["Ana", "Ben"]);
        await using var context = database.CreateContext();
        var entries = await context.AuditLog.AsNoTracking()
            .Where(row => row.TargetType == "Testimonial" && row.TargetId == ana.Id.ToString("D") && (row.Action == "testimonial.hidden" || row.Action == "testimonial.shown"))
            .OrderBy(row => row.Id)
            .ToListAsync(TestContext.Current.CancellationToken);
        entries.Select(row => row.Action).ShouldBe(["testimonial.hidden", "testimonial.shown"]);
        entries.ShouldAllBe(row => row.Detail == "name=Ana");
    }

    [Fact]
    public async Task HidingOrShowingAnUnknownTestimonialIs404()
    {
        await using var rig = await TestimonialRig.StartAsync(database);

        using var hide = await rig.HideAsync(Guid.NewGuid());
        using var show = await rig.ShowAsync(Guid.NewGuid());

        hide.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        show.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteAnswers204ThenTheNextDeleteIs404AndTheAuditNamesThePersonNotTheWords()
    {
        await using var rig = await TestimonialRig.StartAsync(database);
        var juan = await rig.AddAsync(TestimonialBody.Juan);

        using var first = await rig.DeleteAsync(juan.Id);
        using var second = await rig.DeleteAsync(juan.Id);

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        second.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await rig.ListAsync()).ShouldBeEmpty();
        (await rig.PublicNamesAsync()).ShouldBeEmpty();
        await using var context = database.CreateContext();
        var deleted = await context.AuditLog.AsNoTracking().SingleAsync(row => row.ActorUserId == rig.Manager.UserId && row.Action == "testimonial.deleted", TestContext.Current.CancellationToken);
        deleted.TargetId.ShouldBe(juan.Id.ToString("D"));
        deleted.Detail.ShouldBe("name=Juan Dela Cruz");
    }
}

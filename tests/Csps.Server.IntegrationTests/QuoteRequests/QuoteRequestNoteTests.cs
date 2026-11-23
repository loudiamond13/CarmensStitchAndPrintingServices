using System.Net;
using Csps.Application.Security;
using Csps.Domain.QuoteRequests;
using Csps.Server.IntegrationTests.Auth;
using Csps.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.QuoteRequests;

/// <summary>
/// INQ-05, D-17, SEC-08: staff add internal notes to a request. A note keeps who wrote it and when from the token and the clock, the
/// detail lists notes newest first, the audit entry never holds the note text, and no route changes or removes a single note.
/// </summary>
public sealed class QuoteRequestNoteTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Note = "Called, will send mockup Friday.";
    private static readonly DateTimeOffset Received = new(2026, 11, 21, 7, 42, 0, TimeSpan.Zero);

    [Fact]
    public async Task AnAdminAddsANoteAndItIsFirstWithTheAdminsNameAndTheTime()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.Contacted, Received));
        var before = (await rig.ReadAsync(id)).GetProperty("version").GetString();
        using (var first = await rig.PostNoteAsync(rig.Admin.AccessToken, id, new { text = "Asked for the sizes." }))
        {
            first.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        var startedAt = TimeProvider.System.GetUtcNow().AddMinutes(-1);

        using var response = await rig.PostNoteAsync(rig.Admin.AccessToken, id, new
        {
            text = $"  {Note}  ",
            createdById = Guid.NewGuid(),
            createdAtUtc = "2020-01-01T00:00:00Z",
        });
        var added = await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.OK);

        added.EnumerateObject().Select(member => member.Name).ShouldBe(["id", "noteId", "createdAtUtc", "version"]);
        added.GetProperty("id").GetGuid().ShouldBe(id);
        added.GetProperty("version").GetString().ShouldNotBe(before);
        var body = await rig.ReadAsync(id);
        added.GetProperty("version").GetString().ShouldBe(body.GetProperty("version").GetString());
        body.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(rig.Admin.UserId);
        var notes = body.GetProperty("notes").EnumerateArray().ToList();
        added.GetProperty("noteId").GetGuid().ShouldBe(notes[0].GetProperty("id").GetGuid());
        added.GetProperty("createdAtUtc").GetDateTimeOffset().ShouldBe(notes[0].GetProperty("createdAtUtc").GetDateTimeOffset());
        notes.Count.ShouldBe(2);
        notes[0].EnumerateObject().Select(member => member.Name).ShouldBe(["id", "text", "createdBy", "createdAtUtc"]);
        notes[0].GetProperty("text").GetString().ShouldBe(Note);
        notes[0].GetProperty("createdBy").GetProperty("id").GetGuid().ShouldBe(rig.Admin.UserId);
        notes[0].GetProperty("createdBy").GetProperty("name").GetString().ShouldBe("Paolo Reyes");
        notes[0].GetProperty("createdBy").GetProperty("formerStaff").GetBoolean().ShouldBeFalse();
        notes[0].GetProperty("createdAtUtc").GetDateTimeOffset().ShouldBeGreaterThan(startedAt);
        notes[1].GetProperty("text").GetString().ShouldBe("Asked for the sizes.");

        var token = TestContext.Current.CancellationToken;
        await using var context = database.CreateContext();
        var noteId = notes[0].GetProperty("id").GetGuid();
        var stored = await context.QuoteRequestNotes.AsNoTracking().SingleAsync(row => row.Id == noteId, token);
        (stored.QuoteRequestId, stored.Text, stored.CreatedById).ShouldBe((id, Note, rig.Admin.UserId));
        stored.CreatedAtUtc.ShouldBeGreaterThan(startedAt);
        var request = await context.QuoteRequests.AsNoTracking().SingleAsync(row => row.Id == id, token);
        request.UpdatedById.ShouldBe(rig.Admin.UserId);
        request.Status.ShouldBe(QuoteRequestStatus.Contacted);
    }

    [Fact]
    public async Task EachNoteIsAuditedWithoutItsText()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.New, Received));

        using var response = await rig.PostNoteAsync(rig.Admin.AccessToken, id, new { text = Note });
        var body = await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.OK);

        var noteId = body.GetProperty("noteId").GetGuid();
        var token = TestContext.Current.CancellationToken;
        await using var context = database.CreateContext();
        var entry = await context.AuditLog.AsNoTracking()
            .SingleAsync(audit => audit.Action == "quote-request.note-added" && audit.TargetId == id.ToString("D"), token);
        (entry.TargetType, entry.ActorUserId, entry.Detail).ShouldBe(("QuoteRequest", (Guid?)rig.Admin.UserId, $"note={noteId:D}"));
        entry.Detail.ShouldNotBeNull().ShouldNotContain("mockup", Case.Insensitive);
        entry.Detail.ShouldNotContain("Juan", Case.Insensitive);
    }

    [Fact]
    public async Task TheStoredRetryAnswerHoldsNoVisitorDetailsOrNoteText()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed(
            "Juan Dela Cruz",
            QuoteRequestStatus.New,
            Received,
            Team: "Brgy. San Roque Ballers",
            Email: "juan@example.test",
            Message: "Twelve jerseys, numbers 1 to 12.",
            PhotoNames: ["front.jpg"],
            StoredSlots: [0]));
        foreach (var text in new[] { "Asked for the sizes.", Note })
        {
            using var response = await rig.PostNoteAsync(rig.Admin.AccessToken, id, new { text });
            response.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        // The idempotency gate keeps each 200 answer for 24 hours, where the purge and the delete cannot reach it.
        var token = TestContext.Current.CancellationToken;
        await using var context = database.CreateContext();
        var stored = await context.IdempotencyRecords.AsNoTracking()
            .Where(record => record.ResponseBody != null && record.ResponseBody.Contains(id.ToString("D")))
            .Select(record => record.ResponseBody!)
            .ToListAsync(token);
        stored.Count.ShouldBe(2);
        foreach (var body in stored)
        {
            foreach (var personal in new[] { "Juan Dela Cruz", "San Roque", "juan@example.test", "0917", "Twelve jerseys", "front.jpg", "fullSize", "thumb", "sizes", "mockup" })
            {
                body.ShouldNotContain(personal, Case.Insensitive);
            }
        }
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task AnEmptyNoteIsRefusedAndAddsNothing(string? text)
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.New, Received));

        using var response = await rig.PostNoteAsync(rig.Admin.AccessToken, id, text is null ? null : new { text });
        var problem = await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.BadRequest);

        problem.GetProperty("code").GetString().ShouldBe("quote-requests.validation");
        problem.GetProperty("errors").GetProperty("text")[0].GetString().ShouldBe("Write a note first.");
        (await NoteCountAsync(rig, id)).ShouldBe(0);
    }

    [Fact]
    public async Task ANoteOfOneThousandCharactersIsTakenAndOneMoreIsRefused()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.New, Received));

        using (var tooLong = await rig.PostNoteAsync(rig.Admin.AccessToken, id, new { text = new string('a', 1001) }))
        {
            var problem = await QuoteRequestStaffRig.BodyAsync(tooLong, HttpStatusCode.BadRequest);
            problem.GetProperty("errors").GetProperty("text")[0].GetString().ShouldBe("Keep the note to 1,000 characters or fewer.");
        }

        using var exact = await rig.PostNoteAsync(rig.Admin.AccessToken, id, new { text = new string('a', 1000) });
        exact.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await rig.ReadAsync(id)).GetProperty("notes")[0].GetProperty("text").GetString()!.Length.ShouldBe(1000);
        (await NoteCountAsync(rig, id)).ShouldBe(1);
    }

    [Fact]
    public async Task ANoteOnAnUnknownRequestIs404()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);

        using var response = await rig.PostNoteAsync(rig.Admin.AccessToken, Guid.NewGuid(), new { text = Note });

        (await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.NotFound)).GetProperty("code").GetString().ShouldBe("quote-requests.not-found");
    }

    [Fact]
    public async Task TheAuthorsNameStaysAfterTheirAccountIsDeleted()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.New, Received));
        var manager = await TestSessions.StartAsync(rig.Factory, Roles.Manager);
        using (var response = await rig.PostNoteAsync(manager.AccessToken, id, new { text = Note }))
        {
            response.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        await AccountStateFixtures.MarkDeletedAsync(rig.Factory, manager.UserId);

        var author = (await rig.ReadAsync(id)).GetProperty("notes")[0].GetProperty("createdBy");
        author.GetProperty("id").GetGuid().ShouldBe(manager.UserId);
        author.GetProperty("name").GetString().ShouldBe("Paolo Reyes");
        author.GetProperty("formerStaff").GetBoolean().ShouldBeTrue();
    }

    [Fact]
    public async Task ARequestWithNoNotesListsNone()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.New, Received));

        (await rig.ReadAsync(id)).GetProperty("notes").GetArrayLength().ShouldBe(0);
    }

    [Fact]
    public async Task ANoteMovesTheVersionSoAStatusChangeFromBeforeItIs409()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);
        var id = await rig.SeedAsync(new QuoteSeed("Juan Dela Cruz", QuoteRequestStatus.New, Received));
        var version = (await rig.ReadAsync(id)).GetProperty("version").GetString();
        using (var note = await rig.PostNoteAsync(rig.Admin.AccessToken, id, new { text = Note }))
        {
            note.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        using var response = await rig.PostStatusAsync(rig.Admin.AccessToken, id, new { status = "contacted", version });

        (await QuoteRequestStaffRig.BodyAsync(response, HttpStatusCode.Conflict)).GetProperty("code").GetString().ShouldBe("quote-requests.conflict");
    }

    [Fact]
    public async Task NoRouteChangesOrRemovesASingleNote()
    {
        await using var rig = await QuoteRequestStaffRig.StartAsync(database);

        var noteRoutes = rig.Factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.RoutePattern.RawText?.Contains("quote-requests", StringComparison.Ordinal) == true
                && endpoint.RoutePattern.RawText.Contains("notes", StringComparison.Ordinal))
            .ToList();

        noteRoutes.ShouldNotBeEmpty();
        foreach (var endpoint in noteRoutes)
        {
            var methods = endpoint.Metadata.GetMetadata<IHttpMethodMetadata>().ShouldNotBeNull().HttpMethods;
            methods.ShouldBe(["POST"], endpoint.RoutePattern.RawText);
            endpoint.RoutePattern.RawText.ShouldBe("api/v1/quote-requests/{id:guid}/notes");
        }
    }

    private static async Task<int> NoteCountAsync(QuoteRequestStaffRig rig, Guid id) =>
        (await rig.ReadAsync(id)).GetProperty("notes").GetArrayLength();
}

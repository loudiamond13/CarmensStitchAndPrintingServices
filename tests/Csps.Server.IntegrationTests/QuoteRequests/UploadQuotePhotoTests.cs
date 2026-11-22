using System.Net;
using System.Text.Json;
using Csps.Application.Images;
using Csps.Application.Ports;
using Csps.Domain.QuoteRequests;
using Csps.Infrastructure.Images;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Server.IntegrationTests.QuoteRequests;

/// <summary>INQ-02, D-01, D-02, CWE-434, CWE-639, CWE-203: a visitor's photo is posted on its own to a slot the request declared, stored privately, and every wrong try looks the same.</summary>
public sealed class UploadQuotePhotoTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string NotFoundCode = "quote-requests.photo-not-found";
    private const string ExpiredKeyCase = "an expired key";

    [Fact]
    public async Task ADeclaredPhotoIsStoredInItsSlot()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var key = QuoteRequestFixtures.NewUploadKey();
        var body = QuoteRequestFixtures.MinimalBody();
        body["photos"] = new[] { "logo.png" };
        body["uploadKey"] = key;

        using var created = await QuoteRequestFixtures.PostAsync(client, body);
        var createdText = await created.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        created.StatusCode.ShouldBe(HttpStatusCode.OK, createdText);
        using var document = JsonDocument.Parse(createdText);
        var id = document.RootElement.GetProperty("id").GetGuid();
        document.RootElement.TryGetProperty("photoSlots", out var slots).ShouldBeTrue("the answer lists the photo slots");
        var slot = slots.EnumerateArray().ShouldHaveSingleItem();
        slot.GetProperty("slot").GetInt32().ShouldBe(0);
        slot.GetProperty("fileName").GetString().ShouldBe("logo.png");
        createdText.ShouldNotContain(key, Case.Sensitive, "the answer never echoes the key");

        var png = SyntheticImages.Png(800, 600);
        using var uploaded = await QuoteRequestFixtures.PostPhotoAsync(client, id, "0", key, png, "logo.png");

        uploaded.StatusCode.ShouldBe(HttpStatusCode.OK, await uploaded.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();
        var stored = storage.Uploads.ShouldHaveSingleItem();
        stored.PublicId.ShouldStartWith($"csps-test/quotes/{id:D}/");
        stored.AssetFolder.ShouldBe($"csps-test/quotes/{id:D}");
        await using var context = database.CreateContext();
        var row = await context.Set<QuoteRequestPhoto>().AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        row.QuoteRequestId.ShouldBe(id);
        row.Slot.ShouldBe(0);
        row.FileName.ShouldBe("logo.png");
        row.PublicId.ShouldBe(stored.PublicId);
        row.Width.ShouldBe(800);
        row.Height.ShouldBe(600);
        row.Bytes.ShouldBe(stored.Length);
        row.Kind.ShouldBe("png");
        var request = await context.Set<QuoteRequest>().AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        request.UploadKeyHash.ShouldNotBeNull().Length.ShouldBe(32);
        request.CreatedById.ShouldBeNull();
    }

    [Fact]
    public async Task EveryMissAnswersTheSame404()
    {
        await database.ResetAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 11, 22, 10, 0, 0, TimeSpan.Zero));
        await using var factory = AuthClient.WithClock(baseFactory, clock);
        using var client = factory.CreateClient();
        var key = QuoteRequestFixtures.NewUploadKey();
        var id = await QuoteRequestFixtures.CreateWithPhotosAsync(client, ["a.jpg", "b.jpg", "c.jpg", "d.jpg"], key);
        var photo = SyntheticImages.Jpeg(640, 480);
        (await StatusAsync(client, id, "0", key, photo)).ShouldBe(HttpStatusCode.OK);
        await MarkSpamAsync(id, false);

        var misses = new List<(string Name, HttpResponseMessage Response)>
        {
            ("a wrong key", await QuoteRequestFixtures.PostPhotoAsync(client, id, "1", QuoteRequestFixtures.NewUploadKey(), photo)),
            ("no key", await QuoteRequestFixtures.PostPhotoAsync(client, id, "1", null, photo)),
            ("a key that is not a key", await QuoteRequestFixtures.PostPhotoAsync(client, id, "1", "not a key!", photo)),
            ("a random id", await QuoteRequestFixtures.PostPhotoAsync(client, Guid.NewGuid(), "1", key, photo)),
            ("a filled slot", await QuoteRequestFixtures.PostPhotoAsync(client, id, "0", key, photo)),
            ("a slot that was not declared", await QuoteRequestFixtures.PostPhotoAsync(client, id, "4", key, photo)),
            ("slot 5", await QuoteRequestFixtures.PostPhotoAsync(client, id, "5", key, photo)),
            ("slot minus 1", await QuoteRequestFixtures.PostPhotoAsync(client, id, "-1", key, photo)),
        };
        await MarkSpamAsync(id, true);
        misses.Add(("a spam request", await QuoteRequestFixtures.PostPhotoAsync(client, id, "1", key, photo)));
        await MarkSpamAsync(id, false);
        clock.Advance(TimeSpan.FromHours(2) - TimeSpan.FromSeconds(1));
        (await StatusAsync(client, id, "1", key, photo)).ShouldBe(HttpStatusCode.OK, "one second before the end the key still works");
        clock.Advance(TimeSpan.FromSeconds(1));
        misses.Add((ExpiredKeyCase, await QuoteRequestFixtures.PostPhotoAsync(client, id, "2", key, photo)));

        var bodies = new List<string>();
        foreach (var (name, response) in misses)
        {
            using (response)
            {
                response.StatusCode.ShouldBe(HttpStatusCode.NotFound, name);
                var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
                problem.GetProperty("code").GetString().ShouldBe(NotFoundCode, name);
                bodies.Add(RemoveTraceId(problem));
            }
        }

        bodies.Distinct(StringComparer.Ordinal).ShouldHaveSingleItem("no miss tells which part was wrong");
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();
        storage.Uploads.Count.ShouldBe(2, "a refused try never reaches the storage");
    }

    [Fact]
    public async Task ATextFileNamedJpgIsRefusedAs422WithTheQuoteMessage()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var key = QuoteRequestFixtures.NewUploadKey();
        var id = await QuoteRequestFixtures.CreateWithPhotosAsync(client, ["notes.jpg"], key);

        using var response = await QuoteRequestFixtures.PostPhotoAsync(client, id, "0", key, "just some words"u8.ToArray(), "notes.jpg");

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("detail").GetString().ShouldBe("notes.jpg isn't a photo we can take. Use JPG, PNG, WebP or HEIC, or send it on Messenger.");
        problem.GetProperty("code").GetString().ShouldBe("quote-requests.photo-refused");
        factory.Services.GetRequiredService<TestingImageStorage>().Uploads.ShouldBeEmpty();
    }

    [Fact]
    public async Task ATenMegabytePhotoIsStoredAndOneByteMoreIs413()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var key = QuoteRequestFixtures.NewUploadKey();
        var id = await QuoteRequestFixtures.CreateWithPhotosAsync(client, ["a.jpg", "b.jpg"], key);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();

        using var exact = await QuoteRequestFixtures.PostPhotoAsync(client, id, "0", key, PaddedJpeg(ImageUploadLimits.MaxFileBytes), "a.jpg");
        using var over = await QuoteRequestFixtures.PostPhotoAsync(client, id, "1", key, PaddedJpeg(ImageUploadLimits.MaxFileBytes + 1), "b.jpg");

        exact.StatusCode.ShouldBe(HttpStatusCode.OK, await exact.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        over.StatusCode.ShouldBe(HttpStatusCode.RequestEntityTooLarge);
        var problem = await ProblemJson.ReadAsync(over, TestContext.Current.CancellationToken);
        problem.GetProperty("status").GetInt32().ShouldBe(413);
        storage.Uploads.ShouldHaveSingleItem().Length.ShouldBe(ImageUploadLimits.MaxFileBytes);
    }

    [Fact]
    public async Task AThirtyMegapixelPhotoIsRefusedAs422WithThePixelMessage()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var key = QuoteRequestFixtures.NewUploadKey();
        var id = await QuoteRequestFixtures.CreateWithPhotosAsync(client, ["wide.jpg"], key);

        using var response = await QuoteRequestFixtures.PostPhotoAsync(client, id, "0", key, SyntheticImages.Jpeg(6000, 5000), "wide.jpg");

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("detail").GetString().ShouldBe("wide.jpg is too big. Photos can be at most 25 megapixels.");
        factory.Services.GetRequiredService<TestingImageStorage>().Uploads.ShouldBeEmpty();
    }

    [Fact]
    public async Task SixDeclaredNamesAnswer400OnThePhotosField()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var body = QuoteRequestFixtures.MinimalBody();
        body["photos"] = new[] { "1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg", "6.jpg" };
        body["uploadKey"] = QuoteRequestFixtures.NewUploadKey();

        using var response = await QuoteRequestFixtures.PostAsync(client, body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").GetProperty("photos")[0].GetString().ShouldBe("You can send up to 5 photos.");
        await using var context = database.CreateContext();
        (await context.Set<QuoteRequest>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task TwoPhotosForDifferentSlotsAtTheSameTimeAreBothStored()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var key = QuoteRequestFixtures.NewUploadKey();
        var id = await QuoteRequestFixtures.CreateWithPhotosAsync(client, ["a.jpg", "b.jpg"], key);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();
        var photo = SyntheticImages.Jpeg(640, 480);
        storage.HoldUploadsStepwise();

        var first = Task.Run(() => StatusAsync(client, id, "0", key, photo), TestContext.Current.CancellationToken);
        var second = Task.Run(() => StatusAsync(client, id, "1", key, photo), TestContext.Current.CancellationToken);
        await WaitForAsync(() => storage.Uploads.Count == 2);
        storage.ReleaseNext();
        storage.ReleaseNext();

        (await first.WaitAsync(TimeSpan.FromSeconds(30), TestContext.Current.CancellationToken)).ShouldBe(HttpStatusCode.OK);
        (await second.WaitAsync(TimeSpan.FromSeconds(30), TestContext.Current.CancellationToken)).ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        var rows = await context.Set<QuoteRequestPhoto>().AsNoTracking().OrderBy(row => row.Slot).ToListAsync(TestContext.Current.CancellationToken);
        rows.Select(row => row.PublicId).ShouldAllBe(publicId => publicId != null);
        rows.Select(row => row.PublicId).Distinct().Count().ShouldBe(2);
    }

    [Fact]
    public async Task TwoPhotosForOneSlotAtTheSameTimeGiveOneOkAndOne404AndTheLoserIsQueuedForRemoval()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var key = QuoteRequestFixtures.NewUploadKey();
        var id = await QuoteRequestFixtures.CreateWithPhotosAsync(client, ["a.jpg"], key);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();
        var photo = SyntheticImages.Jpeg(640, 480);
        storage.HoldUploadsStepwise();

        var first = Task.Run(() => StatusAsync(client, id, "0", key, photo), TestContext.Current.CancellationToken);
        var second = Task.Run(() => StatusAsync(client, id, "0", key, photo), TestContext.Current.CancellationToken);
        await WaitForAsync(() => storage.Uploads.Count == 2);
        storage.ReleaseNext();
        storage.ReleaseNext();

        var answers = new[]
        {
            await first.WaitAsync(TimeSpan.FromSeconds(30), TestContext.Current.CancellationToken),
            await second.WaitAsync(TimeSpan.FromSeconds(30), TestContext.Current.CancellationToken),
        };
        answers.Order().ShouldBe([HttpStatusCode.OK, HttpStatusCode.NotFound]);
        await using var context = database.CreateContext();
        var kept = (await context.Set<QuoteRequestPhoto>().AsNoTracking().SingleAsync(TestContext.Current.CancellationToken)).PublicId.ShouldNotBeNull();
        var loser = storage.Uploads.Select(upload => upload.PublicId).Single(publicId => publicId != kept);
        var queued = await context.Set<ImageDeletion>().AsNoTracking().Where(row => row.PublicId == loser).ToListAsync(TestContext.Current.CancellationToken);
        queued.ShouldHaveSingleItem().Reason.ShouldBe(ImageDeletionReason.UploadUndone);
        (await context.Set<ImageDeletion>().AsNoTracking().CountAsync(row => row.PublicId == kept, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    // A JPEG whose scan data is padded with zero bytes, so the whole file has the given length.
    private static byte[] PaddedJpeg(int length)
    {
        var small = SyntheticImages.Jpeg(640, 480);
        var photo = new byte[length];
        small.AsSpan(0, small.Length - 2).CopyTo(photo);
        photo[^2] = 0xFF;
        photo[^1] = 0xD9;
        return photo;
    }

    private static async Task<HttpStatusCode> StatusAsync(HttpClient client, Guid id, string slot, string key, byte[] photo)
    {
        using var response = await QuoteRequestFixtures.PostPhotoAsync(client, id, slot, key, photo);
        return response.StatusCode;
    }

    private static string RemoveTraceId(JsonElement problem) =>
        string.Join(
            '|',
            problem.EnumerateObject().Where(member => member.Name != "traceId").Select(member => $"{member.Name}={member.Value.GetRawText()}"));

    private async Task MarkSpamAsync(Guid id, bool spam)
    {
        await using var context = database.CreateContext();
        var status = spam ? QuoteRequestStatus.Spam : QuoteRequestStatus.New;
        await context.Set<QuoteRequest>().Where(row => row.Id == id)
            .ExecuteUpdateAsync(set => set.SetProperty(row => row.Status, status), TestContext.Current.CancellationToken);
    }

    private static async Task WaitForAsync(Func<bool> condition)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(30));
        while (!condition())
        {
            await Task.Delay(TimeSpan.FromMilliseconds(25), timeout.Token);
        }
    }
}

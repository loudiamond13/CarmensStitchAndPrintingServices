using System.Net;
using System.Text.Json;
using Csps.Domain.QuoteRequests;
using Csps.Infrastructure.Images;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.QuoteRequests;

/// <summary>INQ-02, D-01, CWE-434, CWE-639: a visitor's photo is posted on its own to a slot the request declared and is stored privately.</summary>
public sealed class UploadQuotePhotoTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
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
    }
}

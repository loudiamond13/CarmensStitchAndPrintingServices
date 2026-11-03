using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Csps.Application.Security;
using Csps.Domain.Orders;
using Csps.Infrastructure.Images;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>ORD-04, IMG-01, IMG-02, IMG-03, D-01, D-08, D-11, D-12, D-19: staff upload one photo to an order through the server only.</summary>
public sealed class OrderImagesEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly byte[] Photo = SyntheticImages.Jpeg(640, 480);

    [Fact]
    public async Task AManagerUploadsAJpegAndTheOrderIsAnsweredWithOnePhotoSavedAtSlotZero()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var created = await CreateOrderAsync(factory, client, manager.AccessToken);
        var id = created.GetProperty("id").GetGuid();
        var number = created.GetProperty("number").GetString();
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();

        using var response = await UploadAsync(client, manager.AccessToken, id, Photo);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        document.RootElement.GetProperty("id").GetGuid().ShouldBe(id);
        var upload = storage.Uploads.Where(recorded => recorded.AssetFolder == $"csps-test/orders/{id:D}").ShouldHaveSingleItem();
        Regex.IsMatch(upload.PublicId, $"^csps-test/orders/{id:D}/[a-z2-7]{{26}}$").ShouldBeTrue(upload.PublicId);
        upload.Length.ShouldBe(Photo.Length);

        await using var context = database.CreateContext();
        var row = await context.Set<OrderImage>().AsNoTracking().SingleAsync(image => image.OrderId == id, TestContext.Current.CancellationToken);
        row.Slot.ShouldBe(0);
        row.Position.ShouldBe(0);
        row.Width.ShouldBe(640);
        row.Height.ShouldBe(480);
        row.Bytes.ShouldBe(Photo.Length);
        row.Format.ShouldBe("jpg");
        row.Description.ShouldBeNull();
        row.PublicId.ShouldBe(upload.PublicId);
        row.CreatedById.ShouldBe(manager.UserId);

        var audit = await context.AuditLog.AsNoTracking().SingleAsync(entry => entry.Action == "order-image.added" && entry.TargetId == id.ToString("D"), TestContext.Current.CancellationToken);
        audit.TargetType.ShouldBe("Order");
        audit.ActorUserId.ShouldBe(manager.UserId);
        audit.Detail.ShouldBe($"number={number};position=1");
        audit.Detail.ShouldNotBeNull().ShouldNotContain(upload.PublicId);
    }

    [Fact]
    public async Task ADescriptionIsTrimmedBeforeItIsKept()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var created = await CreateOrderAsync(factory, client, admin.AccessToken);
        var id = created.GetProperty("id").GetGuid();

        using var response = await UploadAsync(client, admin.AccessToken, id, Photo, description: "  Back print  ");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        (await context.Set<OrderImage>().AsNoTracking().SingleAsync(image => image.OrderId == id, TestContext.Current.CancellationToken)).Description.ShouldBe("Back print");
    }

    [Fact]
    public async Task ASvgNamedAsAJpegIsRefusedByItsBytesAndNothingIsSentToStorage()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var created = await CreateOrderAsync(factory, client, manager.AccessToken);
        var id = created.GetProperty("id").GetGuid();
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();

        using var response = await UploadAsync(client, manager.AccessToken, id, SyntheticImages.Svg());

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("images.type");
        OrderFixtures.FieldErrors(problem, "file").ShouldBe(["photo.jpg isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file."]);
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains(id.ToString("D"), StringComparison.Ordinal)).ShouldBeEmpty();
        await using var context = database.CreateContext();
        (await context.Set<OrderImage>().CountAsync(image => image.OrderId == id, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task APostWithoutAFileAnswers400AndNamesTheFileField()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var created = await CreateOrderAsync(factory, client, manager.AccessToken);

        using var response = await UploadAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), file: null, description: "No file here");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("images.file-missing");
        OrderFixtures.ErrorFields(problem).ShouldBe(["file"]);
    }

    [Fact]
    public async Task AnUnknownOrderAnswers404AndNothingIsSentToStorage()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var unknown = Guid.NewGuid();
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();

        using var response = await UploadAsync(client, manager.AccessToken, unknown, Photo);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.not-found");
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains(unknown.ToString("D"), StringComparison.Ordinal)).ShouldBeEmpty();
    }

    [Fact]
    public async Task ACancelledOrderAnswers422LockedAndNothingIsSentToStorage()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var created = await CreateOrderAsync(factory, client, manager.AccessToken);
        var id = created.GetProperty("id").GetGuid();
        await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, "cancelled");
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();

        using var response = await UploadAsync(client, manager.AccessToken, id, Photo);

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.locked");
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains(id.ToString("D"), StringComparison.Ordinal)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AStorageThatDoesNotTakeTheFileAnswers503AndSavesNoPhoto()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var created = await CreateOrderAsync(factory, client, manager.AccessToken);
        var id = created.GetProperty("id").GetGuid();
        factory.Services.GetRequiredService<TestingImageStorage>().FailNext(1);

        using var response = await UploadAsync(client, manager.AccessToken, id, Photo);

        response.StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("images.storage-failed");
        await using var context = database.CreateContext();
        (await context.Set<OrderImage>().CountAsync(image => image.OrderId == id, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task AHostWithNoImageStorageStartsAnswersTheUploadWith503AndKeepsTheHealthCheckGreen()
    {
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var baseClient = baseFactory.CreateClient();
        var manager = await TestSessions.StartAsync(baseFactory, Roles.Manager);
        var created = await CreateOrderAsync(baseFactory, baseClient, manager.AccessToken);
        await using var development = baseFactory.WithWebHostBuilder(builder => builder.UseEnvironment(Environments.Development));
        using var client = development.CreateClient();

        using var health = await client.GetAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);
        using var response = await UploadAsync(client, manager.AccessToken, created.GetProperty("id").GetGuid(), Photo);

        health.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("images.not-configured");
        problem.GetProperty("detail").GetString().ShouldBe("Photo uploads aren't set up yet.");
    }

    [Fact]
    public async Task TheContractDescribesTheUploadAsAMultipartFormWithABinaryFile()
    {
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var development = baseFactory.WithWebHostBuilder(builder => builder.UseEnvironment(Environments.Development));
        using var client = development.CreateClient();

        using var response = await client.GetAsync(new Uri("/openapi/v1.json", UriKind.Relative), TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));

        var content = document.RootElement.GetProperty("paths").GetProperty("/api/v1/orders/{orderId}/images").GetProperty("post").GetProperty("requestBody").GetProperty("content");
        content.EnumerateObject().Select(media => media.Name).ShouldBe(["multipart/form-data"]);
        var schemas = document.RootElement.GetProperty("components").GetProperty("schemas");
        schemas.GetProperty("IFormFile").GetProperty("format").GetString().ShouldBe("binary");
    }

    [Fact]
    public async Task TheFifthPhotoIsAcceptedAndTheSixthAnswers422WithNothingSentToStorage()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var created = await CreateOrderAsync(factory, client, manager.AccessToken);
        var id = created.GetProperty("id").GetGuid();
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();

        for (var number = 1; number <= 5; number++)
        {
            using var accepted = await UploadAsync(client, manager.AccessToken, id, Photo);
            accepted.StatusCode.ShouldBe(HttpStatusCode.OK, $"photo {number}");
        }

        var uploadsBefore = storage.Uploads.Count(recorded => recorded.AssetFolder.Contains(id.ToString("D"), StringComparison.Ordinal));
        using var sixth = await UploadAsync(client, manager.AccessToken, id, Photo);

        sixth.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        var problem = await ProblemJson.ReadAsync(sixth, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.images-full");
        problem.GetProperty("detail").GetString().ShouldBe("This order already has 5 photos.");
        uploadsBefore.ShouldBe(5);
        storage.Uploads.Count(recorded => recorded.AssetFolder.Contains(id.ToString("D"), StringComparison.Ordinal)).ShouldBe(5);
        await using var context = database.CreateContext();
        (await context.Set<OrderImage>().CountAsync(image => image.OrderId == id, TestContext.Current.CancellationToken)).ShouldBe(5);
    }

    [Fact]
    public async Task ACompletedOrderAnswers422LockedAndNothingIsSentToStorage()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(factory);
        var paid = await OrderFixtures.Ord0148PaidInFullAsync(client, admin, manager, today);
        var id = paid.GetProperty("id").GetGuid();
        await OrderFixtures.ChangeStatusAndReadAsync(client, manager.AccessToken, id, "completed");
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();

        using var response = await UploadAsync(client, manager.AccessToken, id, Photo);

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.locked");
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains(id.ToString("D"), StringComparison.Ordinal)).ShouldBeEmpty();
    }

    [Fact]
    public async Task ADeletedOrderAnswers404AndNothingIsSentToStorage()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var created = await CreateOrderAsync(factory, client, admin.AccessToken);
        var id = created.GetProperty("id").GetGuid();
        using (var deleted = await OrderFixtures.DeleteAsync(client, admin.AccessToken, id))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var storage = factory.Services.GetRequiredService<TestingImageStorage>();

        using var response = await UploadAsync(client, admin.AccessToken, id, Photo);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("orders.not-found");
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains(id.ToString("D"), StringComparison.Ordinal)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AFileOneByteOverTheLimitAnswers400NamingTheFileAndIsNotSentToStorage()
    {
        var limit = Photo.Length;
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseSetting("Images:MaxBytes", limit.ToString(System.Globalization.CultureInfo.InvariantCulture)));
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var created = await CreateOrderAsync(baseFactory, client, manager.AccessToken);
        var id = created.GetProperty("id").GetGuid();
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();

        using var exact = await UploadAsync(client, manager.AccessToken, id, Photo);
        using var over = await UploadAsync(client, manager.AccessToken, id, [.. Photo, 0], fileName: "Team shirt.jpg");

        exact.StatusCode.ShouldBe(HttpStatusCode.OK);
        over.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(over, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("images.too-large");
        var message = OrderFixtures.FieldErrors(problem, "file").Single();
        message.ShouldStartWith("Team shirt.jpg is over ");
        message.ShouldEndWith(". Choose a smaller photo.");
        storage.Uploads.Count(recorded => recorded.AssetFolder.Contains(id.ToString("D"), StringComparison.Ordinal)).ShouldBe(1);
    }

    [Theory]
    [InlineData(5001, 5000)]
    [InlineData(6000, 5000)]
    [InlineData(10001, 100)]
    public async Task APhotoWithTooManyPixelsOrTooLongASideAnswers400AndIsNotSentToStorage(int width, int height)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var created = await CreateOrderAsync(factory, client, manager.AccessToken);
        var id = created.GetProperty("id").GetGuid();
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();

        using var response = await UploadAsync(client, manager.AccessToken, id, SyntheticImages.Jpeg(width, height), fileName: "Wide print.jpg");

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("images.too-big");
        OrderFixtures.FieldErrors(problem, "file").ShouldBe(["Wide print.jpg is too big. Photos can be at most 25 megapixels."]);
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains(id.ToString("D"), StringComparison.Ordinal)).ShouldBeEmpty();
    }

    [Fact]
    public async Task ADescriptionOf200CharactersIsKeptAndOneOf201Answers400WithNothingSentToStorage()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var created = await CreateOrderAsync(factory, client, manager.AccessToken);
        var id = created.GetProperty("id").GetGuid();
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();

        using var fits = await UploadAsync(client, manager.AccessToken, id, Photo, description: new string('a', 200));
        var uploadsAfterFit = storage.Uploads.Count;
        using var tooLong = await UploadAsync(client, manager.AccessToken, id, Photo, description: new string('a', 201));

        fits.StatusCode.ShouldBe(HttpStatusCode.OK);
        tooLong.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(tooLong, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("orders.image-description-too-long");
        OrderFixtures.FieldErrors(problem, "description").ShouldBe(["Keep the description to 200 characters or fewer."]);
        storage.Uploads.Count.ShouldBe(uploadsAfterFit);
    }

    [Fact]
    public async Task ADescriptionOfOnlySpacesIsStoredAsNone()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var created = await CreateOrderAsync(factory, client, manager.AccessToken);
        var id = created.GetProperty("id").GetGuid();

        using var response = await UploadAsync(client, manager.AccessToken, id, Photo, description: "     ");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        (await context.Set<OrderImage>().AsNoTracking().SingleAsync(image => image.OrderId == id, TestContext.Current.CancellationToken)).Description.ShouldBeNull();
    }

    [Fact]
    public async Task AFormWithOnlyADescriptionPartAnswers400FileMissing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var created = await CreateOrderAsync(factory, client, manager.AccessToken);
        var id = created.GetProperty("id").GetGuid();
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();
        using var request = ApiRequests.Create(HttpMethod.Post, $"/api/v1/orders/{id:D}/images", manager.AccessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        request.Content = MultipartBodies.Content("csps-test-boundary-1", [MultipartPart.Text("description", "Only words")]);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("images.file-missing");
        storage.Uploads.Where(recorded => recorded.AssetFolder.Contains(id.ToString("D"), StringComparison.Ordinal)).ShouldBeEmpty();
    }

    [Fact]
    public async Task TwoUploadsTogetherForTheLastFreeSlotLeaveExactlyFivePhotos()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var created = await CreateOrderAsync(factory, client, manager.AccessToken);
        var id = created.GetProperty("id").GetGuid();
        for (var number = 1; number <= 4; number++)
        {
            using var accepted = await UploadAsync(client, manager.AccessToken, id, Photo);
            accepted.StatusCode.ShouldBe(HttpStatusCode.OK, $"photo {number}");
        }

        var (first, second) = await ConcurrentRequests.SendTogetherAsync(
            () => UploadAsync(client, manager.AccessToken, id, Photo),
            () => UploadAsync(client, manager.AccessToken, id, Photo));
        using (first)
        using (second)
        {
            var statuses = new[] { first.StatusCode, second.StatusCode }.Order().ToArray();
            statuses[0].ShouldBe(HttpStatusCode.OK);
            statuses[1].ShouldBeOneOf(HttpStatusCode.Conflict, HttpStatusCode.UnprocessableEntity);
        }

        await using var context = database.CreateContext();
        var rows = await context.Set<OrderImage>().AsNoTracking().Where(image => image.OrderId == id).ToListAsync(TestContext.Current.CancellationToken);
        rows.Count.ShouldBe(5);
        rows.Select(row => row.Slot).Order().ShouldBe([0, 1, 2, 3, 4]);
    }

    private static async Task<JsonElement> CreateOrderAsync(CspsApiFactory factory, HttpClient client, string accessToken)
    {
        var today = await OrderFixtures.TodayAsync(factory);
        return await OrderFixtures.CreateAsync(client, accessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
    }

    private static async Task<HttpResponseMessage> UploadAsync(HttpClient client, string? accessToken, Guid orderId, byte[]? file, string fileName = "photo.jpg", string? description = null)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, $"/api/v1/orders/{orderId:D}/images", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        var form = new MultipartFormDataContent();
        if (file is not null)
        {
            var part = new ByteArrayContent(file);
            part.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");
            form.Add(part, "file", fileName);
        }

        if (description is not null)
        {
            form.Add(new StringContent(description), "description");
        }

        request.Content = form;
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}

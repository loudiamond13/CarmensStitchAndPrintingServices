using System.Net;
using Csps.Application.Images;
using Csps.Application.Ports;
using Csps.Domain.QuoteRequests;
using Csps.Infrastructure.Images;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Csps.Server.IntegrationTests.QuoteRequests;

/// <summary>D-03, INQ-02, JOB-02: a failed photo is a missing photo and never a lost request; a file that may have reached storage is queued for removal.</summary>
public sealed class QuotePhotoFailureTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly byte[] Photo = SyntheticImages.Jpeg(640, 480);

    [Fact]
    public async Task StorageDownLeavesTheRequestAndAMissingSlot()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var key = QuoteRequestFixtures.NewUploadKey();
        var id = await QuoteRequestFixtures.CreateWithPhotosAsync(client, ["a.jpg", "b.jpg"], key);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();
        storage.FailNext(1);

        using var failed = await QuoteRequestFixtures.PostPhotoAsync(client, id, "0", key, Photo, "a.jpg");

        failed.StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable, await failed.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var problem = await ProblemJson.ReadAsync(failed, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe(ImageErrors.StorageFailedCode);
        await using (var context = database.CreateContext())
        {
            var request = await context.Set<QuoteRequest>().AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
            request.CustomerName.ShouldBe("Juan Dela Cruz");
            request.Status.ShouldBe(QuoteRequestStatus.New);
            var slots = await context.Set<QuoteRequestPhoto>().AsNoTracking().OrderBy(row => row.Slot).ToListAsync(TestContext.Current.CancellationToken);
            slots.Select(row => row.PublicId).ShouldBe([null, null]);
            (await context.Set<ImageDeletion>().AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0, "a clear refusal stored nothing, so nothing is queued");
        }

        using var next = await QuoteRequestFixtures.PostPhotoAsync(client, id, "1", key, Photo, "b.jpg");

        next.StatusCode.ShouldBe(HttpStatusCode.OK, await next.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        await using var after = database.CreateContext();
        var filled = await after.Set<QuoteRequestPhoto>().AsNoTracking().OrderBy(row => row.Slot).ToListAsync(TestContext.Current.CancellationToken);
        filled[0].PublicId.ShouldBeNull();
        filled[1].PublicId.ShouldNotBeNull();
    }

    [Fact]
    public async Task ATimeoutQueuesTheFileForRemoval()
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var key = QuoteRequestFixtures.NewUploadKey();
        var id = await QuoteRequestFixtures.CreateWithPhotosAsync(client, ["a.jpg"], key);
        var storage = factory.Services.GetRequiredService<TestingImageStorage>();
        storage.FailNext(1, ImageUploadOutcome.Failed(ImageFailureCodes.Transient));

        using var response = await QuoteRequestFixtures.PostPhotoAsync(client, id, "0", key, Photo, "a.jpg");

        response.StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);
        var attempted = storage.Uploads.ShouldHaveSingleItem().PublicId;
        await using var context = database.CreateContext();
        var queued = await context.Set<ImageDeletion>().AsNoTracking().ToListAsync(TestContext.Current.CancellationToken);
        var row = queued.ShouldHaveSingleItem();
        row.PublicId.ShouldBe(attempted);
        row.Reason.ShouldBe(ImageDeletionReason.UploadUndone);
        (await context.Set<QuoteRequestPhoto>().AsNoTracking().SingleAsync(TestContext.Current.CancellationToken)).PublicId.ShouldBeNull();
    }

    [Fact]
    public async Task NotConfiguredStorageAnswers503()
    {
        await database.ResetAsync();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IImageStorage>();
            services.AddSingleton<IImageStorage, UnsetStorage>();
        }));
        using var client = factory.CreateClient();
        var key = QuoteRequestFixtures.NewUploadKey();

        var id = await QuoteRequestFixtures.CreateWithPhotosAsync(client, ["a.jpg"], key);
        using var response = await QuoteRequestFixtures.PostPhotoAsync(client, id, "0", key, Photo, "a.jpg");

        response.StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe(ImageErrors.NotConfiguredCode);
        await using var context = database.CreateContext();
        (await context.Set<QuoteRequest>().AsNoTracking().SingleAsync(TestContext.Current.CancellationToken)).Id.ShouldBe(id);
        (await context.Set<QuoteRequestPhoto>().AsNoTracking().SingleAsync(TestContext.Current.CancellationToken)).PublicId.ShouldBeNull();
    }

    // A storage with no keys: every upload answers 503 and nothing is stored.
    private sealed class UnsetStorage : IImageStorage
    {
        public bool IsConfigured => false;

        public string RootFolder => "csps-test";

        public Task<ImageUploadOutcome> UploadAsync(ImageUpload upload, CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<ImageRemovalOutcome> RemoveAsync(string publicId, CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<StoredImagePage> ListAsync(string prefix, string? cursor, CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<StorageUsage> GetUsageAsync(CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}

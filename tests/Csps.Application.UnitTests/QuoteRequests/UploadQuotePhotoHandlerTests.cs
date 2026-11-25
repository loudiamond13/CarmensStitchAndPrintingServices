using System.Buffers.Text;
using System.Security.Cryptography;
using Csps.Application.Images;
using Csps.Application.Ports;
using Csps.Application.QuoteRequests;
using Csps.Domain.Common;
using Csps.Domain.QuoteRequests;
using Csps.Domain.Time;
using Csps.Testing.Images;
using NSubstitute;

namespace Csps.Application.UnitTests.QuoteRequests;

/// <summary>INQ-02, D-01, D-03, CWE-639, CWE-203, JOB-02: one photo through the image pipeline, one answer for every miss, and a stored file never left without a place.</summary>
public sealed class UploadQuotePhotoHandlerTests
{
    private const string Root = "csps";
    private static readonly DateTimeOffset Now = new(2026, 11, 22, 10, 30, 0, TimeSpan.Zero);
    private static readonly Guid RequestId = Guid.Parse("7c4a9e12-3b60-4d85-a1f7-e92d0c58b436");
    private static readonly byte[] Photo = SyntheticImages.Jpeg(640, 480);

    [Fact]
    public async Task AValidPhotoIsStoredUnderTheQuotesFolderAndFillsItsSlot()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(RequestId, 0, Harness.Request(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        var upload = harness.Uploads.ShouldHaveSingleItem();
        upload.AssetFolder.ShouldBe($"csps/quotes/{RequestId:D}");
        upload.PublicId.ShouldStartWith($"csps/quotes/{RequestId:D}/");
        var fill = harness.Fills.ShouldHaveSingleItem();
        fill.Slot.ShouldBe(0);
        fill.Stored.PublicId.ShouldBe(upload.PublicId);
        (fill.Stored.Width, fill.Stored.Height, fill.Stored.Kind, fill.Stored.StoredAtUtc).ShouldBe((640, 480, "jpg", Now));
        fill.Stored.Bytes.ShouldBe(upload.Bytes.Length);
        harness.Queue.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task UnsetStorageAnswers503BeforeAnythingIsRead()
    {
        var harness = new Harness { StorageConfigured = false };

        var result = await harness.Handler.HandleAsync(RequestId, 0, Harness.Request(), TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe(ImageErrors.NotConfiguredCode);
        _ = harness.Store.DidNotReceive().FindForUploadAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task NoFileAnswers400()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(RequestId, 0, Harness.Request() with { Bytes = default }, TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe(ImageErrors.FileMissingCode);
        _ = harness.Store.DidNotReceive().FindForUploadAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task EveryMissIsTheSameNotFoundAndStoresNothing()
    {
        var wrongKey = QuoteRequestFixturesKey();
        var cases = new (string Name, Harness Harness, int Slot, string? Key)[]
        {
            ("no such request", new Harness { Target = null }, 0, null),
            ("a wrong key", new Harness(), 0, wrongKey),
            ("no key", new Harness(), 0, string.Empty),
            ("a request with no key stored", new Harness { Target = Target() with { UploadKeyHash = null } }, 0, null),
            ("a request with no end time", new Harness { Target = Target() with { UploadKeyExpiresAtUtc = null } }, 0, null),
            ("an expired key", new Harness { Target = Target() with { UploadKeyExpiresAtUtc = Now } }, 0, null),
            ("a spam request", new Harness { Target = Target() with { Status = QuoteRequestStatus.Spam } }, 0, null),
            ("a filled slot", new Harness { Target = Target() with { EmptySlots = [1] } }, 0, null),
            ("slot 5", new Harness { Target = Target() with { EmptySlots = [0, 1, 2, 3, 4] } }, 5, null),
            ("slot minus 1", new Harness(), -1, null),
        };

        foreach (var (name, harness, slot, key) in cases)
        {
            var result = await harness.Handler.HandleAsync(RequestId, slot, Harness.Request(key), TestContext.Current.CancellationToken);

            result.IsFailure.ShouldBeTrue(name);
            result.Error.ShouldBe(QuoteRequestErrors.PhotoNotFound, name);
            harness.Uploads.ShouldBeEmpty(name);
        }
    }

    [Fact]
    public async Task TheKeyWorksUpToTheEndTimeAndNotAtIt()
    {
        var ok = new Harness { Target = Target() with { UploadKeyExpiresAtUtc = Now.AddTicks(1) } };
        var late = new Harness { Target = Target() with { UploadKeyExpiresAtUtc = Now } };

        (await ok.Handler.HandleAsync(RequestId, 0, Harness.Request(), TestContext.Current.CancellationToken)).IsSuccess.ShouldBeTrue();
        (await late.Handler.HandleAsync(RequestId, 0, Harness.Request(), TestContext.Current.CancellationToken)).Error.Code.ShouldBe(QuoteRequestErrors.PhotoNotFoundCode);
    }

    [Fact]
    public async Task ATextFileIsRefusedWithTheQuoteMessageAndNeverStored()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(RequestId, 0, Harness.Request() with { Bytes = "words"u8.ToArray(), FileName = "notes.jpg" }, TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        result.Error.Code.ShouldBe("quote-requests.photo-refused");
        result.Error.Message.ShouldBe("notes.jpg isn't a photo we can take. Use JPG, PNG, WebP or HEIC, or send it on Messenger.");
        harness.Uploads.ShouldBeEmpty();
    }

    [Fact]
    public async Task APhotoOverThePixelLimitIsRefusedWithThePixelMessage()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(RequestId, 0, Harness.Request() with { Bytes = SyntheticImages.Jpeg(6000, 5000), FileName = "wide.jpg" }, TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe("quote-requests.photo-refused");
        result.Error.Message.ShouldBe("wide.jpg is too big. Photos can be at most 25 megapixels.");
        harness.Uploads.ShouldBeEmpty();
    }

    [Fact]
    public async Task AFileOverAConfiguredLowerByteLimitKeepsTheImageSizeError()
    {
        var harness = new Harness { Settings = new ImageUploadSettings { MaxBytes = 10 } };

        var result = await harness.Handler.HandleAsync(RequestId, 0, Harness.Request(), TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe(ImageErrors.TooLargeCode);
        harness.Uploads.ShouldBeEmpty();
    }

    [Fact]
    public async Task APhotoWhoseMetadataCannotBeRemovedIsRefusedLikeANonPhoto()
    {
        var harness = new Harness();
        var unknownCritical = SyntheticImages.Png(800, 600, SyntheticImages.PngChunk("ABCD", new byte[4]));

        var result = await harness.Handler.HandleAsync(RequestId, 0, Harness.Request() with { Bytes = unknownCritical, FileName = "odd.png" }, TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe("quote-requests.photo-refused");
        result.Error.Message.ShouldBe("odd.png isn't a photo we can take. Use JPG, PNG, WebP or HEIC, or send it on Messenger.");
        harness.Uploads.ShouldBeEmpty();
    }

    [Fact]
    public async Task AClearStorageRefusalAnswers503AndQueuesNothing()
    {
        var harness = new Harness { Outcome = ImageUploadOutcome.Failed(ImageFailureCodes.Unauthorized) };

        var result = await harness.Handler.HandleAsync(RequestId, 0, Harness.Request(), TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe(ImageErrors.StorageFailedCode);
        harness.Fills.ShouldBeEmpty();
        harness.Queue.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task ATimeoutAnswers503AndQueuesTheFileAsUploadUndone()
    {
        var harness = new Harness { Outcome = ImageUploadOutcome.Failed(ImageFailureCodes.Transient) };

        var result = await harness.Handler.HandleAsync(RequestId, 0, Harness.Request(), TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe(ImageErrors.StorageFailedCode);
        harness.Fills.ShouldBeEmpty();
        await harness.Queue.Received(1).EnqueueNowAsync(harness.Uploads.Single().PublicId, ImageDeletionReason.UploadUndone, CancellationToken.None);
    }

    [Fact]
    public async Task AFilledPlaceAfterTheUploadAnswers404AndQueuesTheFile()
    {
        var harness = new Harness { Fill = false };

        var result = await harness.Handler.HandleAsync(RequestId, 0, Harness.Request(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(QuoteRequestErrors.PhotoNotFound);
        await harness.Queue.Received(1).EnqueueNowAsync(harness.Uploads.Single().PublicId, ImageDeletionReason.UploadUndone, CancellationToken.None);
    }

    [Fact]
    public async Task ASaveThatThrowsQueuesTheFileAndLetsTheErrorThrough()
    {
        var harness = new Harness { FillError = new InvalidOperationException("The database went away.") };

        var error = await Should.ThrowAsync<InvalidOperationException>(
            () => harness.Handler.HandleAsync(RequestId, 0, Harness.Request(), TestContext.Current.CancellationToken));

        error.Message.ShouldBe("The database went away.");
        await harness.Queue.Received(1).EnqueueNowAsync(harness.Uploads.Single().PublicId, ImageDeletionReason.UploadUndone, CancellationToken.None);
    }

    [Fact]
    public async Task AnUploadCutOffByALeftVisitorQueuesTheFileAndLetsTheCancelThrough()
    {
        var harness = new Harness { UploadError = new OperationCanceledException() };

        await Should.ThrowAsync<OperationCanceledException>(
            () => harness.Handler.HandleAsync(RequestId, 0, Harness.Request(), TestContext.Current.CancellationToken));

        harness.Fills.ShouldBeEmpty();
        await harness.Queue.Received(1).EnqueueNowAsync(harness.Uploads.Single().PublicId, ImageDeletionReason.UploadUndone, CancellationToken.None);
    }

    [Fact]
    public async Task ThePlaceIsFilledEvenWhenTheVisitorHasLeftSoTheOutcomeIsNeverUnknown()
    {
        var harness = new Harness();
        using var left = new CancellationTokenSource();
        await left.CancelAsync();

        var result = await harness.Handler.HandleAsync(RequestId, 0, Harness.Request(), left.Token);

        result.IsSuccess.ShouldBeTrue();
        await harness.Store.Received(1).FillPhotoSlotAsync(RequestId, 0, Arg.Any<QuotePhotoStored>(), CancellationToken.None);
    }

    [Fact]
    public async Task AFailingQueueWriteNeverReplacesTheAnswer()
    {
        var harness = new Harness { Fill = false };
        harness.Queue.EnqueueNowAsync(Arg.Any<string>(), Arg.Any<ImageDeletionReason>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new InvalidOperationException("queue down")));

        var result = await harness.Handler.HandleAsync(RequestId, 0, Harness.Request(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(QuoteRequestErrors.PhotoNotFound);
    }

    [Fact]
    public void ARequestIsRequired() =>
        Should.Throw<ArgumentNullException>(() => new Harness().Handler.HandleAsync(RequestId, 0, null!, TestContext.Current.CancellationToken));

    private static string QuoteRequestFixturesKey() => Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));

    private static QuotePhotoTarget Target() => new(RequestId, QuoteRequestStatus.New, HashOf(Harness.Key), Now.AddHours(2), [0, 1, 2]);

    private static byte[] HashOf(string key) => QuoteUploadKey.TryHash(key, out var hash) ? hash : throw new InvalidOperationException();

    private sealed class Harness
    {
        public static readonly string Key = Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));

        public QuotePhotoTarget? Target { get; init; } = new(RequestId, QuoteRequestStatus.New, HashOf(Key), Now.AddHours(2), [0, 1, 2]);

        public bool StorageConfigured { get; init; } = true;

        public ImageUploadOutcome Outcome { get; init; } = ImageUploadOutcome.Stored;

        public bool Fill { get; init; } = true;

        public Exception? FillError { get; init; }

        public Exception? UploadError { get; init; }

        public ImageUploadSettings Settings { get; init; } = new();

        public List<ImageUpload> Uploads { get; } = [];

        public List<(int Slot, QuotePhotoStored Stored)> Fills { get; } = [];

        public IQuoteRequestStore Store { get; } = Substitute.For<IQuoteRequestStore>();

        public IImageDeletionQueue Queue { get; } = Substitute.For<IImageDeletionQueue>();

        public UploadQuotePhotoHandler Handler => field ??= Build();

        public static UploadQuotePhotoRequest Request(string? key = null) => new(Photo, "photo.jpg", key ?? Key);

        private UploadQuotePhotoHandler Build()
        {
            Store.FindForUploadAsync(RequestId, Arg.Any<CancellationToken>()).Returns(Task.FromResult(Target));
            Store.FillPhotoSlotAsync(RequestId, Arg.Any<int>(), Arg.Any<QuotePhotoStored>(), Arg.Any<CancellationToken>())
                .Returns(call =>
                {
                    if (FillError is not null)
                    {
                        return Task.FromException<bool>(FillError);
                    }

                    Fills.Add((call.ArgAt<int>(1), call.ArgAt<QuotePhotoStored>(2)));
                    return Task.FromResult(Fill);
                });
            Queue.EnqueueNowAsync(Arg.Any<string>(), Arg.Any<ImageDeletionReason>(), Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);

            var storage = Substitute.For<IImageStorage>();
            storage.IsConfigured.Returns(StorageConfigured);
            storage.RootFolder.Returns(Root);
            storage.UploadAsync(Arg.Any<ImageUpload>(), Arg.Any<CancellationToken>()).Returns(call =>
            {
                Uploads.Add(call.Arg<ImageUpload>());
                return UploadError is not null ? Task.FromException<ImageUploadOutcome>(UploadError) : Task.FromResult(Outcome);
            });
            return new UploadQuotePhotoHandler(Store, new FixedCalendar(), storage, Queue, Settings);
        }
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(TimeZoneInfo.Utc, ZoneSource.Stored, Now));
    }
}

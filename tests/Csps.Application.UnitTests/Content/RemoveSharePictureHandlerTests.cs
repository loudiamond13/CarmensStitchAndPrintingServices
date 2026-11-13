using Csps.Application.Auth;
using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Auditing;
using Csps.Domain.Content;
using NSubstitute;

namespace Csps.Application.UnitTests.Content;

/// <summary>
/// D-26, AUDIT-01: removing the share picture clears the five columns, queues the file in the same save, writes one audit entry without
/// the address, and answers 404 when no picture is set. A busy lock and a lost race answer busy.
/// </summary>
public sealed class RemoveSharePictureHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 9, 0, 0, TimeSpan.Zero);
    private const string StoredId = "csps-test/content/share/00000000-0000-0000-0000-000000000001/oldoldoldoldoldoldoldold2";

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    [Fact]
    public async Task APictureIsClearedItsFileIsQueuedInTheSameTransactionAndTheChangeIsAudited()
    {
        var harness = new Harness(withPicture: true);
        var queuedInsideTransaction = false;
        harness.Queue.When(queue => queue.Enqueue(Arg.Any<string>(), Arg.Any<ImageDeletionReason>())).Do(_ => queuedInsideTransaction = harness.Unit.InTransaction);

        var result = await harness.Handler.HandleAsync(Token);

        result.IsSuccess.ShouldBeTrue();
        (harness.Settings.SharePicturePublicId, harness.Settings.SharePictureWidth, harness.Settings.SharePictureFormat).ShouldBe((null, null, null));
        harness.Queue.Received(1).Enqueue(StoredId, ImageDeletionReason.PhotoDeleted);
        queuedInsideTransaction.ShouldBeTrue();
        harness.Unit.Commits.ShouldBe(1);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        (entry.Action, entry.TargetType, entry.TargetId, entry.Detail).ShouldBe((AuditActions.SharePictureChanged, "SiteSettings", "1", "change=removed"));
        entry.Detail!.ShouldNotContain(StoredId);
    }

    [Fact]
    public async Task WithNoPictureTheAnswerIsNotFoundAndNothingIsQueuedOrAudited()
    {
        var harness = new Harness(withPicture: false);

        var result = await harness.Handler.HandleAsync(Token);

        result.Error.ShouldBe(SiteContentErrors.SharePictureNotFound);
        harness.Queue.DidNotReceive().Enqueue(Arg.Any<string>(), Arg.Any<ImageDeletionReason>());
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ARemovalThatCannotGetTheSiteContentLockAnswersBusy()
    {
        var harness = new Harness(withPicture: true);
        harness.SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(Task.FromException(new SiteContentBusyException()));

        var result = await harness.Handler.HandleAsync(Token);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
        harness.Queue.DidNotReceive().Enqueue(Arg.Any<string>(), Arg.Any<ImageDeletionReason>());
    }

    [Fact]
    public async Task ASaveThatLosesARaceTwiceAnswersBusy()
    {
        var harness = new Harness(withPicture: true);
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(Token);

        result.Error.ShouldBe(AuthErrors.SessionBusy);
    }

    private sealed class Harness
    {
        public Harness(bool withPicture)
        {
            var store = Substitute.For<ISiteContentStore>();

            // Every attempt loads the row afresh, as the real unit of work does after a lost race: a change of the first attempt is gone.
            store.GetSettingsForUpdateAsync(Arg.Any<CancellationToken>()).Returns(_ =>
            {
                Settings = SiteSettings.CreateDefault(Now);
                if (withPicture)
                {
                    Settings.SetSharePicture(new LinePhotoFile(StoredId, 1200, 630, 90_000, "jpg"));
                }

                return Task.FromResult(new SiteSettingsForUpdate(Settings, []));
            });
            SiteLock = Substitute.For<ISiteContentLock>();
            SiteLock.TakeAsync(Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
            Queue = Substitute.For<IImageDeletionQueue>();
            Handler = new RemoveSharePictureHandler(store, SiteLock, Audit, Unit, Queue);
        }

        public SiteSettings Settings { get; private set; } = null!;

        public ISiteContentLock SiteLock { get; }

        public IImageDeletionQueue Queue { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public RemoveSharePictureHandler Handler { get; }
    }
}

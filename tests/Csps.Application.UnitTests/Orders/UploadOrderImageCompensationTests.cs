using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Images;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using Csps.Domain.Time;
using Csps.Testing.Images;
using NSubstitute;

namespace Csps.Application.UnitTests.Orders;

/// <summary>
/// IMG-01, JOB-02: once the file has reached storage, any way the photo row fails to save queues the file for removal as UploadUndone
/// on its own context, and a refusal before storage queues nothing. A failing queue write never replaces the original answer.
/// </summary>
public sealed class UploadOrderImageCompensationTests
{
    private const string OrderNumber = "ORD-2026-0148";
    private static readonly DateTimeOffset Now = new(2026, 11, 3, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 11, 3);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly byte[] Photo = SyntheticImages.Jpeg(640, 480);

    [Fact]
    public async Task AFileStoredThenAnOrderThatCannotTakeItQueuesTheFileAsUploadUndoneOnceAndKeepsTheOriginalAnswer()
    {
        var harness = new Harness();
        var cancelled = Harness.NewOrder();
        cancelled.ChangeStatus(OrderStatus.Cancelled, CallerId, Now).IsSuccess.ShouldBeTrue();
        harness.Orders.FindAsync(harness.Order.Id, false, Arg.Any<CancellationToken>()).Returns(
            Task.FromResult<Order?>(harness.Order),
            Task.FromResult<Order?>(cancelled));

        var result = await harness.Handler.HandleAsync(harness.Order.Id, new UploadOrderImageRequest(Photo, "p.jpg", null), TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe(OrderRules.LockedCode);
        harness.Queue.Calls.Select(call => call.Reason).ShouldBe([ImageDeletionReason.UploadUndone]);
        harness.Queue.Calls[0].PublicId.ShouldBe(harness.StoredIds.ShouldHaveSingleItem());
    }

    [Fact]
    public async Task ASaveThatThrowsAfterTheFileWasStoredQueuesTheFileAndLetsTheErrorThrough()
    {
        var harness = new Harness();
        harness.Unit.ThrowOnSave(new InvalidOperationException("The database went away."));

        var error = await Should.ThrowAsync<InvalidOperationException>(
            () => harness.Handler.HandleAsync(harness.Order.Id, new UploadOrderImageRequest(Photo, "p.jpg", null), TestContext.Current.CancellationToken));

        error.Message.ShouldBe("The database went away.");
        harness.Queue.Calls.Select(call => call.Reason).ShouldBe([ImageDeletionReason.UploadUndone]);
        harness.Queue.Calls[0].PublicId.ShouldBe(harness.StoredIds.ShouldHaveSingleItem());
    }

    [Fact]
    public async Task ARequestCancelledAfterTheFileWasStoredStillQueuesTheFileWithATokenThatIsNotCancelled()
    {
        var harness = new Harness();
        using var source = new CancellationTokenSource();
        harness.Unit.ThrowOnSave(new OperationCanceledException(source.Token));
        await source.CancelAsync();

        await Should.ThrowAsync<OperationCanceledException>(
            () => harness.Handler.HandleAsync(harness.Order.Id, new UploadOrderImageRequest(Photo, "p.jpg", null), source.Token));

        harness.Queue.Calls.Count.ShouldBe(1);
        harness.Queue.Calls[0].TokenWasCancelled.ShouldBeFalse();
    }

    [Fact]
    public async Task AQueueWriteThatFailsDoesNotReplaceTheOriginalAnswer()
    {
        var harness = new Harness();
        harness.Queue.FailWith(new InvalidOperationException("The queue could not be written."));
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, new UploadOrderImageRequest(Photo, "p.jpg", null), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(EditErrors.Stale);
        harness.Queue.Calls.Count.ShouldBe(1);
    }

    [Fact]
    public async Task ASuccessfulUploadQueuesNothing()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Order.Id, new UploadOrderImageRequest(Photo, "p.jpg", null), TestContext.Current.CancellationToken);

        harness.Unit.Commits.ShouldBe(1);
        harness.Order.Images.Count.ShouldBe(1);
        harness.Queue.Calls.ShouldBeEmpty();
        result.ShouldNotBeNull();
    }

    [Fact]
    public async Task AFileTheStorageRefusedQueuesNothingBecauseNothingWasStored()
    {
        var harness = new Harness();
        harness.Storage.UploadAsync(Arg.Any<ImageUpload>(), Arg.Any<CancellationToken>()).Returns(ImageUploadOutcome.Failed("transient"));

        var result = await harness.Handler.HandleAsync(harness.Order.Id, new UploadOrderImageRequest(Photo, "p.jpg", null), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ImageErrors.StorageFailed);
        harness.Queue.Calls.ShouldBeEmpty();
    }

    [Fact]
    public async Task AnUploadRefusedBeforeTheStorageQueuesNothing()
    {
        var harness = new Harness();

        var empty = await harness.Handler.HandleAsync(harness.Order.Id, new UploadOrderImageRequest(ReadOnlyMemory<byte>.Empty, null, null), TestContext.Current.CancellationToken);
        var notAPhoto = await harness.Handler.HandleAsync(harness.Order.Id, new UploadOrderImageRequest(SyntheticImages.Svg(), "p.jpg", null), TestContext.Current.CancellationToken);

        empty.IsFailure.ShouldBeTrue();
        notAPhoto.IsFailure.ShouldBeTrue();
        harness.StoredIds.ShouldBeEmpty();
        harness.Queue.Calls.ShouldBeEmpty();
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Now));
    }

    private sealed class RecordingQueue : IImageDeletionQueue
    {
        private Exception? _failure;

        public List<(string PublicId, ImageDeletionReason Reason, bool TokenWasCancelled)> Calls { get; } = [];

        public void FailWith(Exception failure) => _failure = failure;

        public void Enqueue(string publicId, ImageDeletionReason reason) =>
            throw new NotSupportedException("A failed upload must queue on its own context.");

        public Task EnqueueNowAsync(string publicId, ImageDeletionReason reason, CancellationToken cancellationToken)
        {
            Calls.Add((publicId, reason, cancellationToken.IsCancellationRequested));
            return _failure is null ? Task.CompletedTask : Task.FromException(_failure);
        }

        public Task EnqueueManyNowAsync(IReadOnlyCollection<string> publicIds, ImageDeletionReason reason, CancellationToken cancellationToken) =>
            throw new NotSupportedException("An upload never queues in bulk.");

        public Task<IReadOnlyList<QueuedRemoval>> ClaimDueAsync(Guid holder, DateTimeOffset now, TimeSpan lease, int max, CancellationToken cancellationToken) =>
            throw new NotSupportedException("Only the removal job claims rows.");

        public Task CompleteAsync(long id, Guid holder, CancellationToken cancellationToken) =>
            throw new NotSupportedException("Only the removal job completes rows.");

        public Task FailAsync(long id, Guid holder, string failureCode, DateTimeOffset now, CancellationToken cancellationToken) =>
            throw new NotSupportedException("Only the removal job fails rows.");

        public Task ReleaseAsync(IReadOnlyCollection<long> ids, Guid holder, CancellationToken cancellationToken) =>
            throw new NotSupportedException("Only the removal job releases rows.");
    }

    private sealed class Harness
    {
        public Harness()
        {
            Order = NewOrder();
            Orders = Substitute.For<IOrders>();
            Orders.FindAsync(Order.Id, false, Arg.Any<CancellationToken>()).Returns(Task.FromResult<Order?>(Order));
            Storage = Substitute.For<IImageStorage>();
            Storage.IsConfigured.Returns(true);
            Storage.RootFolder.Returns("csps-test");
            Storage.UploadAsync(Arg.Any<ImageUpload>(), Arg.Any<CancellationToken>()).Returns(call =>
            {
                StoredIds.Add(call.Arg<ImageUpload>().PublicId);
                return Task.FromResult(ImageUploadOutcome.Stored);
            });
            var calendar = new FixedCalendar();
            var reader = Substitute.For<IOrderReader>();
            reader.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult<OrderDetailResponse?>(null));
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(CallerId);
            Handler = new UploadOrderImageHandler(Orders, reader, calendar, Substitute.For<IAuditTrail>(), Unit, request, Storage, Queue, new ImageUploadSettings());
        }

        public Order Order { get; }

        public IOrders Orders { get; }

        public IImageStorage Storage { get; }

        public FakeUnitOfWork Unit { get; } = new();

        public RecordingQueue Queue { get; } = new();

        public List<string> StoredIds { get; } = [];

        public UploadOrderImageHandler Handler { get; }

        public static Order NewOrder()
        {
            var items = new[] { new NewOrderItem(Guid.NewGuid(), "Jersey top", "S-XL", 15, 650.00m) };
            var details = new OrderDetails("Juan Dela Cruz", "Brgy. San Roque Ballers", "0917 123 4567", "juan.dc@example.com", "Brgy. San Roque", Today, Today.AddDays(14), "rush job");
            var order = Order.Create(new NewOrder(details, OrderStatus.Pending, items), CallerId, Now, Today).Value;
            order.AssignNumber(OrderNumber);
            return order;
        }
    }
}

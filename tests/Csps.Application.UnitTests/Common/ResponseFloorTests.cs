using Csps.Application.Common;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Application.UnitTests.Common;

/// <summary>CWE-204, D-39: the floor never lets a response finish early, even when a timer fires early.</summary>
public sealed class ResponseFloorTests
{
    private static readonly TimeSpan Floor = TimeSpan.FromMilliseconds(500);

    [Fact]
    public async Task WaitsForTheWholeFloorWhenNoTimeHasPassed()
    {
        var time = new FakeTimeProvider();
        var started = time.GetTimestamp();

        var wait = ResponseFloor.WaitAsync(started, Floor, time, TestContext.Current.CancellationToken);
        time.Advance(TimeSpan.FromMilliseconds(499));
        wait.IsCompleted.ShouldBeFalse();
        time.Advance(TimeSpan.FromMilliseconds(1));

        await wait;
    }

    [Fact]
    public async Task OnlyWaitsForTheRestOfTheFloor()
    {
        var time = new FakeTimeProvider();
        var started = time.GetTimestamp();
        time.Advance(TimeSpan.FromMilliseconds(300));

        var wait = ResponseFloor.WaitAsync(started, Floor, time, TestContext.Current.CancellationToken);
        time.Advance(TimeSpan.FromMilliseconds(199));
        wait.IsCompleted.ShouldBeFalse();
        time.Advance(TimeSpan.FromMilliseconds(1));

        await wait;
    }

    [Fact]
    public async Task DoesNotWaitWhenTheWorkAlreadyTookLongerThanTheFloor()
    {
        var time = new FakeTimeProvider();
        var started = time.GetTimestamp();
        time.Advance(TimeSpan.FromMilliseconds(800));

        await ResponseFloor.WaitAsync(started, Floor, time, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task WaitsAgainWhenTheTimerFiresEarly()
    {
        var time = new EarlyFirstTimerProvider(TimeSpan.FromMilliseconds(10));
        var started = time.GetTimestamp();

        var wait = ResponseFloor.WaitAsync(started, Floor, time, TestContext.Current.CancellationToken);
        time.Advance(TimeSpan.FromMilliseconds(490));
        wait.IsCompleted.ShouldBeFalse("the first timer fired 10 ms early, so 10 ms of the floor are left");
        time.Advance(TimeSpan.FromMilliseconds(10));

        await wait;
    }

    [Fact]
    public async Task AnAlreadyCancelledTokenStopsTheWait()
    {
        var time = new FakeTimeProvider();
        using var cancellation = new CancellationTokenSource();
        await cancellation.CancelAsync();

        await Should.ThrowAsync<OperationCanceledException>(
            () => ResponseFloor.WaitAsync(time.GetTimestamp(), Floor, time, cancellation.Token));
    }

    [Fact]
    public void ATimeProviderIsRequired() =>
        Should.Throw<ArgumentNullException>(() => ResponseFloor.WaitAsync(0, Floor, null!, TestContext.Current.CancellationToken));

    // A clock whose first timer fires a little before it is due, as .NET timers can on Windows (coarse tick).
    private sealed class EarlyFirstTimerProvider(TimeSpan early) : TimeProvider
    {
        private readonly FakeTimeProvider _inner = new();
        private bool _firstTimerCreated;

        public override long TimestampFrequency => _inner.TimestampFrequency;

        public override DateTimeOffset GetUtcNow() => _inner.GetUtcNow();

        public override long GetTimestamp() => _inner.GetTimestamp();

        public void Advance(TimeSpan by) => _inner.Advance(by);

        public override ITimer CreateTimer(TimerCallback callback, object? state, TimeSpan dueTime, TimeSpan period)
        {
            if (_firstTimerCreated)
            {
                return _inner.CreateTimer(callback, state, dueTime, period);
            }

            _firstTimerCreated = true;
            return _inner.CreateTimer(callback, state, dueTime - early, period);
        }
    }
}

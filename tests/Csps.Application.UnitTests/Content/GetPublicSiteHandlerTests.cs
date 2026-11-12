using Csps.Application.Content;
using Csps.Application.Ports;
using NSubstitute;
using NSubstitute.Core;

namespace Csps.Application.UnitTests.Content;

/// <summary>PUB-02: the public site use case returns the cached snapshot as it is and never hides a reader failure.</summary>
public sealed class GetPublicSiteHandlerTests
{
    private static readonly PublicSiteSnapshot Snapshot = new(
        new PublicSiteDto(
            "Sample Shop",
            "A sample tagline.",
            null,
            null,
            new PublicAddressDto(null, null, null, null),
            [],
            null,
            null,
            null,
            null,
            null,
            null,
            2026,
            [],
            []),
        new PublicJsonSnapshot("{}", "\"abc\"", new DateTimeOffset(2026, 11, 11, 0, 0, 0, TimeSpan.Zero)));

    [Fact]
    public async Task ReturnsTheCachedSnapshotUnchanged()
    {
        var handler = new GetPublicSiteHandler(Reader(_ => ValueTask.FromResult(Snapshot)));

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBeSameAs(Snapshot);
    }

    [Fact]
    public async Task PassesTheCancellationTokenToTheReader()
    {
        var reader = Reader(_ => ValueTask.FromResult(Snapshot));
        var handler = new GetPublicSiteHandler(reader);
        using var cancellation = new CancellationTokenSource();

        await handler.HandleAsync(cancellation.Token);

        await reader.Received(1).GetSiteAsync(cancellation.Token);
    }

    [Fact]
    public async Task AReaderFailurePropagates()
    {
        var handler = new GetPublicSiteHandler(Reader(_ => ValueTask.FromException<PublicSiteSnapshot>(new InvalidOperationException("reader failed"))));

        var error = await Should.ThrowAsync<InvalidOperationException>(() => handler.HandleAsync(TestContext.Current.CancellationToken));

        error.Message.ShouldBe("reader failed");
    }

    private static IPublicContentReader Reader(Func<CallInfo, ValueTask<PublicSiteSnapshot>> result)
    {
        var reader = Substitute.For<IPublicContentReader>();
#pragma warning disable CA2012 // NSubstitute only records the call here; the arranged ValueTask is consumed once, by the handler.
        reader.GetSiteAsync(Arg.Any<CancellationToken>()).Returns(result);
#pragma warning restore CA2012
        return reader;
    }
}

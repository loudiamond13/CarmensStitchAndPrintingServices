using Csps.Application.Content;
using Csps.Application.Ports;
using NSubstitute;
using NSubstitute.Core;

namespace Csps.Application.UnitTests.Content;

/// <summary>GAL-01: the Gallery use case returns the cached snapshot as it is and never hides a reader failure.</summary>
public sealed class GetPublicGalleryHandlerTests
{
    private static readonly PublicGallerySnapshot Snapshot = new(
        new PublicGalleryDto([], [], 0),
        new PublicJsonSnapshot("{\"items\":[],\"pills\":[],\"total\":0}", "\"abc\"", new DateTimeOffset(2026, 11, 12, 0, 0, 0, TimeSpan.Zero)));

    [Fact]
    public async Task ReturnsTheCachedSnapshotUnchangedAndPassesTheCancellationToken()
    {
        var reader = Reader(_ => ValueTask.FromResult(Snapshot));
        using var cancellation = new CancellationTokenSource();

        var result = await new GetPublicGalleryHandler(reader).HandleAsync(cancellation.Token);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBeSameAs(Snapshot);
        await reader.Received(1).GetGalleryAsync(cancellation.Token);
    }

    [Fact]
    public async Task AReaderFailurePropagates()
    {
        var reader = Reader(_ => ValueTask.FromException<PublicGallerySnapshot>(new InvalidOperationException("reader failed")));

        var error = await Should.ThrowAsync<InvalidOperationException>(() => new GetPublicGalleryHandler(reader).HandleAsync(TestContext.Current.CancellationToken));

        error.Message.ShouldBe("reader failed");
    }

    private static IPublicContentReader Reader(Func<CallInfo, ValueTask<PublicGallerySnapshot>> result)
    {
        var reader = Substitute.For<IPublicContentReader>();
#pragma warning disable CA2012 // NSubstitute only records the call here; the arranged ValueTask is consumed once, by the handler.
        reader.GetGalleryAsync(Arg.Any<CancellationToken>()).Returns(result);
#pragma warning restore CA2012
        return reader;
    }
}

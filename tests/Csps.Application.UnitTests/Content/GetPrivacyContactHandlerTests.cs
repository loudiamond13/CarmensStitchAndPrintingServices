using Csps.Application.Content;
using Csps.Application.Ports;
using NSubstitute;

namespace Csps.Application.UnitTests.Content;

/// <summary>D-13, D-29: the privacy contact use case returns the stored Contact email, or null when none is stored.</summary>
public sealed class GetPrivacyContactHandlerTests
{
    [Fact]
    public async Task ReturnsTheStoredContactEmail()
    {
        var handler = new GetPrivacyContactHandler(Reader("shop-private@example.test"));

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Email.ShouldBe("shop-private@example.test");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task AnEmptyStoredValueIsNull(string stored)
    {
        var handler = new GetPrivacyContactHandler(Reader(stored));

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Email.ShouldBeNull();
    }

    [Fact]
    public async Task PassesTheCancellationTokenToTheReader()
    {
        var reader = Reader("shop-private@example.test");
        var handler = new GetPrivacyContactHandler(reader);
        using var cancellation = new CancellationTokenSource();

        await handler.HandleAsync(cancellation.Token);

        await reader.Received(1).GetAsync(cancellation.Token);
    }

    [Fact]
    public async Task AReaderFailurePropagates()
    {
        var reader = Substitute.For<ISiteSettingsReader>();
#pragma warning disable CA2012 // NSubstitute only records the call here; the arranged ValueTask is consumed once, by the handler.
        reader.GetAsync(Arg.Any<CancellationToken>()).Returns(_ => ValueTask.FromException<SiteSettingsSnapshot>(new InvalidOperationException("reader failed")));
#pragma warning restore CA2012
        var handler = new GetPrivacyContactHandler(reader);

        var error = await Should.ThrowAsync<InvalidOperationException>(() => handler.HandleAsync(TestContext.Current.CancellationToken));

        error.Message.ShouldBe("reader failed");
    }

    private static ISiteSettingsReader Reader(string contactEmail)
    {
        var snapshot = new SiteSettingsSnapshot("Sample Shop", "Asia/Manila", "PHP", "en-PH", contactEmail, string.Empty, string.Empty, string.Empty, "AAAA");
        var reader = Substitute.For<ISiteSettingsReader>();
#pragma warning disable CA2012 // NSubstitute only records the call here; the arranged ValueTask is consumed once, by the handler.
        reader.GetAsync(Arg.Any<CancellationToken>()).Returns(_ => ValueTask.FromResult(snapshot));
#pragma warning restore CA2012
        return reader;
    }
}

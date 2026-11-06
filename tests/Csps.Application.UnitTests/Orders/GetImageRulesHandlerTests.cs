using Csps.Application.Auth;
using Csps.Application.Images;
using Csps.Application.Orders;
using Csps.Application.Ports;
using NSubstitute;

namespace Csps.Application.UnitTests.Orders;

/// <summary>ORD-04, IMG-02, OR-3: the rules come from the domain and the configured upload limits; no caller ends the session.</summary>
public sealed class GetImageRulesHandlerTests
{
    [Fact]
    public async Task TheRulesCarryTheDomainLimitsAndTheConfiguredUploadLimits()
    {
        var settings = new ImageUploadSettings { MaxBytes = 4_000_000, MaxPixels = 12_000_000, MaxSide = 6_000 };

        var result = await Handler(settings).HandleAsync(TestContext.Current.CancellationToken);

        var rules = result.Value;
        rules.MaxPerOrder.ShouldBe(5);
        rules.MaxBytes.ShouldBe(4_000_000);
        rules.MaxPixels.ShouldBe(12_000_000);
        rules.MaxSide.ShouldBe(6_000);
        rules.Types.ShouldBe(["jpeg", "png", "webp", "heic"]);
        rules.DescriptionMaxLength.ShouldBe(200);
    }

    [Fact]
    public async Task WithNoCallerTheSessionHasEnded()
    {
        var result = await Handler(new ImageUploadSettings(), noCaller: true).HandleAsync(TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
    }

    private static GetImageRulesHandler Handler(ImageUploadSettings settings, bool noCaller = false)
    {
        var context = Substitute.For<IRequestContext>();
        context.UserId.Returns(noCaller ? null : Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43"));
        return new GetImageRulesHandler(settings, context);
    }
}

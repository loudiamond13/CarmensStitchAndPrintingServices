using Csps.Application.Images;
using Csps.Application.Maintenance;
using Csps.Application.Ports;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Maintenance;

/// <summary>JOB-01, JOB-02, D-24, D-36: every run says how full the free Cloudinary plan is, and turns red above 80%.</summary>
public sealed class CloudinaryUsageJobTests
{
    private const string StorageLabel = "Cloudinary storage used";
    private const string CreditsLabel = "Cloudinary credits this month";
    private const string OverEightyText = "Over 80% of the free Cloudinary plan. Check usage before it runs out.";
    private const string LimitText = "The Cloudinary plan's photo size limit is below the app's upload limit. Lower Images:MaxBytes.";
    private const string UnreadableText = "Cloudinary usage could not be read.";
    private const string NotCheckedLabel = "Cloudinary usage not checked";
    private const string NotCheckedText = "photo storage is not set up.";
    private const long OneAndAHalfGigabytes = 1_610_612_736;
    private const long FiveMegabytes = 5_242_880;

    private static StorageUsage Usage(double creditsPercent = 20.8, double storagePercent = 10, long storageBytes = OneAndAHalfGigabytes, double used = 5.2, double limit = 25, long imageMax = 0) =>
        new(storagePercent, creditsPercent, storageBytes, used, limit, imageMax);

    private static async Task<IReadOnlyList<MaintenanceLine>> RunAsync(StorageUsage usage, int maxBytes = ImageUploadLimits.MaxFileBytes)
    {
        var storage = Substitute.For<IImageStorage>();
        storage.IsConfigured.Returns(true);
        storage.GetUsageAsync(Arg.Any<CancellationToken>()).Returns(usage);
        return await RunAsync(storage, maxBytes);
    }

    private static async Task<IReadOnlyList<MaintenanceLine>> RunAsync(IImageStorage storage, int maxBytes = ImageUploadLimits.MaxFileBytes, IMaintenanceJobLog? log = null)
    {
        var job = new CloudinaryUsageJob(storage, new ImageUploadSettings { MaxBytes = maxBytes }, log ?? Substitute.For<IMaintenanceJobLog>());
        var report = await job.RunAsync(new MaintenanceBudget(new FakeTimeProvider()), TestContext.Current.CancellationToken);
        report.More.ShouldBeFalse();
        return report.Lines;
    }

    [Fact]
    public void TheJobRunsLastInThePassAsOrder40()
    {
        var job = new CloudinaryUsageJob(Substitute.For<IImageStorage>(), new ImageUploadSettings(), Substitute.For<IMaintenanceJobLog>());

        job.Order.ShouldBe(40);
        job.Name.ShouldBe("cloudinary-usage");
    }

    [Fact]
    public async Task StorageIsReportedInGigabytesWithTwoDecimals()
    {
        var lines = await RunAsync(Usage());

        var line = lines.Single(candidate => candidate.Label == StorageLabel);
        line.Text.ShouldBe("1.50 GB");
        line.Value.ShouldBeNull();
        line.Failed.ShouldBeFalse();
    }

    [Fact]
    public async Task CreditsAreReportedAsUsedOfLimitWithThePercent()
    {
        var lines = await RunAsync(Usage());

        var line = lines.Single(candidate => candidate.Label == CreditsLabel);
        line.Text.ShouldBe("5.2 of 25 (20.8%)");
        line.Failed.ShouldBeFalse();
        lines.ShouldAllBe(candidate => !candidate.Failed);
    }

    [Fact]
    public async Task EightyPercentExactlyIsNotRed()
    {
        var lines = await RunAsync(Usage(creditsPercent: 80.0));

        lines.ShouldAllBe(candidate => !candidate.Failed);
        lines.ShouldNotContain(candidate => candidate.Text == OverEightyText);
    }

    [Fact]
    public async Task EightyPointZeroOnePercentOfCreditsIsRed()
    {
        var lines = await RunAsync(Usage(creditsPercent: 80.01));

        var failed = lines.Single(candidate => candidate.Failed);
        failed.Text.ShouldBe(OverEightyText);
    }

    [Fact]
    public async Task EightyPointZeroOnePercentOfStorageIsAlsoRed()
    {
        var lines = await RunAsync(Usage(creditsPercent: 10, storagePercent: 80.01));

        lines.Single(candidate => candidate.Failed).Text.ShouldBe(OverEightyText);
    }

    [Fact]
    public async Task NinetyPercentIsRedAndTenPercentIsNot()
    {
        (await RunAsync(Usage(creditsPercent: 90))).ShouldContain(candidate => candidate.Failed);
        (await RunAsync(Usage(creditsPercent: 10))).ShouldNotContain(candidate => candidate.Failed);
    }

    [Fact]
    public async Task APlanPhotoLimitBelowTheUploadLimitIsRed()
    {
        var lines = await RunAsync(Usage(imageMax: FiveMegabytes), maxBytes: 10_485_760);

        lines.Single(candidate => candidate.Failed).Text.ShouldBe(LimitText);
    }

    [Theory]
    [InlineData(0, 10_485_760)]
    [InlineData(FiveMegabytes, FiveMegabytes)]
    [InlineData(10_485_760, FiveMegabytes)]
    public async Task AnUnknownOrSufficientPlanLimitIsNotRed(long imageMax, int maxBytes)
    {
        var lines = await RunAsync(Usage(imageMax: imageMax), maxBytes);

        lines.ShouldAllBe(candidate => !candidate.Failed);
    }

    [Theory]
    [InlineData("transient")]
    [InlineData("unauthorized")]
    [InlineData("refused")]
    public async Task UsageThatCannotBeReadIsRedWithOneFixedSentence(string code)
    {
        var storage = Substitute.For<IImageStorage>();
        storage.IsConfigured.Returns(true);
        storage.GetUsageAsync(Arg.Any<CancellationToken>()).Returns<Task<StorageUsage>>(_ => throw new ImageStorageException(code));

        var log = Substitute.For<IMaintenanceJobLog>();

        var lines = await RunAsync(storage, log: log);

        var failed = lines.Single(candidate => candidate.Failed);
        failed.Text.ShouldBe(UnreadableText);
        log.Received(1).StorageReadFailed("cloudinary-usage", code);
        lines.ShouldNotContain(candidate => candidate.Label == StorageLabel);
    }

    [Fact]
    public async Task StorageThatIsNotSetUpGivesAPlainLineAndNoFailureAndNoCall()
    {
        var storage = Substitute.For<IImageStorage>();
        storage.IsConfigured.Returns(false);

        var lines = await RunAsync(storage);

        var line = lines.ShouldHaveSingleItem();
        line.Label.ShouldBe(NotCheckedLabel);
        line.Text.ShouldBe(NotCheckedText);
        line.Failed.ShouldBeFalse();
        await storage.DidNotReceive().GetUsageAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task NoLineEverHoldsAnAddressACloudNameOrAKey()
    {
        var lines = await RunAsync(Usage(creditsPercent: 95, imageMax: FiveMegabytes), maxBytes: 10_485_760);

        lines.SelectMany(line => new[] { line.Label, line.Text ?? string.Empty }).ShouldAllBe(text => !text.Contains("http", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task CancellationIsNotSwallowed()
    {
        using var cancelled = new CancellationTokenSource();
        await cancelled.CancelAsync();
        var storage = Substitute.For<IImageStorage>();
        storage.IsConfigured.Returns(true);
        storage.GetUsageAsync(Arg.Any<CancellationToken>()).Returns<Task<StorageUsage>>(_ => throw new OperationCanceledException(cancelled.Token));
        var job = new CloudinaryUsageJob(storage, new ImageUploadSettings(), Substitute.For<IMaintenanceJobLog>());

        await Should.ThrowAsync<OperationCanceledException>(() => job.RunAsync(new MaintenanceBudget(new FakeTimeProvider()), cancelled.Token));
    }
}

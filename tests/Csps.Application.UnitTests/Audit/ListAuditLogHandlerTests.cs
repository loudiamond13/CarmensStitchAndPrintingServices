using Csps.Application.Audit;
using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Audit;

/// <summary>AUDIT-02, D-26 to D-28, D-40, USER-06: the audit query is checked, the default range is 7 business days, and done-by follows one rule.</summary>
public sealed class ListAuditLogHandlerTests
{
    // 2026-10-19 04:30 in the fixed UTC+8 zone, so the business day differs from the UTC day.
    private static readonly DateTimeOffset Now = new(2026, 10, 18, 20, 30, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly ActorRef Ana = new(Guid.NewGuid(), "Ana Abad", false);
    private static readonly ActorRef Bea = new(Guid.NewGuid(), "Bea Bautista", true);

    [Fact]
    public async Task WithNoDatesTheRangeIsTodayAndTheSixBusinessDaysBeforeIt()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListAuditLogRequest(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        // Business today is Oct 19, so the range starts at 00:00 on Oct 13 and ends at 00:00 on Oct 20 (Manila time).
        var expectedStart = new DateTimeOffset(2026, 10, 12, 16, 0, 0, TimeSpan.Zero);
        var expectedEnd = new DateTimeOffset(2026, 10, 19, 16, 0, 0, TimeSpan.Zero);
        await harness.Reader.Received(1).ListAsync(new AuditLogQuery(expectedStart, expectedEnd, 1, 20), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ThePageAndTheCountsAreEchoedBack()
    {
        var harness = new Harness(new AuditLogPage([], 41));

        var result = await harness.Handler.HandleAsync(new ListAuditLogRequest(3, 50), TestContext.Current.CancellationToken);

        result.Value.Items.ShouldBeEmpty();
        (result.Value.Total, result.Value.Page, result.Value.PageSize).ShouldBe((41, 3, 50));
        await harness.Reader.Received(1).ListAsync(Arg.Is<AuditLogQuery>(query => query.Page == 3 && query.PageSize == 50), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(0, 20, "page", ListAuditLogRequestValidator.PageInvalid)]
    [InlineData(-3, 20, "page", ListAuditLogRequestValidator.PageInvalid)]
    [InlineData(100_001, 20, "page", ListAuditLogRequestValidator.PageInvalid)]
    [InlineData(1, 0, "pageSize", "Use a page size from 1 to 100.")]
    [InlineData(1, 101, "pageSize", "Use a page size from 1 to 100.")]
    public async Task ABadPageOrSizeIsA400NamingTheFieldAndTheLogIsNeverRead(int page, int pageSize, string field, string message)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListAuditLogRequest(page, pageSize), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe(AuthErrors.ValidationCode);
        result.Error.FieldErrors.ShouldNotBeNull()[field].ShouldBe([message]);
        await harness.Reader.DidNotReceiveWithAnyArgs().ListAsync(null!, TestContext.Current.CancellationToken);
    }

    [Theory]
    [InlineData(1, 1)]
    [InlineData(100_000, 100)]
    public async Task TheEdgesOfThePageAndSizeRangesAreAccepted(int page, int pageSize)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListAuditLogRequest(page, pageSize), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public async Task ANullRequestIsRefusedBeforeAnythingIsRead()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Handler.HandleAsync(null!, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task TheSignedInActorDidItEvenForASelfServiceCode()
    {
        var entry = Entry(AuditActions.PasswordChanged, actor: Ana, targetType: "User", target: Bea);
        var harness = new Harness(new AuditLogPage([entry], 1));

        var item = (await harness.Handler.HandleAsync(new ListAuditLogRequest(), TestContext.Current.CancellationToken)).Value.Items.Single();

        item.DoneBy.ShouldBe(new DoneBy(DoneByKinds.User, Ana));
        item.DoneTo.ShouldBe(Bea);
    }

    [Theory]
    [InlineData(AuditActions.SignedIn, "UserSession")]
    [InlineData(AuditActions.TwoFactorVerified, "User")]
    [InlineData(AuditActions.PasswordResetCompleted, "User")]
    [InlineData(AuditActions.InviteAccepted, "User")]
    [InlineData(AuditActions.ProfileEmailChanged, "User")]
    public async Task ASelfServiceEntryWithNoActorWasDoneByThePersonItIsAbout(string action, string targetType)
    {
        var entry = Entry(action, targetType: targetType, target: Ana);
        var harness = new Harness(new AuditLogPage([entry], 1));

        var item = (await harness.Handler.HandleAsync(new ListAuditLogRequest(), TestContext.Current.CancellationToken)).Value.Items.Single();

        item.DoneBy.ShouldBe(new DoneBy(DoneByKinds.User, Ana));
        item.DoneTo.ShouldBe(Ana);
    }

    [Fact]
    public async Task AFailedSignInWithNoAccountIsAnUnknownAccount()
    {
        var entry = Entry(AuditActions.SignInFailed, detail: "unknown-account");
        var harness = new Harness(new AuditLogPage([entry], 1));

        var item = (await harness.Handler.HandleAsync(new ListAuditLogRequest(), TestContext.Current.CancellationToken)).Value.Items.Single();

        item.DoneBy.ShouldBe(new DoneBy(DoneByKinds.UnknownAccount, null));
        item.DoneTo.ShouldBeNull();
        item.Detail.ShouldBe("unknown-account");
    }

    [Fact]
    public async Task AFailedSignInForAKnownAccountWasDoneByThatPerson()
    {
        var entry = Entry(AuditActions.SignInFailed, targetType: "User", target: Ana, detail: "bad-password");
        var harness = new Harness(new AuditLogPage([entry], 1));

        var item = (await harness.Handler.HandleAsync(new ListAuditLogRequest(), TestContext.Current.CancellationToken)).Value.Items.Single();

        item.DoneBy.ShouldBe(new DoneBy(DoneByKinds.User, Ana));
    }

    [Theory]
    [InlineData(AuditActions.PasswordResetLinkInvalid, null)]
    [InlineData(AuditActions.PasswordResetRequested, null)]
    [InlineData(AuditActions.UserInvited, "User")]
    [InlineData(AuditActions.BootstrapManagerCreated, "User")]
    [InlineData(AuditActions.UserDeactivated, "User")]
    public async Task AnythingElseWithNoActorWasTheSystem(string action, string? targetType)
    {
        var entry = Entry(action, targetType: targetType, target: targetType is null ? null : Bea, detail: "bootstrap");
        var harness = new Harness(new AuditLogPage([entry], 1));

        var item = (await harness.Handler.HandleAsync(new ListAuditLogRequest(), TestContext.Current.CancellationToken)).Value.Items.Single();

        item.DoneBy.ShouldBe(new DoneBy(DoneByKinds.System, null));
    }

    [Fact]
    public async Task AFailedSignInWhoseAccountCannotBeFoundIsTheSystemNotAnUnknownAccount()
    {
        var entry = Entry(AuditActions.SignInFailed, targetType: "User", target: null, detail: "bad-password");
        var harness = new Harness(new AuditLogPage([entry], 1));

        var item = (await harness.Handler.HandleAsync(new ListAuditLogRequest(), TestContext.Current.CancellationToken)).Value.Items.Single();

        item.DoneBy.Kind.ShouldBe(DoneByKinds.System);
    }

    [Theory]
    [InlineData("203.0.113.0", "203.0.113.0/24")]
    [InlineData("2001:db8:abcd::", "2001:db8:abcd::/48")]
    [InlineData(null, null)]
    public async Task TheStoredNetworkIsShownWithItsLength(string? stored, string? shown)
    {
        var entry = Entry(AuditActions.UserActivated, actor: Ana, ip: stored);
        var harness = new Harness(new AuditLogPage([entry], 1));

        var item = (await harness.Handler.HandleAsync(new ListAuditLogRequest(), TestContext.Current.CancellationToken)).Value.Items.Single();

        item.IpPrefix.ShouldBe(shown);
    }

    [Fact]
    public async Task EveryStoredFieldPassesThroughAndNothingIsAdded()
    {
        var entry = Entry(AuditActions.UserRoleChanged, actor: Ana, targetType: "User", target: Bea, detail: "role=admin>manager", ip: "198.51.100.0", device: "Chrome");
        var harness = new Harness(new AuditLogPage([entry], 1));

        var item = (await harness.Handler.HandleAsync(new ListAuditLogRequest(), TestContext.Current.CancellationToken)).Value.Items.Single();

        item.ShouldBe(new AuditLogItem(
            entry.Id, entry.OccurredAt, new DoneBy(DoneByKinds.User, Ana), AuditActions.UserRoleChanged, Bea, "role=admin>manager", "198.51.100.0/24", "Chrome", entry.Reference));
    }

    private static AuditLogEntryView Entry(
        string action,
        ActorRef? actor = null,
        string? targetType = null,
        ActorRef? target = null,
        string? detail = null,
        string? ip = null,
        string? device = null) =>
        new(7, Now.AddMinutes(-3), actor, action, targetType, target, detail, ip, device, new string('a', AuditEntry.CorrelationIdLength));

    private sealed class Harness
    {
        public Harness(AuditLogPage? page = null)
        {
            Reader = Substitute.For<IAuditLogReader>();
            Reader.ListAsync(Arg.Any<AuditLogQuery>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult(page ?? new AuditLogPage([], 0)));
            Handler = new ListAuditLogHandler(Reader, new FixedCalendar(new BusinessClock(Manila, ZoneSource.Stored, Now)), new ListAuditLogRequestValidator());
        }

        public IAuditLogReader Reader { get; }

        public ListAuditLogHandler Handler { get; }
    }

    private sealed class FixedCalendar(BusinessClock clock) : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) => ValueTask.FromResult(clock);
    }
}

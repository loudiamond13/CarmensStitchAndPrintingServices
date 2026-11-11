using Csps.Application.Auth;
using Csps.Application.Money;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.Staff;
using Csps.Domain.Identity;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Money;

/// <summary>MONEY-03, CWE-639, CWE-204: the role is decided from the caller's own account before the requested person is looked up.</summary>
public sealed class StaffMoneyAccessTests
{
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly DateTimeOffset Wednesday = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);
    private static readonly Guid CallerId = Guid.Parse("11111111-1111-4111-8111-111111111111");
    private static readonly Guid OtherId = Guid.Parse("22222222-2222-4222-8222-222222222222");

    [Fact]
    public void AnAdminAskingForAnotherIdIsForbidden()
    {
        var result = StaffMoneyAccess.Check(CallerId, State(CallerId, Roles.Admin), OtherId);

        result.IsFailure.ShouldBeTrue();
        result.Error.ShouldBe(MoneyErrors.Forbidden);
        result.Error.Message.ShouldBe("You can only see your own money.");
    }

    [Fact]
    public void AnAdminAskingForTheirOwnIdPasses() =>
        StaffMoneyAccess.Check(CallerId, State(CallerId, Roles.Admin), CallerId).IsSuccess.ShouldBeTrue();

    [Fact]
    public void AManagerPassesForAnyId()
    {
        var manager = State(CallerId, Roles.Manager);

        StaffMoneyAccess.Check(CallerId, manager, OtherId).IsSuccess.ShouldBeTrue();
        StaffMoneyAccess.Check(CallerId, manager, Guid.NewGuid()).IsSuccess.ShouldBeTrue();
        StaffMoneyAccess.Check(CallerId, manager, CallerId).IsSuccess.ShouldBeTrue();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("Viewer")]
    public void AnAccountThatIsNotAManagerAskingForAnotherIdIsForbidden(string? role)
    {
        StaffMoneyAccess.Check(CallerId, State(CallerId, role), OtherId).Error.ShouldBe(MoneyErrors.Forbidden);
    }

    [Fact]
    public void AnUnknownCallerAskingForAnotherIdIsForbiddenAndForTheirOwnIdPasses()
    {
        StaffMoneyAccess.Check(CallerId, null, OtherId).Error.ShouldBe(MoneyErrors.Forbidden);
        StaffMoneyAccess.Check(CallerId, null, CallerId).IsSuccess.ShouldBeTrue();
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AnAdminAskingForACoworkerOrAMadeUpIdIsRefusedAndNeitherThePersonNorTheirMoneyIsRead(bool coworkerExists)
    {
        var harness = new Harness(Roles.Admin, coworkerExists ? State(OtherId, Roles.Admin) : null);

        var result = await harness.Handler.HandleAsync(OtherId, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(MoneyErrors.Forbidden);
        await harness.Staff.DidNotReceive().GetStaffStateAsync(OtherId, Arg.Any<CancellationToken>());
        await harness.Reader.DidNotReceive().GetSumsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnAdminsOwnIdAnswersWithTheirOwnFigure()
    {
        var harness = new Harness(Roles.Admin, sums: [new StaffMoneySums(CallerId, "Liza Mercado", 900m, 0m, 0m, 0m, 400m, 0m)]);

        var result = await harness.Handler.HandleAsync(CallerId, TestContext.Current.CancellationToken);

        result.Value.ShouldBe(new StaffMoneyResponse(CallerId, "Liza Mercado", "Admin", "active", 500.00m, new DateOnly(2026, 11, 4)));
    }

    [Theory]
    [InlineData(true, false, "active")]
    [InlineData(false, false, "deactivated")]
    [InlineData(false, true, "deleted")]
    [InlineData(true, true, "deleted")]
    public async Task AManagerReadsAnotherStaffMembersFigureWithTheirRoleAndStatus(bool active, bool deleted, string status)
    {
        var other = new StaffState(OtherId, "Jomar Santos", Roles.Admin, active, false, deleted, true);
        var harness = new Harness(Roles.Manager, other, [new StaffMoneySums(OtherId, "Jomar Santos", 0m, 0m, 0m, 0m, 333.33m, 0m)]);

        var result = await harness.Handler.HandleAsync(OtherId, TestContext.Current.CancellationToken);

        result.Value.ShouldBe(new StaffMoneyResponse(OtherId, "Jomar Santos", "Admin", status, -333.33m, new DateOnly(2026, 11, 4)));
    }

    [Fact]
    public async Task AManagerAskingAboutNobodyGetsPersonNotFoundAndNoMoneyIsRead()
    {
        var harness = new Harness(Roles.Manager, other: null);

        var result = await harness.Handler.HandleAsync(OtherId, TestContext.Current.CancellationToken);

        result.Error.ShouldBe(MoneyErrors.PersonNotFound);
        result.Error.Message.ShouldBe("This person wasn't found.");
        await harness.Reader.DidNotReceive().GetSumsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AManagerAskingAboutTheLegacyHolderOrAnAccountWithNoStaffRoleGetsPersonNotFound()
    {
        var holder = new Harness(Roles.Manager, State(LegacyHolder.Id, Roles.Admin));
        var viewer = new Harness(Roles.Manager, State(OtherId, null));

        (await holder.Handler.HandleAsync(LegacyHolder.Id, TestContext.Current.CancellationToken)).Error.ShouldBe(MoneyErrors.PersonNotFound);
        (await viewer.Handler.HandleAsync(OtherId, TestContext.Current.CancellationToken)).Error.ShouldBe(MoneyErrors.PersonNotFound);
    }

    [Fact]
    public async Task AStaffMemberWithNoMoneyRowsShowsZero()
    {
        var harness = new Harness(Roles.Manager, State(OtherId, Roles.Admin), sums: []);

        var result = await harness.Handler.HandleAsync(OtherId, TestContext.Current.CancellationToken);

        result.Value.Balance.ShouldBe(0.00m);
    }

    [Fact]
    public async Task ATokenWithNoUserOrAnUnknownCallerIsRefusedAsEnded()
    {
        var noUser = new Harness(Roles.Manager, signedIn: false);
        var unknownCaller = new Harness(null, knownCaller: false);

        (await noUser.Handler.HandleAsync(OtherId, TestContext.Current.CancellationToken)).Error.ShouldBe(AuthErrors.SessionEnded);
        (await unknownCaller.Handler.HandleAsync(OtherId, TestContext.Current.CancellationToken)).Error.ShouldBe(AuthErrors.SessionEnded);
    }

    private static StaffState State(Guid id, string? role) => new(id, id == CallerId ? "Liza Mercado" : "Jomar Santos", role, true, false, false, true);

    private sealed class Harness
    {
        public Harness(
            string? callerRole,
            StaffState? other = null,
            IReadOnlyList<StaffMoneySums>? sums = null,
            bool signedIn = true,
            bool knownCaller = true)
        {
            Reader = Substitute.For<IStaffMoneyReader>();
            Reader.GetSumsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult(sums ?? []));
            Staff = Substitute.For<IStaffDirectory>();
            Staff.GetStaffStateAsync(CallerId, Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<StaffState?>(knownCaller ? State(CallerId, callerRole) : null));
            if (other is not null)
            {
                Staff.GetStaffStateAsync(other.Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult<StaffState?>(other));
            }

            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(signedIn ? CallerId : null);
            Handler = new GetStaffMoneyHandler(Reader, request, Staff, new FixedCalendar());
        }

        public IStaffMoneyReader Reader { get; }

        public IStaffDirectory Staff { get; }

        public GetStaffMoneyHandler Handler { get; }
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Wednesday));
    }
}

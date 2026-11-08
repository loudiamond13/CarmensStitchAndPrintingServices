using Csps.Application.Auth;
using Csps.Application.Money;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.Staff;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Money;

/// <summary>MONEY-01: the handler reads the token's user only, with the business today, and the balance comes from the domain formula.</summary>
public sealed class GetMyMoneyHandlerTests
{
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");

    // 10:00 in Manila on Wednesday 2026-11-04.
    private static readonly DateTimeOffset Wednesday = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);
    private static readonly Guid CallerId = Guid.Parse("11111111-1111-4111-8111-111111111111");

    [Fact]
    public async Task TheCallersOwnFigureComesBackWithTheirRoleStatusAndTheBusinessToday()
    {
        var reader = Substitute.For<IStaffMoneyReader>();
        reader.GetSumsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<StaffMoneySums>>([new StaffMoneySums(CallerId, "Liza Mercado", 1500m, 0m, 0m, 0m, 400m, 0m)]));
        var handler = new GetMyMoneyHandler(reader, Caller(CallerId), new FixedCalendar(), Directory(Roles.Admin));

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(new StaffMoneyResponse(CallerId, "Liza Mercado", "Admin", "active", 1100.00m, new DateOnly(2026, 11, 4)));
        await reader.Received(1).GetSumsAsync(Arg.Is<IReadOnlyCollection<Guid>>(ids => ids.Count == 1 && ids.Contains(CallerId)), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AManagerReadsTheirOwnRole()
    {
        var reader = Substitute.For<IStaffMoneyReader>();
        reader.GetSumsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<StaffMoneySums>>([new StaffMoneySums(CallerId, "Carmen Reyes", 10m, 0m, 0m, 0m, 0m, 0m)]));
        var handler = new GetMyMoneyHandler(reader, Caller(CallerId), new FixedCalendar(), Directory(Roles.Manager));

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.Role.ShouldBe("Manager");
        result.Value.Status.ShouldBe("active");
    }

    [Fact]
    public async Task ABalanceBelowZeroIsReportedAsANegativeFigure()
    {
        var reader = Substitute.For<IStaffMoneyReader>();
        reader.GetSumsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<StaffMoneySums>>([new StaffMoneySums(CallerId, "Liza Mercado", 0m, 0m, 0m, 0m, 400m, 0m)]));
        var handler = new GetMyMoneyHandler(reader, Caller(CallerId), new FixedCalendar(), Directory(Roles.Admin));

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.Balance.ShouldBe(-400.00m);
    }

    [Fact]
    public async Task ATokenWithNoUserIsRefusedAndNothingIsRead()
    {
        var reader = Substitute.For<IStaffMoneyReader>();
        var handler = new GetMyMoneyHandler(reader, Caller(null), new FixedCalendar(), Directory(Roles.Admin));

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.ShouldBe(AuthErrors.SessionEnded);
        await reader.DidNotReceive().GetSumsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AUserTheReaderDoesNotKnowIsRefused()
    {
        var reader = Substitute.For<IStaffMoneyReader>();
        reader.GetSumsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<StaffMoneySums>>([]));
        var handler = new GetMyMoneyHandler(reader, Caller(CallerId), new FixedCalendar(), Directory(Roles.Admin));

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
    }

    [Fact]
    public async Task AUserTheDirectoryDoesNotKnowIsRefused()
    {
        var reader = Substitute.For<IStaffMoneyReader>();
        reader.GetSumsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<StaffMoneySums>>([new StaffMoneySums(CallerId, "Liza Mercado", 10m, 0m, 0m, 0m, 0m, 0m)]));
        var handler = new GetMyMoneyHandler(reader, Caller(CallerId), new FixedCalendar(), Directory(null, known: false));

        var result = await handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
    }

    private static IStaffDirectory Directory(string? role, bool known = true)
    {
        var directory = Substitute.For<IStaffDirectory>();
        directory.GetStaffStateAsync(CallerId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<StaffState?>(known ? new StaffState(CallerId, "Liza Mercado", role, true, false, false, true) : null));
        return directory;
    }

    private static IRequestContext Caller(Guid? userId)
    {
        var context = Substitute.For<IRequestContext>();
        context.UserId.Returns(userId);
        return context;
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Wednesday));
    }
}

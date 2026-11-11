using Csps.Application.Auth;
using Csps.Application.Money;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Common;
using Csps.Domain.Money;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.Money;

/// <summary>MONEY-04, D-53: the shared create flow checks the session and the form, then runs the work in one transaction and answers busy when the lock is not had.</summary>
public sealed class MoneyWriteTests
{
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.CreateCustomTimeZone("Manila", TimeSpan.FromHours(8), "Manila", "Manila");
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid RecipientId = Guid.Parse("5b8e2c71-4d90-4a3f-8c16-0f7d3a9e6b24");

    [Fact]
    public async Task WithNoCallerTheSessionHasEndedAndNoTransactionOpens()
    {
        var run = new Run(noCaller: true);

        var result = await run.StartAsync(Valid());

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        run.Attempts.ShouldBe(0);
        run.Unit.Commits.ShouldBe(0);
    }

    [Fact]
    public async Task AFormThatBreaksAFieldRuleIsRefusedBeforeAnyTransaction()
    {
        var run = new Run();

        var result = await run.StartAsync(CreateMoneyTransferRequest.Empty);

        result.Error.Code.ShouldBe(MoneyRules.InvalidCode);
        run.Attempts.ShouldBe(0);
        run.Unit.Commits.ShouldBe(0);
    }

    [Fact]
    public async Task AValidFormRunsTheWorkOnceInATransactionWithTheCallerTheDateAndTheClock()
    {
        var run = new Run();

        var result = await run.StartAsync(Valid());

        result.IsSuccess.ShouldBeTrue();
        run.Attempts.ShouldBe(1);
        run.SeenCaller.ShouldBe(CallerId);
        run.SeenDate.ShouldBe(new DateOnly(2026, 11, 4));
        run.SeenClock!.UtcNow.ShouldBe(Now);
        run.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task ABusyLockInTheWorkIsAConflictAnswer()
    {
        var run = new Run { Throw = new StaffMoneyBusyException() };

        var result = await run.StartAsync(Valid());

        result.Error.ShouldBe(MoneyErrors.Busy);
    }

    private static CreateMoneyTransferRequest Valid() => new(RecipientId, 10.00m, "2026-11-04", null);

    private sealed class Run
    {
        private readonly IRequestContext _request = Substitute.For<IRequestContext>();

        public Run(bool noCaller = false) => _request.UserId.Returns(noCaller ? null : CallerId);

        public FakeUnitOfWork Unit { get; } = new();

        public int Attempts { get; private set; }

        public Guid SeenCaller { get; private set; }

        public DateOnly SeenDate { get; private set; }

        public BusinessClock? SeenClock { get; private set; }

        public Exception? Throw { get; set; }

        public Task<Result<MoneyTransferSavedResponse>> StartAsync(CreateMoneyTransferRequest request) =>
            MoneyWrite.RunLockedAsync(
                request,
                request.TransferDate,
                new CreateMoneyTransferRequestValidator(),
                new FixedCalendar(),
                _request,
                Unit,
                (caller, date, clock, _) =>
                {
                    Attempts++;
                    SeenCaller = caller;
                    SeenDate = date;
                    SeenClock = clock;
                    return Throw is null
                        ? Task.FromResult(Result.Success(Saved()))
                        : Task.FromException<Result<MoneyTransferSavedResponse>>(Throw);
                },
                TestContext.Current.CancellationToken);

        private static MoneyTransferSavedResponse Saved() => new(null!, 0m);
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Now));
    }
}

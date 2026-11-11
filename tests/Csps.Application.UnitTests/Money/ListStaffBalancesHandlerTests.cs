using Csps.Application.Auth;
using Csps.Application.Money;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Identity;
using NSubstitute;

namespace Csps.Application.UnitTests.Money;

/// <summary>MONEY-03, D-42 to D-44, D-56: the handler lists active people, then leavers who hold or are owed money, and totals what is listed.</summary>
public sealed class ListStaffBalancesHandlerTests
{
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid LizaId = Guid.Parse("5b8e2c71-4d90-4a3f-8c16-0f7d3a9e6b24");
    private static readonly Guid JomarId = Guid.Parse("3a9f1d64-7e20-4c85-9b13-6d4e8f2a0c57");
    private static readonly Guid AnaId = Guid.Parse("9d2c4e18-1b7a-4f63-a850-2e6c9b3d7f01");
    private static readonly Guid BenId = Guid.Parse("c4a7e913-5d02-4b8e-9f36-7a1d0e5c8b42");

    [Fact]
    public async Task WithNoCallerTheSessionHasEndedAndNothingIsRead()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        await harness.Reader.DidNotReceive().ListStaffPeopleAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ActiveLeaverAndZeroBalancePeopleAreSplitAndTotalledWithOneSumsRead()
    {
        var harness = new Harness(
            people:
            [
                Person(AnaId, "Ana Abad", Roles.Admin, active: false, deleted: true),
                Person(BenId, "Ben Lim", Roles.Admin, active: false, deleted: false),
                Person(CallerId, "Carmen Reyes", Roles.Manager),
                Person(JomarId, "Jomar Santos", Roles.Admin, active: false, deleted: false),
                Person(LizaId, "Liza Mercado", Roles.Admin),
            ],
            sums:
            [
                new StaffMoneySums(AnaId, "Ana Abad", 0m, 0m, 0m, 0m, 300.00m, 0m),
                new StaffMoneySums(BenId, "Ben Lim", 0m, 0m, 0m, 0m, 0m, 0m),
                new StaffMoneySums(CallerId, "Carmen Reyes", 8450.00m, 0m, 0m, 0m, 0m, 0m),
                new StaffMoneySums(JomarId, "Jomar Santos", 2000.00m, 0m, 0m, 0m, 0m, 0m),
                new StaffMoneySums(LizaId, "Liza Mercado", 0m, 0m, 0m, 0m, 500.00m, 0m),
            ]);

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.Items.ShouldBe(
        [
            new StaffBalanceRow(CallerId, "Carmen Reyes", "Manager", "active", 8450.00m, true),
            new StaffBalanceRow(LizaId, "Liza Mercado", "Admin", "active", -500.00m, false),
            new StaffBalanceRow(AnaId, "Ana Abad", "Admin", "deleted", -300.00m, false),
            new StaffBalanceRow(JomarId, "Jomar Santos", "Admin", "deactivated", 2000.00m, false),
        ]);
        result.Value.Total.ShouldBe(9650.00m);
        await harness.Reader.Received(1).GetSumsAsync(Arg.Is<IReadOnlyCollection<Guid>>(ids => ids.Count == 5), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnActivePersonWithNoSumsRowShowsZero()
    {
        var harness = new Harness(people: [Person(CallerId, "Carmen Reyes", Roles.Manager)]);

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.Items.ShouldBe([new StaffBalanceRow(CallerId, "Carmen Reyes", "Manager", "active", 0.00m, true)]);
        result.Value.Total.ShouldBe(0.00m);
    }

    [Fact]
    public async Task TheLegacyHolderIsNeverListedEvenIfTheReaderReturnsIt()
    {
        var harness = new Harness(
            people:
            [
                Person(CallerId, "Carmen Reyes", Roles.Manager),
                Person(LegacyHolder.Id, "Legacy / unassigned", Roles.Admin),
            ],
            sums: [new StaffMoneySums(LegacyHolder.Id, "Legacy / unassigned", 111.11m, 0m, 0m, 0m, 0m, 0m)]);

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.Items.Select(row => row.UserId).ShouldBe([CallerId]);
        result.Value.Total.ShouldBe(0.00m);
    }

    [Fact]
    public async Task WithNoPeopleNothingIsSummedAndTheTotalIsZero()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.Items.ShouldBeEmpty();
        result.Value.Total.ShouldBe(0.00m);
        await harness.Reader.DidNotReceive().GetSumsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>());
    }

    private static StaffPerson Person(Guid id, string name, string role, bool active = true, bool deleted = false) =>
        new(id, name, active, deleted) { Role = role };

    private sealed class Harness
    {
        public Harness(bool noCaller = false, IReadOnlyList<StaffPerson>? people = null, IReadOnlyList<StaffMoneySums>? sums = null)
        {
            Reader = Substitute.For<IStaffMoneyReader>();
            Reader.ListStaffPeopleAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult(people ?? []));
            Reader.GetSumsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult(sums ?? []));
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Handler = new ListStaffBalancesHandler(Reader, request);
        }

        public IStaffMoneyReader Reader { get; }

        public ListStaffBalancesHandler Handler { get; }
    }
}

using Csps.Application.Auth;
using Csps.Application.Money;
using Csps.Application.Ports;
using Csps.Application.Users;
using Csps.Domain.Identity;
using NSubstitute;

namespace Csps.Application.UnitTests.Money;

/// <summary>D-19, D-49, D-56: the handler offers active people first and then the leavers who are owed money, and answers names and status words only.</summary>
public sealed class ListTransferRecipientsHandlerTests
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
    public async Task ActivePeopleComeFirstWithTheCallerMarkedAndLockedOrNotSetUpOnesIncluded()
    {
        var harness = new Harness(people:
        [
            new StaffPerson(CallerId, "Carmen Reyes", "Manager", true, false, false),
            new StaffPerson(LizaId, "Liza Mercado", "Admin", true, true, false),
        ]);

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.ShouldBe(
        [
            new TransferRecipientResponse(CallerId, "Carmen Reyes", "active", true),
            new TransferRecipientResponse(LizaId, "Liza Mercado", "active", false),
        ]);
        await harness.Reader.DidNotReceive().GetSumsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task OnlyLeaversBelowZeroAreOfferedAndTheirBalancesReadInOneCall()
    {
        var harness = new Harness(
            people:
            [
                new StaffPerson(CallerId, "Carmen Reyes", "Manager", true, false, false),
                new StaffPerson(AnaId, "Ana Abad", "Admin", false, false, true),
                new StaffPerson(BenId, "Ben Lim", "Admin", false, false, false),
                new StaffPerson(JomarId, "Jomar Santos", "Admin", false, false, true),
            ],
            sums:
            [
                new StaffMoneySums(AnaId, "Ana Abad", 0m, 0m, 0m, 0m, 0m, 0m),
                new StaffMoneySums(BenId, "Ben Lim", 300.00m, 0m, 0m, 0m, 0m, 0m),
                new StaffMoneySums(JomarId, "Jomar Santos", 0m, 0m, 0m, 0m, 500.00m, 0m),
            ]);

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.ShouldBe(
        [
            new TransferRecipientResponse(CallerId, "Carmen Reyes", "active", true),
            new TransferRecipientResponse(JomarId, "Jomar Santos", "deleted", false),
        ]);
        await harness.Reader.Received(1).GetSumsAsync(
            Arg.Is<IReadOnlyCollection<Guid>>(ids => ids.Count == 3 && ids.Contains(AnaId) && ids.Contains(BenId) && ids.Contains(JomarId)),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ADeactivatedLeaverWhoIsOwedMoneyReadsAsDeactivated()
    {
        var harness = new Harness(
            people: [new StaffPerson(JomarId, "Jomar Santos", "Admin", false, false, false)],
            sums: [new StaffMoneySums(JomarId, "Jomar Santos", 0m, 0m, 0m, 0m, 0.01m, 0m)]);

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.ShouldBe([new TransferRecipientResponse(JomarId, "Jomar Santos", "deactivated", false)]);
    }

    [Fact]
    public async Task ALeaverWithNoSumsRowIsTreatedAsHoldingNothingAndLeftOut()
    {
        var harness = new Harness(people: [new StaffPerson(JomarId, "Jomar Santos", "Admin", false, false, false)]);

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.ShouldBeEmpty();
    }

    [Fact]
    public void ThePersonFromTheListMapsToTheSameStatusesAsTheAccountRules()
    {
        MoneyParties.FromPerson(new StaffPerson(LizaId, "Liza Mercado", "Admin", true, true, false), 5m).Status.ShouldBe(Csps.Domain.Money.MoneyPartyStatus.Active);
        MoneyParties.FromPerson(new StaffPerson(LizaId, "Liza Mercado", "Admin", false, false, false), 5m).Status.ShouldBe(Csps.Domain.Money.MoneyPartyStatus.Deactivated);
        MoneyParties.FromPerson(new StaffPerson(LizaId, "Liza Mercado", "Admin", false, false, true), 5m).Status.ShouldBe(Csps.Domain.Money.MoneyPartyStatus.Deleted);
        MoneyParties.FromPerson(new StaffPerson(LizaId, "Liza Mercado", "Admin", true, false, true), 5m).Status.ShouldBe(Csps.Domain.Money.MoneyPartyStatus.Deleted);
        Should.Throw<ArgumentNullException>(() => MoneyParties.FromPerson(null!, 0m));
    }

    [Fact]
    public void TheLegacyHolderIsNotStaffWhateverItsFlagsSay()
    {
        MoneyParties.FromPerson(new StaffPerson(LegacyHolder.Id, "Legacy / unassigned", "Admin", true, false, false), 5m).Status.ShouldBe(Csps.Domain.Money.MoneyPartyStatus.NotStaff);
        MoneyParties.FromPerson(new StaffPerson(LegacyHolder.Id, "Legacy / unassigned", "Admin", false, false, true), 5m).Status.ShouldBe(Csps.Domain.Money.MoneyPartyStatus.NotStaff);
    }

    [Fact]
    public async Task TheLegacyHolderIsNeverOfferedEvenIfTheReaderReturnsIt()
    {
        var harness = new Harness(
            people:
            [
                new StaffPerson(CallerId, "Carmen Reyes", "Manager", true, false, false),
                new StaffPerson(LegacyHolder.Id, "Legacy / unassigned", "Admin", true, false, false),
                new StaffPerson(JomarId, "Jomar Santos", "Admin", false, false, true),
            ],
            sums:
            [
                new StaffMoneySums(JomarId, "Jomar Santos", 0m, 0m, 0m, 0m, 500.00m, 0m),
                new StaffMoneySums(LegacyHolder.Id, "Legacy / unassigned", 0m, 0m, 0m, 0m, 500.00m, 0m),
            ]);

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.ShouldBe(
        [
            new TransferRecipientResponse(CallerId, "Carmen Reyes", "active", true),
            new TransferRecipientResponse(JomarId, "Jomar Santos", "deleted", false),
        ]);
        await harness.Reader.Received(1).GetSumsAsync(
            Arg.Is<IReadOnlyCollection<Guid>>(ids => ids.Count == 1 && ids.Contains(JomarId)),
            Arg.Any<CancellationToken>());
    }

    private sealed class Harness
    {
        public Harness(bool noCaller = false, IReadOnlyList<StaffPerson>? people = null, IReadOnlyList<StaffMoneySums>? sums = null)
        {
            Reader = Substitute.For<IStaffMoneyReader>();
            Reader.ListStaffPeopleAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult(people ?? []));
            Reader.GetSumsAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult(sums ?? []));
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Handler = new ListTransferRecipientsHandler(Reader, request);
        }

        public IStaffMoneyReader Reader { get; }

        public ListTransferRecipientsHandler Handler { get; }
    }
}

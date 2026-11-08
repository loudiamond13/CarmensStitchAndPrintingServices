using Csps.Application.Auth;
using Csps.Application.Money;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.Staff;
using NSubstitute;

namespace Csps.Application.UnitTests.Money;

/// <summary>MONEY-03, D-31, D-48: a Manager lists every transfer, an Admin only their own, and deleted transfers are Manager-only.</summary>
public sealed class ListMoneyTransfersHandlerTests
{
    private static readonly Guid CallerId = Guid.Parse("11111111-1111-4111-8111-111111111111");

    [Fact]
    public async Task AManagerListsEveryTransferAndTheAnswerEchoesTheReaderPage()
    {
        var harness = new Harness(Roles.Manager);

        var result = await harness.Handler.HandleAsync(new ListMoneyTransfersRequest(2, 10), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(harness.Page);
        await harness.Reader.Received(1).ListTransfersAsync(null, false, 2, 10, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AManagerWhoAsksForDeletedTransfersGetsThemFromTheReader()
    {
        var harness = new Harness(Roles.Manager);

        await harness.Handler.HandleAsync(new ListMoneyTransfersRequest(Deleted: true), TestContext.Current.CancellationToken);

        await harness.Reader.Received(1).ListTransfersAsync(null, true, 1, 20, Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(Roles.Admin)]
    [InlineData(null)]
    public async Task AnAdminOrAnAccountWithNoRoleOnlySeesTransfersTheySentOrReceivedAndNeverDeletedOnes(string? role)
    {
        var harness = new Harness(role);

        var result = await harness.Handler.HandleAsync(new ListMoneyTransfersRequest(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Reader.Received(1).ListTransfersAsync(CallerId, false, 1, 20, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnAdminWhoAsksForDeletedTransfersIsRefusedBeforeAnyRead()
    {
        var harness = new Harness(Roles.Admin);

        var result = await harness.Handler.HandleAsync(new ListMoneyTransfersRequest(Deleted: true), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(MoneyErrors.DeletedForbidden);
        await harness.Reader.DidNotReceive().ListTransfersAsync(Arg.Any<Guid?>(), Arg.Any<bool>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(0, 20, "page")]
    [InlineData(100001, 20, "page")]
    [InlineData(1, 0, "pageSize")]
    [InlineData(1, 101, "pageSize")]
    public async Task APageOrPageSizeOutOfRangeIsRefusedWithTheSharedWordsAndNothingIsRead(int page, int pageSize, string field)
    {
        var harness = new Harness(Roles.Manager);

        var result = await harness.Handler.HandleAsync(new ListMoneyTransfersRequest(page, pageSize), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe([field]);
        result.Error.FieldErrors[field].ShouldBe([field == "page" ? "Use a page from 1 to 100000." : "Use a page size from 1 to 100."]);
        await harness.Reader.DidNotReceive().ListTransfersAsync(Arg.Any<Guid?>(), Arg.Any<bool>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TheLimitsThemselvesAreAccepted()
    {
        var harness = new Harness(Roles.Manager);

        var result = await harness.Handler.HandleAsync(new ListMoneyTransfersRequest(100000, 100), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public async Task ATokenWithNoUserOrAnUnknownAccountIsRefusedAndNothingIsRead()
    {
        var noUser = new Harness(Roles.Manager, signedIn: false);
        var unknown = new Harness(null, knownAccount: false);

        (await noUser.Handler.HandleAsync(new ListMoneyTransfersRequest(), TestContext.Current.CancellationToken)).Error.ShouldBe(AuthErrors.SessionEnded);
        (await unknown.Handler.HandleAsync(new ListMoneyTransfersRequest(), TestContext.Current.CancellationToken)).Error.ShouldBe(AuthErrors.SessionEnded);
        await noUser.Reader.DidNotReceive().ListTransfersAsync(Arg.Any<Guid?>(), Arg.Any<bool>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
        await unknown.Reader.DidNotReceive().ListTransfersAsync(Arg.Any<Guid?>(), Arg.Any<bool>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ANullRequestIsRefused()
    {
        var harness = new Harness(Roles.Manager);

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Handler.HandleAsync(null!, TestContext.Current.CancellationToken));
    }

    private sealed class Harness
    {
        public Harness(string? role, bool signedIn = true, bool knownAccount = true)
        {
            Page = new MoneyTransferListResponse([], 0, 2, 10);
            Reader = Substitute.For<IStaffMoneyReader>();
            Reader.ListTransfersAsync(Arg.Any<Guid?>(), Arg.Any<bool>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
                .Returns(call => Task.FromResult(Page with { Page = call.ArgAt<int>(2), PageSize = call.ArgAt<int>(3) }));
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(signedIn ? CallerId : null);
            var directory = Substitute.For<IStaffDirectory>();
            directory.GetStaffStateAsync(CallerId, Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<StaffState?>(knownAccount ? new StaffState(CallerId, "Liza Mercado", role, true, false, false, true) : null));
            Handler = new ListMoneyTransfersHandler(Reader, request, directory, new ListMoneyTransfersRequestValidator());
        }

        public MoneyTransferListResponse Page { get; }

        public IStaffMoneyReader Reader { get; }

        public ListMoneyTransfersHandler Handler { get; }
    }
}

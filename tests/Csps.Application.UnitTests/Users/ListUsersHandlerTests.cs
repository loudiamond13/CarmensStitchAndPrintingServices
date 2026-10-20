using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.Users;
using Csps.Domain.Common;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Users;

/// <summary>USER-01, SEC-03, OR-3: the roster query is checked before the port is called, and the port gets the parsed filters.</summary>
public sealed class ListUsersHandlerTests
{
    private static readonly DateTimeOffset Start = new(2026, 10, 18, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task ADefaultQueryAsksForTheFirstPageOfTwentyAndEchoesThePageBack()
    {
        var item = Item("Ana");
        var harness = new Harness(new UserListPage([item], 41));

        var result = await harness.Handler.HandleAsync(new ListUsersRequest(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Items.ShouldBe([item]);
        (result.Value.Total, result.Value.Page, result.Value.PageSize).ShouldBe((41, 1, 20));
        await harness.Directory.Received(1).ListUsersAsync(new UserListQuery(null, null, null, 1, 20), Start, Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("ana", "ana")]
    [InlineData("  ana cruz  ", "ana cruz")]
    [InlineData("", null)]
    [InlineData("   ", null)]
    [InlineData("\t\r\n", null)]
    [InlineData(null, null)]
    public async Task TheSearchIsTrimmedAndBlankMeansNoSearch(string? typed, string? sent)
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new ListUsersRequest(Q: typed), TestContext.Current.CancellationToken);

        await harness.Directory.Received(1).ListUsersAsync(
            Arg.Is<UserListQuery>(query => query.Search == sent), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("admin", Roles.Admin)]
    [InlineData("manager", Roles.Manager)]
    [InlineData(null, null)]
    public async Task TheRoleFilterBecomesTheRoleName(string? typed, string? sent)
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new ListUsersRequest(Role: typed), TestContext.Current.CancellationToken);

        await harness.Directory.Received(1).ListUsersAsync(
            Arg.Is<UserListQuery>(query => query.Role == sent), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("active")]
    [InlineData("inactive")]
    [InlineData("locked")]
    [InlineData(null)]
    public async Task TheStatusFilterIsPassedAsIs(string? status)
    {
        var harness = new Harness();

        await harness.Handler.HandleAsync(new ListUsersRequest(Status: status), TestContext.Current.CancellationToken);

        await harness.Directory.Received(1).ListUsersAsync(
            Arg.Is<UserListQuery>(query => query.Status == status), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ThePageAndSizeAreTheOnesAskedFor()
    {
        var harness = new Harness(new UserListPage([], 7));

        var result = await harness.Handler.HandleAsync(new ListUsersRequest(Page: 9, PageSize: 100), TestContext.Current.CancellationToken);

        (result.Value.Page, result.Value.PageSize, result.Value.Total).ShouldBe((9, 100, 7));
        await harness.Directory.Received(1).ListUsersAsync(
            Arg.Is<UserListQuery>(query => query.Page == 9 && query.PageSize == 100), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("owner", null, 1, 20, "role", ListUsersRequestValidator.RoleInvalid)]
    [InlineData("Admin", null, 1, 20, "role", ListUsersRequestValidator.RoleInvalid)]
    [InlineData("", null, 1, 20, "role", ListUsersRequestValidator.RoleInvalid)]
    [InlineData(null, "gone", 1, 20, "status", ListUsersRequestValidator.StatusInvalid)]
    [InlineData(null, "Active", 1, 20, "status", ListUsersRequestValidator.StatusInvalid)]
    [InlineData(null, null, 0, 20, "page", ListUsersRequestValidator.PageInvalid)]
    [InlineData(null, null, -3, 20, "page", ListUsersRequestValidator.PageInvalid)]
    [InlineData(null, null, 100_001, 20, "page", ListUsersRequestValidator.PageInvalid)]
    [InlineData(null, null, 1, 0, "pageSize", "Use a page size from 1 to 100.")]
    [InlineData(null, null, 1, -1, "pageSize", "Use a page size from 1 to 100.")]
    [InlineData(null, null, 1, 101, "pageSize", "Use a page size from 1 to 100.")]
    public async Task ABadRoleStatusPageOrSizeIsA400NamingTheFieldAndTheDirectoryIsNeverAsked(
        string? role, string? status, int page, int pageSize, string field, string message)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListUsersRequest(Role: role, Status: status, Page: page, PageSize: pageSize), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe(AuthErrors.ValidationCode);
        result.Error.FieldErrors.ShouldNotBeNull()[field].ShouldBe([message]);
        await harness.Directory.DidNotReceiveWithAnyArgs().ListUsersAsync(null!, default, TestContext.Current.CancellationToken);
    }

    [Theory]
    [InlineData(1, 1)]
    [InlineData(100_000, 100)]
    public async Task TheEdgesOfThePageAndSizeRangesAreAccepted(int page, int pageSize)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(new ListUsersRequest(Page: page, PageSize: pageSize), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        (result.Value.Page, result.Value.PageSize).ShouldBe((page, pageSize));
    }

    [Fact]
    public async Task ASearchOfOneHundredCharactersPassesAndOneHundredAndOneIsRefused()
    {
        var harness = new Harness();

        var accepted = await harness.Handler.HandleAsync(new ListUsersRequest(Q: new string('a', 100)), TestContext.Current.CancellationToken);
        var refused = await harness.Handler.HandleAsync(new ListUsersRequest(Q: new string('a', 101)), TestContext.Current.CancellationToken);

        accepted.IsSuccess.ShouldBeTrue();
        refused.Error.FieldErrors.ShouldNotBeNull()["q"].ShouldBe(["Use 100 characters or fewer."]);
        await harness.Directory.Received(1).ListUsersAsync(Arg.Any<UserListQuery>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task EveryBadFieldIsReportedTogether()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(
            new ListUsersRequest(new string('a', 101), "owner", "gone", 0, 0), TestContext.Current.CancellationToken);

        result.Error.FieldErrors.ShouldNotBeNull().Keys.Order(StringComparer.Ordinal).ShouldBe(["page", "pageSize", "q", "role", "status"]);
    }

    [Fact]
    public async Task ANullRequestIsRefusedBeforeAnythingIsRead()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Handler.HandleAsync(null!, TestContext.Current.CancellationToken));
    }

    private static UserListItem Item(string firstName) =>
        new(Guid.NewGuid(), firstName, "Cruz", "staff@example.test", Roles.Admin, UserStatuses.Active, InviteStates.None, Start);

    private sealed class Harness
    {
        public Harness(UserListPage? page = null)
        {
            Directory = Substitute.For<IUserDirectory>();
            Directory.ListUsersAsync(Arg.Any<UserListQuery>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(page ?? new UserListPage([], 0)));
            Handler = new ListUsersHandler(Directory, new ListUsersRequestValidator(), new FakeTimeProvider(Start));
        }

        public IUserDirectory Directory { get; }

        public ListUsersHandler Handler { get; }
    }
}

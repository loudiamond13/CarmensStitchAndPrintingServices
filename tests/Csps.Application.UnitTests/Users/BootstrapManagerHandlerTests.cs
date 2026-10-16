using Csps.Application.Auth;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Users;

/// <summary>
/// AUTH-12, D-29, T-04-77: the bootstrap creates a passwordless Manager and queues a 72-hour invite, writes both audit
/// entries, and refuses while an active Manager exists.
/// </summary>
public sealed class BootstrapManagerHandlerTests
{
    private const string Secret = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";

    private static readonly DateTimeOffset Start = new(2026, 10, 14, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid NewId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");

    [Fact]
    public async Task AnEmptySystemGetsAPasswordlessManagerAndAnInviteInOneTransaction()
    {
        var harness = Harness.Create();

        var result = await harness.Handler.HandleAsync(new BootstrapManagerCommand(" carmen@csps.test ", " Carmen ", " Reyes "), TestContext.Current.CancellationToken);

        result.Value.ShouldBe(NewId);
        await harness.Accounts.Received(1).CreateAsync(
            Arg.Is<NewUserAccount>(a => a.Email == "carmen@csps.test" && a.FirstName == "Carmen" && a.LastName == "Reyes" && a.Role == Roles.Manager && a.Password == null),
            Arg.Any<CancellationToken>());

        var token = harness.AddedToken.ShouldNotBeNull();
        token.UserId.ShouldBe(NewId);
        token.Purpose.ShouldBe(AccountTokenPurpose.Invitation);
        token.ExpiresAt.ShouldBe(Start.AddHours(72));
        TokenHash.Equal(token.TokenHash, TokenHash.Compute(Secret)).ShouldBeTrue();

        var mail = harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBeOfType<InviteEmail>();
        mail.To.ShouldBe("carmen@csps.test");
        mail.Token.ShouldBe(Secret);
        mail.ExpiresAt.ShouldBe(Start.AddHours(72));

        harness.Audit.Entries.Select(e => e.Action).ShouldBe([AuditActions.BootstrapManagerCreated, AuditActions.UserInvited]);
        harness.Audit.Entries.ShouldAllBe(e => e.TargetType == "User" && e.TargetId == NewId.ToString("D") && !e.Independent);
        harness.Unit.Commits.ShouldBe(1);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task AnActiveManagerBlocksTheBootstrapAndNothingIsCreated()
    {
        var harness = Harness.Create(activeManager: true);

        var result = await harness.Handler.HandleAsync(new BootstrapManagerCommand("carmen@csps.test", "Carmen", "Reyes"), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        result.Error.Code.ShouldBe("bootstrap.manager-exists");
        await harness.AssertNothingCreatedAsync();
    }

    [Fact]
    public async Task WithNoActiveManagerTheBootstrapProceeds()
    {
        // An inactive Manager alone does not count: the port answers false for it.
        var harness = Harness.Create(activeManager: false);

        var result = await harness.Handler.HandleAsync(new BootstrapManagerCommand("carmen@csps.test", "Carmen", "Reyes"), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.Received(1).AnyActiveManagerAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnAddressThatAlreadyHasAnAccountIsRefusedAndNothingIsCreated()
    {
        var harness = Harness.Create();
        harness.Accounts.FindByEmailAsync("carmen@csps.test", Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<UserAccount?>(new UserAccount(NewId, "carmen@csps.test", "Old", "Manager", "Manager", false, true, true, null, false, null)));

        var result = await harness.Handler.HandleAsync(new BootstrapManagerCommand("carmen@csps.test", "Carmen", "Reyes"), TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe("bootstrap.email-taken");
        await harness.AssertNothingCreatedAsync();
    }

    [Theory]
    [InlineData(null, "Carmen", "Reyes", "email", "Enter your email.")]
    [InlineData("not-an-email", "Carmen", "Reyes", "email", "Enter a valid email, like name@gmail.com")]
    [InlineData("carmen@csps.test", null, "Reyes", "firstName", "Enter a first name.")]
    [InlineData("carmen@csps.test", "  ", "Reyes", "firstName", "Enter a first name.")]
    [InlineData("carmen@csps.test", "Carmen", null, "lastName", "Enter a last name.")]
    public async Task InvalidDetailsAre400OnTheFieldAndNothingIsCreated(string? email, string? first, string? last, string field, string message)
    {
        var harness = Harness.Create();

        var result = await harness.Handler.HandleAsync(new BootstrapManagerCommand(email, first, last), TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()[field].ShouldBe([message]);
        await harness.Accounts.DidNotReceive().AnyActiveManagerAsync(Arg.Any<CancellationToken>());
        await harness.AssertNothingCreatedAsync();
    }

    [Fact]
    public async Task ANameOfOneHundredCharactersIsAcceptedAndOneOverIsRefused()
    {
        var harness = Harness.Create();

        var at = await harness.Handler.HandleAsync(new BootstrapManagerCommand("carmen@csps.test", new string('a', 100), new string('b', 100)), TestContext.Current.CancellationToken);
        var over = await harness.Handler.HandleAsync(new BootstrapManagerCommand("carmen@csps.test", new string('a', 101), new string('b', 101)), TestContext.Current.CancellationToken);

        at.IsSuccess.ShouldBeTrue();
        over.Error.FieldErrors.ShouldNotBeNull()["firstName"].ShouldBe(["First name must be 100 characters or fewer."]);
        over.Error.FieldErrors["lastName"].ShouldBe(["Last name must be 100 characters or fewer."]);
    }

    [Fact]
    public async Task AFailureAnywhereRollsBack()
    {
        var harness = Harness.Create();
        harness.Outbox.FailWith = new InvalidOperationException("The outbox is down.");

        await Should.ThrowAsync<InvalidOperationException>(
            () => harness.Handler.HandleAsync(new BootstrapManagerCommand("carmen@csps.test", "Carmen", "Reyes"), TestContext.Current.CancellationToken));

        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(0);
    }

    [Fact]
    public async Task NoAuditEntryHoldsTheEmailOrTheToken()
    {
        var harness = Harness.Create();

        await harness.Handler.HandleAsync(new BootstrapManagerCommand("carmen@csps.test", "Carmen", "Reyes"), TestContext.Current.CancellationToken);

        foreach (var entry in harness.Audit.Entries)
        {
            (entry.Detail ?? string.Empty).ShouldNotContain("carmen@csps.test");
            (entry.Detail ?? string.Empty).ShouldNotContain(Secret);
        }
    }

    private sealed class Harness
    {
        private Harness(bool activeManager)
        {
            Accounts = Substitute.For<IUserAccounts>();
            Accounts.AnyActiveManagerAsync(Arg.Any<CancellationToken>()).Returns(activeManager);
            Accounts.CreateAsync(Arg.Any<NewUserAccount>(), Arg.Any<CancellationToken>()).Returns(NewId);
            Tokens = Substitute.For<IAccountTokens>();
            Tokens.When(t => t.Add(Arg.Any<AccountToken>())).Do(call => AddedToken = call.Arg<AccountToken>());
            var random = Substitute.For<ISecureRandom>();
            random.NewToken().Returns(Secret);

            Handler = new BootstrapManagerHandler(
                Accounts,
                Tokens,
                random,
                Outbox,
                Audit,
                Unit,
                new BootstrapManagerCommandValidator(),
                new AuthSettings(),
                new FakeTimeProvider(Start));
        }

        public IUserAccounts Accounts { get; }

        public IAccountTokens Tokens { get; }

        public RecordingOutbox Outbox { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public AccountToken? AddedToken { get; private set; }

        public BootstrapManagerHandler Handler { get; }

        public static Harness Create(bool activeManager = false) => new(activeManager);

        public async Task AssertNothingCreatedAsync()
        {
            await Accounts.DidNotReceive().CreateAsync(Arg.Any<NewUserAccount>(), Arg.Any<CancellationToken>());
            AddedToken.ShouldBeNull();
            Outbox.Emails.ShouldBeEmpty();
            Audit.Entries.ShouldBeEmpty();
            Unit.Saves.ShouldBe(0);
        }
    }
}

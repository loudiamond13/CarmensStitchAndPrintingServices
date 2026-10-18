using Csps.Application.Auth;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Application.Profile;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Profile;

/// <summary>
/// PROF-02, D-24, D-40, T-05-40: with an email change waiting, a resend revokes the open link and queues a fresh 24-hour one
/// to the pending address only, and a cancel revokes the links and clears the pending address. Nothing waiting is a 404 for
/// a resend and a quiet success for a cancel.
/// </summary>
public sealed class EmailChangePendingHandlerTests
{
    private const string OldEmail = "paolo.reyes@example.com";
    private const string NewEmail = "paolo.new@example.com";
    private const string Secret = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";

    private static readonly DateTimeOffset Start = new(2026, 10, 18, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid UserId = Guid.Parse("4b1f0c7e-2a53-4d6e-8f10-9a7c3e5d2b61");

    // ---- resend ----

    [Fact]
    public async Task AResendDoesEveryEffectInOneTransaction()
    {
        var harness = new Harness();

        var result = await harness.ResendAsync();

        result.IsSuccess.ShouldBeTrue();
        await harness.Tokens.Received(1).LockAccountAsync(UserId, Arg.Any<CancellationToken>());
        await harness.Tokens.Received(1).RevokeOpenAsync(UserId, AccountTokenPurpose.EmailChange, Start, Arg.Any<CancellationToken>());
        var token = harness.Added.ShouldNotBeNull();
        token.UserId.ShouldBe(UserId);
        token.Purpose.ShouldBe(AccountTokenPurpose.EmailChange);
        (token.ExpiresAt - token.CreatedAt).ShouldBe(TimeSpan.FromHours(24));
        var confirm = harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBeOfType<EmailChangeConfirmEmail>();
        confirm.To.ShouldBe(NewEmail);
        confirm.OldEmail.ShouldBe(OldEmail);
        confirm.ExpiresAt.ShouldBe(Start.AddHours(24));
        confirm.RequestedAt.ShouldBe(Start);
        TokenHash.Equal(token.TokenHash, TokenHash.Compute(confirm.Token)).ShouldBeTrue();
        harness.Audit.Entries.ShouldBe([new AuditCall("profile.email-change-requested", "User", UserId.ToString("D"), "resent", Independent: false)]);
        harness.Unit.Commits.ShouldBe(1);
        harness.Unit.Rollbacks.ShouldBe(0);
    }

    [Fact]
    public async Task AResendWritesNoAddressAndSendsNothingToTheCurrentOne()
    {
        var harness = new Harness();

        await harness.ResendAsync();

        await harness.Accounts.DidNotReceive().SetPendingEmailAsync(Arg.Any<Guid>(), Arg.Any<string?>(), Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().ApplyPendingEmailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        harness.Outbox.Emails.ShouldAllBe(static mail => mail.To == NewEmail);
    }

    [Fact]
    public async Task AResendWithNothingPendingIsA404NoneAndChangesNothing()
    {
        var harness = new Harness { Pending = null };

        var result = await harness.ResendAsync();

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.NotFound);
        result.Error.Code.ShouldBe("email-change.none");
        result.Error.Message.ShouldBe("There is no email change waiting.");
        await harness.AssertNothingChangedAsync();
    }

    [Fact]
    public async Task AResendWithNoProfileIsTheSameNoneAnswer()
    {
        var harness = new Harness { ProfileExists = false };

        var result = await harness.ResendAsync();

        result.Error.Code.ShouldBe("email-change.none");
        await harness.AssertNothingChangedAsync();
    }

    [Fact]
    public async Task AResendByACallerWithNoUserIsRefused()
    {
        var harness = new Harness { SignedIn = false };

        var result = await harness.ResendAsync();

        result.Error.Code.ShouldBe(AuthErrors.SessionEndedCode);
        await harness.Accounts.DidNotReceive().FindByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await harness.AssertNothingChangedAsync();
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("deactivated")]
    [InlineData("manager-locked")]
    [InlineData("deleted")]
    public async Task AResendByAMissingOrBlockedAccountIsRefused(string account)
    {
        var harness = new Harness(account);

        var result = await harness.ResendAsync();

        result.Error.Code.ShouldBe(AuthErrors.SessionEndedCode);
        await harness.AssertNothingChangedAsync();
    }

    [Fact]
    public async Task AResendThatLosesItsRaceOnceReadsAgainAndSucceeds()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.ResendAsync();

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task AResendThatLosesItsRaceTwiceAnswersBusy()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.ResendAsync();

        result.Error.Code.ShouldBe(AuthErrors.SessionBusyCode);
    }

    // ---- cancel ----

    [Fact]
    public async Task ACancelRevokesTheLinksClearsThePendingAddressAndAuditsWithNoDetail()
    {
        var harness = new Harness();

        var result = await harness.CancelAsync();

        result.IsSuccess.ShouldBeTrue();
        await harness.Tokens.Received(1).LockAccountAsync(UserId, Arg.Any<CancellationToken>());
        await harness.Tokens.Received(1).RevokeOpenAsync(UserId, AccountTokenPurpose.EmailChange, Start, Arg.Any<CancellationToken>());
        await harness.Accounts.Received(1).SetPendingEmailAsync(UserId, null, Arg.Any<CancellationToken>());
        harness.Audit.Entries.ShouldBe([new AuditCall("profile.email-change-canceled", "User", UserId.ToString("D"), null, Independent: false)]);
        harness.Outbox.Emails.ShouldBeEmpty();
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task ACancelNeverTouchesTheSignInEmail()
    {
        var harness = new Harness();

        await harness.CancelAsync();

        await harness.Accounts.DidNotReceive().ApplyPendingEmailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ACancelWithNothingPendingSucceedsAndWritesNothing(bool profileExists)
    {
        var harness = new Harness { Pending = null, ProfileExists = profileExists };

        var result = await harness.CancelAsync();

        result.IsSuccess.ShouldBeTrue();
        await harness.AssertNothingChangedAsync();
    }

    [Fact]
    public async Task ACancelByACallerWithNoUserIsRefused()
    {
        var harness = new Harness { SignedIn = false };

        var result = await harness.CancelAsync();

        result.Error.Code.ShouldBe(AuthErrors.SessionEndedCode);
        await harness.AssertNothingChangedAsync();
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("deactivated")]
    [InlineData("manager-locked")]
    [InlineData("deleted")]
    public async Task ACancelByAMissingOrBlockedAccountIsRefused(string account)
    {
        var harness = new Harness(account);

        var result = await harness.CancelAsync();

        result.Error.Code.ShouldBe(AuthErrors.SessionEndedCode);
        await harness.AssertNothingChangedAsync();
    }

    [Fact]
    public async Task ACancelThatLosesItsRaceTwiceAnswersBusy()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.CancelAsync();

        result.Error.Code.ShouldBe(AuthErrors.SessionBusyCode);
    }

    private sealed class Harness
    {
        private readonly string _account;

        public Harness(string account = "active")
        {
            _account = account;
            Time = new FakeTimeProvider(Start);

            Accounts = Substitute.For<IUserAccounts>();
            Accounts.FindByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult(Resolve(Account())));

            Tokens = Substitute.For<IAccountTokens>();
            Tokens.When(store => store.Add(Arg.Any<AccountToken>())).Do(call => Added = call.Arg<AccountToken>());

            Random = Substitute.For<ISecureRandom>();
            Random.NewToken().Returns(Secret);

            Directory = Substitute.For<IUserDirectory>();
            Directory.GetProfileAsync(UserId, Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult<ProfileView?>(
                ProfileExists ? new ProfileView(UserId, "Paolo", "Reyes", OldEmail, "Manager", Pending, Start.AddDays(-30), Guid.NewGuid()) : null));
        }

        public IUserAccounts Accounts { get; }

        public IAccountTokens Tokens { get; }

        public ISecureRandom Random { get; }

        public IUserDirectory Directory { get; }

        public AccountToken? Added { get; private set; }

        public RecordingOutbox Outbox { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public FakeTimeProvider Time { get; }

        public bool SignedIn { get; init; } = true;

        public bool ProfileExists { get; init; } = true;

        public string? Pending { get; init; } = NewEmail;

        public Task<Result> ResendAsync() =>
            new ResendEmailChangeHandler(Accounts, Directory, Tokens, Random, Outbox, Audit, Unit, Context(), new AuthSettings(), Time)
                .HandleAsync(TestContext.Current.CancellationToken);

        public Task<Result> CancelAsync() =>
            new CancelEmailChangeHandler(Accounts, Directory, Tokens, Audit, Unit, Context(), Time)
                .HandleAsync(TestContext.Current.CancellationToken);

        public async Task AssertNothingChangedAsync()
        {
            await Accounts.DidNotReceive().SetPendingEmailAsync(Arg.Any<Guid>(), Arg.Any<string?>(), Arg.Any<CancellationToken>());
            Added.ShouldBeNull();
            Outbox.Emails.ShouldBeEmpty();
            Audit.Entries.ShouldBeEmpty();
            await Tokens.DidNotReceive().RevokeOpenAsync(Arg.Any<Guid>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        }

        private static UserAccount Account() =>
            new(UserId, OldEmail, "Paolo", "Reyes", "Manager", true, true, true, null, false, null);

        private IRequestContext Context()
        {
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(SignedIn ? UserId : null);
            return request;
        }

        private UserAccount? Resolve(UserAccount user) => _account switch
        {
            "missing" => null,
            "deactivated" => user with { IsActive = false },
            "manager-locked" => user with { IsManagerLocked = true },
            "deleted" => user with { IsDeleted = true },
            _ => user,
        };
    }
}

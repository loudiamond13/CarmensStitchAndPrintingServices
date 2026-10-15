using Csps.Application.Auth;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Auth;

/// <summary>
/// AUTH-09, AUTH-11, D-13, D-14, D-22: the must-change step works only for the pending sign-in that passed the code
/// step, applies the full password rule, and starts the session in the same transaction that saves the password.
/// </summary>
public sealed class SetNewPasswordHandlerTests
{
    private const string Ticket = "ticket-token-0123456789-abcdefghijklmnopqrstuvwxyz";
    private const string Email = "paolo.reyes@example.com";
    private const string Good = "Mabuhay#Tahi2026";

    private static readonly DateTimeOffset Start = new(2026, 10, 14, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid UserId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("some-other-ticket")]
    public async Task AMissingOrUnknownTicketIs401AndChangesNothing(string? ticket)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(ticket, new SetNewPasswordRequest(Good), TestContext.Current.CancellationToken);

        AssertTicketExpired(result);
        await harness.AssertNothingChangedAsync();
    }

    [Fact]
    public async Task ASignInThatHasNotPassedTheCodeStepIs401()
    {
        var harness = new Harness(awaiting: false);

        var result = await harness.RunAsync(Good);

        AssertTicketExpired(result);
        await harness.AssertNothingChangedAsync();
    }

    [Fact]
    public async Task AChallengeAtItsExpiryIs401()
    {
        var harness = new Harness();
        harness.Time.Advance(TimeSpan.FromMinutes(30));

        var result = await harness.RunAsync(Good);

        AssertTicketExpired(result);
        await harness.AssertNothingChangedAsync();
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("deactivated")]
    [InlineData("locked")]
    public async Task AnAccountThatMaySignInNoLongerIs401(string account)
    {
        var harness = new Harness(account: account);

        var result = await harness.RunAsync(Good);

        AssertTicketExpired(result);
        await harness.AssertNothingChangedAsync();
    }

    [Fact]
    public async Task AnEmptyPasswordIs400AndNothingIsChecked()
    {
        var harness = new Harness();

        var result = await harness.RunAsync(string.Empty);

        AssertFieldError(result, SetNewPasswordRequestValidator.NewPasswordRequired);
        await harness.AssertNothingChangedAsync();
        await harness.Pwned.DidNotReceive().CheckAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("short1!", "Use at least 8 characters.")]
    [InlineData("Paolo#2026x", "Don't use your name or email in your password.")]
    public async Task APolicyFailureIs400WithThePolicyMessageAndNothingIsSaved(string password, string message)
    {
        var harness = new Harness();

        var result = await harness.RunAsync(password);

        AssertFieldError(result, message);
        await harness.AssertNothingChangedAsync();
        harness.Challenge.Status.ShouldBe(TwoFactorChallengeStatus.AwaitingNewPassword);
    }

    [Fact]
    public async Task ABreachedPasswordIs400WithTheBreachMessage()
    {
        var harness = new Harness(BreachCheckResult.Breached);

        var result = await harness.RunAsync(Good);

        AssertFieldError(result, PasswordRules.BreachedMessage);
        await harness.AssertNothingChangedAsync();
    }

    [Fact]
    public async Task AnUnreachableServiceAndACommonPasswordIs400WithTheCommonMessage()
    {
        var harness = new Harness(BreachCheckResult.Unavailable, isCommon: true);

        var result = await harness.RunAsync(Good);

        AssertFieldError(result, PasswordRules.TooCommonMessage);
        await harness.AssertNothingChangedAsync();
    }

    [Fact]
    public async Task ASkippedBreachCheckMarksARecheckAndAuditsIt()
    {
        var harness = new Harness(BreachCheckResult.Unavailable);

        var result = await harness.RunAsync(Good);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.Received(1).MarkBreachRecheckAsync(UserId, Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().ClearBreachRecheckAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        harness.Audit.Entries.Select(e => e.Action).ShouldBe(
            [AuditActions.PasswordChanged, AuditActions.BreachCheckUnavailable, AuditActions.SignedIn]);
    }

    [Fact]
    public async Task AValidPasswordDoesEveryEffectInOneTransactionAndStartsTheSession()
    {
        var harness = new Harness(persistent: false);

        var result = await harness.RunAsync(Good);

        result.IsSuccess.ShouldBeTrue();
        var issued = result.Value;
        issued.Response.User.Id.ShouldBe(UserId);
        issued.RefreshToken.ShouldNotBeNullOrEmpty();
        harness.Challenge.Status.ShouldBe(TwoFactorChallengeStatus.Completed);
        harness.Challenge.CompletedAt.ShouldBe(Start);
        await harness.Accounts.Received(1).SetPasswordAsync(UserId, Good, Arg.Any<CancellationToken>());
        await harness.Accounts.Received(1).ClearMustChangePasswordAsync(UserId, Arg.Any<CancellationToken>());
        await harness.Accounts.Received(1).ClearBreachRecheckAsync(UserId, Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().MarkBreachRecheckAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());

        var session = harness.Added.ShouldHaveSingleItem().Session;
        session.UserId.ShouldBe(UserId);
        session.Persistent.ShouldBeFalse();

        var mail = harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBeOfType<PasswordChangedEmail>();
        mail.To.ShouldBe(Email);
        mail.SessionsEnded.ShouldBeFalse();
        mail.ChangedAt.ShouldBe(Start);

        harness.Audit.Entries.Select(e => (e.Action, e.TargetType, e.TargetId)).ShouldBe(
        [
            (AuditActions.PasswordChanged, "User", UserId.ToString("D")),
            (AuditActions.SignedIn, "UserSession", session.Id.ToString("D")),
        ]);
        harness.Audit.Entries.ShouldAllBe(e => !e.Independent && e.Detail == null);
        harness.Unit.Commits.ShouldBe(1);
        harness.Unit.Rollbacks.ShouldBe(0);
    }

    [Fact]
    public async Task TheSignInIsSpentAndSavedBeforeTheAccountChanges()
    {
        var harness = new Harness();
        var spentAtFirstAccountCall = false;
        harness.Accounts.SetPasswordAsync(UserId, Good, Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                spentAtFirstAccountCall = harness.Challenge.Status == TwoFactorChallengeStatus.Completed && harness.Unit.Saves == 1;
                return Task.CompletedTask;
            });

        await harness.RunAsync(Good);

        spentAtFirstAccountCall.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(2);
    }

    [Fact]
    public async Task ARaceLostToAnotherSubmissionOfTheSameTicketIs401AndRollsBack()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.RunAsync(Good);

        AssertTicketExpired(result);
        harness.Unit.Rollbacks.ShouldBe(1);
        await harness.Accounts.DidNotReceive().SetPasswordAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
        harness.Outbox.Emails.ShouldBeEmpty();
    }

    [Fact]
    public async Task AFailureAnywhereRollsBackTheWholeStep()
    {
        var harness = new Harness();
        harness.Outbox.FailWith = new InvalidOperationException("The outbox is down.");

        await Should.ThrowAsync<InvalidOperationException>(() => harness.RunAsync(Good));

        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(0);
    }

    [Fact]
    public async Task NoAuditEntryHoldsTheEmailTheTicketOrThePassword()
    {
        var harness = new Harness(BreachCheckResult.Unavailable);

        await harness.RunAsync(Good);

        harness.Audit.Entries.ShouldAllBe(e => e.Detail == null
            || (!e.Detail.Contains(Email, StringComparison.Ordinal)
                && !e.Detail.Contains(Ticket, StringComparison.Ordinal)
                && !e.Detail.Contains(Good, StringComparison.Ordinal)));
    }

    [Fact]
    public void TheRequestNeverPrintsThePasswordAndTheEmptyRequestHasNone()
    {
        new SetNewPasswordRequest(Good).ToString().ShouldNotContain(Good);
        SetNewPasswordRequest.Empty.NewPassword.ShouldBeNull();
    }

    private static void AssertTicketExpired(Result<IssuedSession> result)
    {
        result.IsFailure.ShouldBeTrue();
        result.Error.ShouldBeSameAs(AuthErrors.TicketExpired);
        result.Error.Kind.ShouldBe(ErrorKind.Unauthenticated);
    }

    private static void AssertFieldError(Result<IssuedSession> result, string message)
    {
        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()["newPassword"].ShouldBe([message]);
    }

    private sealed class Harness
    {
        public Harness(
            BreachCheckResult breach = BreachCheckResult.NotBreached,
            bool isCommon = false,
            bool awaiting = true,
            bool persistent = true,
            string account = "active")
        {
            Time = new FakeTimeProvider(Start);
            var settings = new AuthSettings();
            var twoFactor = settings.ToTwoFactorSettings();
            var mac = Enumerable.Repeat((byte)1, TokenHash.HashLength).ToArray();
            Challenge = TwoFactorChallenge.Start(UserId, TokenHash.Compute(Ticket), persistent, Start, twoFactor);
            Challenge.IssueCode(mac, Start, twoFactor);
            if (awaiting)
            {
                Challenge.Verify(mac, Start, twoFactor).Outcome.ShouldBe(TwoFactorVerifyOutcome.Ok);
                Challenge.RequirePasswordChange(PasswordChangeReason.Temporary);
            }

            Challenges = Substitute.For<ITwoFactorChallenges>();
            Challenges.FindByTicketHashAsync(Arg.Any<byte[]>(), Arg.Any<CancellationToken>())
                .Returns(call => Task.FromResult(TokenHash.Equal(call.Arg<byte[]>(), TokenHash.Compute(Ticket)) ? Challenge : null));

            Accounts = Substitute.For<IUserAccounts>();
            UserAccount? user = account switch
            {
                "missing" => null,
                "deactivated" => Account(isActive: false),
                "locked" => Account(lockoutEnd: Start.AddMinutes(10)),
                _ => Account(),
            };
            Accounts.FindByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(Task.FromResult(user));

            Pwned = Substitute.For<IPwnedPasswords>();
            Pwned.CheckAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(breach);
            var common = Substitute.For<ICommonPasswords>();
            common.IsCommon(Arg.Any<string>()).Returns(isCommon);

            Sessions = Substitute.For<ISessions>();
            Sessions.When(store => store.Add(Arg.Any<UserSession>(), Arg.Any<RefreshToken>()))
                .Do(call => Added.Add((call.ArgAt<UserSession>(0), call.ArgAt<RefreshToken>(1))));
            var accessTokens = Substitute.For<IAccessTokenIssuer>();
            accessTokens.Issue(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<Guid>()).Returns(new AccessToken("access-token", Start.AddMinutes(15)));
            var random = Substitute.For<ISecureRandom>();
            random.NewToken().Returns("refresh-token-0123456789-abcdefghijklmnopqrstuvwxyz");
            var request = Substitute.For<IRequestContext>();
            request.UserAgent.Returns("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36");
            var issuer = new SessionIssuer(Sessions, accessTokens, random, request, settings, Time);

            Handler = new SetNewPasswordHandler(
                Challenges,
                Accounts,
                new PasswordRules(Pwned, common),
                issuer,
                Outbox,
                Audit,
                Unit,
                new SetNewPasswordRequestValidator(),
                Time);
        }

        public TwoFactorChallenge Challenge { get; }

        public ITwoFactorChallenges Challenges { get; }

        public IUserAccounts Accounts { get; }

        public IPwnedPasswords Pwned { get; }

        public ISessions Sessions { get; }

        public RecordingOutbox Outbox { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public FakeTimeProvider Time { get; }

        public SetNewPasswordHandler Handler { get; }

        public List<(UserSession Session, RefreshToken Token)> Added { get; } = [];

        public Task<Result<IssuedSession>> RunAsync(string? password) =>
            Handler.HandleAsync(Ticket, new SetNewPasswordRequest(password), TestContext.Current.CancellationToken);

        public async Task AssertNothingChangedAsync()
        {
            await Accounts.DidNotReceive().SetPasswordAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
            await Accounts.DidNotReceive().ClearMustChangePasswordAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
            await Accounts.DidNotReceive().MarkBreachRecheckAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
            await Accounts.DidNotReceive().ClearBreachRecheckAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
            Added.ShouldBeEmpty();
            Outbox.Emails.ShouldBeEmpty();
            Audit.Entries.ShouldBeEmpty();
            Unit.Commits.ShouldBe(0);
            Challenge.Status.ShouldNotBe(TwoFactorChallengeStatus.Completed);
        }

        private static UserAccount Account(bool isActive = true, DateTimeOffset? lockoutEnd = null) =>
            new(UserId, Email, "Paolo", "Reyes", "Manager", isActive, true, true, PasswordChangeReason.Temporary, false, lockoutEnd);
    }
}

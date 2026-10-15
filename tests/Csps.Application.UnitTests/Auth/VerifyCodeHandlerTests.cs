using Csps.Application.Auth;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Auth;

/// <summary>AUTH-02, AUTH-03, D-13, D-39: the code step, its error answers, the cross-ticket cap and the must-change hand-off.</summary>
public sealed class VerifyCodeHandlerTests
{
    private const string Ticket = "ticket-token-0123456789-abcdefghijklmnopqrstuvwxyz";
    private const string RightCode = "048213";
    private const string WrongCode = "999999";
    private const string Email = "paolo.reyes@example.com";

    private static readonly DateTimeOffset Start = new(2026, 10, 14, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid UserId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");
    private static readonly byte[] RightMac = Mac(1);
    private static readonly byte[] WrongMac = Mac(2);

    [Fact]
    public async Task ACorrectCodeStartsTheSessionAndWritesTheTwoAuditEntries()
    {
        var harness = new Harness();

        var result = await harness.RunAsync(RightCode);

        var outcome = result.Value;
        outcome.Next.ShouldBe(VerifyNext.SignedIn);
        outcome.Reason.ShouldBeNull();
        var issued = outcome.Session.ShouldNotBeNull();
        harness.Challenge.Status.ShouldBe(TwoFactorChallengeStatus.Completed);
        harness.Added.ShouldHaveSingleItem().Session.Persistent.ShouldBeTrue();
        harness.Audit.Entries.ShouldBe(
        [
            new AuditCall(AuditActions.TwoFactorVerified, "User", UserId.ToString("D"), null, Independent: false),
            new AuditCall(AuditActions.SignedIn, "UserSession", issued.SessionId.ToString("D"), null, Independent: false),
        ]);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task ALostRaceWithAnotherSubmissionOfTheCodeIsATimedOutSignIn()
    {
        var harness = new Harness();
        harness.Unit.ConflictOnSave = true;

        var result = await harness.RunAsync(RightCode);

        result.Error.ShouldBeSameAs(AuthErrors.TicketExpired);
    }

    [Fact]
    public async Task ABrowserSessionChoiceCarriesThroughToTheSession()
    {
        var harness = new Harness(persistent: false);

        var result = await harness.RunAsync(RightCode);

        result.Value.Session.ShouldNotBeNull().Response.Persistent.ShouldBeFalse();
    }

    [Theory]
    [InlineData(PasswordChangeReason.Temporary)]
    [InlineData(PasswordChangeReason.Breach)]
    public async Task ACorrectCodeOnAMustChangeAccountStopsBeforeAnySession(PasswordChangeReason reason)
    {
        var harness = new Harness(mustChange: reason);

        var result = await harness.RunAsync(RightCode);

        var outcome = result.Value;
        outcome.Next.ShouldBe(VerifyNext.SetNewPassword);
        outcome.Reason.ShouldBe(reason);
        outcome.Session.ShouldBeNull();
        harness.Added.ShouldBeEmpty();
        harness.Challenge.Status.ShouldBe(TwoFactorChallengeStatus.AwaitingNewPassword);
        harness.Challenge.PasswordChangeReason.ShouldBe(reason);
        harness.Audit.Entries.ShouldBe([new AuditCall(AuditActions.TwoFactorVerified, "User", UserId.ToString("D"), null, Independent: false)]);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task AWrongCodeIsA400OnTheCodeFieldAndTheAttemptIsCommittedFirst()
    {
        var harness = new Harness();

        var result = await harness.RunAsync(WrongCode);

        var error = result.Error;
        error.Kind.ShouldBe(ErrorKind.Validation);
        error.Code.ShouldBe("auth.code-wrong");
        error.FieldErrors.ShouldNotBeNull()["code"].ShouldBe(["That code isn't right. Check the newest email and try again."]);
        error.Message.ShouldNotContain("4");
        harness.Challenge.Codes[0].FailedAttempts.ShouldBe(1);
        harness.Unit.Saves.ShouldBe(1);
        harness.Audit.Entries.ShouldBe([new AuditCall(AuditActions.TwoFactorFailed, "User", UserId.ToString("D"), null, Independent: true)]);
        harness.Outbox.Emails.ShouldBeEmpty();
    }

    [Fact]
    public async Task TheFifthWrongCodeUsesTheCodeUp()
    {
        var harness = new Harness(failuresAlready: 4);

        var result = await harness.RunAsync(WrongCode);

        result.Error.Code.ShouldBe("auth.code-used-up");
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()["code"].ShouldBe(["This code can't be used anymore. Use Resend Code to get a new one."]);
        harness.Audit.Entries.ShouldBe([new AuditCall(AuditActions.TwoFactorExhausted, "User", UserId.ToString("D"), null, Independent: true)]);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task AUsedUpCodeStaysUsedUpEvenForTheRightCode()
    {
        var harness = new Harness(failuresAlready: 5);

        var result = await harness.RunAsync(RightCode);

        result.Error.Code.ShouldBe("auth.code-used-up");
        harness.Challenge.Codes[0].FailedAttempts.ShouldBe(5);
        harness.Challenge.Status.ShouldBe(TwoFactorChallengeStatus.Pending);
        harness.Added.ShouldBeEmpty();
        await harness.Accounts.DidNotReceive().LockUntilAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnExpiredCodeIsA400WithTheExpiredMessageAndCountsNothing()
    {
        var harness = new Harness();
        harness.Time.Advance(TimeSpan.FromMinutes(16));

        var result = await harness.RunAsync(RightCode);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe("auth.code-expired");
        result.Error.FieldErrors.ShouldNotBeNull()["code"].ShouldBe(["This code has expired. Use Resend Code to get a new one."]);
        harness.Challenge.Codes[0].FailedAttempts.ShouldBe(0);
        harness.Added.ShouldBeEmpty();
    }

    [Fact]
    public async Task AClosedChallengeIsATimedOutSignIn()
    {
        var harness = new Harness();
        harness.Challenge.Invalidate(Start);

        var result = await harness.RunAsync(RightCode);

        result.Error.ShouldBeSameAs(AuthErrors.TicketExpired);
        result.Error.Kind.ShouldBe(ErrorKind.Unauthenticated);
        result.Error.Code.ShouldBe("auth.ticket-expired");
        result.Error.Message.ShouldBe("Your sign-in timed out. Sign in again.");
        harness.Added.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task TheTenthWrongCodeAcrossSignInsLocksTheAccountAndQueuesOneEmail()
    {
        var harness = new Harness(failuresInWindow: 9);

        var result = await harness.RunAsync(WrongCode);

        var error = result.Error;
        error.Kind.ShouldBe(ErrorKind.TooManyRequests);
        error.Code.ShouldBe("auth.code-lockout");
        error.Message.ShouldBe("Too many wrong codes.");
        error.RetryAfter.ShouldBeNull();
        await harness.Challenges.Received(1).InvalidateOpenAsync(UserId, Start, Arg.Any<CancellationToken>());
        await harness.Accounts.Received(1).LockUntilAsync(UserId, Start.AddMinutes(15), Arg.Any<CancellationToken>());
        harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBe(new AccountLockedEmail(Email, Start.AddMinutes(15), LockoutCause.Code));
        harness.Audit.Entries.ShouldBe(
        [
            new AuditCall(AuditActions.Lockout, "User", UserId.ToString("D"), "code", Independent: false),
            new AuditCall(AuditActions.TwoFactorFailed, "User", UserId.ToString("D"), null, Independent: true),
        ],
        ignoreOrder: true);
        harness.Challenge.Codes[0].FailedAttempts.ShouldBe(1);
    }

    [Fact]
    public async Task TheCapWinsOverTheUsedUpMessageOnTheSameAttempt()
    {
        var harness = new Harness(failuresAlready: 4, failuresInWindow: 9);

        var result = await harness.RunAsync(WrongCode);

        result.Error.Code.ShouldBe("auth.code-lockout");
        harness.Outbox.Emails.ShouldHaveSingleItem();
    }

    [Fact]
    public async Task TheNinthWrongCodeIsStillAPlainWrongCode()
    {
        var harness = new Harness(failuresInWindow: 8);

        var result = await harness.RunAsync(WrongCode);

        result.Error.Code.ShouldBe("auth.code-wrong");
        await harness.Accounts.DidNotReceive().LockUntilAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        await harness.Challenges.DidNotReceive().InvalidateOpenAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        harness.Outbox.Emails.ShouldBeEmpty();
    }

    [Fact]
    public async Task TheCapCountsOnlyTheLastHour()
    {
        var harness = new Harness(failuresInWindow: 9);

        await harness.RunAsync(WrongCode);

        await harness.Challenges.Received(1).CountFailedAttemptsSinceAsync(UserId, Start.AddHours(-1), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ACorrectCodeNeverTriggersTheCap()
    {
        var harness = new Harness(failuresInWindow: 9);

        var result = await harness.RunAsync(RightCode);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.DidNotReceive().LockUntilAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task NoTicketIsATimedOutSignInWithoutAnyLookup(string? ticket)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(ticket, new VerifyCodeRequest(RightCode), TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.TicketExpired);
        await harness.Challenges.DidNotReceive().FindByTicketHashAsync(Arg.Any<byte[]>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnUnknownTicketIsATimedOutSignIn()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync("another-ticket", new VerifyCodeRequest(RightCode), TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.TicketExpired);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("12345")]
    [InlineData("1234567")]
    [InlineData("12345a")]
    public async Task AMalformedCodeIsA400AndNothingIsLookedUp(string? code)
    {
        var harness = new Harness();

        var result = await harness.RunAsync(code);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()["code"].ShouldBe(["Enter all 6 digits."]);
        await harness.Challenges.DidNotReceive().FindByTicketHashAsync(Arg.Any<byte[]>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("deactivated")]
    [InlineData("locked")]
    public async Task AnAccountThatCannotSignInGetsATimedOutSignIn(string state)
    {
        var harness = new Harness(account: state);

        var result = await harness.RunAsync(RightCode);

        result.Error.ShouldBeSameAs(AuthErrors.TicketExpired);
        harness.Added.ShouldBeEmpty();
        harness.Challenge.Codes[0].ConsumedAt.ShouldBeNull();
    }

    [Fact]
    public async Task ANullRequestIsRefused()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Handler.HandleAsync(Ticket, null!, TestContext.Current.CancellationToken));
    }

    [Fact]
    public void TheRequestAndOutcomeNeverPrintTheirSecrets()
    {
        new VerifyCodeRequest(RightCode).ToString().ShouldNotContain(RightCode);
        VerifyCodeRequest.Empty.Code.ShouldBeNull();
        new VerifyCodeOutcome(VerifyNext.SetNewPassword, PasswordChangeReason.Breach, null).ToString().ShouldBe("VerifyCodeOutcome");
    }

    private static byte[] Mac(byte fill) => Enumerable.Repeat(fill, TokenHash.HashLength).ToArray();

    private sealed class Harness
    {
        public Harness(
            bool persistent = true,
            PasswordChangeReason? mustChange = null,
            int failuresAlready = 0,
            int failuresInWindow = 0,
            string account = "active")
        {
            Time = new FakeTimeProvider(Start);
            var settings = new AuthSettings();
            var twoFactor = settings.ToTwoFactorSettings();
            Challenge = TwoFactorChallenge.Start(UserId, TokenHash.Compute(Ticket), persistent, Start, twoFactor);
            Challenge.IssueCode(RightMac, Start, twoFactor);
            for (var i = 0; i < failuresAlready; i++)
            {
                Challenge.Verify(WrongMac, Start, twoFactor);
            }

            Challenge.Codes[0].FailedAttempts.ShouldBe(failuresAlready);

            Challenges = Substitute.For<ITwoFactorChallenges>();
            Challenges.FindByTicketHashAsync(Arg.Any<byte[]>(), Arg.Any<CancellationToken>())
                .Returns(call => Task.FromResult(TokenHash.Equal(call.Arg<byte[]>(), TokenHash.Compute(Ticket)) ? Challenge : null));
            Challenges.CountFailedAttemptsSinceAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(failuresInWindow));

            Accounts = Substitute.For<IUserAccounts>();
            UserAccount? user = account switch
            {
                "missing" => null,
                "deactivated" => Account(mustChange, isActive: false),
                "locked" => Account(mustChange, lockoutEnd: Start.AddMinutes(10)),
                _ => Account(mustChange),
            };
            Accounts.FindByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(Task.FromResult(user));

            var codeMac = Substitute.For<ICodeMac>();
            codeMac.Compute(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<string>())
                .Returns(call => call.Arg<string>() == RightCode ? RightMac : WrongMac);

            var sessions = Substitute.For<ISessions>();
            sessions.When(store => store.Add(Arg.Any<UserSession>(), Arg.Any<RefreshToken>()))
                .Do(call => Added.Add((call.ArgAt<UserSession>(0), call.ArgAt<RefreshToken>(1))));
            var accessTokens = Substitute.For<IAccessTokenIssuer>();
            accessTokens.Issue(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<Guid>()).Returns(new AccessToken("access-token", Start.AddMinutes(15)));
            var random = Substitute.For<ISecureRandom>();
            random.NewToken().Returns("refresh-token-0123456789-abcdefghijklmnopqrstuvwxyz");
            var request = Substitute.For<IRequestContext>();
            request.UserAgent.Returns("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36");
            var issuer = new SessionIssuer(sessions, accessTokens, random, request, settings, Time);

            Handler = new VerifyCodeHandler(
                Challenges, Accounts, codeMac, issuer, Outbox, Audit, Unit, new VerifyCodeRequestValidator(), settings, Time);
        }

        public TwoFactorChallenge Challenge { get; }

        public ITwoFactorChallenges Challenges { get; }

        public IUserAccounts Accounts { get; }

        public RecordingOutbox Outbox { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public FakeTimeProvider Time { get; }

        public VerifyCodeHandler Handler { get; }

        public List<(UserSession Session, RefreshToken Token)> Added { get; } = [];

        public Task<Result<VerifyCodeOutcome>> RunAsync(string? code) =>
            Handler.HandleAsync(Ticket, new VerifyCodeRequest(code), TestContext.Current.CancellationToken);

        private static UserAccount Account(PasswordChangeReason? mustChange, bool isActive = true, DateTimeOffset? lockoutEnd = null) =>
            new(UserId, Email, "Paolo", "Reyes", "Manager", isActive, true, true, mustChange, false, lockoutEnd);
    }
}

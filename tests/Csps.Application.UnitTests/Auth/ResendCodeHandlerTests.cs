using Csps.Application.Auth;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Auth;

/// <summary>AUTH-04, D-10, D-33: a new code after a minute, at most five an hour with no wait time at the cap, and only the newest code works.</summary>
public sealed class ResendCodeHandlerTests
{
    private const string Ticket = "ticket-token-0123456789-abcdefghijklmnopqrstuvwxyz";
    private const string NewCode = "731905";
    private const string Email = "paolo.reyes@example.com";

    private static readonly DateTimeOffset Start = new(2026, 10, 14, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid UserId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");

    [Fact]
    public async Task AfterTheCooldownANewCodeIsEmailedAndTheOldOneIsSuperseded()
    {
        var harness = new Harness();
        harness.Time.Advance(TimeSpan.FromSeconds(61));

        var result = await harness.RunAsync();

        result.Value.ResendAfterSeconds.ShouldBe(60);
        harness.Challenge.Codes.Count.ShouldBe(2);
        harness.Challenge.Codes[0].SupersededAt.ShouldBe(Start.AddSeconds(61));
        var mail = harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBeOfType<SignInCodeEmail>();
        mail.To.ShouldBe(Email);
        mail.Code.ShouldBe(NewCode);
        mail.ExpiresAt.ShouldBe(Start.AddSeconds(61).AddMinutes(15));
        mail.RequestedAt.ShouldBe(Start.AddSeconds(61));
        harness.Audit.Entries.ShouldBe([new AuditCall(AuditActions.TwoFactorResent, "User", UserId.ToString("D"), null, Independent: false)]);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task TheNewCodeIsBoundToTheChallengeAndTheAccount()
    {
        var harness = new Harness();
        harness.Time.Advance(TimeSpan.FromSeconds(61));

        await harness.RunAsync();

        harness.CodeMac.Received(1).Compute(harness.Challenge.Id, UserId, NewCode);
    }

    [Fact]
    public async Task WithinTheCooldownTheAnswerIs429WithTheWaitLeft()
    {
        var harness = new Harness();
        harness.Time.Advance(TimeSpan.FromSeconds(30));

        var result = await harness.RunAsync();

        var error = result.Error;
        error.Kind.ShouldBe(ErrorKind.TooManyRequests);
        error.Code.ShouldBe("auth.resend-cooldown");
        error.RetryAfter.ShouldBe(TimeSpan.FromSeconds(30));
        harness.Challenge.Codes.Count.ShouldBe(1);
        harness.Outbox.Emails.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AtTheHourlyCapTheAnswerIs429WithNoWaitTime()
    {
        var harness = new Harness(codesInWindow: 5);
        harness.Time.Advance(TimeSpan.FromSeconds(61));

        var result = await harness.RunAsync();

        var error = result.Error;
        error.Kind.ShouldBe(ErrorKind.TooManyRequests);
        error.Code.ShouldBe("auth.resend-cap");
        error.Message.ShouldBe("You've asked for too many codes.");
        error.RetryAfter.ShouldBeNull();
        harness.Outbox.Emails.ShouldBeEmpty();
        harness.Challenge.Codes.Count.ShouldBe(1);
    }

    [Fact]
    public async Task ALostSaveRaceReadsAgainAndAnswersWithTheNormalCooldown()
    {
        var harness = new Harness();
        harness.Time.Advance(TimeSpan.FromSeconds(61));
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.RunAsync();

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.TooManyRequests);
        result.Error.Code.ShouldBe("auth.resend-cooldown");
    }

    [Fact]
    public async Task TwoLostSaveRacesStillAnswerWithTheCooldownAndNeverThrow()
    {
        var harness = new Harness();
        harness.Time.Advance(TimeSpan.FromSeconds(61));
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.RunAsync();

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.TooManyRequests);
        result.Error.RetryAfter.ShouldBe(TimeSpan.FromSeconds(60));
    }

    [Fact]
    public async Task TheCapIsCheckedBeforeTheCooldown()
    {
        var harness = new Harness(codesInWindow: 5);

        var result = await harness.RunAsync();

        result.Error.Code.ShouldBe("auth.resend-cap");
    }

    [Fact]
    public async Task TheFourthCodeInTheHourStillAllowsAFifth()
    {
        var harness = new Harness(codesInWindow: 4);
        harness.Time.Advance(TimeSpan.FromSeconds(61));

        var result = await harness.RunAsync();

        result.IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public async Task TheCapCountsTheCodesOfTheLastHour()
    {
        var harness = new Harness();
        harness.Time.Advance(TimeSpan.FromSeconds(61));

        await harness.RunAsync();

        await harness.Challenges.Received(1).CountCodesIssuedSinceAsync(UserId, Start.AddSeconds(61).AddHours(-1), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AClosedChallengeIsATimedOutSignIn()
    {
        var harness = new Harness();
        harness.Challenge.Invalidate(Start);
        harness.Time.Advance(TimeSpan.FromSeconds(61));

        var result = await harness.RunAsync();

        result.Error.ShouldBeSameAs(AuthErrors.TicketExpired);
        harness.Outbox.Emails.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task NoTicketIsATimedOutSignInWithoutAnyLookup(string? ticket)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(ticket, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.TicketExpired);
        await harness.Challenges.DidNotReceive().FindByTicketHashAsync(Arg.Any<byte[]>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnUnknownTicketIsATimedOutSignIn()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync("another-ticket", TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.TicketExpired);
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("deactivated")]
    [InlineData("locked")]
    public async Task AnAccountThatCannotSignInGetsATimedOutSignIn(string state)
    {
        var harness = new Harness(account: state);
        harness.Time.Advance(TimeSpan.FromSeconds(61));

        var result = await harness.RunAsync();

        result.Error.ShouldBeSameAs(AuthErrors.TicketExpired);
        harness.Outbox.Emails.ShouldBeEmpty();
    }

    [Fact]
    public void TheOutcomeIsAPlainNumber() => new ResendCodeOutcome(60).ResendAfterSeconds.ShouldBe(60);

    private sealed class Harness
    {
        public Harness(int codesInWindow = 1, string account = "active")
        {
            Time = new FakeTimeProvider(Start);
            var settings = new AuthSettings();
            var twoFactor = settings.ToTwoFactorSettings();
            Challenge = TwoFactorChallenge.Start(UserId, TokenHash.Compute(Ticket), true, Start, twoFactor);
            Challenge.IssueCode(new byte[TokenHash.HashLength], Start, twoFactor);

            Challenges = Substitute.For<ITwoFactorChallenges>();
            Challenges.FindByTicketHashAsync(Arg.Any<byte[]>(), Arg.Any<CancellationToken>())
                .Returns(call => Task.FromResult(TokenHash.Equal(call.Arg<byte[]>(), TokenHash.Compute(Ticket)) ? Challenge : null));
            Challenges.CountCodesIssuedSinceAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(codesInWindow));

            var accounts = Substitute.For<IUserAccounts>();
            UserAccount? user = account switch
            {
                "missing" => null,
                "deactivated" => Account(isActive: false),
                "locked" => Account(lockoutEnd: Start.AddMinutes(10)),
                _ => Account(),
            };
            accounts.FindByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(Task.FromResult(user));

            CodeMac = Substitute.For<ICodeMac>();
            CodeMac.Compute(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<string>()).Returns(new byte[TokenHash.HashLength]);
            var random = Substitute.For<ISecureRandom>();
            random.NewSixDigitCode().Returns(NewCode);
            var request = Substitute.For<IRequestContext>();
            request.UserAgent.Returns("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36");

            Handler = new ResendCodeHandler(Challenges, accounts, CodeMac, random, Outbox, Audit, Unit, request, settings, Time);
        }

        public TwoFactorChallenge Challenge { get; }

        public ITwoFactorChallenges Challenges { get; }

        public ICodeMac CodeMac { get; }

        public RecordingOutbox Outbox { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public FakeTimeProvider Time { get; }

        public ResendCodeHandler Handler { get; }

        public Task<Result<ResendCodeOutcome>> RunAsync() => Handler.HandleAsync(Ticket, TestContext.Current.CancellationToken);

        private static UserAccount Account(bool isActive = true, DateTimeOffset? lockoutEnd = null) =>
            new(UserId, Email, "Paolo", "Reyes", "Manager", isActive, true, true, null, false, lockoutEnd);
    }
}

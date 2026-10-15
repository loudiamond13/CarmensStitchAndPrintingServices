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
/// AUTH-08, D-16, D-20, D-39: forgot-password gives every email the same answer at the same time, informs a
/// deactivated account without a link, sends nothing for an unknown address and caps the emails per hour.
/// </summary>
public sealed class ForgotPasswordHandlerTests
{
    private const string Email = "paolo.reyes@example.com";
    private const string Secret = "reset-token-0123456789-abcdefghijklmnopqrstuvwxyz";
    private const string ChromeOnAndroid =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

    private static readonly DateTimeOffset Start = new(2026, 10, 14, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid UserId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");

    [Theory]
    [InlineData("unknown")]
    [InlineData("unconfirmed")]
    [InlineData("deactivated")]
    [InlineData("active")]
    [InlineData("active-capped")]
    [InlineData("deactivated-capped")]
    public async Task EveryBranchAnswersTheSameSuccessAtTheSameInstant(string branch)
    {
        var harness = Harness.For(branch);

        var task = harness.Handler.HandleAsync(new ForgotPasswordRequest(Email), TestContext.Current.CancellationToken);
        task.IsCompleted.ShouldBeFalse();
        harness.Time.Advance(TimeSpan.FromMilliseconds(499));
        task.IsCompleted.ShouldBeFalse();
        harness.Time.Advance(TimeSpan.FromMilliseconds(1));

        var result = await task;
        result.IsSuccess.ShouldBeTrue();
        harness.Time.GetUtcNow().ShouldBe(Start.AddMilliseconds(500));
    }

    [Theory]
    [InlineData("unknown")]
    [InlineData("unconfirmed")]
    public async Task AnUnknownOrUnconfirmedAddressGetsNothingButAnAuditEntry(string branch)
    {
        var harness = Harness.For(branch);

        await harness.RunAsync();

        harness.Outbox.Emails.ShouldBeEmpty();
        harness.Tokens.DidNotReceive().Add(Arg.Any<AccountToken>());
        await harness.Tokens.DidNotReceive().RevokeOpenAsync(Arg.Any<Guid>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Action.ShouldBe(AuditActions.PasswordResetRequested);
        entry.Detail.ShouldBe("unknown-account");
        entry.TargetType.ShouldBeNull();
        entry.TargetId.ShouldBeNull();
        entry.Independent.ShouldBeFalse();
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task ADeactivatedAccountGetsTheNoticeAndNoLink()
    {
        var harness = Harness.For("deactivated");

        await harness.RunAsync();

        var notice = harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBeOfType<DeactivatedNoticeEmail>();
        notice.To.ShouldBe(Email);
        harness.Tokens.DidNotReceive().Add(Arg.Any<AccountToken>());
        await harness.Tokens.DidNotReceive().RevokeOpenAsync(Arg.Any<Guid>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Detail.ShouldBe("deactivated");
        entry.TargetType.ShouldBe("User");
        entry.TargetId.ShouldBe(UserId.ToString("D"));
    }

    [Fact]
    public async Task AnActiveAccountGetsOneTokenAndOneLinkEmailInOneUnitOfWork()
    {
        var harness = Harness.For("active");
        AccountToken? added = null;
        harness.Tokens.When(tokens => tokens.Add(Arg.Any<AccountToken>())).Do(call => added = call.Arg<AccountToken>());

        await harness.RunAsync();

        var token = added.ShouldNotBeNull();
        token.UserId.ShouldBe(UserId);
        token.Purpose.ShouldBe(AccountTokenPurpose.PasswordReset);
        token.TokenHash.ShouldBe(TokenHash.Compute(Secret));
        token.ExpiresAt.ShouldBe(Start.AddMinutes(30));
        var mail = harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBeOfType<PasswordResetEmail>();
        mail.To.ShouldBe(Email);
        mail.Token.ShouldBe(Secret);
        mail.ExpiresAt.ShouldBe(token.ExpiresAt);
        mail.RequestedAt.ShouldBe(Start);
        mail.Device.Label.ShouldBe("Chrome on Android");
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Detail.ShouldBe("sent");
        entry.TargetId.ShouldBe(UserId.ToString("D"));
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task AnActiveAccountTakesTheLockThenRevokesTheEarlierLinks()
    {
        var harness = Harness.For("active");

        await harness.RunAsync();

        Received.InOrder(() =>
        {
            harness.Tokens.LockAccountAsync(UserId, Arg.Any<CancellationToken>());
            harness.Tokens.RevokeOpenAsync(UserId, AccountTokenPurpose.PasswordReset, Start, Arg.Any<CancellationToken>());
            harness.Tokens.Add(Arg.Any<AccountToken>());
        });
    }

    [Theory]
    [InlineData("active-capped", AuthEmailKind.PasswordReset)]
    [InlineData("deactivated-capped", AuthEmailKind.DeactivatedNotice)]
    public async Task ThreeEmailsInTheLastHourSendNothingMore(string branch, AuthEmailKind kind)
    {
        var harness = Harness.For(branch);

        await harness.RunAsync();

        harness.Outbox.Emails.ShouldBeEmpty();
        harness.Tokens.DidNotReceive().Add(Arg.Any<AccountToken>());
        await harness.Tokens.DidNotReceive().RevokeOpenAsync(Arg.Any<Guid>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        var count = harness.Outbox.Counts.ShouldHaveSingleItem();
        count.Kind.ShouldBe(kind);
        count.To.ShouldBe(Email);
        count.Since.ShouldBe(Start.AddHours(-1));
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Detail.ShouldBe("capped");
        entry.TargetId.ShouldBe(UserId.ToString("D"));
    }

    [Theory]
    [InlineData("active", AuthEmailKind.PasswordReset)]
    [InlineData("deactivated", AuthEmailKind.DeactivatedNotice)]
    public async Task TwoEmailsInTheLastHourStillAllowAThird(string branch, AuthEmailKind kind)
    {
        var harness = Harness.For(branch);
        harness.Outbox.Recent[kind] = 2;

        await harness.RunAsync();

        harness.Outbox.Emails.ShouldHaveSingleItem();
        harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldBe(branch == "active" ? "sent" : "deactivated");
    }

    [Fact]
    public async Task ABadFormIsA400WithoutLookingUpAnyAccount()
    {
        var harness = Harness.For("active");

        var result = await harness.Handler.HandleAsync(new ForgotPasswordRequest("paolo"), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe(AuthErrors.ValidationCode);
        result.Error.FieldErrors.ShouldNotBeNull().ShouldContainKey("email");
        await harness.Accounts.DidNotReceive().FindByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TheAddressIsTrimmedBeforeTheLookup()
    {
        var harness = Harness.For("active");

        var task = harness.Handler.HandleAsync(new ForgotPasswordRequest($"  {Email}  "), TestContext.Current.CancellationToken);
        harness.Time.Advance(TimeSpan.FromMilliseconds(500));
        await task;

        await harness.Accounts.Received(1).FindByEmailAsync(Email, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ALostRaceIsRetriedOnceAndStillAnswersSuccess()
    {
        var harness = Harness.For("active");
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.RunAsync();

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(2);
    }

    [Fact]
    public async Task TwoLostRacesStillAnswerSuccess()
    {
        var harness = Harness.For("active");
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.RunAsync();

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(2);
    }

    [Fact]
    public async Task NoAuditEntryHoldsTheEmailOrTheToken()
    {
        var harness = Harness.For("active");

        await harness.RunAsync();

        harness.Audit.Entries.ShouldAllBe(entry => entry.Detail != null && !entry.Detail.Contains(Email, StringComparison.Ordinal)
            && !entry.Detail.Contains(Secret, StringComparison.Ordinal));
    }

    private sealed class Harness
    {
        private Harness()
        {
            Accounts = Substitute.For<IUserAccounts>();
            Tokens = Substitute.For<IAccountTokens>();
            Time = new FakeTimeProvider(Start);

            var random = Substitute.For<ISecureRandom>();
            random.NewToken().Returns(Secret);
            var request = Substitute.For<IRequestContext>();
            request.UserAgent.Returns(ChromeOnAndroid);
            request.CorrelationId.Returns(new string('a', 32));

            Handler = new ForgotPasswordHandler(
                Accounts, Tokens, random, Outbox, Audit, Unit, request, new ForgotPasswordRequestValidator(), new AuthSettings(), Time);
        }

        public IUserAccounts Accounts { get; }

        public IAccountTokens Tokens { get; }

        public RecordingOutbox Outbox { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public FakeTimeProvider Time { get; }

        public ForgotPasswordHandler Handler { get; }

        public static Harness For(string branch)
        {
            var harness = new Harness();
            var account = branch switch
            {
                "unknown" => null,
                "unconfirmed" => Account(confirmed: false),
                "deactivated" or "deactivated-capped" => Account(isActive: false),
                _ => Account(),
            };
            harness.Accounts.FindByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult(account));
            if (branch == "active-capped")
            {
                harness.Outbox.Recent[AuthEmailKind.PasswordReset] = 3;
            }

            if (branch == "deactivated-capped")
            {
                harness.Outbox.Recent[AuthEmailKind.DeactivatedNotice] = 3;
            }

            return harness;
        }

        // Starts the handler, then lets the response floor pass.
        public async Task<Result> RunAsync()
        {
            var task = Handler.HandleAsync(new ForgotPasswordRequest(Email), TestContext.Current.CancellationToken);
            Time.Advance(TimeSpan.FromMilliseconds(500));
            return await task;
        }

        private static UserAccount Account(bool isActive = true, bool confirmed = true) =>
            new(UserId, Email, "Paolo", "Reyes", "Manager", isActive, confirmed, true, null, false, null);
    }
}

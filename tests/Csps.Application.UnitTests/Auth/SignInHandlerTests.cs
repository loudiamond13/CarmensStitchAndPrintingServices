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
/// AUTH-01, AUTH-02, AUTH-07, AUTH-10, D-02, D-39: every branch of the first sign-in step does one password hash,
/// takes the response floor, and every failure is the same 401.
/// </summary>
public sealed class SignInHandlerTests
{
    private const string Email = "paolo.reyes@example.com";
    private const string Password = "correct horse battery staple";
    private const string ChromeOnAndroid =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

    private static readonly DateTimeOffset Start = new(2026, 10, 14, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid UserId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");

    [Theory]
    [InlineData("unknown", 0, 1)]
    [InlineData("no-password", 0, 1)]
    [InlineData("bad-password", 1, 0)]
    [InlineData("locked", 1, 0)]
    [InlineData("deactivated", 1, 0)]
    [InlineData("unconfirmed", 1, 0)]
    [InlineData("success", 1, 0)]
    public async Task EveryBranchChecksExactlyOnePasswordHash(string branch, int realChecks, int dummyChecks)
    {
        var harness = Harness.For(branch);

        await harness.RunAsync();

        await harness.Accounts.Received(realChecks).CheckPasswordAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
        harness.Accounts.Received(dummyChecks).VerifyDummyPassword(Password);
    }

    [Theory]
    [InlineData("unknown")]
    [InlineData("no-password")]
    [InlineData("bad-password")]
    [InlineData("locked")]
    [InlineData("deactivated")]
    [InlineData("unconfirmed")]
    [InlineData("success")]
    public async Task EveryBranchTakesTheFullResponseFloor(string branch)
    {
        var harness = Harness.For(branch);

        var task = harness.Handler.HandleAsync(new SignInRequest(Email, Password, true), TestContext.Current.CancellationToken);
        task.IsCompleted.ShouldBeFalse();
        harness.Time.Advance(TimeSpan.FromMilliseconds(499));
        task.IsCompleted.ShouldBeFalse();
        harness.Time.Advance(TimeSpan.FromMilliseconds(1));

        (await task).ShouldNotBeNull();
    }

    [Theory]
    [InlineData("unknown")]
    [InlineData("no-password")]
    [InlineData("bad-password")]
    [InlineData("locked")]
    [InlineData("deactivated")]
    [InlineData("unconfirmed")]
    public async Task EverySixFailuresReturnTheSameError(string branch)
    {
        var harness = Harness.For(branch);

        var result = await harness.RunAsync();

        result.IsFailure.ShouldBeTrue();
        result.Error.ShouldBeSameAs(AuthErrors.InvalidCredentials);
        result.Error.Kind.ShouldBe(ErrorKind.Unauthenticated);
        result.Error.Code.ShouldBe("auth.invalid-credentials");
        result.Error.Message.ShouldBe("Email or password is incorrect.");
    }

    [Theory]
    [InlineData("unknown", 0)]
    [InlineData("no-password", 0)]
    [InlineData("bad-password", 1)]
    [InlineData("locked", 0)]
    [InlineData("deactivated", 0)]
    [InlineData("unconfirmed", 0)]
    [InlineData("success", 0)]
    public async Task OnlyAWrongPasswordOnAnOpenAccountCountsAsAFailure(string branch, int counted)
    {
        var harness = Harness.For(branch);

        await harness.RunAsync();

        await harness.Accounts.Received(counted).RecordFailedPasswordAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("locked")]
    [InlineData("deactivated")]
    [InlineData("unconfirmed")]
    public async Task ABlockedAccountWithAWrongPasswordIsStillNotCounted(string branch)
    {
        var harness = Harness.For(branch, passwordIsRight: false);

        var result = await harness.RunAsync();

        result.Error.ShouldBeSameAs(AuthErrors.InvalidCredentials);
        await harness.Accounts.Received(1).CheckPasswordAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().RecordFailedPasswordAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("deactivated")]
    [InlineData("unconfirmed")]
    [InlineData("locked")]
    public async Task ABlockedAccountNeverGetsAChallengeOrACodeEmail(string branch)
    {
        var harness = Harness.For(branch);

        await harness.RunAsync();

        harness.Challenges.DidNotReceive().Add(Arg.Any<TwoFactorChallenge>());
        harness.Outbox.Emails.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task SuccessStartsAChallengeAndQueuesTheCodeEmailInOneUnitOfWork()
    {
        var harness = Harness.For("success");
        TwoFactorChallenge? added = null;
        harness.Challenges.When(challenges => challenges.Add(Arg.Any<TwoFactorChallenge>())).Do(call => added = call.Arg<TwoFactorChallenge>());

        var result = await harness.RunAsync(keepSignedIn: true);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Ticket.ShouldBe(Harness.Ticket);
        result.Value.ResendAfterSeconds.ShouldBe(60);
        result.Value.TicketExpiresAt.ShouldBe(Start.AddMinutes(30));
        await harness.Accounts.Received(1).ResetFailedCountAsync(UserId, Arg.Any<CancellationToken>());
        await harness.Challenges.Received(1).InvalidateOpenAsync(UserId, Start, Arg.Any<CancellationToken>());
        var challenge = added.ShouldNotBeNull();
        challenge.UserId.ShouldBe(UserId);
        challenge.Persistent.ShouldBeTrue();
        challenge.Codes.ShouldHaveSingleItem();
        TokenHash.Equal(challenge.TicketHash, TokenHash.Compute(Harness.Ticket)).ShouldBeTrue();

        var email = harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBeOfType<SignInCodeEmail>();
        email.To.ShouldBe(Email);
        email.Code.ShouldBe(Harness.Code);
        email.ExpiresAt.ShouldBe(Start.AddMinutes(15));
        email.RequestedAt.ShouldBe(Start);
        email.Device.Label.ShouldBe("Chrome on Android");

        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.ShouldBe(new AuditCall(AuditActions.TwoFactorIssued, "User", UserId.ToString("D"), null, Independent: false));
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task ABrowserSessionChoiceIsKeptOnTheChallenge()
    {
        var harness = Harness.For("success");
        TwoFactorChallenge? added = null;
        harness.Challenges.When(challenges => challenges.Add(Arg.Any<TwoFactorChallenge>())).Do(call => added = call.Arg<TwoFactorChallenge>());

        await harness.RunAsync(keepSignedIn: false);

        added.ShouldNotBeNull().Persistent.ShouldBeFalse();
    }

    [Fact]
    public async Task TheEmailIsTrimmedBeforeTheLookup()
    {
        var harness = Harness.For("success");

        await harness.RunAsync(email: $"  {Email}  ");

        await harness.Accounts.Received(1).FindByEmailAsync(Email, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AMissingFormReportsEveryFieldWithoutWaitingOrTouchingAccounts()
    {
        var harness = Harness.For("success");

        var result = await harness.Handler.HandleAsync(SignInRequest.Empty, TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Code.ShouldBe("auth.invalid-request");
        var fields = result.Error.FieldErrors.ShouldNotBeNull();
        fields["email"].ShouldBe(["Enter your email."]);
        fields["password"].ShouldBe(["Enter your password."]);
        await harness.Accounts.DidNotReceive().FindByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public void ARequestPrintsOnlyItsTypeName() =>
        new SignInRequest(Email, Password, true).ToString().ShouldBe("SignInRequest");

    [Fact]
    public void AnOutcomePrintsOnlyItsTypeName() =>
        new SignInOutcome("secret-ticket", Start, 60).ToString().ShouldBe("SignInOutcome");

    [Theory]
    [InlineData("unknown", "unknown-account", false)]
    [InlineData("no-password", "no-password", true)]
    [InlineData("bad-password", "bad-password", true)]
    [InlineData("locked", "locked", true)]
    [InlineData("deactivated", "deactivated", true)]
    [InlineData("unconfirmed", "unconfirmed", true)]
    public async Task EveryFailureIsAuditedIndependentlyWithItsReason(string branch, string reason, bool targetKnown)
    {
        var harness = Harness.For(branch);

        await harness.RunAsync();

        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.ShouldBe(new AuditCall(AuditActions.SignInFailed, targetKnown ? "User" : null, targetKnown ? UserId.ToString("D") : null, reason, Independent: true));
        AuditActions.SignInFailureReasons.ShouldContain(entry.Detail);
    }

    [Fact]
    public async Task ASuccessWritesNoFailureAudit()
    {
        var harness = Harness.For("success");

        await harness.RunAsync();

        harness.Audit.Entries.ShouldNotContain(entry => entry.Action == AuditActions.SignInFailed);
    }

    [Fact]
    public async Task TheFailureThatLocksTheAccountQueuesOneLockoutEmailAndAuditsIt()
    {
        var harness = Harness.For("bad-password");
        var until = Start.AddMinutes(15);
        harness.Accounts.RecordFailedPasswordAsync(UserId, Arg.Any<CancellationToken>()).Returns(Task.FromResult(new FailedPasswordResult(true, until)));

        var result = await harness.RunAsync();

        result.Error.ShouldBeSameAs(AuthErrors.InvalidCredentials);
        var email = harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBeOfType<AccountLockedEmail>();
        email.To.ShouldBe(Email);
        email.LockedUntil.ShouldBe(until);
        email.Cause.ShouldBe(LockoutCause.Password);
        harness.Audit.Entries.ShouldBe(
        [
            new AuditCall(AuditActions.Lockout, "User", UserId.ToString("D"), "password", Independent: false),
            new AuditCall(AuditActions.SignInFailed, "User", UserId.ToString("D"), "bad-password", Independent: true),
        ]);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task AFailureThatDoesNotLockSendsNoEmailAndWritesNoLockoutAudit()
    {
        var harness = Harness.For("bad-password");

        await harness.RunAsync();

        harness.Outbox.Emails.ShouldBeEmpty();
        harness.Audit.Entries.ShouldNotContain(entry => entry.Action == AuditActions.Lockout);
        harness.Unit.Saves.ShouldBe(0);
    }

    private sealed record AuditCall(string Action, string? TargetType, string? TargetId, string? Detail, bool Independent);

    private sealed class RecordingOutbox : IEmailOutbox
    {
        public List<AuthEmail> Emails { get; } = [];

        public ValueTask EnqueueAsync(AuthEmail email, CancellationToken cancellationToken)
        {
            Emails.Add(email);
            return ValueTask.CompletedTask;
        }

        public Task<int> CountRecentAsync(AuthEmailKind kind, string toAddress, DateTimeOffset since, CancellationToken cancellationToken) =>
            Task.FromResult(0);
    }

    private sealed class RecordingAudit : IAuditTrail
    {
        public List<AuditCall> Entries { get; } = [];

        public void Record(string action, string? targetType, string? targetId, string? detail) =>
            Entries.Add(new AuditCall(action, targetType, targetId, detail, Independent: false));

        public ValueTask RecordIndependentlyAsync(string action, string? targetType, string? targetId, string? detail, CancellationToken cancellationToken)
        {
            Entries.Add(new AuditCall(action, targetType, targetId, detail, Independent: true));
            return ValueTask.CompletedTask;
        }
    }

    // Runs the work at once and counts commits, like a real unit of work without a database.
    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        public int Saves { get; private set; }

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken)
        {
            Saves++;
            return Task.FromResult(1);
        }

        public Task<T> InTransactionAsync<T>(Func<CancellationToken, Task<T>> work, CancellationToken cancellationToken) =>
            work(cancellationToken);
    }

    private sealed class Harness
    {
        public const string Ticket = "ticket-token-0123456789-abcdefghijklmnopqrstuvwxyz";
        public const string Code = "048213";

        private Harness()
        {
            Accounts = Substitute.For<IUserAccounts>();
            Challenges = Substitute.For<ITwoFactorChallenges>();
            Time = new FakeTimeProvider(Start);

            var codeMac = Substitute.For<ICodeMac>();
            codeMac.Compute(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<string>()).Returns(new byte[TokenHash.HashLength]);
            var random = Substitute.For<ISecureRandom>();
            random.NewToken().Returns(Ticket);
            random.NewSixDigitCode().Returns(Code);
            var request = Substitute.For<IRequestContext>();
            request.UserAgent.Returns(ChromeOnAndroid);
            request.CorrelationId.Returns(new string('a', 32));

            Handler = new SignInHandler(
                Accounts, Challenges, codeMac, random, Outbox, Audit, Unit, request, new SignInRequestValidator(), new AuthSettings(), Time);
        }

        public IUserAccounts Accounts { get; }

        public ITwoFactorChallenges Challenges { get; }

        public RecordingOutbox Outbox { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public FakeTimeProvider Time { get; }

        public SignInHandler Handler { get; }

        public static Harness For(string branch, bool passwordIsRight = true)
        {
            var harness = new Harness();
            var account = branch switch
            {
                "unknown" => null,
                "no-password" => Account(hasPassword: false),
                "locked" => Account(lockoutEnd: Start.AddMinutes(10)),
                "deactivated" => Account(isActive: false),
                "unconfirmed" => Account(confirmed: false),
                _ => Account(),
            };
            harness.Accounts.FindByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult(account));
            var right = passwordIsRight && branch != "bad-password";
            harness.Accounts.CheckPasswordAsync(UserId, Arg.Any<string>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(right ? PasswordCheck.Succeeded : PasswordCheck.Failed));
            harness.Accounts.RecordFailedPasswordAsync(UserId, Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(new FailedPasswordResult(false, null)));
            return harness;
        }

        // Starts the handler, proves it is still waiting for the floor, then lets the floor pass.
        public async Task<Result<SignInOutcome>> RunAsync(bool keepSignedIn = true, string email = Email)
        {
            var task = Handler.HandleAsync(new SignInRequest(email, Password, keepSignedIn), TestContext.Current.CancellationToken);
            Time.Advance(TimeSpan.FromMilliseconds(500));
            return await task;
        }

        private static UserAccount Account(
            bool isActive = true, bool confirmed = true, bool hasPassword = true, DateTimeOffset? lockoutEnd = null) =>
            new(UserId, Email, "Paolo", "Reyes", "Manager", isActive, confirmed, hasPassword, null, false, lockoutEnd);
    }
}

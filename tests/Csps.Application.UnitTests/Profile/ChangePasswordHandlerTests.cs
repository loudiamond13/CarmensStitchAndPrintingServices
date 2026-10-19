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
/// PROF-03, D-41 Q9, D-46, T-05-31: a password change needs the right current password, counts wrong ones toward the
/// lockout like sign-in, applies the full rule, signs out the other devices only and writes no password anywhere.
/// </summary>
public sealed class ChangePasswordHandlerTests
{
    private const string Email = "paolo.reyes@example.com";
    private const string Current = "Tala#Bituin2025";
    private const string Good = "Mabuhay#Tahi2026";
    private const string WrongCurrent = "Not-My-Password1!";
    private const string LockedMessage = "Too many wrong passwords. Try again in 15 minutes.";

    private static readonly DateTimeOffset Start = new(2026, 10, 18, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid UserId = Guid.Parse("4b1f0c7e-2a53-4d6e-8f10-9a7c3e5d2b61");
    private static readonly Guid ThisSession = Guid.Parse("7d3e9a10-5b64-4c28-9e1f-0a2b4c6d8e10");
    private static readonly Guid OtherSession = Guid.Parse("c8a2e4f6-1b3d-4579-8a0c-2e4f6a8c0e12");

    [Fact]
    public async Task AValidChangeDoesEveryEffectInOneTransactionAndKeepsThisDevice()
    {
        var harness = new Harness();

        var result = await harness.RunAsync(Current, Good);

        result.IsSuccess.ShouldBeTrue();
        Received.InOrder(() =>
        {
            harness.Tokens.LockAccountAsync(UserId, Arg.Any<CancellationToken>());
            harness.Accounts.SetPasswordAsync(UserId, Good, Arg.Any<CancellationToken>());
            harness.Tokens.RevokeOpenAsync(UserId, AccountTokenPurpose.PasswordReset, Start, Arg.Any<CancellationToken>());
            harness.Sessions.RevokeAllAsync(UserId, ThisSession, SessionRevocationReason.PasswordChanged, Start, Arg.Any<CancellationToken>());
        });
        await harness.Tokens.Received(1).LockAccountAsync(UserId, Arg.Any<CancellationToken>());
        await harness.Tokens.Received(1).RevokeOpenAsync(UserId, AccountTokenPurpose.PasswordReset, Start, Arg.Any<CancellationToken>());
        await harness.Accounts.Received(1).SetPasswordAsync(UserId, Good, Arg.Any<CancellationToken>());
        await harness.Accounts.Received(1).ResetFailedCountAsync(UserId, Arg.Any<CancellationToken>());
        await harness.Accounts.Received(1).ClearBreachRecheckAsync(UserId, Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().MarkBreachRecheckAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await harness.Sessions.Received(1).RevokeAllAsync(UserId, ThisSession, SessionRevocationReason.PasswordChanged, Start, Arg.Any<CancellationToken>());
        var mail = harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBeOfType<PasswordChangedEmail>();
        mail.To.ShouldBe(Email);
        mail.ChangedAt.ShouldBe(Start);
        mail.SessionsEnded.ShouldBeTrue();
        mail.OtherDevicesOnly.ShouldBeTrue();
        harness.Audit.Entries.ShouldBe(
        [
            new AuditCall(AuditActions.PasswordChanged, "User", UserId.ToString("D"), "profile", Independent: false),
            new AuditCall(AuditActions.SessionsRevoked, "User", UserId.ToString("D"), "password-changed", Independent: false),
        ]);
        harness.Unit.Commits.ShouldBe(1);
        harness.Unit.Rollbacks.ShouldBe(0);
        await harness.SessionCache.Received(1).EvictUserAsync(UserId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task WithNoOtherDeviceNoRevocationIsAudited()
    {
        var harness = new Harness { Revoked = [] };

        var result = await harness.RunAsync(Current, Good);

        result.IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.Select(static entry => entry.Action).ShouldBe([AuditActions.PasswordChanged]);
    }

    [Fact]
    public async Task ASkippedBreachCheckMarksARecheckAndAuditsIt()
    {
        var harness = new Harness(BreachCheckResult.Unavailable);

        var result = await harness.RunAsync(Current, Good);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.Received(1).MarkBreachRecheckAsync(UserId, Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().ClearBreachRecheckAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        harness.Audit.Entries.Select(static entry => entry.Action).ShouldBe(
            [AuditActions.PasswordChanged, AuditActions.SessionsRevoked, AuditActions.BreachCheckUnavailable]);
    }

    [Fact]
    public async Task TheBreachLookupRunsBeforeTheTransaction()
    {
        var harness = new Harness();
        var commitsAtLookup = -1;
        harness.Pwned.CheckAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(_ =>
        {
            commitsAtLookup = harness.Unit.Commits;
            return Task.FromResult(BreachCheckResult.NotBreached);
        });

        await harness.RunAsync(Current, Good);

        commitsAtLookup.ShouldBe(0);
        await harness.Pwned.Received(1).CheckAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AWrongCurrentPasswordIsAFieldErrorAndIsCounted()
    {
        var harness = new Harness();

        var result = await harness.RunAsync(WrongCurrent, Good);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()["currentPassword"].ShouldBe(["Your current password is incorrect."]);
        await harness.Accounts.Received(1).RecordFailedPasswordAsync(UserId, Arg.Any<CancellationToken>());
        await harness.AssertPasswordUnchangedAsync();
        harness.Outbox.Emails.ShouldBeEmpty();
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AWrongCurrentPasswordNeverReachesTheBreachLookup()
    {
        var harness = new Harness();

        await harness.RunAsync(WrongCurrent, Good);

        await harness.Pwned.DidNotReceive().CheckAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TheWrongPasswordThatLocksTheAccountAnswers429AndSendsTheOneLockoutEmail()
    {
        var lockoutEnd = Start.AddMinutes(15);
        var harness = new Harness { Failure = new FailedPasswordResult(LockedNow: true, lockoutEnd) };

        var result = await harness.RunAsync(WrongCurrent, Good);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.TooManyRequests);
        result.Error.Code.ShouldBe("profile.password-locked");
        result.Error.Message.ShouldBe(LockedMessage);
        result.Error.RetryAfter.ShouldBe(TimeSpan.FromMinutes(15));
        var mail = harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBeOfType<AccountLockedEmail>();
        mail.To.ShouldBe(Email);
        mail.LockedUntil.ShouldBe(lockoutEnd);
        mail.Cause.ShouldBe(LockoutCause.Password);
        mail.LockedFor.ShouldBe(TimeSpan.FromMinutes(15));
        harness.Audit.Entries.ShouldBe([new AuditCall(AuditActions.Lockout, "User", UserId.ToString("D"), "password", Independent: false)]);
        harness.Unit.Commits.ShouldBe(1);
        await harness.AssertPasswordUnchangedAsync();
    }

    [Fact]
    public async Task ALockThatAlreadyEndedByTheAnswerStillGivesAPositiveWait()
    {
        var harness = new Harness { Failure = new FailedPasswordResult(LockedNow: true, Start) };

        var result = await harness.RunAsync(WrongCurrent, Good);

        result.Error.Code.ShouldBe("profile.password-locked");
        result.Error.RetryAfter.ShouldNotBeNull().ShouldBeGreaterThan(TimeSpan.Zero);
    }

    [Fact]
    public async Task AnAlreadyLockedAccountAnswers429WithoutCheckingThePassword()
    {
        var harness = new Harness(lockoutEnd: Start.AddMinutes(9));

        var result = await harness.RunAsync(Current, Good);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.TooManyRequests);
        result.Error.Code.ShouldBe("profile.password-locked");
        result.Error.Message.ShouldBe(LockedMessage);
        result.Error.RetryAfter.ShouldBe(TimeSpan.FromMinutes(9));
        await harness.Accounts.DidNotReceiveWithAnyArgs().CheckPasswordAsync(default, default!, TestContext.Current.CancellationToken);
        await harness.Accounts.DidNotReceive().RecordFailedPasswordAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await harness.AssertPasswordUnchangedAsync();
        harness.Outbox.Emails.ShouldBeEmpty();
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task ALockThatHasEndedIsNotALock()
    {
        var harness = new Harness(lockoutEnd: Start.AddSeconds(-1));

        var result = await harness.RunAsync(Current, Good);

        result.IsSuccess.ShouldBeTrue();
    }

    [Theory]
    [InlineData("short1!", "Use at least 8 characters.")]
    [InlineData("Paolo#2026x", "Don't use your name or email in your password.")]
    [InlineData("Reyes#Tahi2026", "Don't use your name or email in your password.")]
    public async Task APolicyFailureIsAFieldErrorOnNewPasswordAndNothingIsSaved(string password, string message)
    {
        var harness = new Harness();

        var result = await harness.RunAsync(Current, password);

        AssertNewPasswordError(result, message);
        await harness.AssertPasswordUnchangedAsync();
    }

    [Fact]
    public async Task ABreachedPasswordIsRefusedWithTheBreachMessage()
    {
        var harness = new Harness(BreachCheckResult.Breached);

        var result = await harness.RunAsync(Current, Good);

        AssertNewPasswordError(result, PasswordRules.BreachedMessage);
        await harness.AssertPasswordUnchangedAsync();
    }

    [Fact]
    public async Task AnUnreachableServiceAndACommonPasswordIsRefusedAsTooCommon()
    {
        var harness = new Harness(BreachCheckResult.Unavailable, isCommon: true);

        var result = await harness.RunAsync(Current, Good);

        AssertNewPasswordError(result, PasswordRules.TooCommonMessage);
        await harness.AssertPasswordUnchangedAsync();
    }

    [Fact]
    public async Task TheCurrentPasswordAsTheNewOneIsRefusedWithoutALookup()
    {
        var harness = new Harness();

        var result = await harness.RunAsync(Current, Current);

        AssertNewPasswordError(result, SetNewPasswordHandler.SameAsCurrentMessage);
        await harness.Pwned.DidNotReceive().CheckAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
        await harness.AssertPasswordUnchangedAsync();
    }

    [Fact]
    public async Task TheSamePasswordInAnotherUnicodeFormIsStillTheSamePassword()
    {
        var composed = "Café#Tahi2026";
        var decomposed = "Café#Tahi2026";
        var harness = new Harness(current: composed);

        var result = await harness.RunAsync(composed, decomposed);

        AssertNewPasswordError(result, SetNewPasswordHandler.SameAsCurrentMessage);
    }

    [Fact]
    public async Task ASamePasswordGuessCannotProbeTheCurrentPassword()
    {
        // Equal-to-current is only decided after the current password was verified and counted, so it is no oracle.
        var harness = new Harness();

        var result = await harness.RunAsync(WrongCurrent, WrongCurrent);

        result.Error.FieldErrors.ShouldNotBeNull().ContainsKey("currentPassword").ShouldBeTrue();
        await harness.Accounts.Received(1).RecordFailedPasswordAsync(UserId, Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(null, Good, "currentPassword", "Enter your current password.")]
    [InlineData("", Good, "currentPassword", "Enter your current password.")]
    [InlineData(Current, null, "newPassword", "Enter a new password.")]
    [InlineData(Current, "", "newPassword", "Enter a new password.")]
    [InlineData(Current, "abcdefg1", "newPassword", "Add at least one symbol, like ! or #.")]
    public async Task AnInvalidFormNeverReachesThePorts(string? current, string? next, string field, string message)
    {
        var harness = new Harness();

        var result = await harness.RunAsync(current, next);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe(AuthErrors.ValidationCode);
        result.Error.FieldErrors.ShouldNotBeNull()[field].ShouldContain(message);
        harness.Accounts.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Commits.ShouldBe(0);
    }

    [Fact]
    public async Task NoUserOrNoSessionInTheRequestIsASessionEndedAndTouchesNothing()
    {
        foreach (var harness in new[] { new Harness { SignedIn = false }, new Harness { HasSession = false } })
        {
            var result = await harness.RunAsync(Current, Good);

            result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
            harness.Accounts.ReceivedCalls().ShouldBeEmpty();
            harness.Sessions.ReceivedCalls().ShouldBeEmpty();
        }
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("deactivated")]
    [InlineData("manager-locked")]
    [InlineData("deleted")]
    public async Task AnAccountThatMayNotSignInIsASessionEndedAndIsNotCounted(string account)
    {
        var harness = new Harness(account: account);

        var result = await harness.RunAsync(WrongCurrent, Good);

        result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
        await harness.Accounts.DidNotReceiveWithAnyArgs().CheckPasswordAsync(default, default!, TestContext.Current.CancellationToken);
        await harness.Accounts.DidNotReceive().RecordFailedPasswordAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await harness.AssertPasswordUnchangedAsync();
    }

    [Fact]
    public async Task ARaceLostOnceIsRetriedAndSucceeds()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.RunAsync(Current, Good);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task ARaceLostTwiceIsASessionBusyConflictAndEvictsNothing()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.RunAsync(Current, Good);

        result.Error.ShouldBeSameAs(AuthErrors.SessionBusy);
        harness.Unit.Commits.ShouldBe(0);
        await harness.SessionCache.DidNotReceive().EvictUserAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AFailureAnywhereRollsBackTheWholeChange()
    {
        var harness = new Harness();
        harness.Outbox.FailWith = new InvalidOperationException("The outbox is down.");

        await Should.ThrowAsync<InvalidOperationException>(() => harness.RunAsync(Current, Good));

        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(0);
        await harness.SessionCache.DidNotReceive().EvictUserAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task NoAuditEntryHoldsEitherPasswordOrTheEmail()
    {
        var harness = new Harness();

        await harness.RunAsync(Current, Good);

        harness.Audit.Entries.ShouldAllBe(entry => entry.Detail == null
            || (!entry.Detail.Contains(Current, StringComparison.Ordinal)
                && !entry.Detail.Contains(Good, StringComparison.Ordinal)
                && !entry.Detail.Contains(Email, StringComparison.Ordinal)));
    }

    [Fact]
    public void TheRequestNeverPrintsEitherPasswordAndTheEmptyRequestHasNone()
    {
        var text = new ChangePasswordRequest(Current, Good).ToString();

        text.ShouldNotContain(Current);
        text.ShouldNotContain(Good);
        ChangePasswordRequest.Empty.CurrentPassword.ShouldBeNull();
        ChangePasswordRequest.Empty.NewPassword.ShouldBeNull();
    }

    private static void AssertNewPasswordError(Result result, string message)
    {
        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()["newPassword"].ShouldBe([message]);
    }

    private sealed class Harness
    {
        private readonly string _current;

        public Harness(
            BreachCheckResult breach = BreachCheckResult.NotBreached,
            bool isCommon = false,
            string account = "active",
            DateTimeOffset? lockoutEnd = null,
            string current = Current)
        {
            _current = current;
            Time = new FakeTimeProvider(Start);

            Accounts = Substitute.For<IUserAccounts>();
            UserAccount? user = account switch
            {
                "missing" => null,
                "deactivated" => Account(isActive: false),
                "manager-locked" => Account(isManagerLocked: true),
                "deleted" => Account(isDeleted: true),
                _ => Account(lockoutEnd),
            };
            Accounts.FindByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(Task.FromResult(user));
            Accounts.CheckPasswordAsync(UserId, Arg.Any<string>(), Arg.Any<CancellationToken>())
                .Returns(call => Task.FromResult(call.ArgAt<string>(1) == _current ? PasswordCheck.Succeeded : PasswordCheck.Failed));
            Accounts.RecordFailedPasswordAsync(UserId, Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult(Failure));

            Pwned = Substitute.For<IPwnedPasswords>();
            Pwned.CheckAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(breach);
            var common = Substitute.For<ICommonPasswords>();
            common.IsCommon(Arg.Any<string>()).Returns(isCommon);

            Sessions = Substitute.For<ISessions>();
            Sessions.RevokeAllAsync(UserId, ThisSession, SessionRevocationReason.PasswordChanged, Start, Arg.Any<CancellationToken>())
                .Returns(_ => Task.FromResult<IReadOnlyList<Guid>>(Revoked));

            PasswordRules = new PasswordRules(Pwned, common);
        }

        public IUserAccounts Accounts { get; }

        public IPwnedPasswords Pwned { get; }

        public ISessions Sessions { get; }

        public ISessionCache SessionCache { get; } = Substitute.For<ISessionCache>();

        public IAccountTokens Tokens { get; } = Substitute.For<IAccountTokens>();

        public RecordingOutbox Outbox { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public FakeTimeProvider Time { get; }

        public bool SignedIn { get; init; } = true;

        public bool HasSession { get; init; } = true;

        public IReadOnlyList<Guid> Revoked { get; init; } = [OtherSession];

        public FailedPasswordResult Failure { get; init; } = new(LockedNow: false, null);

        private PasswordRules PasswordRules { get; }

        public Task<Result> RunAsync(string? current, string? next) =>
            Build().HandleAsync(new ChangePasswordRequest(current, next), TestContext.Current.CancellationToken);

        public async Task AssertPasswordUnchangedAsync()
        {
            await Accounts.DidNotReceive().SetPasswordAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
            await Accounts.DidNotReceive().ResetFailedCountAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
            await Accounts.DidNotReceive().MarkBreachRecheckAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
            await Accounts.DidNotReceive().ClearBreachRecheckAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
            await Sessions.DidNotReceiveWithAnyArgs().RevokeAllAsync(default, default, default, default, default);
            await Tokens.DidNotReceive().LockAccountAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
            await Tokens.DidNotReceive().RevokeOpenAsync(Arg.Any<Guid>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
            await SessionCache.DidNotReceive().EvictUserAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
            Outbox.Emails.OfType<PasswordChangedEmail>().ShouldBeEmpty();
        }

        private static UserAccount Account(DateTimeOffset? lockoutEnd = null, bool isActive = true, bool isManagerLocked = false, bool isDeleted = false) =>
            new(UserId, Email, "Paolo", "Reyes", "Manager", isActive, true, true, null, false, lockoutEnd, isManagerLocked, isDeleted);

        private ChangePasswordHandler Build()
        {
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(SignedIn ? UserId : null);
            request.SessionId.Returns(HasSession ? ThisSession : null);
            return new ChangePasswordHandler(
                Accounts,
                Sessions,
                SessionCache,
                PasswordRules,
                Outbox,
                Audit,
                Unit,
                request,
                new ChangePasswordRequestValidator(),
                new CurrentPasswordCheck(Accounts, Outbox, Audit, Unit, new AuthSettings(), Time),
                Time);
        }
    }
}

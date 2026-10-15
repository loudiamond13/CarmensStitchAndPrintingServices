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
/// AUTH-09, AUTH-10, AUTH-11, D-14, D-17, D-18, D-19: a reset applies the full password rule, then spends the link, ends
/// every session and lockout and queues the changed email in one transaction, or changes nothing.
/// </summary>
public sealed class ResetPasswordHandlerTests
{
    private const string Email = "paolo.reyes@example.com";
    private const string Secret = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";
    private const string Good = "Tela-Sukat-7381";

    private static readonly DateTimeOffset Start = new(2026, 10, 14, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid UserId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");

    [Theory]
    [InlineData("short1!", "Use at least 8 characters.")]
    [InlineData("Paolo#2026x", "Don't use your name or email in your password.")]
    public async Task APolicyFailureIs400OnNewPasswordAndNothingElseHappens(string password, string message)
    {
        var harness = Harness.Create();

        var result = await harness.Handler.HandleAsync(new ResetPasswordRequest(Secret, password), TestContext.Current.CancellationToken);

        AssertFieldError(result, message);
        await harness.AssertNothingChangedAsync();
        await harness.Pwned.DidNotReceive().CheckAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ABreachedPasswordIs400WithTheBreachMessageAndNothingChanges()
    {
        var harness = Harness.Create(BreachCheckResult.Breached);

        var result = await harness.Handler.HandleAsync(new ResetPasswordRequest(Secret, Good), TestContext.Current.CancellationToken);

        AssertFieldError(result, PasswordRules.BreachedMessage);
        await harness.AssertNothingChangedAsync();
    }

    [Fact]
    public async Task AnUnreachableServiceAndACommonPasswordIs400WithTheCommonMessage()
    {
        var harness = Harness.Create(BreachCheckResult.Unavailable, isCommon: true);

        var result = await harness.Handler.HandleAsync(new ResetPasswordRequest(Secret, Good), TestContext.Current.CancellationToken);

        AssertFieldError(result, PasswordRules.TooCommonMessage);
        await harness.AssertNothingChangedAsync();
    }

    [Fact]
    public async Task AnUnreachableServiceAndAnUncommonPasswordIsAcceptedAndMarkedForARecheck()
    {
        var harness = Harness.Create(BreachCheckResult.Unavailable);

        var result = await harness.Handler.HandleAsync(new ResetPasswordRequest(Secret, Good), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.Received(1).MarkBreachRecheckAsync(UserId, Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().ClearBreachRecheckAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        var entry = harness.Audit.Entries.Single(e => e.Action == AuditActions.BreachCheckUnavailable);
        entry.TargetType.ShouldBe("User");
        entry.TargetId.ShouldBe(UserId.ToString("D"));
        entry.Independent.ShouldBeFalse();
    }

    [Fact]
    public async Task ACleanBreachAnswerClearsAnyRecheckMark()
    {
        var harness = Harness.Create();

        var result = await harness.Handler.HandleAsync(new ResetPasswordRequest(Secret, Good), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.Received(1).ClearBreachRecheckAsync(UserId, Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().MarkBreachRecheckAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        harness.Audit.Entries.ShouldNotContain(e => e.Action == AuditActions.BreachCheckUnavailable);
    }

    [Fact]
    public async Task AResetDoesEveryEffectInOneTransactionAndEvictsTheUserAfterTheCommit()
    {
        var harness = Harness.Create();

        var result = await harness.Handler.HandleAsync(new ResetPasswordRequest(Secret, Good), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Token.UsedAt.ShouldBe(Start);
        await harness.Accounts.Received(1).SetPasswordAsync(UserId, Good, Arg.Any<CancellationToken>());
        await harness.Accounts.Received(1).ClearLockoutAsync(UserId, Arg.Any<CancellationToken>());
        await harness.Accounts.Received(1).ClearMustChangePasswordAsync(UserId, Arg.Any<CancellationToken>());
        await harness.Tokens.Received(1).RevokeOpenAsync(UserId, AccountTokenPurpose.PasswordReset, Start, Arg.Any<CancellationToken>());
        await harness.Sessions.Received(1).RevokeAllAsync(UserId, null, SessionRevocationReason.PasswordReset, Start, Arg.Any<CancellationToken>());
        await harness.SessionCache.Received(1).EvictUserAsync(UserId, Arg.Any<CancellationToken>());

        var mail = harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBeOfType<PasswordChangedEmail>();
        mail.To.ShouldBe(Email);
        mail.SessionsEnded.ShouldBeTrue();
        mail.ChangedAt.ShouldBe(Start);

        harness.Audit.Entries.Select(e => (e.Action, e.Detail)).ShouldBe(
            [(AuditActions.PasswordResetCompleted, null), (AuditActions.SessionsRevoked, "password-reset")]);
        harness.Audit.Entries.ShouldAllBe(e => e.TargetType == "User" && e.TargetId == UserId.ToString("D") && !e.Independent);
        harness.Unit.Commits.ShouldBe(1);
        harness.Unit.Rollbacks.ShouldBe(0);
    }

    [Fact]
    public async Task TheLinkIsSpentAndSavedBeforeAnyOtherChange()
    {
        var harness = Harness.Create();
        var tokenUsedAtFirstAccountCall = false;
        harness.Accounts.SetPasswordAsync(UserId, Good, Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                tokenUsedAtFirstAccountCall = harness.Token.UsedAt is not null && harness.Unit.Saves == 1;
                return Task.CompletedTask;
            });

        await harness.Handler.HandleAsync(new ResetPasswordRequest(Secret, Good), TestContext.Current.CancellationToken);

        tokenUsedAtFirstAccountCall.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(2);
    }

    [Fact]
    public async Task AFailureAnywhereRollsBackAndEvictsNobody()
    {
        var harness = Harness.Create();
        harness.Outbox.FailWith = new InvalidOperationException("The outbox is down.");

        await Should.ThrowAsync<InvalidOperationException>(
            () => harness.Handler.HandleAsync(new ResetPasswordRequest(Secret, Good), TestContext.Current.CancellationToken));

        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(0);
        await harness.SessionCache.DidNotReceive().EvictUserAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        harness.Audit.Entries.ShouldNotContain(e => e.Action == AuditActions.PasswordResetLinkInvalid);
    }

    [Fact]
    public async Task AnEmptyPasswordIs400AndTheLinkIsNotLookedUp()
    {
        var harness = Harness.Create();

        var result = await harness.Handler.HandleAsync(new ResetPasswordRequest(Secret, string.Empty), TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()["newPassword"].ShouldBe([ResetPasswordRequestValidator.NewPasswordRequired]);
        await harness.Tokens.DidNotReceive().FindByHashAsync(Arg.Any<byte[]>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("too-short")]
    [InlineData("0123456789abcdefghijklmnopqrstuvwxyzABCDEF=")]
    public async Task AMissingOrMalformedTokenIsTheInvalidLinkAnswerWithoutALookup(string? token)
    {
        var harness = Harness.Create();

        var result = await harness.Handler.HandleAsync(new ResetPasswordRequest(token, Good), TestContext.Current.CancellationToken);

        AssertInvalidLink(result);
        await harness.Tokens.DidNotReceive().FindByHashAsync(Arg.Any<byte[]>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<CancellationToken>());
        await harness.AssertNothingChangedAsync();
        harness.AssertInvalidLinkAudited();
    }

    [Theory]
    [InlineData("unknown")]
    [InlineData("used")]
    [InlineData("revoked")]
    [InlineData("expired")]
    [InlineData("at-expiry")]
    [InlineData("account-missing")]
    [InlineData("deactivated")]
    [InlineData("unconfirmed")]
    public async Task AnyLinkThatDoesNotWorkIsTheSameInvalidAnswerAndChangesNothing(string reason)
    {
        var harness = Harness.Create();
        harness.Break(reason);

        var result = await harness.Handler.HandleAsync(new ResetPasswordRequest(Secret, Good), TestContext.Current.CancellationToken);

        AssertInvalidLink(result);
        await harness.AssertNothingChangedAsync();
        await harness.Pwned.DidNotReceive().CheckAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
        harness.AssertInvalidLinkAudited();
    }

    [Fact]
    public async Task ALockedAccountMayResetAndTheResetEndsTheLockout()
    {
        var harness = Harness.Create(lockoutEnd: Start.AddMinutes(10));

        var result = await harness.Handler.HandleAsync(new ResetPasswordRequest(Secret, Good), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.Received(1).ClearLockoutAsync(UserId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ARaceLostToAnotherResetReadsTheSpentLinkAsInvalid()
    {
        var harness = Harness.Create();
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.Handler.HandleAsync(new ResetPasswordRequest(Secret, Good), TestContext.Current.CancellationToken);

        // The fake keeps the same tracked token, which the first pass spent, as the winner's save would have.
        AssertInvalidLink(result);
        harness.Unit.Rollbacks.ShouldBe(1);
        await harness.SessionCache.DidNotReceive().EvictUserAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().SetPasswordAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TwoLostRacesAnswerBusyAndChangeNothing()
    {
        var harness = Harness.Create();
        harness.Unit.FailEverySaveWithConflict();
        harness.Tokens.FindByHashAsync(Arg.Any<byte[]>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromResult<AccountToken?>(NewToken()));

        var result = await harness.Handler.HandleAsync(new ResetPasswordRequest(Secret, Good), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Conflict);
        result.Error.Code.ShouldBe(AuthErrors.SessionBusyCode);
        harness.Unit.Rollbacks.ShouldBe(2);
        await harness.SessionCache.DidNotReceive().EvictUserAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task NoAuditEntryHoldsTheEmailTheTokenOrThePassword()
    {
        var harness = Harness.Create(BreachCheckResult.Unavailable);

        await harness.Handler.HandleAsync(new ResetPasswordRequest(Secret, Good), TestContext.Current.CancellationToken);

        harness.Audit.Entries.ShouldAllBe(e => e.Detail == null
            || (!e.Detail.Contains(Email, StringComparison.Ordinal)
                && !e.Detail.Contains(Secret, StringComparison.Ordinal)
                && !e.Detail.Contains(Good, StringComparison.Ordinal)));
    }

    private static AccountToken NewToken() =>
        AccountToken.Create(UserId, AccountTokenPurpose.PasswordReset, TokenHash.Compute(Secret), Start, TimeSpan.FromMinutes(30));

    private static void AssertFieldError(Result result, string message)
    {
        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()["newPassword"].ShouldBe([message]);
    }

    private static void AssertInvalidLink(Result result)
    {
        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.NotFound);
        result.Error.Code.ShouldBe("auth.link-invalid");
        result.Error.Message.ShouldBe("This link has expired");
    }

    private sealed class Harness
    {
        private Harness(BreachCheckResult breach, bool isCommon, DateTimeOffset? lockoutEnd)
        {
            Accounts = Substitute.For<IUserAccounts>();
            Tokens = Substitute.For<IAccountTokens>();
            Sessions = Substitute.For<ISessions>();
            SessionCache = Substitute.For<ISessionCache>();
            Pwned = Substitute.For<IPwnedPasswords>();
            Pwned.CheckAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(breach);
            var common = Substitute.For<ICommonPasswords>();
            common.IsCommon(Arg.Any<string>()).Returns(isCommon);
            Time = new FakeTimeProvider(Start);
            Token = NewToken();

            Account = new UserAccount(UserId, Email, "Paolo", "Reyes", "Manager", true, true, true, null, false, lockoutEnd);
            Tokens.FindByHashAsync(Arg.Any<byte[]>(), AccountTokenPurpose.PasswordReset, Arg.Any<CancellationToken>())
                .Returns(call => Task.FromResult(TokenHash.Equal(call.Arg<byte[]>(), TokenHash.Compute(Secret)) ? Token : null));
            Accounts.FindByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<UserAccount?>(Account));
            Sessions.RevokeAllAsync(Arg.Any<Guid>(), Arg.Any<Guid?>(), Arg.Any<SessionRevocationReason>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<IReadOnlyList<Guid>>([Guid.NewGuid()]));

            Handler = new ResetPasswordHandler(
                Tokens,
                Accounts,
                Sessions,
                SessionCache,
                new PasswordRules(Pwned, common),
                Outbox,
                Audit,
                Unit,
                new ResetPasswordRequestValidator(),
                Time);
        }

        public IUserAccounts Accounts { get; }

        public IAccountTokens Tokens { get; }

        public ISessions Sessions { get; }

        public ISessionCache SessionCache { get; }

        public IPwnedPasswords Pwned { get; }

        public RecordingOutbox Outbox { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public FakeTimeProvider Time { get; }

        private DateTimeOffset? _usedAtStart;

        public AccountToken Token { get; private set; }

        public UserAccount Account { get; private set; }

        public ResetPasswordHandler Handler { get; }

        public static Harness Create(BreachCheckResult breach = BreachCheckResult.NotBreached, bool isCommon = false, DateTimeOffset? lockoutEnd = null) =>
            new(breach, isCommon, lockoutEnd);

        // Makes the link fail for one reason; every reason must read the same to the caller.
        public void Break(string reason)
        {
            switch (reason)
            {
                case "unknown":
                    Tokens.FindByHashAsync(Arg.Any<byte[]>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<CancellationToken>())
                        .Returns(Task.FromResult<AccountToken?>(null));
                    break;
                case "used":
                    Token.Use(Start);
                    _usedAtStart = Start;
                    break;
                case "revoked":
                    Token.Revoke(Start);
                    break;
                case "expired":
                    Time.Advance(TimeSpan.FromMinutes(31));
                    break;
                case "at-expiry":
                    Time.Advance(TimeSpan.FromMinutes(30));
                    break;
                case "account-missing":
                    Accounts.FindByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<UserAccount?>(null));
                    break;
                case "deactivated":
                    Account = Account with { IsActive = false };
                    Accounts.FindByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<UserAccount?>(Account));
                    break;
                case "unconfirmed":
                    Account = Account with { EmailConfirmed = false };
                    Accounts.FindByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<UserAccount?>(Account));
                    break;
                default:
                    throw new ArgumentOutOfRangeException(nameof(reason), reason, "Unknown reason.");
            }
        }

        public void AssertInvalidLinkAudited()
        {
            var entry = Audit.Entries.ShouldHaveSingleItem();
            entry.Action.ShouldBe(AuditActions.PasswordResetLinkInvalid);
            entry.Independent.ShouldBeTrue();
            entry.TargetType.ShouldBeNull();
            entry.TargetId.ShouldBeNull();
            entry.Detail.ShouldBeNull();
        }

        // Nothing was spent, saved, queued, revoked or evicted.
        public async Task AssertNothingChangedAsync()
        {
            Token.UsedAt.ShouldBe(_usedAtStart);
            Unit.Saves.ShouldBe(0);
            Outbox.Emails.ShouldBeEmpty();
            await Accounts.DidNotReceive().SetPasswordAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
            await Accounts.DidNotReceive().ClearLockoutAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
            await Accounts.DidNotReceive().ClearMustChangePasswordAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
            await Accounts.DidNotReceive().MarkBreachRecheckAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
            await Tokens.DidNotReceive().RevokeOpenAsync(Arg.Any<Guid>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
            await Sessions.DidNotReceive().RevokeAllAsync(Arg.Any<Guid>(), Arg.Any<Guid?>(), Arg.Any<SessionRevocationReason>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
            await SessionCache.DidNotReceive().EvictUserAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
            Audit.Entries.ShouldNotContain(e => e.Action == AuditActions.PasswordResetCompleted || e.Action == AuditActions.SessionsRevoked);
        }
    }
}

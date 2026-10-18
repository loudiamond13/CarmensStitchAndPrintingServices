using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Auth;

/// <summary>
/// AUTH-12, D-14, D-29: accepting an invite applies the full password rule with the breach check failing closed, then
/// spends the invite, saves the password, confirms the address and audits it in one transaction, or changes nothing.
/// </summary>
public sealed class AcceptInviteHandlerTests
{
    private const string Email = "carmen.reyes@example.com";
    private const string Secret = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";
    private const string Good = "Tela-Sukat-7381";

    private static readonly DateTimeOffset Start = new(2026, 10, 14, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid UserId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");

    [Fact]
    public async Task AnAcceptanceDoesEveryEffectInOneTransactionAndIssuesNoSession()
    {
        var harness = Harness.Create();

        var result = await harness.Handler.HandleAsync(new AcceptInviteRequest(Secret, Good), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Token.UsedAt.ShouldBe(Start);
        await harness.Accounts.Received(1).SetPasswordAsync(UserId, Good, Arg.Any<CancellationToken>());
        await harness.Accounts.Received(1).ConfirmEmailAsync(UserId, Arg.Any<CancellationToken>());
        await harness.Tokens.Received(1).RevokeOpenAsync(UserId, AccountTokenPurpose.Invitation, Start, Arg.Any<CancellationToken>());
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Action.ShouldBe(AuditActions.InviteAccepted);
        entry.TargetType.ShouldBe("User");
        entry.TargetId.ShouldBe(UserId.ToString("D"));
        entry.Independent.ShouldBeFalse();
        harness.Unit.Commits.ShouldBe(1);
        harness.Unit.Saves.ShouldBe(2);
    }

    [Fact]
    public async Task TheInviteIsSpentAndSavedBeforeThePasswordIsSet()
    {
        var harness = Harness.Create();
        var spentAtPasswordTime = false;
        harness.Accounts.SetPasswordAsync(UserId, Good, Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                spentAtPasswordTime = harness.Token.UsedAt is not null && harness.Unit.Saves == 1;
                return Task.CompletedTask;
            });

        await harness.Handler.HandleAsync(new AcceptInviteRequest(Secret, Good), TestContext.Current.CancellationToken);

        spentAtPasswordTime.ShouldBeTrue();
    }

    [Fact]
    public async Task AnUnreachableBreachListSavesNothingAndNeverSetsThePassword()
    {
        var harness = Harness.Create(BreachCheckResult.Unavailable);

        var result = await harness.Handler.HandleAsync(new AcceptInviteRequest(Secret, Good), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        result.Error.Code.ShouldBe("auth.breach-check-unavailable");
        result.Error.Message.ShouldBe("We couldn't check your password right now.");
        await harness.AssertNothingChangedAsync();
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Action.ShouldBe(AuditActions.BreachCheckUnavailable);
        entry.Independent.ShouldBeTrue();
        entry.TargetId.ShouldBe(UserId.ToString("D"));
    }

    [Fact]
    public async Task AUncommonPasswordIsStillRefusedWhileTheBreachListIsDown()
    {
        var harness = Harness.Create(BreachCheckResult.Unavailable, isCommon: false);

        var result = await harness.Handler.HandleAsync(new AcceptInviteRequest(Secret, "Hibp-Down#2026"), TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe("auth.breach-check-unavailable");
        await harness.Accounts.DidNotReceive().MarkBreachRecheckAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("short1!", "Use at least 8 characters.")]
    [InlineData("Carmen#2026x", "Don't use your name or email in your password.")]
    public async Task APolicyFailureIs400OnNewPasswordAndNothingChanges(string password, string message)
    {
        var harness = Harness.Create();

        var result = await harness.Handler.HandleAsync(new AcceptInviteRequest(Secret, password), TestContext.Current.CancellationToken);

        AssertFieldError(result, message);
        await harness.AssertNothingChangedAsync();
        await harness.Pwned.DidNotReceive().CheckAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ABreachedPasswordIs400WithTheBreachMessageAndNothingChanges()
    {
        var harness = Harness.Create(BreachCheckResult.Breached);

        var result = await harness.Handler.HandleAsync(new AcceptInviteRequest(Secret, Good), TestContext.Current.CancellationToken);

        AssertFieldError(result, PasswordRules.BreachedMessage);
        await harness.AssertNothingChangedAsync();
    }

    [Fact]
    public async Task AnEmptyPasswordIs400AndTheInviteIsNotLookedUp()
    {
        var harness = Harness.Create();

        var result = await harness.Handler.HandleAsync(new AcceptInviteRequest(Secret, string.Empty), TestContext.Current.CancellationToken);

        AssertFieldError(result, AcceptInviteRequestValidator.NewPasswordRequired);
        await harness.Tokens.DidNotReceive().FindByHashAsync(Arg.Any<byte[]>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("too-short")]
    [InlineData("0123456789abcdefghijklmnopqrstuvwxyzABCDEF=")]
    public async Task AMissingOrMalformedTokenIsTheInvalidInviteAnswerWithoutALookup(string? token)
    {
        var harness = Harness.Create();

        var result = await harness.Handler.HandleAsync(new AcceptInviteRequest(token, Good), TestContext.Current.CancellationToken);

        AssertInvalidInvite(result);
        await harness.Tokens.DidNotReceive().FindByHashAsync(Arg.Any<byte[]>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<CancellationToken>());
        await harness.AssertNothingChangedAsync();
    }

    [Theory]
    [InlineData("unknown")]
    [InlineData("used")]
    [InlineData("revoked")]
    [InlineData("expired")]
    [InlineData("at-expiry")]
    [InlineData("account-missing")]
    [InlineData("deactivated")]
    public async Task AnyInviteThatDoesNotWorkIsTheSameInvalidAnswerAndChangesNothing(string reason)
    {
        var harness = Harness.Create();
        harness.Break(reason);

        var result = await harness.Handler.HandleAsync(new AcceptInviteRequest(Secret, Good), TestContext.Current.CancellationToken);

        AssertInvalidInvite(result);
        await harness.AssertNothingChangedAsync();
        await harness.Pwned.DidNotReceive().CheckAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnUnconfirmedAccountMayAcceptItsInvite()
    {
        var harness = Harness.Create(confirmed: false);

        var result = await harness.Handler.HandleAsync(new AcceptInviteRequest(Secret, Good), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.Received(1).ConfirmEmailAsync(UserId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ARaceLostToAnotherAcceptanceReadsTheSpentInviteAsInvalid()
    {
        var harness = Harness.Create();
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.Handler.HandleAsync(new AcceptInviteRequest(Secret, Good), TestContext.Current.CancellationToken);

        AssertInvalidInvite(result);
        harness.Unit.Rollbacks.ShouldBe(1);
        await harness.Accounts.DidNotReceive().SetPasswordAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TwoLostRacesAnswerBusyAndChangeNothing()
    {
        var harness = Harness.Create();
        harness.Unit.FailEverySaveWithConflict();
        harness.Tokens.FindByHashAsync(Arg.Any<byte[]>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromResult<AccountToken?>(NewToken()));

        var result = await harness.Handler.HandleAsync(new AcceptInviteRequest(Secret, Good), TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Conflict);
        result.Error.Code.ShouldBe(AuthErrors.SessionBusyCode);
        await harness.Accounts.DidNotReceive().SetPasswordAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AFailureAnywhereRollsBack()
    {
        var harness = Harness.Create();
        harness.Accounts.ConfirmEmailAsync(UserId, Arg.Any<CancellationToken>()).Returns(Task.FromException(new InvalidOperationException("Down.")));

        await Should.ThrowAsync<InvalidOperationException>(
            () => harness.Handler.HandleAsync(new AcceptInviteRequest(Secret, Good), TestContext.Current.CancellationToken));

        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(0);
    }

    [Fact]
    public async Task NoAuditEntryHoldsTheEmailTheTokenOrThePassword()
    {
        var harness = Harness.Create();
        var down = Harness.Create(BreachCheckResult.Unavailable);

        await harness.Handler.HandleAsync(new AcceptInviteRequest(Secret, Good), TestContext.Current.CancellationToken);
        await down.Handler.HandleAsync(new AcceptInviteRequest(Secret, Good), TestContext.Current.CancellationToken);

        foreach (var entry in harness.Audit.Entries.Concat(down.Audit.Entries))
        {
            (entry.Detail ?? string.Empty).ShouldNotContain(Email);
            (entry.Detail ?? string.Empty).ShouldNotContain(Secret);
            (entry.Detail ?? string.Empty).ShouldNotContain(Good);
        }
    }

    [Fact]
    public async Task TheBreachCheckRunsAfterTheLookupAndBeforeTheTransactionThenTheInviteIsReadAgainInside()
    {
        var harness = Harness.Create();
        var events = new List<string>();
        harness.Tokens.FindByHashAsync(Arg.Any<byte[]>(), AccountTokenPurpose.Invitation, Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                events.Add(harness.Unit.InTransaction ? "lookup:inside" : "lookup:outside");
                return Task.FromResult<AccountToken?>(harness.Token);
            });
        harness.Pwned.CheckAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                events.Add(harness.Unit.InTransaction ? "breach:inside" : "breach:outside");
                return Task.FromResult(BreachCheckResult.NotBreached);
            });

        var result = await harness.Handler.HandleAsync(new AcceptInviteRequest(Secret, Good), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        events.ShouldBe(["lookup:outside", "breach:outside", "lookup:inside"]);
    }

    [Fact]
    public async Task AnInviteSpentDuringTheBreachCheckIsTheInvalidAnswerAndChangesNothingMore()
    {
        var harness = Harness.Create();
        harness.Pwned.CheckAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                harness.Token.Use(Start);
                return Task.FromResult(BreachCheckResult.NotBreached);
            });

        var result = await harness.Handler.HandleAsync(new AcceptInviteRequest(Secret, Good), TestContext.Current.CancellationToken);

        AssertInvalidInvite(result);
        harness.Unit.Saves.ShouldBe(0);
        await harness.Accounts.DidNotReceive().SetPasswordAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().ConfirmEmailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ARetryAfterALostRaceDoesNotCallTheBreachServiceAgain()
    {
        var harness = Harness.Create();
        harness.Unit.FailFirstSaveWithConflict();
        harness.Tokens.FindByHashAsync(Arg.Any<byte[]>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromResult<AccountToken?>(NewToken()));

        var result = await harness.Handler.HandleAsync(new AcceptInviteRequest(Secret, Good), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Rollbacks.ShouldBe(1);
        await harness.Pwned.Received(1).CheckAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    private static AccountToken NewToken() =>
        AccountToken.Create(UserId, AccountTokenPurpose.Invitation, TokenHash.Compute(Secret), Start, TimeSpan.FromHours(72));

    private static void AssertFieldError(Result result, string message)
    {
        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()["newPassword"].ShouldBe([message]);
    }

    private static void AssertInvalidInvite(Result result)
    {
        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.NotFound);
        result.Error.Code.ShouldBe("auth.invite-invalid");
        result.Error.Message.ShouldBe("This invite has expired");
    }

    private sealed class Harness
    {
        private DateTimeOffset? _usedAtStart;

        private Harness(BreachCheckResult breach, bool isCommon, bool confirmed)
        {
            Accounts = Substitute.For<IUserAccounts>();
            Tokens = Substitute.For<IAccountTokens>();
            Pwned = Substitute.For<IPwnedPasswords>();
            Pwned.CheckAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(breach);
            var common = Substitute.For<ICommonPasswords>();
            common.IsCommon(Arg.Any<string>()).Returns(isCommon);
            Time = new FakeTimeProvider(Start);
            Token = NewToken();

            Account = new UserAccount(UserId, Email, "Carmen", "Reyes", "Manager", true, confirmed, false, null, false, null);
            Tokens.FindByHashAsync(Arg.Any<byte[]>(), AccountTokenPurpose.Invitation, Arg.Any<CancellationToken>())
                .Returns(call => Task.FromResult(TokenHash.Equal(call.Arg<byte[]>(), TokenHash.Compute(Secret)) ? Token : null));
            Accounts.FindByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<UserAccount?>(Account));

            Handler = new AcceptInviteHandler(
                Tokens, Accounts, new PasswordRules(Pwned, common), Audit, Unit, new AcceptInviteRequestValidator(), Time);
        }

        public IUserAccounts Accounts { get; }

        public IAccountTokens Tokens { get; }

        public IPwnedPasswords Pwned { get; }

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public FakeTimeProvider Time { get; }

        public AccountToken Token { get; }

        public UserAccount Account { get; private set; }

        public AcceptInviteHandler Handler { get; }

        public static Harness Create(BreachCheckResult breach = BreachCheckResult.NotBreached, bool isCommon = false, bool confirmed = false) =>
            new(breach, isCommon, confirmed);

        // Makes the invite fail for one reason; every reason must read the same to the caller.
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
                    Time.Advance(TimeSpan.FromHours(73));
                    break;
                case "at-expiry":
                    Time.Advance(TimeSpan.FromHours(72));
                    break;
                case "account-missing":
                    Accounts.FindByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<UserAccount?>(null));
                    break;
                case "deactivated":
                    Account = Account with { IsActive = false };
                    Accounts.FindByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<UserAccount?>(Account));
                    break;
                default:
                    throw new ArgumentOutOfRangeException(nameof(reason), reason, "Unknown reason.");
            }
        }

        // Nothing was spent, saved or changed on the account.
        public async Task AssertNothingChangedAsync()
        {
            Token.UsedAt.ShouldBe(_usedAtStart);
            Unit.Saves.ShouldBe(0);
            await Accounts.DidNotReceive().SetPasswordAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
            await Accounts.DidNotReceive().ConfirmEmailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
            await Tokens.DidNotReceive().RevokeOpenAsync(Arg.Any<Guid>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
            Audit.Entries.ShouldNotContain(e => e.Action == AuditActions.InviteAccepted);
        }
    }
}

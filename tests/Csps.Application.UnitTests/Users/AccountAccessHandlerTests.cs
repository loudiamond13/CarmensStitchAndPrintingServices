using Csps.Application.Auth;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Users;

/// <summary>
/// USER-07, C-4, 04 D-21, 04 D-24, D-14, D-19, D-21, D-40, D-41 Q5: the three account-access handlers (resend an invitation, send a
/// reset link, set a temporary password) and the temporary-password validator. Each branch of each handler is covered here, because
/// Csps.Application is measured from this project only.
/// </summary>
public sealed class AccountAccessHandlerTests
{
    private const string Secret = "tok_secret-value-0123456789abcdefghijklmnopq";
    private const string ManagerName = "Carmen Reyes";
    private const string Temporary = "Tela-Sukat-7381";

    private static readonly DateTimeOffset Start = new(2026, 10, 18, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid TargetId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");
    private static readonly string Key = TargetId.ToString("D");

    // ---- Resend invitation -------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task ResendRevokesTheOldInvitationIssuesASevenDayOneEmailsItWithTheManagerLineAndRecordsItUnderTheLock()
    {
        var harness = new Harness { Target = Account(hasPassword: false) };

        var result = await harness.Resend.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        Received.InOrder(() =>
        {
            harness.Tokens.LockAccountAsync(TargetId, Arg.Any<CancellationToken>());
            harness.Tokens.RevokeOpenAsync(TargetId, AccountTokenPurpose.Invitation, Start, Arg.Any<CancellationToken>());
            harness.Tokens.Add(Arg.Any<AccountToken>());
        });
        var added = harness.Added.ShouldHaveSingleItem();
        added.Purpose.ShouldBe(AccountTokenPurpose.Invitation);
        added.UserId.ShouldBe(TargetId);
        added.ExpiresAt.ShouldBe(Start.AddDays(7));
        added.TokenHash.ShouldBe(TokenHash.Compute(Secret));
        harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBe(new InviteEmail("person@csps.test", Secret, Start.AddDays(7), Start, ManagerName));
        harness.Audit.Entries.ShouldBe([new AuditCall(AuditActions.UserInvitationResent, "User", Key, null, Independent: false)]);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ResendForAnUnknownOrDeletedPersonIsANotFound(bool deleted)
    {
        var harness = new Harness { Target = deleted ? Account(hasPassword: false) with { IsDeleted = true } : null };

        var result = await harness.Resend.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.NotFound);
        harness.AssertNothingSent();
    }

    [Theory]
    [InlineData("deactivated", false)]
    [InlineData("locked", false)]
    [InlineData("deactivated", true)]
    public async Task ResendForABlockedPersonIsRefusedAndBlockedWinsOverAlreadySetUp(string state, bool hasPassword)
    {
        var harness = new Harness { Target = Blocked(Account(hasPassword), state) };

        var result = await harness.Resend.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.Blocked);
        harness.AssertNothingSent();
    }

    [Fact]
    public async Task ResendForAPersonWithAPasswordIsRefused()
    {
        var harness = new Harness { Target = Account(hasPassword: true) };

        var result = await harness.Resend.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.AlreadySetUp);
        harness.AssertNothingSent();
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task ResendWithoutASignedInManagerOrTheirProfileEndsTheSession(bool noCaller)
    {
        var harness = new Harness(noCaller: noCaller, noProfile: !noCaller) { Target = Account(hasPassword: false) };

        var result = await harness.Resend.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
        await harness.Tokens.DidNotReceive().LockAccountAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ResendRetriesALostRaceOnceThenAnswersBusy()
    {
        var retried = new Harness { Target = Account(hasPassword: false) };
        retried.Unit.FailFirstSaveWithConflict();
        (await retried.Resend.HandleAsync(TargetId, TestContext.Current.CancellationToken)).IsSuccess.ShouldBeTrue();
        retried.Unit.Saves.ShouldBe(2);

        var busy = new Harness { Target = Account(hasPassword: false) };
        busy.Unit.FailEverySaveWithConflict();
        (await busy.Resend.HandleAsync(TargetId, TestContext.Current.CancellationToken)).Error.ShouldBeSameAs(AuthErrors.SessionBusy);
    }

    // ---- Send reset link ---------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task ASentLinkReplacesTheOpenOneLastsThirtyMinutesNamesTheManagerAndIsRecordedUnderTheLock()
    {
        var harness = new Harness();

        var result = await harness.SendLink.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        Received.InOrder(() =>
        {
            harness.Tokens.LockAccountAsync(TargetId, Arg.Any<CancellationToken>());
            harness.Tokens.RevokeOpenAsync(TargetId, AccountTokenPurpose.PasswordReset, Start, Arg.Any<CancellationToken>());
            harness.Tokens.Add(Arg.Any<AccountToken>());
        });
        var added = harness.Added.ShouldHaveSingleItem();
        added.Purpose.ShouldBe(AccountTokenPurpose.PasswordReset);
        added.ExpiresAt.ShouldBe(Start.AddMinutes(30));
        added.TokenHash.ShouldBe(TokenHash.Compute(Secret));
        harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBe(new ManagerResetLinkEmail("person@csps.test", Secret, Start.AddMinutes(30), Start, ManagerName));
        harness.Audit.Entries.ShouldBe([new AuditCall(AuditActions.UserResetLinkSent, "User", Key, null, Independent: false)]);
        harness.Unit.Saves.ShouldBe(1);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ALinkForAnUnknownOrDeletedPersonIsANotFound(bool deleted)
    {
        var harness = new Harness { Target = deleted ? Account() with { IsDeleted = true } : null };

        var result = await harness.SendLink.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.NotFound);
        harness.AssertNothingSent();
    }

    [Theory]
    [InlineData("deactivated", true)]
    [InlineData("locked", true)]
    [InlineData("locked", false)]
    public async Task ALinkForABlockedPersonIsRefusedAndBlockedWinsOverNoPassword(string state, bool hasPassword)
    {
        var harness = new Harness { Target = Blocked(Account(hasPassword), state) };

        var result = await harness.SendLink.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.Blocked);
        harness.AssertNothingSent();
    }

    [Fact]
    public async Task ALinkForAPersonWithNoPasswordPointsToTheInvitation()
    {
        var harness = new Harness { Target = Account(hasPassword: false) };

        var result = await harness.SendLink.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.NoPassword);
        harness.AssertNothingSent();
    }

    [Theory]
    [InlineData(3, 0, 1)]
    [InlineData(0, 3, 2)]
    [InlineData(2, 1, 2)]
    [InlineData(1, 2, 2)]
    public async Task ResetEmailsOfBothKindsInTheLastHourShareOneCapOfThree(int forgot, int fromManagers, int countsMade)
    {
        var harness = new Harness();
        harness.Outbox.Recent[AuthEmailKind.PasswordReset] = forgot;
        harness.Outbox.Recent[AuthEmailKind.ManagerResetLink] = fromManagers;

        var result = await harness.SendLink.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.ResetLinkCapped);
        harness.Outbox.Counts.Count.ShouldBe(countsMade);
        harness.Outbox.Counts.ShouldAllBe(count => count.To == "person@csps.test" && count.Since == Start.AddHours(-1));
        harness.AssertNothingSent();
    }

    [Theory]
    [InlineData(2, 0)]
    [InlineData(0, 2)]
    [InlineData(1, 1)]
    public async Task TwoResetEmailsInTheLastHourStillAllowAThird(int forgot, int fromManagers)
    {
        var harness = new Harness();
        harness.Outbox.Recent[AuthEmailKind.PasswordReset] = forgot;
        harness.Outbox.Recent[AuthEmailKind.ManagerResetLink] = fromManagers;

        var result = await harness.SendLink.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Outbox.Emails.ShouldHaveSingleItem();
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task ALinkWithoutASignedInManagerOrTheirProfileEndsTheSession(bool noCaller)
    {
        var harness = new Harness(noCaller: noCaller, noProfile: !noCaller);

        var result = await harness.SendLink.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
        await harness.Tokens.DidNotReceive().LockAccountAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ALinkRetriesALostRaceOnceThenAnswersBusy()
    {
        var retried = new Harness();
        retried.Unit.FailFirstSaveWithConflict();
        (await retried.SendLink.HandleAsync(TargetId, TestContext.Current.CancellationToken)).IsSuccess.ShouldBeTrue();
        retried.Unit.Saves.ShouldBe(2);

        var busy = new Harness();
        busy.Unit.FailEverySaveWithConflict();
        (await busy.SendLink.HandleAsync(TargetId, TestContext.Current.CancellationToken)).Error.ShouldBeSameAs(AuthErrors.SessionBusy);
    }

    // ---- Set temporary password --------------------------------------------------------------------------------------------------

    [Fact]
    public async Task ATemporaryPasswordIsSavedClearsTheLockoutEndsEverySessionNotifiesAndIsAuditedWithFixedWords()
    {
        var harness = new Harness();
        harness.Sessions.RevokeAllAsync(TargetId, null, SessionRevocationReason.PasswordReset, Start, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<Guid>>([Guid.NewGuid(), Guid.NewGuid()]));

        var result = await harness.SetPassword.HandleAsync(TargetId, new SetTemporaryPasswordRequest(Temporary), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        Received.InOrder(() =>
        {
            harness.Tokens.LockAccountAsync(TargetId, Arg.Any<CancellationToken>());
            harness.Accounts.SetPasswordAsync(TargetId, Temporary, Arg.Any<CancellationToken>());
            harness.Accounts.ClearLockoutAsync(TargetId, Arg.Any<CancellationToken>());
            harness.Accounts.SetMustChangePasswordAsync(TargetId, PasswordChangeReason.Temporary, Arg.Any<CancellationToken>());
            harness.Accounts.MarkStaffEditAsync(TargetId, Arg.Any<CancellationToken>());
            harness.Sessions.RevokeAllAsync(TargetId, null, SessionRevocationReason.PasswordReset, Start, Arg.Any<CancellationToken>());
        });
        await harness.Accounts.DidNotReceive().ConfirmEmailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await harness.Tokens.DidNotReceive().RevokeOpenAsync(Arg.Any<Guid>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBe(new ManagerResetEmail("person@csps.test", ManagerName, Start));
        harness.Audit.Entries.ShouldBe(
        [
            new AuditCall(AuditActions.UserTemporaryPasswordSet, "User", Key, null, Independent: false),
            new AuditCall(AuditActions.SessionsRevoked, "User", Key, "temporary-password", Independent: false),
        ]);
        harness.Audit.Entries.ShouldAllBe(entry => entry.Detail == null || !entry.Detail.Contains(Temporary, StringComparison.Ordinal));
        harness.Outbox.Emails.ShouldAllBe(email => !email.ToString()!.Contains(Temporary, StringComparison.Ordinal));
        await harness.SessionCache.Received(1).EvictUserAsync(TargetId, Arg.Any<CancellationToken>());
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task WithNoSessionOpenOnlyTheTemporaryPasswordEntryIsRecorded()
    {
        var harness = new Harness();

        var result = await harness.SetPassword.HandleAsync(TargetId, new SetTemporaryPasswordRequest(Temporary), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.ShouldBe([new AuditCall(AuditActions.UserTemporaryPasswordSet, "User", Key, null, Independent: false)]);
        await harness.SessionCache.Received(1).EvictUserAsync(TargetId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnInvitedPersonGetsTheirFirstPasswordTheAddressCountsAsConfirmedAndTheInvitationDies()
    {
        var harness = new Harness { Target = Account(hasPassword: false) with { EmailConfirmed = false } };

        var result = await harness.SetPassword.HandleAsync(TargetId, new SetTemporaryPasswordRequest(Temporary), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.Received(1).ConfirmEmailAsync(TargetId, Arg.Any<CancellationToken>());
        await harness.Tokens.Received(1).RevokeOpenAsync(TargetId, AccountTokenPurpose.Invitation, Start, Arg.Any<CancellationToken>());
        await harness.Accounts.Received(1).SetMustChangePasswordAsync(TargetId, PasswordChangeReason.Temporary, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TheCallersOwnAccountIsRefusedBeforeAnythingIsReadOrChanged()
    {
        var harness = new Harness();

        var result = await harness.SetPassword.HandleAsync(CallerId, new SetTemporaryPasswordRequest(Temporary), TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.OwnAccount);
        await harness.Tokens.DidNotReceive().LockAccountAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().SetPasswordAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Ab1!")]
    [InlineData("Abcdefgh!")]
    public async Task APasswordThatBreaksTheBasicRuleIsA400OnItsFieldAndNothingIsRead(string? password)
    {
        var harness = new Harness();

        var result = await harness.SetPassword.HandleAsync(TargetId, new SetTemporaryPasswordRequest(password), TestContext.Current.CancellationToken);

        result.Error.FieldErrors.ShouldNotBeNull().ShouldContainKey("temporaryPassword");
        await harness.Tokens.DidNotReceive().LockAccountAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await harness.SessionCache.DidNotReceive().EvictUserAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AnUnknownOrDeletedPersonIsANotFoundAndTheCacheIsLeftAlone(bool deleted)
    {
        var harness = new Harness { Target = deleted ? Account() with { IsDeleted = true } : null };

        var result = await harness.SetPassword.HandleAsync(TargetId, new SetTemporaryPasswordRequest(Temporary), TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.NotFound);
        await harness.Accounts.DidNotReceive().SetPasswordAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
        await harness.SessionCache.DidNotReceive().EvictUserAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Theory]
    [InlineData("deactivated")]
    [InlineData("locked")]
    public async Task ABlockedPersonIsRefusedAndKeepsTheirPassword(string state)
    {
        var harness = new Harness { Target = Blocked(Account(), state) };

        var result = await harness.SetPassword.HandleAsync(TargetId, new SetTemporaryPasswordRequest(Temporary), TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.Blocked);
        await harness.Accounts.DidNotReceive().SetPasswordAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
        harness.Outbox.Emails.ShouldBeEmpty();
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task APasswordWithoutASignedInManagerOrTheirProfileEndsTheSession(bool noCaller)
    {
        var harness = new Harness(noCaller: noCaller, noProfile: !noCaller);

        var result = await harness.SetPassword.HandleAsync(TargetId, new SetTemporaryPasswordRequest(Temporary), TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
        await harness.Accounts.DidNotReceive().SetPasswordAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task APasswordRetriesALostRaceOnceThenAnswersBusy()
    {
        var retried = new Harness();
        retried.Unit.FailFirstSaveWithConflict();
        (await retried.SetPassword.HandleAsync(TargetId, new SetTemporaryPasswordRequest(Temporary), TestContext.Current.CancellationToken)).IsSuccess.ShouldBeTrue();
        retried.Unit.Saves.ShouldBe(2);

        var busy = new Harness();
        busy.Unit.FailEverySaveWithConflict();
        var result = await busy.SetPassword.HandleAsync(TargetId, new SetTemporaryPasswordRequest(Temporary), TestContext.Current.CancellationToken);
        result.Error.ShouldBeSameAs(AuthErrors.SessionBusy);
        await busy.SessionCache.DidNotReceive().EvictUserAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ANullRequestIsAProgrammingError()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.SetPassword.HandleAsync(TargetId, null!, TestContext.Current.CancellationToken));
    }

    // ---- The request and its validator -------------------------------------------------------------------------------------------

    [Fact]
    public void TheRequestPrintsOnlyItsTypeNameAndAnEmptyOneHasNoPassword()
    {
        new SetTemporaryPasswordRequest(Temporary).ToString().ShouldBe("SetTemporaryPasswordRequest");
        SetTemporaryPasswordRequest.Empty.TemporaryPassword.ShouldBeNull();
    }

    [Theory]
    [InlineData(null, "Enter a temporary password.")]
    [InlineData("", "Enter a temporary password.")]
    [InlineData("Ab1!", "Use at least 8 characters.")]
    [InlineData("Abcdefgh!", "Add at least one number.")]
    [InlineData("Abcdefg1h", "Add at least one symbol, like ! or #.")]
    [InlineData("Abcdef1!\tx", "Remove tabs and line breaks from your password.")]
    public async Task TheValidatorGivesOneMessageForTheFirstRuleBroken(string? password, string message)
    {
        var result = await new SetTemporaryPasswordRequestValidator().ValidateAsync(new SetTemporaryPasswordRequest(password), TestContext.Current.CancellationToken);

        result.Errors.Select(error => (error.PropertyName, error.ErrorMessage)).ShouldBe([(nameof(SetTemporaryPasswordRequest.TemporaryPassword), message)]);
    }

    [Fact]
    public async Task TheValidatorTakesSixtyFourCharactersAndRefusesSixtyFiveAndNeedsNoBreachOrNameCheck()
    {
        var validator = new SetTemporaryPasswordRequestValidator();

        (await validator.ValidateAsync(new SetTemporaryPasswordRequest("Aa1!" + new string('x', 60)), TestContext.Current.CancellationToken)).IsValid.ShouldBeTrue();
        (await validator.ValidateAsync(new SetTemporaryPasswordRequest("Password1!"), TestContext.Current.CancellationToken)).IsValid.ShouldBeTrue();
        var over = await validator.ValidateAsync(new SetTemporaryPasswordRequest("Aa1!" + new string('x', 61)), TestContext.Current.CancellationToken);
        over.Errors.ShouldHaveSingleItem().ErrorMessage.ShouldBe("Use 64 characters or fewer.");
    }

    private static UserAccount Account(bool hasPassword = true) =>
        new(TargetId, "person@csps.test", "Ana", "Abad", "Admin", IsActive: true, EmailConfirmed: hasPassword, HasPassword: hasPassword, MustChangePassword: null, BreachRecheckPending: false, LockoutEnd: null);

    private static UserAccount Blocked(UserAccount account, string state) =>
        state == "deactivated" ? account with { IsActive = false } : account with { IsManagerLocked = true };

    private sealed class Harness
    {
        public Harness(bool noCaller = false, bool noProfile = false)
        {
            Target = Account();
            Accounts = Substitute.For<IUserAccounts>();
            Accounts.FindByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult<UserAccount?>(Target));

            Tokens = Substitute.For<IAccountTokens>();
            Tokens.When(tokens => tokens.Add(Arg.Any<AccountToken>())).Do(call => Added.Add(call.Arg<AccountToken>()));

            Sessions = Substitute.For<ISessions>();
            Sessions.RevokeAllAsync(Arg.Any<Guid>(), Arg.Any<Guid?>(), Arg.Any<SessionRevocationReason>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<IReadOnlyList<Guid>>([]));
            SessionCache = Substitute.For<ISessionCache>();

            var directory = Substitute.For<IUserDirectory>();
            directory.GetProfileAsync(CallerId, Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult<ProfileView?>(
                noProfile ? null : new ProfileView(CallerId, "Carmen", "Reyes", "carmen@csps.test", "Manager", null, Start.AddDays(-30), Guid.NewGuid())));

            var random = Substitute.For<ISecureRandom>();
            random.NewToken().Returns(Secret);
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            var settings = new AuthSettings();
            var time = new FakeTimeProvider(Start);

            Resend = new ResendInvitationHandler(Accounts, directory, Tokens, random, Outbox, Audit, Unit, request, settings, time);
            SendLink = new SendResetLinkHandler(Accounts, directory, Tokens, random, Outbox, Audit, Unit, request, settings, time);
            SetPassword = new SetTemporaryPasswordHandler(
                Accounts, directory, Sessions, SessionCache, Tokens, Outbox, Audit, Unit, request, new SetTemporaryPasswordRequestValidator(), time);
        }

        public UserAccount? Target { get; set; }

        public List<AccountToken> Added { get; } = [];

        public IUserAccounts Accounts { get; }

        public IAccountTokens Tokens { get; }

        public ISessions Sessions { get; }

        public ISessionCache SessionCache { get; }

        public RecordingOutbox Outbox { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public ResendInvitationHandler Resend { get; }

        public SendResetLinkHandler SendLink { get; }

        public SetTemporaryPasswordHandler SetPassword { get; }

        public void AssertNothingSent()
        {
            Added.ShouldBeEmpty();
            Outbox.Emails.ShouldBeEmpty();
            Audit.Entries.ShouldBeEmpty();
            Unit.Saves.ShouldBe(0);
        }
    }
}

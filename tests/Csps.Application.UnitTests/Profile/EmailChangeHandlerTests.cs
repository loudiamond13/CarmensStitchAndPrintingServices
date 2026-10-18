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
/// PROF-02, C-9, D-24, D-25, D-40, T-05-37, T-05-38: the request needs the right current password, queues one 24-hour
/// single-use link to the new address and a notice to the old one, and audits by user id only; the confirmation applies the
/// pending address once, and every dead link gets the same answer.
/// </summary>
public sealed class EmailChangeHandlerTests
{
    private const string OldEmail = "paolo.reyes@example.com";
    private const string NewEmail = "paolo.new@example.com";
    private const string Password = "Tala#Bituin2025";
    private const string WrongPassword = "Not-My-Password1!";
    private const string Secret = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";
    private const string ChromeOnAndroid =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

    private static readonly DateTimeOffset Start = new(2026, 10, 18, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid UserId = Guid.Parse("4b1f0c7e-2a53-4d6e-8f10-9a7c3e5d2b61");

    // ---- request ----

    [Fact]
    public async Task ARequestDoesEveryEffectInOneTransaction()
    {
        var harness = new Harness();

        var result = await harness.RequestAsync(NewEmail, Password);

        result.IsSuccess.ShouldBeTrue();
        result.Value.PendingEmail.ShouldBe(NewEmail);
        await harness.Tokens.Received(1).LockAccountAsync(UserId, Arg.Any<CancellationToken>());
        await harness.Tokens.Received(1).RevokeOpenAsync(UserId, AccountTokenPurpose.EmailChange, Start, Arg.Any<CancellationToken>());
        await harness.Accounts.Received(1).SetPendingEmailAsync(UserId, NewEmail, Arg.Any<CancellationToken>());
        var token = harness.Added.ShouldNotBeNull();
        token.UserId.ShouldBe(UserId);
        token.Purpose.ShouldBe(AccountTokenPurpose.EmailChange);
        (token.ExpiresAt - token.CreatedAt).ShouldBe(TimeSpan.FromHours(24));
        var confirm = harness.Outbox.Emails.OfType<EmailChangeConfirmEmail>().ShouldHaveSingleItem();
        confirm.To.ShouldBe(NewEmail);
        confirm.OldEmail.ShouldBe(OldEmail);
        confirm.ExpiresAt.ShouldBe(Start.AddHours(24));
        confirm.RequestedAt.ShouldBe(Start);
        TokenHash.Equal(token.TokenHash, TokenHash.Compute(confirm.Token)).ShouldBeTrue();
        var notice = harness.Outbox.Emails.OfType<EmailChangeNoticeEmail>().ShouldHaveSingleItem();
        notice.To.ShouldBe(OldEmail);
        notice.NewEmail.ShouldBe(NewEmail);
        notice.RequestedAt.ShouldBe(Start);
        notice.Device.Label.ShouldBe("Chrome on Android");
        harness.Outbox.Emails.Count.ShouldBe(2);
        harness.Audit.Entries.ShouldBe([new AuditCall("profile.email-change-requested", "User", UserId.ToString("D"), null, Independent: false)]);
        harness.Unit.Commits.ShouldBe(1);
        harness.Unit.Rollbacks.ShouldBe(0);
    }

    [Fact]
    public async Task TheSignInEmailIsNotTouchedByARequest()
    {
        var harness = new Harness();

        await harness.RequestAsync(NewEmail, Password);

        await harness.Accounts.DidNotReceive().ApplyPendingEmailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TheNewAddressIsTrimmed()
    {
        var harness = new Harness();

        await harness.RequestAsync($"  {NewEmail}  ", Password);

        await harness.Accounts.Received(1).SetPendingEmailAsync(UserId, NewEmail, Arg.Any<CancellationToken>());
        harness.Outbox.Emails.OfType<EmailChangeConfirmEmail>().Single().To.ShouldBe(NewEmail);
    }

    [Fact]
    public async Task AnUnknownBrowserIsNamedAsSuch()
    {
        var harness = new Harness { UserAgent = null };

        await harness.RequestAsync(NewEmail, Password);

        harness.Outbox.Emails.OfType<EmailChangeNoticeEmail>().Single().Device.IsKnown.ShouldBeFalse();
    }

    [Fact]
    public async Task ACallerWithNoUserIsRefusedAndNothingChanges()
    {
        var harness = new Harness { SignedIn = false };

        var result = await harness.RequestAsync(NewEmail, Password);

        AssertSessionEnded(result);
        await harness.AssertNothingChangedAsync();
        await harness.Accounts.DidNotReceive().FindByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("deactivated")]
    [InlineData("manager-locked")]
    [InlineData("deleted")]
    public async Task AMissingOrBlockedAccountIsRefusedAndNothingChanges(string account)
    {
        var harness = new Harness(account);

        var result = await harness.RequestAsync(NewEmail, Password);

        AssertSessionEnded(result);
        await harness.AssertNothingChangedAsync();
        await harness.Accounts.DidNotReceive().CheckPasswordAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AWrongCurrentPasswordIsAFieldErrorAndNothingChanges()
    {
        var harness = new Harness();

        var result = await harness.RequestAsync(NewEmail, WrongPassword);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()["currentPassword"].ShouldBe(["Your current password is incorrect."]);
        await harness.AssertNothingChangedAsync(commits: 1);
    }

    [Fact]
    public async Task AWrongCurrentPasswordIsCountedTowardTheLockout()
    {
        var harness = new Harness();

        await harness.RequestAsync(NewEmail, WrongPassword);

        await harness.Accounts.Received(1).RecordFailedPasswordAsync(UserId, Arg.Any<CancellationToken>());
        harness.Outbox.Emails.ShouldBeEmpty();
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task TheWrongPasswordThatLocksTheAccountAnswers429AndSendsTheOneLockoutEmail()
    {
        var lockoutEnd = Start.AddMinutes(15);
        var harness = new Harness { Failure = new FailedPasswordResult(LockedNow: true, lockoutEnd) };

        var result = await harness.RequestAsync(NewEmail, WrongPassword);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.TooManyRequests);
        result.Error.Code.ShouldBe("profile.password-locked");
        result.Error.RetryAfter.ShouldBe(TimeSpan.FromMinutes(15));
        var mail = harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBeOfType<AccountLockedEmail>();
        mail.To.ShouldBe(OldEmail);
        mail.Cause.ShouldBe(LockoutCause.Password);
        harness.Audit.Entries.ShouldBe([new AuditCall(AuditActions.Lockout, "User", UserId.ToString("D"), "password", Independent: false)]);
        await harness.Accounts.DidNotReceive().SetPendingEmailAsync(Arg.Any<Guid>(), Arg.Any<string?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnAlreadyLockedAccountAnswers429WithoutCheckingThePasswordOrTheAddress()
    {
        var harness = new Harness(lockoutEnd: Start.AddMinutes(9));

        var result = await harness.RequestAsync(NewEmail, Password);

        result.Error.Code.ShouldBe("profile.password-locked");
        result.Error.RetryAfter.ShouldBe(TimeSpan.FromMinutes(9));
        await harness.Accounts.DidNotReceive().CheckPasswordAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().RecordFailedPasswordAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().FindByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
        await harness.AssertNothingChangedAsync();
    }

    [Fact]
    public async Task TheCorrectPasswordIsNotCountedAndClearsTheCountSoFar()
    {
        var harness = new Harness();

        await harness.RequestAsync(NewEmail, Password);

        await harness.Accounts.DidNotReceive().RecordFailedPasswordAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await harness.Accounts.Received(1).ResetFailedCountAsync(UserId, Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("PAOLO.REYES@EXAMPLE.COM")]
    [InlineData("  paolo.reyes@example.com ")]
    public async Task TheCurrentAddressInAnyCaseIsAFieldErrorBeforeThePasswordIsChecked(string typed)
    {
        var harness = new Harness();

        var result = await harness.RequestAsync(typed, Password);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()["newEmail"].ShouldBe(["This is already your email."]);
        await harness.AssertNothingChangedAsync();
        await harness.Accounts.DidNotReceive().CheckPasswordAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnAddressAnotherAccountUsesIsAFieldErrorAndNothingChanges()
    {
        var harness = new Harness { Holder = Holder(isDeleted: false) };

        var result = await harness.RequestAsync(NewEmail, Password);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()["newEmail"].ShouldBe(["Another account already uses this email."]);
        await harness.Accounts.Received(1).FindByEmailAsync(NewEmail, Arg.Any<CancellationToken>());
        await harness.AssertNothingChangedAsync();
    }

    [Fact]
    public async Task ATakenAddressIsNotRevealedWhenThePasswordIsWrong()
    {
        var harness = new Harness { Holder = Holder(isDeleted: false) };

        var result = await harness.RequestAsync(NewEmail, WrongPassword);

        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["currentPassword"]);
        await harness.Accounts.DidNotReceive().FindByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnAddressHeldOnlyByADeletedAccountIsAccepted()
    {
        var harness = new Harness { Holder = Holder(isDeleted: true) };

        var result = await harness.RequestAsync(NewEmail, Password);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.Received(1).SetPendingEmailAsync(UserId, NewEmail, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ANewRequestRevokesTheOpenLinksBeforeItIssuesTheNewOne()
    {
        var harness = new Harness();

        await harness.RequestAsync(NewEmail, Password);

        Received.InOrder(() =>
        {
            harness.Tokens.LockAccountAsync(UserId, Arg.Any<CancellationToken>());
            harness.Tokens.RevokeOpenAsync(UserId, AccountTokenPurpose.EmailChange, Start, Arg.Any<CancellationToken>());
            harness.Tokens.Add(Arg.Any<AccountToken>());
        });
    }

    [Theory]
    [InlineData(null, Password, "newEmail", "Enter your new email.")]
    [InlineData("   ", Password, "newEmail", "Enter your new email.")]
    [InlineData("no-at-sign", Password, "newEmail", "Enter a valid email, like name@gmail.com")]
    [InlineData("@example.com", Password, "newEmail", "Enter a valid email, like name@gmail.com")]
    [InlineData("two@@example.com", Password, "newEmail", "Enter a valid email, like name@gmail.com")]
    [InlineData(NewEmail, null, "currentPassword", "Enter your current password.")]
    [InlineData(NewEmail, "", "currentPassword", "Enter your current password.")]
    public async Task AnInvalidFormIsAFieldErrorBeforeAnyWork(string? newEmail, string? password, string field, string message)
    {
        var harness = new Harness();

        var result = await harness.RequestAsync(newEmail, password);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()[field].ShouldBe([message]);
        await harness.AssertNothingChangedAsync();
        await harness.Accounts.DidNotReceive().CheckPasswordAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnAddressLongerThanTheCapIsRefused()
    {
        var harness = new Harness();

        var result = await harness.RequestAsync(new string('a', 250) + "@example.com", Password);

        result.Error.FieldErrors.ShouldNotBeNull()["newEmail"].ShouldBe(["Enter a valid email, like name@gmail.com"]);
    }

    [Fact]
    public async Task ALostRaceIsRetriedOnceAndTheSecondPassSucceeds()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.RequestAsync(NewEmail, Password);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task TwoLostRacesAnswerBusyAndSendNothing()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.RequestAsync(NewEmail, Password);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe(AuthErrors.SessionBusyCode);
        harness.Unit.Commits.ShouldBe(0);
    }

    [Fact]
    public async Task AnAccountThatVanishesAfterTheSaveReadsAsASessionEnd()
    {
        var harness = new Harness { ProfileExists = false };

        var result = await harness.RequestAsync(NewEmail, Password);

        AssertSessionEnded(result);
    }

    // ---- confirm ----

    [Fact]
    public async Task AConfirmationAppliesTheAddressSpendsTheLinkAndAuditsIt()
    {
        var harness = new Harness();

        var result = await harness.ConfirmAsync(Secret);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(new EmailChangeResponse(NewEmail));
        await harness.Tokens.Received(1).LockAccountAsync(UserId, Arg.Any<CancellationToken>());
        await harness.Accounts.Received(1).ApplyPendingEmailAsync(UserId, Arg.Any<CancellationToken>());
        harness.Link.UsedAt.ShouldBe(Start);
        await harness.Tokens.Received(1).RevokeOpenAsync(UserId, AccountTokenPurpose.EmailChange, Start, Arg.Any<CancellationToken>());
        harness.Audit.Entries.ShouldBe([new AuditCall("profile.email-changed", "User", UserId.ToString("D"), null, Independent: false)]);
        harness.Unit.Commits.ShouldBe(1);
        harness.Outbox.Emails.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("too-short")]
    [InlineData("0123456789abcdefghijklmnopqrstuvwxyzABCDEF!")]
    public async Task AMissingOrMalformedTokenIsInvalidWithoutALookup(string? token)
    {
        var harness = new Harness();

        var result = await harness.ConfirmAsync(token);

        AssertInvalid(result);
        await harness.Tokens.DidNotReceive().FindByHashAsync(Arg.Any<byte[]>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<CancellationToken>());
        await harness.AssertNothingAppliedAsync();
    }

    [Fact]
    public async Task AnUnknownTokenIsInvalid()
    {
        var harness = new Harness();

        var result = await harness.ConfirmAsync("ZYXWVUTSRQPONMLKJIHGFEDCBAzyxwvutsrqponmlkj");

        AssertInvalid(result);
        await harness.AssertNothingAppliedAsync();
    }

    [Fact]
    public async Task TheLookupAsksForTheEmailChangePurposeOnly()
    {
        var harness = new Harness();

        await harness.ConfirmAsync(Secret);

        await harness.Tokens.Received().FindByHashAsync(Arg.Any<byte[]>(), AccountTokenPurpose.EmailChange, Arg.Any<CancellationToken>());
        await harness.Tokens.DidNotReceive().FindByHashAsync(Arg.Any<byte[]>(), Arg.Is<AccountTokenPurpose>(purpose => purpose != AccountTokenPurpose.EmailChange), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("used")]
    [InlineData("revoked")]
    public async Task AUsedOrReplacedLinkIsInvalid(string reason)
    {
        var harness = new Harness();
        if (reason == "used")
        {
            harness.Link.Use(Start);
        }
        else
        {
            harness.Link.Revoke(Start);
        }

        var result = await harness.ConfirmAsync(Secret);

        AssertInvalid(result);
        await harness.AssertNothingAppliedAsync();
    }

    [Fact]
    public async Task TheLinkIsLiveJustBeforeTwentyFourHoursAndDeadAtTwentyFourHours()
    {
        var live = new Harness();
        live.Time.Advance(TimeSpan.FromHours(24) - TimeSpan.FromMilliseconds(1));
        var dead = new Harness();
        dead.Time.Advance(TimeSpan.FromHours(24));

        var liveResult = await live.ConfirmAsync(Secret);
        var deadResult = await dead.ConfirmAsync(Secret);

        liveResult.IsSuccess.ShouldBeTrue();
        AssertInvalid(deadResult);
        await dead.AssertNothingAppliedAsync();
        dead.Link.UsedAt.ShouldBeNull();
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("deactivated")]
    [InlineData("manager-locked")]
    [InlineData("deleted")]
    public async Task AMissingOrBlockedAccountIsTheSameInvalidAnswer(string account)
    {
        var harness = new Harness(account);

        var result = await harness.ConfirmAsync(Secret);

        AssertInvalid(result);
        await harness.AssertNothingAppliedAsync();
        harness.Link.UsedAt.ShouldBeNull();
    }

    [Fact]
    public async Task NothingPendingIsInvalidAndLeavesTheLinkUnspent()
    {
        var harness = new Harness { Apply = EmailApplyOutcome.NothingPending };

        var result = await harness.ConfirmAsync(Secret);

        AssertInvalid(result);
        harness.Link.UsedAt.ShouldBeNull();
        harness.Audit.Entries.ShouldBeEmpty();
        await harness.Tokens.DidNotReceive().RevokeOpenAsync(Arg.Any<Guid>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnAddressTakenMeanwhileSpendsTheLinkClearsThePendingAddressAndAnswersTaken()
    {
        var harness = new Harness { Apply = EmailApplyOutcome.Taken };

        var result = await harness.ConfirmAsync(Secret);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Conflict);
        result.Error.Code.ShouldBe("email-change.taken");
        result.Error.Message.ShouldBe("This email can't be used.");
        harness.Link.UsedAt.ShouldBe(Start);
        await harness.Accounts.Received(1).SetPendingEmailAsync(UserId, null, Arg.Any<CancellationToken>());
        await harness.Tokens.Received(1).RevokeOpenAsync(UserId, AccountTokenPurpose.EmailChange, Start, Arg.Any<CancellationToken>());
        harness.Audit.Entries.ShouldBe([new AuditCall("profile.email-change-canceled", "User", UserId.ToString("D"), "taken", Independent: false)]);
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task ATakenAnswerNeverReadsAsAChange()
    {
        var harness = new Harness { Apply = EmailApplyOutcome.Taken };

        await harness.ConfirmAsync(Secret);

        harness.Audit.Entries.ShouldNotContain(static entry => entry.Action == "profile.email-changed");
    }

    [Fact]
    public async Task AConfirmationThatLosesItsRaceOnceReadsTheLinkAgainAndSucceeds()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.ConfirmAsync(Secret);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task AConfirmationThatLosesItsRaceTwiceAnswersBusy()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.ConfirmAsync(Secret);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe(AuthErrors.SessionBusyCode);
    }

    // ---- check ----

    [Fact]
    public async Task ALiveLinkIsCheckedToItsPendingAddressAndNothingIsWritten()
    {
        var harness = new Harness();

        var result = await harness.CheckAsync(Secret);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(new EmailChangeResponse(NewEmail));
        harness.Link.UsedAt.ShouldBeNull();
        await harness.Tokens.DidNotReceive().LockAccountAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await harness.Tokens.DidNotReceive().RevokeOpenAsync(Arg.Any<Guid>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        await harness.AssertNothingAppliedAsync();
        harness.Unit.Commits.ShouldBe(0);
        harness.Outbox.Emails.ShouldBeEmpty();
    }

    [Fact]
    public async Task TheCheckOfAnAddressAnotherLiveAccountNowUsesAnswersTaken()
    {
        var harness = new Harness { Holder = Holder(isDeleted: false) };

        var result = await harness.CheckAsync(Secret);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Conflict);
        result.Error.Code.ShouldBe("email-change.taken");
        harness.Link.UsedAt.ShouldBeNull();
        await harness.AssertNothingAppliedAsync();
        harness.Unit.Commits.ShouldBe(0);
    }

    [Fact]
    public async Task TheCheckLooksTheHolderUpByThePendingAddress()
    {
        var harness = new Harness { Holder = Holder(isDeleted: false) };

        await harness.CheckAsync(Secret);

        await harness.Accounts.Received(1).FindByEmailAsync(NewEmail, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TheCheckOfAnAddressHeldOnlyByADeletedAccountIsStillLive()
    {
        var harness = new Harness { Holder = Holder(isDeleted: true) };

        var result = await harness.CheckAsync(Secret);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(new EmailChangeResponse(NewEmail));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("too-short")]
    [InlineData("0123456789abcdefghijklmnopqrstuvwxyzABCDEF!")]
    public async Task TheCheckOfAMissingOrMalformedTokenIsInvalidWithoutALookup(string? token)
    {
        var harness = new Harness();

        var result = await harness.CheckAsync(token);

        AssertInvalid(result);
        await harness.Tokens.DidNotReceive().FindByHashAsync(Arg.Any<byte[]>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TheCheckOfAnUnknownTokenIsInvalid()
    {
        var harness = new Harness();

        AssertInvalid(await harness.CheckAsync("ZYXWVUTSRQPONMLKJIHGFEDCBAzyxwvutsrqponmlkj"));
    }

    [Fact]
    public async Task TheCheckAsksForTheEmailChangePurposeOnly()
    {
        var harness = new Harness();

        await harness.CheckAsync(Secret);

        await harness.Tokens.Received().FindByHashAsync(Arg.Any<byte[]>(), AccountTokenPurpose.EmailChange, Arg.Any<CancellationToken>());
        await harness.Tokens.DidNotReceive().FindByHashAsync(Arg.Any<byte[]>(), Arg.Is<AccountTokenPurpose>(purpose => purpose != AccountTokenPurpose.EmailChange), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("used")]
    [InlineData("revoked")]
    public async Task TheCheckOfAUsedOrReplacedLinkIsInvalid(string reason)
    {
        var harness = new Harness();
        if (reason == "used")
        {
            harness.Link.Use(Start);
        }
        else
        {
            harness.Link.Revoke(Start);
        }

        AssertInvalid(await harness.CheckAsync(Secret));
    }

    [Fact]
    public async Task TheCheckIsLiveJustBeforeTwentyFourHoursAndDeadAtTwentyFourHours()
    {
        var live = new Harness();
        live.Time.Advance(TimeSpan.FromHours(24) - TimeSpan.FromMilliseconds(1));
        var dead = new Harness();
        dead.Time.Advance(TimeSpan.FromHours(24));

        (await live.CheckAsync(Secret)).IsSuccess.ShouldBeTrue();
        AssertInvalid(await dead.CheckAsync(Secret));
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("deactivated")]
    [InlineData("manager-locked")]
    [InlineData("deleted")]
    public async Task TheCheckOfAMissingOrBlockedAccountIsTheSameInvalidAnswer(string account)
    {
        var harness = new Harness(account);

        AssertInvalid(await harness.CheckAsync(Secret));
        await harness.Directory.DidNotReceive().GetProfileAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task TheCheckWithNothingPendingOrNoProfileIsInvalid(bool profileExists)
    {
        var harness = new Harness { ProfileExists = profileExists, Pending = null };

        AssertInvalid(await harness.CheckAsync(Secret));
    }

    // ---- values that must never print ----

    [Fact]
    public void FormsThatCarryASecretPrintOnlyTheirTypeName()
    {
        new RequestEmailChangeRequest(NewEmail, Password).ToString().ShouldBe("RequestEmailChangeRequest");
        new EmailChangeTokenRequest(Secret).ToString().ShouldBe("EmailChangeTokenRequest");
        RequestEmailChangeRequest.Empty.NewEmail.ShouldBeNull();
        EmailChangeTokenRequest.Empty.Token.ShouldBeNull();
    }

    [Fact]
    public void TheInvalidAnswerIsANotFoundThatNeverSaysWhy()
    {
        EmailChangeErrors.Invalid.Kind.ShouldBe(ErrorKind.NotFound);
        EmailChangeErrors.Invalid.Code.ShouldBe("email-change.invalid");
        EmailChangeErrors.Invalid.Message.ShouldBe("This link has expired");
    }

    private static UserAccount Holder(bool isDeleted) =>
        new(Guid.Parse("7c2d9e10-5b34-4f8a-a6d1-0e93b8c4f725"), NewEmail, "Ana", "Cruz", "Admin", true, true, true, null, false, null, false, isDeleted);

    private static void AssertInvalid(Result<EmailChangeResponse> result)
    {
        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.NotFound);
        result.Error.Code.ShouldBe("email-change.invalid");
    }

    private static void AssertSessionEnded(Result<ProfileResponse> result)
    {
        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe(AuthErrors.SessionEndedCode);
    }

    private sealed class Harness
    {
        private readonly string _account;
        private int _lookups;

        public Harness(string account = "active", DateTimeOffset? lockoutEnd = null)
        {
            _account = account;
            Time = new FakeTimeProvider(Start);

            Accounts = Substitute.For<IUserAccounts>();
            var user = Account(OldEmail, lockoutEnd);
            Accounts.RecordFailedPasswordAsync(UserId, Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult(Failure));
            Accounts.FindByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult(Holder));
            Accounts.FindByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(
                Task.FromResult(Resolve(user)),
                Task.FromResult<UserAccount?>(Account(NewEmail)));
            Accounts.CheckPasswordAsync(UserId, Arg.Any<string>(), Arg.Any<CancellationToken>())
                .Returns(call => Task.FromResult(call.ArgAt<string>(1) == Password ? PasswordCheck.Succeeded : PasswordCheck.Failed));
            Accounts.ApplyPendingEmailAsync(UserId, Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult(Apply));

            Tokens = Substitute.For<IAccountTokens>();
            Tokens.When(store => store.Add(Arg.Any<AccountToken>())).Do(call => Added = call.Arg<AccountToken>());
            Link = AccountToken.Create(UserId, AccountTokenPurpose.EmailChange, TokenHash.Compute(Secret), Start, TimeSpan.FromHours(24));
            Tokens.FindByHashAsync(Arg.Any<byte[]>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<CancellationToken>())
                .Returns(call => Task.FromResult(
                    call.ArgAt<AccountTokenPurpose>(1) == AccountTokenPurpose.EmailChange && TokenHash.Equal(call.Arg<byte[]>(), TokenHash.Compute(Secret)) ? NextLink() : null));

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

        public AccountToken Link { get; }

        public AccountToken? Added { get; private set; }

        public RecordingOutbox Outbox { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public FakeTimeProvider Time { get; }

        public bool SignedIn { get; init; } = true;

        public string? UserAgent { get; init; } = ChromeOnAndroid;

        public bool ProfileExists { get; init; } = true;

        public string? Pending { get; init; } = NewEmail;

        public EmailApplyOutcome Apply { get; init; } = EmailApplyOutcome.Applied;

        public FailedPasswordResult Failure { get; init; } = new(LockedNow: false, null);

        public UserAccount? Holder { get; init; }

        public Task<Result<ProfileResponse>> RequestAsync(string? newEmail, string? currentPassword) =>
            BuildRequest().HandleAsync(new RequestEmailChangeRequest(newEmail, currentPassword), TestContext.Current.CancellationToken);

        public Task<Result<EmailChangeResponse>> ConfirmAsync(string? token) =>
            new ConfirmEmailChangeHandler(Tokens, Accounts, Audit, Unit, Time)
                .HandleAsync(new EmailChangeTokenRequest(token), TestContext.Current.CancellationToken);

        // A wrong password is counted in its own transaction, so that one commit is expected there.
        public Task<Result<EmailChangeResponse>> CheckAsync(string? token) =>
            new CheckEmailChangeHandler(Tokens, Accounts, Directory, Time)
                .HandleAsync(new EmailChangeTokenRequest(token), TestContext.Current.CancellationToken);

        public async Task AssertNothingChangedAsync(int commits = 0)
        {
            await Accounts.DidNotReceive().SetPendingEmailAsync(Arg.Any<Guid>(), Arg.Any<string?>(), Arg.Any<CancellationToken>());
            Added.ShouldBeNull();
            Outbox.Emails.ShouldBeEmpty();
            Audit.Entries.ShouldBeEmpty();
            Unit.Commits.ShouldBe(commits);
            await Tokens.DidNotReceive().RevokeOpenAsync(Arg.Any<Guid>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        }

        public async Task AssertNothingAppliedAsync()
        {
            await Accounts.DidNotReceive().ApplyPendingEmailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
            Audit.Entries.ShouldBeEmpty();
        }

        // The first lookup returns the token the test prepared; a retry after a lost race reads a fresh copy, as the real store does.
        private AccountToken NextLink() =>
            _lookups++ == 0 ? Link : AccountToken.Create(UserId, AccountTokenPurpose.EmailChange, TokenHash.Compute(Secret), Start, TimeSpan.FromHours(24));

        private UserAccount? Resolve(UserAccount user) => _account switch
        {
            "missing" => null,
            "deactivated" => user with { IsActive = false },
            "manager-locked" => user with { IsManagerLocked = true },
            "deleted" => user with { IsDeleted = true },
            _ => user,
        };

        private static UserAccount Account(string email, DateTimeOffset? lockoutEnd = null) =>
            new(UserId, email, "Paolo", "Reyes", "Manager", true, true, true, null, false, lockoutEnd);

        private RequestEmailChangeHandler BuildRequest()
        {
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(SignedIn ? UserId : null);
            request.UserAgent.Returns(UserAgent);
            return new RequestEmailChangeHandler(
                Accounts,
                Directory,
                Tokens,
                Random,
                Outbox,
                Audit,
                Unit,
                request,
                new RequestEmailChangeRequestValidator(),
                new CurrentPasswordCheck(Accounts, Outbox, Audit, Unit, new AuthSettings(), Time),
                new AuthSettings(),
                Time);
        }
    }
}

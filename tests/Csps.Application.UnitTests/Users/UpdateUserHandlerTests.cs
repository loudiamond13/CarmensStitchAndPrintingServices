using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Users;

/// <summary>
/// USER-03, USER-04, USER-05, USER-06, SEC-07, C-9, D-18, D-19, D-20, D-40, D-45: a Manager edits another person's name, role and email. The roster lock
/// comes first when the role is not Manager, a real demotion meets the last-Manager guard, a role change ends every session and evicts
/// after the commit, names and role are audited as separate entries with field names and role values only, and values that already
/// match write nothing.
/// </summary>
public sealed class UpdateUserHandlerTests
{
    private const string TargetEmail = "person@csps.test";
    private const string NewEmail = "new.person@csps.test";
    private const string Secret = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";

    private static readonly DateTimeOffset Start = new(2026, 10, 18, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid TargetId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");
    private static readonly Guid OpenedVersion = Guid.Parse("9c2d1e4f-7a60-4b38-a1f5-3d8e6b0c4a72");
    private static readonly Guid SavedVersion = Guid.Parse("3e7f9a10-2b4c-4d65-8e1f-6a0b5c9d7e23");

    [Fact]
    public async Task TheRosterLockIsTakenBeforeTheTargetIsReadWhenTheRoleIsNotManager()
    {
        var harness = new Harness();

        await harness.SaveAsync(role: "Admin");

        Received.InOrder(() =>
        {
            harness.RosterLock.LockActiveManagersAsync(Arg.Any<CancellationToken>());
            harness.Accounts.FindByIdAsync(TargetId, Arg.Any<CancellationToken>());
        });
    }

    [Fact]
    public async Task NoLockIsTakenWhenTheRoleStaysOrBecomesManager()
    {
        var harness = new Harness { Target = Account(TargetId, Roles.Admin) };

        await harness.SaveAsync(role: "manager");

        await harness.RosterLock.DidNotReceive().LockActiveManagersAsync(Arg.Any<CancellationToken>());
        await harness.Accounts.Received(1).UpdateDetailsAsync(TargetId, Arg.Any<UserDetailsChange>(), OpenedVersion, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TheFormIsTrimmedAndTheRoleIsPassedInItsCanonicalSpelling()
    {
        var harness = new Harness();

        await harness.SaveAsync("  Ana ", "Cruz  ", "admin");

        await harness.Accounts.Received(1).UpdateDetailsAsync(TargetId, new UserDetailsChange("Ana", "Cruz", Roles.Admin), OpenedVersion, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ANameOnlySaveRecordsOneEntryWithFieldNamesAndNeverRevokesOrEvicts()
    {
        var harness = new Harness
        {
            Edit = new DetailsEditResult(EditOutcome.Saved, SavedVersion, [EditedFields.FirstName, EditedFields.LastName]),
        };

        var result = await harness.SaveAsync(role: "Admin");

        result.IsSuccess.ShouldBeTrue();
        result.Value.Id.ShouldBe(TargetId);
        harness.Audit.Entries.ShouldBe([new AuditCall(AuditActions.UserDetailsChanged, "User", TargetId.ToString("D"), "fields=first-name,last-name", Independent: false)]);
        await harness.Sessions.DidNotReceive().RevokeAllAsync(Arg.Any<Guid>(), Arg.Any<Guid?>(), Arg.Any<SessionRevocationReason>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        harness.Cache.EvictedUsers.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task ANameAndRoleSaveRecordsSeparateEntriesRevokesEverySessionAndEvictsAfterTheCommit()
    {
        var harness = new Harness
        {
            Target = Account(TargetId, Roles.Admin),
            Edit = new DetailsEditResult(EditOutcome.Saved, SavedVersion, [EditedFields.FirstName, EditedFields.Role], Roles.Admin),
        };
        harness.Sessions.RevokeAllAsync(TargetId, null, SessionRevocationReason.AccountChanged, Start, Arg.Any<CancellationToken>())
            .Returns([Guid.NewGuid()]);

        var result = await harness.SaveAsync(role: "Manager");

        result.IsSuccess.ShouldBeTrue();
        var key = TargetId.ToString("D");
        harness.Audit.Entries.ShouldBe(
        [
            new AuditCall(AuditActions.UserDetailsChanged, "User", key, "fields=first-name", Independent: false),
            new AuditCall(AuditActions.UserRoleChanged, "User", key, "role=admin>manager", Independent: false),
            new AuditCall(AuditActions.SessionsRevoked, "User", key, "account-changed", Independent: false),
        ]);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        harness.Cache.EvictedUsers.ShouldBe([TargetId]);
        harness.Cache.SavesWhenEvicted.ShouldBe(1);
        harness.Cache.CommitsWhenEvicted.ShouldBe(1);
    }

    [Fact]
    public async Task ARoleOnlySaveWithNobodySignedInRecordsOnlyTheRoleChangeButStillEvicts()
    {
        var harness = new Harness
        {
            Edit = new DetailsEditResult(EditOutcome.Saved, SavedVersion, [EditedFields.Role], Roles.Manager),
        };

        var result = await harness.SaveAsync(role: "Admin");

        result.IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.ShouldBe([new AuditCall(AuditActions.UserRoleChanged, "User", TargetId.ToString("D"), "role=manager>admin", Independent: false)]);
        harness.Cache.EvictedUsers.ShouldBe([TargetId]);
    }

    [Fact]
    public async Task ADemotionIsRefusedWhenNoOtherActiveManagerRemains()
    {
        var harness = new Harness();
        harness.Accounts.CountActiveManagersAsync(TargetId, Arg.Any<CancellationToken>()).Returns(0);

        var result = await harness.SaveAsync(role: "Admin");

        result.Error.ShouldBeSameAs(UserErrors.LastActiveManager);
        await harness.Accounts.DidNotReceiveWithAnyArgs().UpdateDetailsAsync(default, default!, default, TestContext.Current.CancellationToken);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
        harness.Cache.EvictedUsers.ShouldBeEmpty();
    }

    [Fact]
    public async Task ARenameThatKeepsTheManagerRoleNeverCountsManagers()
    {
        var harness = new Harness();
        harness.Accounts.CountActiveManagersAsync(Arg.Any<Guid?>(), Arg.Any<CancellationToken>()).Returns(0);

        var result = await harness.SaveAsync(role: "Manager");

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.DidNotReceive().CountActiveManagersAsync(Arg.Any<Guid?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnAdminKeptAsAdminNeverCountsManagers()
    {
        var harness = new Harness { Target = Account(TargetId, Roles.Admin) };

        var result = await harness.SaveAsync(role: "Admin");

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.DidNotReceive().CountActiveManagersAsync(Arg.Any<Guid?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ValuesThatAlreadyMatchAreASuccessThatWritesRevokesAndEvictsNothing()
    {
        var harness = new Harness { Edit = new DetailsEditResult(EditOutcome.Unchanged, OpenedVersion, []) };

        var result = await harness.SaveAsync(role: "Manager");

        result.IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
        await harness.Sessions.DidNotReceive().RevokeAllAsync(Arg.Any<Guid>(), Arg.Any<Guid?>(), Arg.Any<SessionRevocationReason>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        harness.Cache.EvictedUsers.ShouldBeEmpty();
    }

    [Fact]
    public async Task AStaleVersionAnswersEditStaleAndChangesNothing()
    {
        var harness = new Harness { Edit = new DetailsEditResult(EditOutcome.Stale, SavedVersion, []) };

        var result = await harness.SaveAsync(role: "Manager");

        result.Error.ShouldBeSameAs(EditErrors.Stale);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
        harness.Cache.EvictedUsers.ShouldBeEmpty();
    }

    [Fact]
    public async Task APersonWhoVanishesBeforeTheSaveIsANotFound()
    {
        var harness = new Harness { Edit = new DetailsEditResult(EditOutcome.NotFound, Guid.Empty, []) };

        var result = await harness.SaveAsync(role: "Manager");

        result.Error.ShouldBeSameAs(UserErrors.NotFound);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AMissingOrDeletedPersonIsANotFoundThatChangesNothing(bool deleted)
    {
        var harness = new Harness { Target = deleted ? Account(TargetId, Roles.Manager) with { IsDeleted = true } : null };

        var result = await harness.SaveAsync(role: "Manager");

        result.Error.ShouldBeSameAs(UserErrors.NotFound);
        await harness.Accounts.DidNotReceiveWithAnyArgs().UpdateDetailsAsync(default, default!, default, TestContext.Current.CancellationToken);
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task TheCallersOwnAccountIsRefusedBeforeAnythingIsLockedOrRead()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(CallerId, Harness.Form("Ana", "Cruz", "Admin"), TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.OwnAccount);
        await harness.RosterLock.DidNotReceive().LockActiveManagersAsync(Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().FindByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task WithoutASignedInUserNothingIsValidatedLockedOrRead()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.SaveAsync(role: "Admin");

        result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
        await harness.RosterLock.DidNotReceive().LockActiveManagersAsync(Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().FindByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnEmptyFormReportsEveryFieldAndTouchesNothing()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(TargetId, UpdateUserRequest.Empty, TestContext.Current.CancellationToken);

        result.Error.Code.ShouldBe(AuthErrors.ValidationCode);
        result.Error.FieldErrors.ShouldNotBeNull().Keys.Order().ToArray().ShouldBe(["email", "firstName", "lastName", "role", "version"]);
        await harness.RosterLock.DidNotReceive().LockActiveManagersAsync(Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().FindByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("Neda", "Santos", "Owner", "role", "Choose a role.")]
    [InlineData("Neda", "Santos", "", "role", "Choose a role.")]
    [InlineData("", "Santos", "Admin", "firstName", "Enter a first name.")]
    [InlineData("Neda", " ", "Admin", "lastName", "Enter a last name.")]
    public async Task ABadFieldIsReportedWithTheSharedMessage(string first, string last, string role, string field, string message)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(TargetId, Harness.Form(first, last, role), TestContext.Current.CancellationToken);

        result.Error.FieldErrors.ShouldNotBeNull()[field].ShouldBe([message]);
    }

    [Fact]
    public async Task NamesOverOneHundredCharactersAndAMalformedVersionAreRefused()
    {
        var harness = new Harness();
        var tooLong = new string('a', 101);

        var result = await harness.Handler.HandleAsync(TargetId, new UpdateUserRequest(tooLong, tooLong, "Admin", "not-a-guid"), TestContext.Current.CancellationToken);

        var errors = result.Error.FieldErrors.ShouldNotBeNull();
        errors["firstName"].ShouldBe(["First name must be 100 characters or fewer."]);
        errors["lastName"].ShouldBe(["Last name must be 100 characters or fewer."]);
        errors["version"].ShouldBe(["Reload the form and try again."]);
    }

    [Fact]
    public async Task ALostRaceIsRetriedOnceThenAnswersBusyWithoutEvicting()
    {
        var retried = new Harness
        {
            Edit = new DetailsEditResult(EditOutcome.Saved, SavedVersion, [EditedFields.Role], Roles.Manager),
        };
        retried.Unit.FailFirstSaveWithConflict();
        (await retried.SaveAsync(role: "Admin")).IsSuccess.ShouldBeTrue();
        retried.Unit.Saves.ShouldBe(2);

        var busy = new Harness
        {
            Edit = new DetailsEditResult(EditOutcome.Saved, SavedVersion, [EditedFields.Role], Roles.Manager),
        };
        busy.Unit.FailEverySaveWithConflict();
        var result = await busy.SaveAsync(role: "Admin");

        result.Error.ShouldBeSameAs(AuthErrors.SessionBusy);
        busy.Cache.EvictedUsers.ShouldBeEmpty();
    }

    [Fact]
    public async Task APersonWhoCannotBeReadBackAfterTheSaveIsANotFound()
    {
        var harness = new Harness { View = null };

        var result = await harness.SaveAsync(role: "Manager");

        result.Error.ShouldBeSameAs(UserErrors.NotFound);
    }

    // ---- the email: confirm by link, save at once, invited person (C-9, D-45) ----

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("later")]
    public async Task AChangedEmailWithoutAValidChoiceIsRefusedBeforeAnythingIsLookedUpOrSaved(string? choice)
    {
        var harness = new Harness();

        var result = await harness.EmailSaveAsync(NewEmail, choice);

        result.Error.ShouldBeSameAs(UserErrors.EmailChangeChoiceRequired);
        await harness.Accounts.DidNotReceive().FindByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().UpdateDetailsAsync(Arg.Any<Guid>(), Arg.Any<UserDetailsChange>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        harness.Outbox.Emails.ShouldBeEmpty();
    }

    [Theory]
    [InlineData("person@csps.test", null)]
    [InlineData("PERSON@csps.test", "whatever")]
    [InlineData("  person@csps.test  ", "")]
    public async Task AnUnchangedEmailIgnoresTheChoiceAndSendsNothing(string email, string? choice)
    {
        var harness = new Harness { Target = Account(TargetId, Roles.Admin) };

        var result = await harness.EmailSaveAsync(email, choice);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.Received(1).UpdateDetailsAsync(TargetId, new UserDetailsChange("Ana", "Cruz", Roles.Admin), OpenedVersion, Arg.Any<CancellationToken>());
        await harness.Tokens.DidNotReceive().LockAccountAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        harness.Outbox.Emails.ShouldBeEmpty();
        harness.Audit.Entries.Select(entry => entry.Action).ShouldBe([AuditActions.UserDetailsChanged]);
    }

    [Theory]
    [InlineData(" NOW ")]
    [InlineData("Now")]
    public async Task TheChoiceIsTrimmedAndAnyLetterCaseWorks(string choice)
    {
        var harness = new Harness { Target = Account(TargetId, Roles.Admin), Edit = new DetailsEditResult(EditOutcome.Saved, SavedVersion, [EditedFields.Email]) };

        var result = await harness.EmailSaveAsync(NewEmail, choice);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.Received(1).UpdateDetailsAsync(TargetId, new UserDetailsChange("Ana", "Cruz", Roles.Admin, NewEmail), OpenedVersion, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnAddressAnotherLiveAccountUsesIsRefusedOnTheEmailFieldAndNothingIsSaved()
    {
        var harness = new Harness { Target = Account(TargetId, Roles.Admin) };
        harness.Accounts.FindByEmailAsync(NewEmail, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<UserAccount?>(Account(Guid.NewGuid(), Roles.Admin) with { Email = NewEmail }));

        var result = await harness.EmailSaveAsync(NewEmail, "now");

        result.Error.ShouldBeSameAs(UserErrors.EmailInUse);
        await harness.Accounts.DidNotReceive().UpdateDetailsAsync(Arg.Any<Guid>(), Arg.Any<UserDetailsChange>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        harness.Outbox.Emails.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task ADeletedHolderOrTheSamePersonDoesNotBlockTheAddress(bool deleted)
    {
        var harness = new Harness { Target = Account(TargetId, Roles.Admin), Edit = new DetailsEditResult(EditOutcome.Saved, SavedVersion, [EditedFields.Email]) };
        var holder = deleted ? Account(Guid.NewGuid(), Roles.Admin) with { Email = NewEmail, IsDeleted = true } : Account(TargetId, Roles.Admin) with { Email = NewEmail };
        harness.Accounts.FindByEmailAsync(NewEmail, Arg.Any<CancellationToken>()).Returns(Task.FromResult<UserAccount?>(holder));

        var result = await harness.EmailSaveAsync(NewEmail, "now");

        result.IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public async Task AnAddressTakenInTheSameInstantIsTheSameRefusalAndSendsNothing()
    {
        var harness = new Harness
        {
            Target = Account(TargetId, Roles.Admin),
            Edit = new DetailsEditResult(EditOutcome.EmailTaken, OpenedVersion, []),
        };

        var result = await harness.EmailSaveAsync(NewEmail, "confirm");

        result.Error.ShouldBeSameAs(UserErrors.EmailInUse);
        harness.Outbox.Emails.ShouldBeEmpty();
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(EditOutcome.Stale)]
    [InlineData(EditOutcome.NotFound)]
    public async Task AStaleFormOrAVanishedPersonSendsNothingAndStartsNoLink(EditOutcome outcome)
    {
        var harness = new Harness { Target = Account(TargetId, Roles.Admin), Edit = new DetailsEditResult(outcome, OpenedVersion, []) };

        var result = await harness.EmailSaveAsync(NewEmail, "confirm");

        result.IsFailure.ShouldBeTrue();
        result.Error.ShouldBeSameAs(outcome == EditOutcome.Stale ? EditErrors.Stale : UserErrors.NotFound);
        await harness.Tokens.DidNotReceive().LockAccountAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().SetPendingEmailAsync(Arg.Any<Guid>(), Arg.Any<string?>(), Arg.Any<CancellationToken>());
        harness.Outbox.Emails.ShouldBeEmpty();
    }

    [Fact]
    public async Task WithoutTheCallersProfileAChangedEmailAnswersSessionEndedAndSavesNothing()
    {
        var harness = new Harness { Target = Account(TargetId, Roles.Admin) };
        harness.Directory.GetProfileAsync(CallerId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<ProfileView?>(null));

        var result = await harness.EmailSaveAsync(NewEmail, "now");

        result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
        await harness.Accounts.DidNotReceive().UpdateDetailsAsync(Arg.Any<Guid>(), Arg.Any<UserDetailsChange>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ConfirmByLinkKeepsTheSignInStartsAPendingChangeAndEmailsBothAddresses()
    {
        var harness = new Harness { Target = Account(TargetId, Roles.Admin), Edit = new DetailsEditResult(EditOutcome.Unchanged, OpenedVersion, []) };

        var result = await harness.EmailSaveAsync(NewEmail, "confirm");

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.Received(1).UpdateDetailsAsync(TargetId, new UserDetailsChange("Ana", "Cruz", Roles.Admin), OpenedVersion, Arg.Any<CancellationToken>());
        Received.InOrder(() =>
        {
            harness.Tokens.LockAccountAsync(TargetId, Arg.Any<CancellationToken>());
            harness.Tokens.RevokeOpenAsync(TargetId, AccountTokenPurpose.EmailChange, Start, Arg.Any<CancellationToken>());
            harness.Accounts.SetPendingEmailAsync(TargetId, NewEmail, Arg.Any<CancellationToken>());
        });
        var token = harness.Added.ShouldHaveSingleItem();
        token.UserId.ShouldBe(TargetId);
        token.Purpose.ShouldBe(AccountTokenPurpose.EmailChange);
        (token.ExpiresAt - token.CreatedAt).ShouldBe(TimeSpan.FromHours(24));
        var confirm = harness.Outbox.Emails.OfType<EmailChangeConfirmEmail>().ShouldHaveSingleItem();
        confirm.To.ShouldBe(NewEmail);
        confirm.OldEmail.ShouldBe(TargetEmail);
        confirm.ChangedBy.ShouldBe("Carmen Reyes");
        confirm.Token.ShouldBe(Secret);
        confirm.ExpiresAt.ShouldBe(token.ExpiresAt);
        var notice = harness.Outbox.Emails.OfType<EmailChangeNoticeEmail>().ShouldHaveSingleItem();
        notice.To.ShouldBe(TargetEmail);
        notice.NewEmail.ShouldBe(NewEmail);
        harness.Outbox.Emails.Count.ShouldBe(2);
        harness.Audit.Entries.ShouldBe([new AuditCall(AuditActions.UserEmailChangeStarted, "User", TargetId.ToString("D"), null, Independent: false)]);
        await harness.Sessions.DidNotReceive().RevokeAllAsync(Arg.Any<Guid>(), Arg.Any<Guid?>(), Arg.Any<SessionRevocationReason>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        harness.Cache.EvictedUsers.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task ConfirmByLinkWithANameChangeRecordsBothEntriesInOrder()
    {
        var harness = new Harness
        {
            Target = Account(TargetId, Roles.Admin),
            Edit = new DetailsEditResult(EditOutcome.Saved, SavedVersion, [EditedFields.FirstName]),
        };

        var result = await harness.EmailSaveAsync(NewEmail, "confirm", first: "Neda");

        result.IsSuccess.ShouldBeTrue();
        var key = TargetId.ToString("D");
        harness.Audit.Entries.ShouldBe(
        [
            new AuditCall(AuditActions.UserDetailsChanged, "User", key, "fields=first-name", Independent: false),
            new AuditCall(AuditActions.UserEmailChangeStarted, "User", key, null, Independent: false),
        ]);
    }

    [Fact]
    public async Task SaveAtOnceMovesTheEmailEndsEverySessionClosesOpenLinksAndNotifiesTheOldAddress()
    {
        var harness = new Harness { Target = Account(TargetId, Roles.Admin), Edit = new DetailsEditResult(EditOutcome.Saved, SavedVersion, [EditedFields.Email]) };
        harness.Sessions.RevokeAllAsync(TargetId, null, SessionRevocationReason.AccountChanged, Start, Arg.Any<CancellationToken>())
            .Returns([Guid.NewGuid()]);

        var result = await harness.EmailSaveAsync(NewEmail, "now");

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.Received(1).UpdateDetailsAsync(TargetId, new UserDetailsChange("Ana", "Cruz", Roles.Admin, NewEmail), OpenedVersion, Arg.Any<CancellationToken>());
        await harness.Tokens.Received(1).RevokeOpenAsync(TargetId, AccountTokenPurpose.EmailChange, Start, Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().SetPendingEmailAsync(Arg.Any<Guid>(), Arg.Any<string?>(), Arg.Any<CancellationToken>());
        harness.Added.ShouldBeEmpty();
        var notice = harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBeOfType<ManagerEmailChangedEmail>();
        notice.To.ShouldBe(TargetEmail);
        notice.NewEmail.ShouldBe(NewEmail);
        notice.ChangedBy.ShouldBe("Carmen Reyes");
        notice.ChangedAt.ShouldBe(Start);
        var key = TargetId.ToString("D");
        harness.Audit.Entries.ShouldBe(
        [
            new AuditCall(AuditActions.UserDetailsChanged, "User", key, "fields=email", Independent: false),
            new AuditCall(AuditActions.SessionsRevoked, "User", key, "account-changed", Independent: false),
        ]);
        harness.Cache.EvictedUsers.ShouldBe([TargetId]);
        harness.Cache.SavesWhenEvicted.ShouldBe(1);
        harness.Cache.CommitsWhenEvicted.ShouldBe(1);
    }

    [Fact]
    public async Task SaveAtOnceForSomeoneWithNoOpenSessionRecordsNoRevocationButStillEvicts()
    {
        var harness = new Harness { Target = Account(TargetId, Roles.Admin), Edit = new DetailsEditResult(EditOutcome.Saved, SavedVersion, [EditedFields.Email]) };

        var result = await harness.EmailSaveAsync(NewEmail, "now");

        result.IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.Select(entry => entry.Action).ShouldBe([AuditActions.UserDetailsChanged]);
        harness.Cache.EvictedUsers.ShouldBe([TargetId]);
    }

    [Fact]
    public async Task ANameRoleAndAtOnceEmailInOneSaveRevokeOnceAndKeepTheEntriesSeparate()
    {
        var harness = new Harness
        {
            Edit = new DetailsEditResult(EditOutcome.Saved, SavedVersion, [EditedFields.FirstName, EditedFields.Email, EditedFields.Role], Roles.Manager),
        };
        harness.Sessions.RevokeAllAsync(TargetId, null, SessionRevocationReason.AccountChanged, Start, Arg.Any<CancellationToken>())
            .Returns([Guid.NewGuid()]);

        var result = await harness.EmailSaveAsync(NewEmail, "now", first: "Neda");

        result.IsSuccess.ShouldBeTrue();
        await harness.Sessions.Received(1).RevokeAllAsync(Arg.Any<Guid>(), Arg.Any<Guid?>(), Arg.Any<SessionRevocationReason>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        var key = TargetId.ToString("D");
        harness.Audit.Entries.ShouldBe(
        [
            new AuditCall(AuditActions.UserDetailsChanged, "User", key, "fields=first-name,email", Independent: false),
            new AuditCall(AuditActions.UserRoleChanged, "User", key, "role=manager>admin", Independent: false),
            new AuditCall(AuditActions.SessionsRevoked, "User", key, "account-changed", Independent: false),
        ]);
    }

    [Theory]
    [InlineData("confirm")]
    [InlineData("now")]
    public async Task AnInvitedPersonMovesAtOnceWhicheverChoiceIsSentAndGetsAFreshInvitation(string choice)
    {
        var harness = new Harness
        {
            Target = Account(TargetId, Roles.Admin) with { HasPassword = false },
            Edit = new DetailsEditResult(EditOutcome.Saved, SavedVersion, [EditedFields.Email]),
        };

        var result = await harness.EmailSaveAsync(NewEmail, choice);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.Received(1).UpdateDetailsAsync(TargetId, new UserDetailsChange("Ana", "Cruz", Roles.Admin, NewEmail), OpenedVersion, Arg.Any<CancellationToken>());
        Received.InOrder(() =>
        {
            harness.Tokens.LockAccountAsync(TargetId, Arg.Any<CancellationToken>());
            harness.Tokens.RevokeOpenAsync(TargetId, AccountTokenPurpose.Invitation, Start, Arg.Any<CancellationToken>());
        });
        var token = harness.Added.ShouldHaveSingleItem();
        token.Purpose.ShouldBe(AccountTokenPurpose.Invitation);
        (token.ExpiresAt - token.CreatedAt).ShouldBe(TimeSpan.FromDays(7));
        var invite = harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBeOfType<InviteEmail>();
        invite.To.ShouldBe(NewEmail);
        invite.Token.ShouldBe(Secret);
        invite.InvitedBy.ShouldBe("Carmen Reyes");
        invite.ExpiresAt.ShouldBe(token.ExpiresAt);
        var key = TargetId.ToString("D");
        harness.Audit.Entries.ShouldBe(
        [
            new AuditCall(AuditActions.UserDetailsChanged, "User", key, "fields=email", Independent: false),
            new AuditCall(AuditActions.UserInvitationResent, "User", key, null, Independent: false),
        ]);
        await harness.Accounts.DidNotReceive().SetPendingEmailAsync(Arg.Any<Guid>(), Arg.Any<string?>(), Arg.Any<CancellationToken>());
        await harness.Sessions.DidNotReceive().RevokeAllAsync(Arg.Any<Guid>(), Arg.Any<Guid?>(), Arg.Any<SessionRevocationReason>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        harness.Cache.EvictedUsers.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not-an-email")]
    [InlineData("a@@b.com")]
    public async Task ABlankOrMalformedEmailIsReportedOnTheEmailFieldAndTouchesNothing(string? email)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(
            TargetId, new UpdateUserRequest("Ana", "Cruz", "Admin", OpenedVersion.ToString("D"), email, "now"), TestContext.Current.CancellationToken);

        result.Error.FieldErrors.ShouldNotBeNull()["email"].ShouldBe(["Enter a valid email, like name@gmail.com"]);
        await harness.Accounts.DidNotReceive().FindByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    private static UserAccount Account(Guid id, string role) =>
        new(id, TargetEmail, "Ana", "Abad", role, IsActive: true, EmailConfirmed: true, HasPassword: true, MustChangePassword: null, BreachRecheckPending: false, LockoutEnd: null);

    private sealed class Harness
    {
        public Harness(bool noCaller = false)
        {
            Target = Account(TargetId, Roles.Manager);
            Accounts = Substitute.For<IUserAccounts>();
            Accounts.FindByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns<Task<UserAccount?>>(_ => Task.FromResult<UserAccount?>(Target));
            Accounts.UpdateDetailsAsync(Arg.Any<Guid>(), Arg.Any<UserDetailsChange>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
                .Returns(_ => Task.FromResult(Edit));
            Accounts.CountActiveManagersAsync(Arg.Any<Guid?>(), Arg.Any<CancellationToken>()).Returns(1);
            Directory = Substitute.For<IUserDirectory>();
            Directory.GetUserAsync(TargetId, Start, Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult<UserDetailView?>(View));
            Sessions = Substitute.For<ISessions>();
            Sessions.RevokeAllAsync(Arg.Any<Guid>(), Arg.Any<Guid?>(), Arg.Any<SessionRevocationReason>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
                .Returns([]);
            Cache = new EvictionProbe();
            Cache.Watch(Unit);
            RosterLock = Substitute.For<IManagerRosterLock>();
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Tokens = Substitute.For<IAccountTokens>();
            Tokens.When(store => store.Add(Arg.Any<AccountToken>())).Do(call => Added.Add(call.Arg<AccountToken>()));
            Random = Substitute.For<ISecureRandom>();
            Random.NewToken().Returns(Secret);
            Directory.GetProfileAsync(CallerId, Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult<ProfileView?>(
                new ProfileView(CallerId, "Carmen", "Reyes", "carmen@csps.test", "Manager", null, Start.AddDays(-90), Guid.NewGuid())));
            Handler = new UpdateUserHandler(
                Accounts, Directory, Sessions, Cache, RosterLock, new ManagerGuard(Accounts), request, new UpdateUserRequestValidator(), Audit, Unit,
                new FakeTimeProvider(Start), Tokens, Random, Outbox, new AuthSettings());
        }

        public UserAccount? Target { get; set; }

        public DetailsEditResult Edit { get; set; } = new(EditOutcome.Saved, SavedVersion, [EditedFields.FirstName]);

        public UserDetailView? View { get; set; } = new(
            TargetId, "Ana", "Cruz", "person@csps.test", "Admin", UserStatuses.Active, InviteStates.None,
            Start.AddDays(-30), true, false, null, Start, SavedVersion, null, null);

        public IUserAccounts Accounts { get; }

        public IUserDirectory Directory { get; }

        public ISessions Sessions { get; }

        public EvictionProbe Cache { get; }

        public IManagerRosterLock RosterLock { get; }

        public IAccountTokens Tokens { get; }

        public ISecureRandom Random { get; }

        public List<AccountToken> Added { get; } = [];

        public RecordingOutbox Outbox { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public UpdateUserHandler Handler { get; }

        public static UpdateUserRequest Form(string first, string last, string role, string email = TargetEmail, string? emailChange = null) =>
            new(first, last, role, OpenedVersion.ToString("D"), email, emailChange);

        public Task<Result<UserDetailResponse>> EmailSaveAsync(
            string email, string? choice, string first = "Ana", string last = "Cruz", string role = "Admin") =>
            Handler.HandleAsync(TargetId, Form(first, last, role, email, choice), TestContext.Current.CancellationToken);

        public Task<Result<UserDetailResponse>> SaveAsync(string first = "Ana", string last = "Cruz", string role = "Admin") =>
            Handler.HandleAsync(TargetId, Form(first, last, role), TestContext.Current.CancellationToken);
    }
}

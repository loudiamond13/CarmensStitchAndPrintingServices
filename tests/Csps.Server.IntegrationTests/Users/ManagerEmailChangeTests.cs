using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Users;

/// <summary>
/// USER-03, USER-06, C-9, D-21, D-40, D-45, T-05-68: a Manager changes a colleague's sign-in email and chooses, each time, whether it
/// applies by a confirmation link (C-9) or at once with the person signed out. The API never infers the choice. An invited person's
/// address always moves at once and the invitation is replaced. A Manager can also call off a waiting change.
/// </summary>
public sealed class ManagerEmailChangeTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string ManagerName = "Paolo Reyes";
    private const string DetailsChanged = "user.details-changed";
    private const string EmailChangeStarted = "user.email-change-started";
    private const string InvitationResent = "user.invitation-resent";
    private const string SessionsRevoked = "auth.sessions-revoked";
    private const string EmailChangeCanceled = "profile.email-change-canceled";
    private const string ConfirmSubject = "Confirm your new CSPS email";
    private const string NoticeSubject = "Your CSPS email is being changed";
    private const string ManagerChangedSubject = "A Manager changed your CSPS sign-in email";
    private const string InviteSubject = "Set up your CSPS staff account";
    private const string EmailInvalid = "Enter a valid email, like name@gmail.com";
    private const string EmailTaken = "Another account already uses this email.";
    private const string ModeRequired = "Choose how the email change applies.";

    [Theory]
    [InlineData("confirm")]
    [InlineData("now")]
    public async Task AnInvitedPersonsAddressMovesAtOnceWhicheverWayIsChosenAndTheOldInviteDies(string mode)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var oldEmail = AuthClient.NewEmail();
        var newEmail = AuthClient.NewEmail();
        var id = await InviteAsync(client, manager.AccessToken, oldEmail);
        var oldToken = AuthClient.TokenOf((await AuthClient.WaitForEmailsAsync(client, oldEmail)).Single(static mail => mail.Subject == InviteSubject));
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, id);

        using var response = await PutAsync(client, manager.AccessToken, id, Form(before, newEmail, mode));

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var saved = await ReadAsync(response);
        saved.GetProperty("email").GetString().ShouldBe(newEmail);
        saved.GetProperty("pendingEmail").ValueKind.ShouldBe(JsonValueKind.Null);
        saved.GetProperty("hasPassword").GetBoolean().ShouldBeFalse();
        saved.GetProperty("inviteState").GetString().ShouldBe("pending");

        using (var oldLink = await AuthClient.CheckInviteAsync(client, oldToken))
        {
            oldLink.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        }

        var invite = (await AuthClient.WaitForEmailsAsync(client, newEmail)).ShouldHaveSingleItem();
        invite.Subject.ShouldBe(InviteSubject);
        invite.Text.ShouldContain($"{ManagerName} set up your account.");
        invite.Text.ShouldContain("This link works for 7 days and only once.");
        using (var newLink = await AuthClient.CheckInviteAsync(client, AuthClient.TokenOf(invite)))
        {
            newLink.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        // The old address holds only the first invitation: a person who never set up the account gets no notice.
        (await AuthClient.ReadEmailsAsync(client, oldEmail)).ShouldHaveSingleItem();
        (await AuditOfAsync(id, DetailsChanged)).ShouldHaveSingleItem().Detail.ShouldBe("fields=email");
        (await AuditOfAsync(id, InvitationResent)).ShouldHaveSingleItem().ActorUserId.ShouldBe(manager.UserId);
        (await AuditOfAsync(id, EmailChangeStarted)).ShouldBeEmpty();
        await AssertNoAddressInAuditAsync(id, oldEmail, newEmail);
    }

    [Fact]
    public async Task ConfirmByLinkLeavesTheSignInAloneUntilTheNewInboxConfirmsAndNamesTheManager()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        using var personClient = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var device = await AuthClient.SignInFullyAsync(personClient, staff);
        var newEmail = AuthClient.NewEmail();
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id);

        using var response = await PutAsync(client, manager.AccessToken, staff.Id, Form(before, newEmail, "confirm"));

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var saved = await ReadAsync(response);
        saved.GetProperty("email").GetString().ShouldBe(staff.Email);
        saved.GetProperty("pendingEmail").GetString().ShouldBe(newEmail);
        saved.GetProperty("version").GetGuid().ShouldBe(before.GetProperty("version").GetGuid());

        var confirm = (await AuthClient.WaitForEmailsAsync(client, newEmail)).ShouldHaveSingleItem();
        confirm.Subject.ShouldBe(ConfirmSubject);
        confirm.Text.ShouldContain($"{ManagerName} changed the sign-in email for your CSPS staff account to {newEmail}.");
        confirm.Text.ShouldNotContain("You asked to change");
        confirm.Text.ShouldContain("It works for 24 hours and only once.");
        var notice = (await AuthClient.WaitForEmailsAsync(client, staff.Email, count: 2)).Single(static mail => mail.Subject == NoticeSubject);
        notice.Text.ShouldNotContain("#token=");

        // Nothing moved: the old email still signs in, the new one does not, and the person is not signed out.
        using var fresh = AuthClient.CreateClient(factory);
        using (var withOld = await AuthClient.SignInAsync(fresh, staff.Email, staff.Password))
        {
            withOld.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        using (var withNew = await AuthClient.SignInAsync(fresh, newEmail, staff.Password))
        {
            withNew.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        }

        (await AuthClient.SiteSettingsStatusAsync(personClient, device.AccessToken)).ShouldBe(HttpStatusCode.OK);

        using (var applied = await ConfirmAsync(client, AuthClient.TokenOf(confirm)))
        {
            applied.StatusCode.ShouldBe(HttpStatusCode.OK, await applied.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        (await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id)).GetProperty("email").GetString().ShouldBe(newEmail);

        var started = (await AuditOfAsync(staff.Id, EmailChangeStarted)).ShouldHaveSingleItem();
        started.ActorUserId.ShouldBe(manager.UserId);
        started.TargetType.ShouldBe("User");
        started.Detail.ShouldBeNull();
        (await AuditOfAsync(staff.Id, DetailsChanged)).ShouldBeEmpty();
        (await AuditOfAsync(staff.Id, SessionsRevoked)).ShouldBeEmpty();
        await AssertNoAddressInAuditAsync(staff.Id, staff.Email, newEmail);
    }

    [Fact]
    public async Task SaveAtOnceMovesTheEmailNotifiesTheOldAddressSignsThePersonOutAndClosesOpenLinks()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        using var personClient = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var device = await AuthClient.SignInFullyAsync(personClient, staff);
        var laterEmail = AuthClient.NewEmail();
        var newEmail = AuthClient.NewEmail();

        // A change by link is waiting first; the at-once save must close it.
        var waiting = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id);
        using (var start = await PutAsync(client, manager.AccessToken, staff.Id, Form(waiting, laterEmail, "confirm")))
        {
            start.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        var openLink = AuthClient.TokenOf((await AuthClient.WaitForEmailsAsync(client, laterEmail)).Single(static mail => mail.Subject == ConfirmSubject));
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id);
        (await AuthClient.SiteSettingsStatusAsync(personClient, device.AccessToken)).ShouldBe(HttpStatusCode.OK);

        using var response = await PutAsync(client, manager.AccessToken, staff.Id, Form(before, newEmail, "now"));

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var saved = await ReadAsync(response);
        saved.GetProperty("email").GetString().ShouldBe(newEmail);
        saved.GetProperty("pendingEmail").ValueKind.ShouldBe(JsonValueKind.Null);
        saved.GetProperty("version").GetGuid().ShouldNotBe(before.GetProperty("version").GetGuid());
        saved.GetProperty("lastChangedBy").GetProperty("id").GetGuid().ShouldBe(manager.UserId);

        // Signed out at once: the old token is refused on the very next request, and the new email signs in while the old one does not.
        (await AuthClient.SiteSettingsStatusAsync(personClient, device.AccessToken)).ShouldBe(HttpStatusCode.Unauthorized);
        using var fresh = AuthClient.CreateClient(factory);
        using (var withNew = await AuthClient.SignInAsync(fresh, newEmail, staff.Password))
        {
            withNew.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        using (var withOld = await AuthClient.SignInAsync(fresh, staff.Email, staff.Password))
        {
            withOld.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        }

        // The earlier confirmation link is dead.
        using (var dead = await ConfirmAsync(client, openLink))
        {
            dead.StatusCode.ShouldBe(HttpStatusCode.NotFound);
            (await ProblemJson.ReadAsync(dead, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("email-change.invalid");
        }

        // The old address is told by a new notice that names the Manager and carries no token.
        var told = (await AuthClient.WaitForEmailsAsync(client, staff.Email, count: 3)).Single(static mail => mail.Subject == ManagerChangedSubject);
        told.Text.ShouldContain($"{ManagerName} changed your sign-in email to {newEmail}.");
        told.Text.ShouldContain("every device signed in to your account was signed out");
        told.Text.ShouldNotContain("#token=");

        (await AuditOfAsync(staff.Id, DetailsChanged)).ShouldHaveSingleItem().Detail.ShouldBe("fields=email");
        var revoked = (await AuditOfAsync(staff.Id, SessionsRevoked)).ShouldHaveSingleItem();
        revoked.Detail.ShouldBe("account-changed");
        revoked.ActorUserId.ShouldBe(manager.UserId);
        (await AuditOfAsync(staff.Id, EmailChangeStarted)).Count.ShouldBe(1);
        await AssertNoAddressInAuditAsync(staff.Id, staff.Email, newEmail, laterEmail);
    }

    [Fact]
    public async Task ANameChangeAndAnAtOnceEmailInOneSaveAreOneDetailsEntryWithOnlyFieldNames()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var newEmail = AuthClient.NewEmail();
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id);

        using var response = await PutAsync(client, manager.AccessToken, staff.Id, Form(before, newEmail, "now", firstName: "Neda"));

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await ReadAsync(response)).GetProperty("firstName").GetString().ShouldBe("Neda");
        (await AuditOfAsync(staff.Id, DetailsChanged)).ShouldHaveSingleItem().Detail.ShouldBe("fields=first-name,email");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("later")]
    [InlineData("apply")]
    public async Task ChangingTheEmailWithoutAValidChoiceAnswers400OnTheChoiceFieldAndChangesNothing(string? mode)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var newEmail = AuthClient.NewEmail();
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id);

        using var response = await PutAsync(client, manager.AccessToken, staff.Id, Form(before, newEmail, mode));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").GetProperty("emailChange").EnumerateArray().Select(item => item.GetString()).ShouldBe([ModeRequired]);
        var after = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id);
        after.GetProperty("email").GetString().ShouldBe(staff.Email);
        after.GetProperty("pendingEmail").ValueKind.ShouldBe(JsonValueKind.Null);
        after.GetProperty("version").GetGuid().ShouldBe(before.GetProperty("version").GetGuid());
        (await AuthClient.ReadEmailsAsync(client, newEmail)).ShouldBeEmpty();
        (await AuditOfAsync(staff.Id, EmailChangeStarted)).ShouldBeEmpty();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("whatever")]
    public async Task AnUnchangedEmailIgnoresTheChoiceAndSavesTheRest(string? mode)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id);

        using var response = await PutAsync(client, manager.AccessToken, staff.Id, Form(before, staff.Email, mode, firstName: "Neda"));

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var saved = await ReadAsync(response);
        saved.GetProperty("firstName").GetString().ShouldBe("Neda");
        saved.GetProperty("email").GetString().ShouldBe(staff.Email);
        (await AuditOfAsync(staff.Id, DetailsChanged)).ShouldHaveSingleItem().Detail.ShouldBe("fields=first-name");
        (await AuditOfAsync(staff.Id, EmailChangeStarted)).ShouldBeEmpty();
    }

    [Fact]
    public async Task TheSameAddressInAnotherLetterCaseIsTheSameAddress()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id);

        using var response = await PutAsync(client, manager.AccessToken, staff.Id, Form(before, staff.Email.ToUpperInvariant(), null));

        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var saved = await ReadAsync(response);
        saved.GetProperty("email").GetString().ShouldBe(staff.Email);
        saved.GetProperty("version").GetGuid().ShouldBe(before.GetProperty("version").GetGuid());
    }

    [Theory]
    [InlineData("confirm", false)]
    [InlineData("now", false)]
    [InlineData("confirm", true)]
    public async Task AnAddressAnotherAccountUsesAnswers400OnTheEmailFieldAndChangesNothing(string mode, bool otherLetterCase)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var other = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id);

        using var response = await PutAsync(client, manager.AccessToken, staff.Id, Form(before, otherLetterCase ? other.Email.ToUpperInvariant() : other.Email, mode));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").GetProperty("email").EnumerateArray().Select(item => item.GetString()).ShouldBe([EmailTaken]);
        var after = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id);
        after.GetProperty("email").GetString().ShouldBe(staff.Email);
        after.GetProperty("pendingEmail").ValueKind.ShouldBe(JsonValueKind.Null);
        after.GetProperty("version").GetGuid().ShouldBe(before.GetProperty("version").GetGuid());
        (await AuthClient.ReadEmailsAsync(client, other.Email)).ShouldBeEmpty();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not-an-email")]
    [InlineData("a@@b.com")]
    [InlineData("@b.com")]
    public async Task AMissingBlankOrMalformedEmailAnswers400OnTheEmailFieldAndChangesNothing(string? email)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id);

        using var response = await PutAsync(client, manager.AccessToken, staff.Id, Form(before, email, "now", firstName: "Neda"));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("errors").GetProperty("email").EnumerateArray().Select(item => item.GetString()).ShouldBe([EmailInvalid]);
        var after = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id);
        after.GetProperty("firstName").GetString().ShouldBe("Paolo");
        after.GetProperty("version").GetGuid().ShouldBe(before.GetProperty("version").GetGuid());
    }

    [Fact]
    public async Task AnEmailLongerThan256CharactersAnswers400OnTheEmailField()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id);

        using var response = await PutAsync(client, manager.AccessToken, staff.Id, Form(before, new string('a', 251) + "@x.com", "now"));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("errors").GetProperty("email")
            .EnumerateArray().Select(item => item.GetString()).ShouldBe([EmailInvalid]);
    }

    [Fact]
    public async Task AStaleFormWithANewEmailAnswers409AndMovesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var newEmail = AuthClient.NewEmail();
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id);
        using (var first = await PutAsync(client, manager.AccessToken, staff.Id, Form(before, staff.Email, null, firstName: "Neda")))
        {
            first.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        foreach (var mode in new[] { "now", "confirm" })
        {
            using var stale = await PutAsync(client, manager.AccessToken, staff.Id, Form(before, newEmail, mode));

            stale.StatusCode.ShouldBe(HttpStatusCode.Conflict, await stale.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            (await ProblemJson.ReadAsync(stale, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("edit.stale");
        }

        var after = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id);
        after.GetProperty("email").GetString().ShouldBe(staff.Email);
        after.GetProperty("pendingEmail").ValueKind.ShouldBe(JsonValueKind.Null);
        (await AuthClient.ReadEmailsAsync(client, newEmail)).ShouldBeEmpty();
    }

    [Fact]
    public async Task ACanceledChangeClosesTheLinkClearsTheWaitingAddressAndRecordsTheManager()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var newEmail = AuthClient.NewEmail();
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id);
        using (var start = await PutAsync(client, manager.AccessToken, staff.Id, Form(before, newEmail, "confirm")))
        {
            start.StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        var token = AuthClient.TokenOf((await AuthClient.WaitForEmailsAsync(client, newEmail)).Single(static mail => mail.Subject == ConfirmSubject));

        using (var cancel = await CancelAsync(client, manager.AccessToken, staff.Id))
        {
            cancel.StatusCode.ShouldBe(HttpStatusCode.NoContent, await cancel.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        var after = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id);
        after.GetProperty("pendingEmail").ValueKind.ShouldBe(JsonValueKind.Null);
        after.GetProperty("email").GetString().ShouldBe(staff.Email);
        using (var dead = await ConfirmAsync(client, token))
        {
            dead.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        }

        var entry = (await AuditOfAsync(staff.Id, EmailChangeCanceled)).ShouldHaveSingleItem();
        entry.ActorUserId.ShouldBe(manager.UserId);
        entry.Detail.ShouldBeNull();
    }

    [Fact]
    public async Task CancelingWhenNothingIsWaitingAnswers204AndWritesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);

        using var response = await CancelAsync(client, manager.AccessToken, staff.Id);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await AuditOfAsync(staff.Id, EmailChangeCanceled)).ShouldBeEmpty();
    }

    [Fact]
    public async Task CancelingForAnUnknownOrDeletedPersonAnswers404()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var deleted = await UserFixtures.CreateAsync(factory, UserFixtures.NewTag(), "Jun", "Javier", Roles.Admin);
        await AccountStateFixtures.MarkDeletedAsync(factory, deleted.Id);

        foreach (var id in new[] { Guid.NewGuid(), deleted.Id })
        {
            using var response = await CancelAsync(client, manager.AccessToken, id);

            response.StatusCode.ShouldBe(HttpStatusCode.NotFound, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            (await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("users.not-found");
        }
    }

    [Fact]
    public async Task AManagerCannotCancelOrChangeTheirOwnEmailHereAndAnAdminIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);
        var staff = await AuthClient.CreateStaffAsync(factory, role: Roles.Admin);
        var own = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, manager.UserId);
        var before = await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id);

        using (var ownCancel = await CancelAsync(client, manager.AccessToken, manager.UserId))
        {
            ownCancel.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
            (await ProblemJson.ReadAsync(ownCancel, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("users.own-account");
        }

        using (var ownChange = await PutAsync(client, manager.AccessToken, manager.UserId, Form(own, AuthClient.NewEmail(), "now")))
        {
            ownChange.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        }

        using (var adminCancel = await CancelAsync(client, admin.AccessToken, staff.Id))
        {
            adminCancel.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        }

        using (var adminChange = await PutAsync(client, admin.AccessToken, staff.Id, Form(before, AuthClient.NewEmail(), "now")))
        {
            adminChange.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        }

        (await UserFixtures.ReadDetailAsync(client, manager.AccessToken, staff.Id)).GetProperty("email").GetString().ShouldBe(staff.Email);
    }

    // The default of the form is the link route, so a change that was not explicitly "now" never moves the address.
    private static Dictionary<string, object?> Form(JsonElement loaded, string? email, string? emailChange, string? firstName = null) =>
        new()
        {
            ["firstName"] = firstName ?? loaded.GetProperty("firstName").GetString(),
            ["lastName"] = loaded.GetProperty("lastName").GetString(),
            ["role"] = loaded.GetProperty("role").GetString(),
            ["version"] = loaded.GetProperty("version").GetString(),
            ["email"] = email,
            ["emailChange"] = emailChange,
        };

    private static async Task<Guid> InviteAsync(HttpClient client, string accessToken, string email)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, UserFixtures.Route, accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        request.Content = JsonContent.Create(new { firstName = "Ana", lastName = "Abad", email, role = "Admin", access = "invitation" });
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<HttpResponseMessage> PutAsync(HttpClient client, string? accessToken, Guid id, object body)
    {
        using var request = ApiRequests.Create(HttpMethod.Put, $"{UserFixtures.Route}/{id:D}", accessToken);
        request.Content = JsonContent.Create(body);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<HttpResponseMessage> CancelAsync(HttpClient client, string? accessToken, Guid id)
    {
        using var request = ApiRequests.Create(HttpMethod.Delete, $"{UserFixtures.Route}/{id:D}/email-change", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<HttpResponseMessage> ConfirmAsync(HttpClient client, string token)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, "/api/v1/profile/email-change/confirm");
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        request.Content = JsonContent.Create(new { token });
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return document.RootElement.Clone();
    }

    private async Task<List<AuditEntry>> AuditOfAsync(Guid userId, string action)
    {
        await using var context = database.CreateContext();
        var key = userId.ToString("D");
        return await context.AuditLog.AsNoTracking()
            .Where(entry => entry.TargetId == key && entry.Action == action)
            .OrderBy(entry => entry.Id)
            .ToListAsync(TestContext.Current.CancellationToken);
    }

    // D-40: field names only, never an address, in any entry that names the person.
    private async Task AssertNoAddressInAuditAsync(Guid userId, params string[] addresses)
    {
        await using var context = database.CreateContext();
        var key = userId.ToString("D");
        var details = await context.AuditLog.AsNoTracking()
            .Where(entry => entry.TargetId == key)
            .Select(entry => entry.Detail)
            .ToListAsync(TestContext.Current.CancellationToken);
        foreach (var detail in details.OfType<string>())
        {
            foreach (var address in addresses)
            {
                detail.ShouldNotContain(address, Case.Insensitive);
            }
        }
    }
}

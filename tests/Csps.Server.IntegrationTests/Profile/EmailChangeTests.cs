using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Profile;

/// <summary>
/// PROF-02, C-9, D-24, D-25, D-40, T-05-37, T-05-38: a signed-in staff member asks to change their sign-in email. The
/// link goes to the new address and a notice to the old one, and the change applies only when the new inbox confirms.
/// </summary>
public sealed class EmailChangeTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string RequestRoute = "/api/v1/profile/email-change";
    private const string ConfirmRoute = "/api/v1/profile/email-change/confirm";
    private const string ConfirmSubject = "Confirm your new CSPS email";
    private const string NoticeSubject = "Your CSPS email is being changed";

    // Stored value of AccountTokenPurpose.EmailChange; the tests pin it so a renumbering is caught.
    private const AccountTokenPurpose EmailChangePurpose = (AccountTokenPurpose)3;

    [Fact]
    public async Task RequestingAChangeEmailsTheNewAddressALinkAndTheOldOneANoticeAndChangesNoSignIn()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        var newEmail = AuthClient.NewEmail();

        using var response = await RequestAsync(client, device.AccessToken, newEmail, staff.Password);
        var profile = await ReadAsync(response);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        profile.GetProperty("email").GetString().ShouldBe(staff.Email);
        profile.GetProperty("pendingEmail").GetString().ShouldBe(newEmail);
        var toNew = (await AuthClient.WaitForEmailsAsync(client, newEmail)).Single();
        toNew.Subject.ShouldBe(ConfirmSubject);
        toNew.Text.ShouldContain("/admin/confirm-email#token=");
        var toOld = (await AuthClient.WaitForEmailsAsync(client, staff.Email, count: 2)).Single(static mail => mail.Subject == NoticeSubject);
        toOld.Text.ShouldNotContain("#token=");

        using var fresh = AuthClient.CreateClient(factory);
        using var withNew = await AuthClient.SignInAsync(fresh, newEmail, staff.Password);
        using var withOld = await AuthClient.SignInAsync(fresh, staff.Email, staff.Password);
        withNew.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        withOld.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ConfirmingTheLinkMovesTheSignInEmailAndClearsThePendingOne()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        var newEmail = AuthClient.NewEmail();
        var token = await RequestAndReadTokenAsync(client, device.AccessToken, newEmail, staff.Password);

        using var anonymous = AuthClient.CreateClient(factory);
        using var confirm = await ConfirmAsync(anonymous, token);
        var confirmed = await ReadAsync(confirm);

        confirm.StatusCode.ShouldBe(HttpStatusCode.OK);
        confirmed.GetProperty("newEmail").GetString().ShouldBe(newEmail);
        using var profileResponse = await GetProfileAsync(client, device.AccessToken);
        var profile = await ReadAsync(profileResponse);
        profile.GetProperty("email").GetString().ShouldBe(newEmail);
        profile.GetProperty("pendingEmail").ValueKind.ShouldBe(JsonValueKind.Null);

        using var fresh = AuthClient.CreateClient(factory);
        using var withNew = await AuthClient.SignInAsync(fresh, newEmail, staff.Password);
        using var withOld = await AuthClient.SignInAsync(fresh, staff.Email, staff.Password);
        withNew.StatusCode.ShouldBe(HttpStatusCode.OK);
        withOld.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

        await using var context = database.CreateContext();
        var user = await context.Users.AsNoTracking().SingleAsync(row => row.Id == staff.Id, TestContext.Current.CancellationToken);
        user.UserName.ShouldBe(newEmail);
        user.NormalizedEmail.ShouldBe(newEmail.ToUpperInvariant());
        user.NormalizedUserName.ShouldBe(newEmail.ToUpperInvariant());
    }

    [Fact]
    public async Task AConfirmedLinkIsDeadTheSecondTime()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        var token = await RequestAndReadTokenAsync(client, device.AccessToken, AuthClient.NewEmail(), staff.Password);
        using var first = await ConfirmAsync(client, token);
        first.StatusCode.ShouldBe(HttpStatusCode.OK);

        using var second = await ConfirmAsync(client, token);
        var problem = await ProblemJson.ReadAsync(second, TestContext.Current.CancellationToken);

        second.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        problem.GetProperty("code").GetString().ShouldBe("email-change.invalid");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-a-token")]
    [InlineData("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")]
    public async Task AMissingMalformedOrUnknownTokenIsTheSameInvalidAnswer(string? token)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        using var response = await ConfirmAsync(client, token);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        problem.GetProperty("code").GetString().ShouldBe("email-change.invalid");
    }

    [Fact]
    public async Task TheLinkLastsTwentyFourHoursAndIsStoredAsAHash()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        var token = await RequestAndReadTokenAsync(client, device.AccessToken, AuthClient.NewEmail(), staff.Password);

        await using var context = database.CreateContext();
        var stored = await context.AccountTokens.AsNoTracking()
            .SingleAsync(row => row.UserId == staff.Id && row.Purpose == EmailChangePurpose, TestContext.Current.CancellationToken);

        (stored.ExpiresAt - stored.CreatedAt).ShouldBe(TimeSpan.FromHours(24));
        stored.TokenHash.ShouldBe(TokenHash.Compute(token));
        stored.UsedAt.ShouldBeNull();
    }

    [Fact]
    public async Task AWrongCurrentPasswordIsAFieldErrorAndNothingIsSent()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        var newEmail = AuthClient.NewEmail();

        using var response = await RequestAsync(client, device.AccessToken, newEmail, "Not-My-Password1!");
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        problem.GetProperty("errors").GetProperty("currentPassword").EnumerateArray().Select(static m => m.GetString()).ShouldBe(["Your current password is incorrect."]);
        (await AuthClient.ReadEmailsAsync(client, newEmail)).ShouldBeEmpty();
        await using var context = database.CreateContext();
        (await context.Users.AsNoTracking().SingleAsync(row => row.Id == staff.Id, TestContext.Current.CancellationToken)).PendingEmail.ShouldBeNull();
        (await context.AccountTokens.AsNoTracking().CountAsync(row => row.UserId == staff.Id && row.Purpose == EmailChangePurpose, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task ABlankOrMalformedNewEmailIsAFieldError()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);

        using var blank = await RequestAsync(client, device.AccessToken, "  ", staff.Password);
        using var malformed = await RequestAsync(client, device.AccessToken, "no-at-sign", staff.Password);

        blank.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await ProblemJson.ReadAsync(blank, TestContext.Current.CancellationToken)).GetProperty("errors").GetProperty("newEmail").EnumerateArray()
            .Select(static m => m.GetString()).ShouldBe(["Enter your new email."]);
        malformed.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await ProblemJson.ReadAsync(malformed, TestContext.Current.CancellationToken)).GetProperty("errors").GetProperty("newEmail").EnumerateArray()
            .Select(static m => m.GetString()).ShouldBe(["Enter a valid email, like name@gmail.com"]);
    }

    [Fact]
    public async Task FiveWrongCurrentPasswordsLockTheAccountAndTheFifthAnswers429()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        var newEmail = AuthClient.NewEmail();

        for (var attempt = 1; attempt <= 4; attempt++)
        {
            using var wrong = await RequestAsync(client, device.AccessToken, newEmail, "Not-My-Password1!");
            wrong.StatusCode.ShouldBe(HttpStatusCode.BadRequest, $"attempt {attempt}");
        }

        using var fifth = await RequestAsync(client, device.AccessToken, newEmail, "Not-My-Password1!");
        var problem = await ProblemJson.ReadAsync(fifth, TestContext.Current.CancellationToken);

        fifth.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        problem.GetProperty("code").GetString().ShouldBe("profile.password-locked");
        int.Parse(fifth.Headers.GetValues("Retry-After").Single(), System.Globalization.CultureInfo.InvariantCulture).ShouldBeInRange(890, 900);
        using var lockedRight = await RequestAsync(client, device.AccessToken, newEmail, staff.Password);
        lockedRight.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        using var fresh = AuthClient.CreateClient(factory);
        using var signIn = await AuthClient.SignInAsync(fresh, staff.Email, staff.Password);
        signIn.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await AuthClient.ReadEmailsAsync(client, newEmail)).ShouldBeEmpty();
        await using var context = database.CreateContext();
        (await context.Users.AsNoTracking().SingleAsync(row => row.Id == staff.Id, TestContext.Current.CancellationToken)).PendingEmail.ShouldBeNull();
    }

    [Fact]
    public async Task WrongPasswordsOnTheEmailChangeAndThePasswordChangeShareOneCount()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);

        for (var attempt = 1; attempt <= 2; attempt++)
        {
            using var wrong = await RequestAsync(client, device.AccessToken, AuthClient.NewEmail(), "Not-My-Password1!");
            wrong.StatusCode.ShouldBe(HttpStatusCode.BadRequest, $"email attempt {attempt}");
        }

        for (var attempt = 1; attempt <= 2; attempt++)
        {
            using var wrong = await ChangePasswordAsync(client, device.AccessToken, "Not-My-Password1!");
            wrong.StatusCode.ShouldBe(HttpStatusCode.BadRequest, $"password attempt {attempt}");
        }

        using var fifth = await RequestAsync(client, device.AccessToken, AuthClient.NewEmail(), "Not-My-Password1!");

        fifth.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public async Task TheCorrectCurrentPasswordResetsTheWrongCount()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        for (var attempt = 1; attempt <= 4; attempt++)
        {
            using var wrong = await RequestAsync(client, device.AccessToken, AuthClient.NewEmail(), "Not-My-Password1!");
            wrong.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        }

        using var right = await RequestAsync(client, device.AccessToken, AuthClient.NewEmail(), staff.Password);
        using var wrongAgain = await RequestAsync(client, device.AccessToken, AuthClient.NewEmail(), "Not-My-Password1!");

        right.StatusCode.ShouldBe(HttpStatusCode.OK);
        wrongAgain.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task TheCurrentEmailInAnotherLetterCaseIsRefused(bool withSpaces)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        var typed = staff.Email.ToUpperInvariant();

        using var response = await RequestAsync(client, device.AccessToken, withSpaces ? $"  {typed} " : typed, staff.Password);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        problem.GetProperty("errors").GetProperty("newEmail").EnumerateArray().Select(static m => m.GetString()).ShouldBe(["This is already your email."]);
        (await AuthClient.ReadEmailsAsync(client, staff.Email)).ShouldNotContain(static mail => mail.Subject == NoticeSubject);
    }

    [Theory]
    [InlineData(StaffState.Active)]
    [InlineData(StaffState.Deactivated)]
    public async Task AnAddressAnotherAccountUsesIsRefusedAndNothingIsSent(StaffState otherState)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var other = await AuthClient.CreateStaffAsync(factory, otherState);
        var device = await AuthClient.SignInFullyAsync(client, staff);

        using var response = await RequestAsync(client, device.AccessToken, other.Email.ToUpperInvariant(), staff.Password);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        problem.GetProperty("errors").GetProperty("newEmail").EnumerateArray().Select(static m => m.GetString()).ShouldBe(["Another account already uses this email."]);
        (await AuthClient.ReadEmailsAsync(client, other.Email)).ShouldBeEmpty();
        await using var context = database.CreateContext();
        (await context.Users.AsNoTracking().SingleAsync(row => row.Id == staff.Id, TestContext.Current.CancellationToken)).PendingEmail.ShouldBeNull();
    }

    [Fact]
    public async Task ATakenAddressIsOnlyRevealedToSomeoneWhoKnowsTheirPassword()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var other = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);

        using var response = await RequestAsync(client, device.AccessToken, other.Email, "Not-My-Password1!");
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        problem.GetProperty("errors").TryGetProperty("newEmail", out _).ShouldBeFalse();
        problem.GetProperty("errors").GetProperty("currentPassword").EnumerateArray().Select(static m => m.GetString()).ShouldBe(["Your current password is incorrect."]);
    }

    [Fact]
    public async Task AnAddressFreedByASoftDeleteIsAccepted()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var gone = await AuthClient.CreateStaffAsync(factory);
        await SoftDeleteAsync(gone.Id);
        var device = await AuthClient.SignInFullyAsync(client, staff);

        using var response = await RequestAsync(client, device.AccessToken, gone.Email, staff.Password);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await AuthClient.WaitForEmailsAsync(client, gone.Email)).Single().Subject.ShouldBe(ConfirmSubject);
    }

    [Fact]
    public async Task ANewRequestReplacesThePendingOneAndKillsTheOldLink()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        var first = AuthClient.NewEmail();
        var second = AuthClient.NewEmail();
        var firstToken = await RequestAndReadTokenAsync(client, device.AccessToken, first, staff.Password);
        var secondToken = await RequestAndReadTokenAsync(client, device.AccessToken, second, staff.Password);

        using var old = await ConfirmAsync(client, firstToken);
        using var current = await ConfirmAsync(client, secondToken);

        old.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(old, TestContext.Current.CancellationToken)).GetProperty("code").GetString().ShouldBe("email-change.invalid");
        current.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await ReadAsync(current)).GetProperty("newEmail").GetString().ShouldBe(second);
    }

    [Fact]
    public async Task AnAnonymousCallerCannotRequestAChange()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        using var response = await RequestAsync(client, null, AuthClient.NewEmail(), "whatever1!");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ARequestWithoutAnIdempotencyKeyIsRefusedAndChangesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);

        using var response = await RequestAsync(client, device.AccessToken, AuthClient.NewEmail(), staff.Password, idempotencyKey: false);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        problem.GetProperty("code").GetString().ShouldBe("idempotency.key-missing");
        await using var context = database.CreateContext();
        (await context.Users.AsNoTracking().SingleAsync(row => row.Id == staff.Id, TestContext.Current.CancellationToken)).PendingEmail.ShouldBeNull();
    }

    [Fact]
    public async Task AConfirmWithoutAnIdempotencyKeyIsRefusedAndTheLinkStillWorks()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        var token = await RequestAndReadTokenAsync(client, device.AccessToken, AuthClient.NewEmail(), staff.Password);

        using var refused = await ConfirmAsync(client, token, idempotencyKey: false);
        using var accepted = await ConfirmAsync(client, token);

        refused.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        accepted.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ALinkForADeactivatedAccountIsTheSameInvalidAnswerAndChangesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        var token = await RequestAndReadTokenAsync(client, device.AccessToken, AuthClient.NewEmail(), staff.Password);
        await AuthClient.DeactivateAsync(factory, staff.Id);

        using var response = await ConfirmAsync(client, token);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        problem.GetProperty("code").GetString().ShouldBe("email-change.invalid");
        await using var context = database.CreateContext();
        (await context.Users.AsNoTracking().SingleAsync(row => row.Id == staff.Id, TestContext.Current.CancellationToken)).Email.ShouldBe(staff.Email);
    }

    [Fact]
    public async Task TheTokenOfAnotherPurposeCannotConfirmAnEmailChange()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var resetToken = await AuthClient.RequestResetTokenAsync(client, staff.Email);

        using var response = await ConfirmAsync(client, resetToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task TheChangeIsAuditedByUserIdWithNoAddressAndNoDetail()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        var newEmail = AuthClient.NewEmail();
        var token = await RequestAndReadTokenAsync(client, device.AccessToken, newEmail, staff.Password);
        using var confirm = await ConfirmAsync(client, token);
        confirm.StatusCode.ShouldBe(HttpStatusCode.OK);

        await using var context = database.CreateContext();
        var key = staff.Id.ToString("D");
        var entries = await context.AuditLog.AsNoTracking()
            .Where(entry => entry.TargetId == key && entry.Action.StartsWith("profile.email-change"))
            .ToListAsync(TestContext.Current.CancellationToken);

        var requested = entries.Single(static entry => entry.Action == "profile.email-change-requested");
        requested.TargetType.ShouldBe("User");
        requested.ActorUserId.ShouldBe(staff.Id);
        requested.Detail.ShouldBeNull();
        var changed = entries.Single(static entry => entry.Action == "profile.email-changed");
        changed.TargetType.ShouldBe("User");
        changed.Detail.ShouldBeNull();
        var everything = await context.AuditLog.AsNoTracking().Select(static entry => (entry.Detail ?? string.Empty) + "|" + (entry.TargetId ?? string.Empty)).ToListAsync(TestContext.Current.CancellationToken);
        everything.ShouldAllBe(text => !text.Contains(newEmail, StringComparison.OrdinalIgnoreCase) && !text.Contains(staff.Email, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task TheLastChangerIsTheAccountItselfEvenAfterAnEarlierSelfEdit()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var device = await AuthClient.SignInFullyAsync(client, staff);
        await RenameAsync(client, device.AccessToken, "Ana", "Cruz");
        var token = await RequestAndReadTokenAsync(client, device.AccessToken, AuthClient.NewEmail(), staff.Password);

        using var anonymous = AuthClient.CreateClient(factory);
        using var confirm = await ConfirmAsync(anonymous, token);

        confirm.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        var user = await context.Users.AsNoTracking().SingleAsync(row => row.Id == staff.Id, TestContext.Current.CancellationToken);
        user.UpdatedById.ShouldBe(staff.Id);
        user.UpdatedAtUtc.ShouldNotBeNull();
    }

    [Fact]
    public async Task TheLinkChangesOnlyItsOwnAccountWhoeverOpensIt()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var mine = AuthClient.CreateClient(factory);
        using var theirs = AuthClient.CreateClient(factory);
        var me = await AuthClient.CreateStaffAsync(factory);
        var someoneElse = await AuthClient.CreateStaffAsync(factory);
        var myDevice = await AuthClient.SignInFullyAsync(mine, me);
        await AuthClient.SignInFullyAsync(theirs, someoneElse);
        var token = await RequestAndReadTokenAsync(mine, myDevice.AccessToken, AuthClient.NewEmail(), me.Password);

        using var confirm = await ConfirmAsync(theirs, token);

        confirm.StatusCode.ShouldBe(HttpStatusCode.OK);
        await using var context = database.CreateContext();
        (await context.Users.AsNoTracking().SingleAsync(row => row.Id == someoneElse.Id, TestContext.Current.CancellationToken)).Email.ShouldBe(someoneElse.Email);
    }

    private static async Task<HttpResponseMessage> ChangePasswordAsync(HttpClient client, string accessToken, string currentPassword)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, "/api/v1/profile/password", accessToken);
        request.Content = JsonContent.Create(new { currentPassword, newPassword = "Another#Tahi2027" });
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    // What the later delete feature does to a row (D-07, D-10): the address is scrambled, so it is free again.
    private async Task SoftDeleteAsync(Guid id)
    {
        var scrambled = $"deleted-{id:N}@deleted.invalid";
        var normalized = scrambled.ToUpperInvariant();
        var now = TimeProvider.System.GetUtcNow();
        await using var context = database.CreateContext();
        var changed = await context.Users.Where(row => row.Id == id).ExecuteUpdateAsync(
            setters => setters
                .SetProperty(row => row.Email, scrambled)
                .SetProperty(row => row.UserName, scrambled)
                .SetProperty(row => row.NormalizedEmail, normalized)
                .SetProperty(row => row.NormalizedUserName, normalized)
                .SetProperty(row => row.DeletedAtUtc, now),
            TestContext.Current.CancellationToken);
        changed.ShouldBe(1);
    }

    private static async Task<string> RequestAndReadTokenAsync(HttpClient client, string accessToken, string newEmail, string password)
    {
        using var response = await RequestAsync(client, accessToken, newEmail, password);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var mail = (await AuthClient.WaitForEmailsAsync(client, newEmail)).Single(static message => message.Subject == ConfirmSubject);
        return AuthClient.TokenOf(mail);
    }

    private static async Task RenameAsync(HttpClient client, string accessToken, string firstName, string lastName)
    {
        using var read = await GetProfileAsync(client, accessToken);
        var version = (await ReadAsync(read)).GetProperty("version").GetString();
        using var request = ApiRequests.Create(HttpMethod.Put, "/api/v1/profile", accessToken);
        request.Content = JsonContent.Create(new { firstName, lastName, version });
        using var save = await client.SendAsync(request, TestContext.Current.CancellationToken);
        save.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    private static async Task<HttpResponseMessage> GetProfileAsync(HttpClient client, string accessToken)
    {
        using var request = ApiRequests.Get("/api/v1/profile", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    private static async Task<HttpResponseMessage> RequestAsync(
        HttpClient client, string? accessToken, string? newEmail, string? currentPassword, bool idempotencyKey = true)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, RequestRoute, accessToken);
        request.Content = JsonContent.Create(new { newEmail, currentPassword });
        if (idempotencyKey)
        {
            request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<HttpResponseMessage> ConfirmAsync(HttpClient client, string? token, bool idempotencyKey = true)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, ConfirmRoute);
        request.Content = JsonContent.Create(new { token });
        if (idempotencyKey)
        {
            request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}

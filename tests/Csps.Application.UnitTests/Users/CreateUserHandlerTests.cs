using Csps.Application.Auth;
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
/// USER-02, C-4, D-12..D-15, SEC-08: a Manager adds a person by invitation or with a temporary password. Every field is
/// checked before anything is created, a taken email is a field error, and no password, name or email reaches the audit trail.
/// </summary>
public sealed class CreateUserHandlerTests
{
    private const string Secret = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";
    private const string Temporary = "Tela-Sukat-7381";

    private static readonly DateTimeOffset Start = new(2026, 10, 18, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid ManagerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid NewId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");

    [Fact]
    public async Task AnInvitationCreatesAPasswordlessAccountASevenDayTokenAndAnEmailNamingTheManager()
    {
        var harness = Harness.Create();

        var result = await harness.Handler.HandleAsync(Request(email: " ana@csps.test ", first: " Ana ", last: " Abad ", role: "admin"), TestContext.Current.CancellationToken);

        result.Value.Id.ShouldBe(NewId);
        await harness.Accounts.Received(1).CreateAsync(
            Arg.Is<NewUserAccount>(a => a.Email == "ana@csps.test" && a.FirstName == "Ana" && a.LastName == "Abad" && a.Role == Roles.Admin && a.Password == null),
            Arg.Any<CancellationToken>());
        await harness.Accounts.DidNotReceive().SetMustChangePasswordAsync(Arg.Any<Guid>(), Arg.Any<PasswordChangeReason>(), Arg.Any<CancellationToken>());

        var token = harness.AddedToken.ShouldNotBeNull();
        token.UserId.ShouldBe(NewId);
        token.Purpose.ShouldBe(AccountTokenPurpose.Invitation);
        token.ExpiresAt.ShouldBe(Start.AddDays(7));
        TokenHash.Equal(token.TokenHash, TokenHash.Compute(Secret)).ShouldBeTrue();

        var mail = harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBeOfType<InviteEmail>();
        mail.To.ShouldBe("ana@csps.test");
        mail.Token.ShouldBe(Secret);
        mail.InvitedBy.ShouldBe("Carmen Reyes");

        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Action.ShouldBe(AuditActions.UserInvited);
        entry.TargetType.ShouldBe("User");
        entry.TargetId.ShouldBe(NewId.ToString("D"));
        entry.Detail.ShouldBe("manager");
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task AnInvitationIgnoresATemporaryPasswordSentWithIt()
    {
        var harness = Harness.Create();

        var result = await harness.Handler.HandleAsync(Request(temporaryPassword: Temporary), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.Received(1).CreateAsync(Arg.Is<NewUserAccount>(a => a.Password == null), Arg.Any<CancellationToken>());
        harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBeOfType<InviteEmail>();
    }

    [Fact]
    public async Task ATemporaryPasswordCreatesTheAccountWithItMarksItMustChangeAndSendsNoEmail()
    {
        var harness = Harness.Create();

        var result = await harness.Handler.HandleAsync(
            Request(first: "Tess", last: "Tan", role: "Manager", access: "temporary-password", temporaryPassword: Temporary), TestContext.Current.CancellationToken);

        result.Value.Id.ShouldBe(NewId);
        await harness.Accounts.Received(1).CreateAsync(
            Arg.Is<NewUserAccount>(a => a.Role == Roles.Manager && a.Password == Temporary), Arg.Any<CancellationToken>());
        await harness.Accounts.Received(1).SetMustChangePasswordAsync(NewId, PasswordChangeReason.Temporary, Arg.Any<CancellationToken>());
        harness.AddedToken.ShouldBeNull();
        harness.Outbox.Emails.ShouldBeEmpty();

        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Action.ShouldBe("user.created-temporary");
        entry.TargetType.ShouldBe("User");
        entry.TargetId.ShouldBe(NewId.ToString("D"));
        entry.Detail.ShouldBeNull();
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task NoAuditEntryHoldsThePasswordANameOrTheEmail()
    {
        var harness = Harness.Create();

        await harness.Handler.HandleAsync(
            Request(email: "tess@csps.test", first: "Tess", last: "Tan", access: "temporary-password", temporaryPassword: Temporary), TestContext.Current.CancellationToken);

        foreach (var entry in harness.Audit.Entries)
        {
            var text = string.Join(' ', entry.Action, entry.TargetType, entry.TargetId, entry.Detail);
            text.ShouldNotContain(Temporary);
            text.ShouldNotContain("tess@csps.test");
            text.ShouldNotContain("Tess");
        }

        Request(access: "temporary-password", temporaryPassword: Temporary).ToString().ShouldNotContain(Temporary);
    }

    [Fact]
    public async Task AnAddressAnotherAccountUsesIsA400OnTheEmailFieldAndNothingIsCreated()
    {
        var harness = Harness.Create();
        harness.Accounts.FindByEmailAsync("ana@csps.test", Arg.Any<CancellationToken>()).Returns(Task.FromResult<UserAccount?>(Existing(deleted: false)));

        var result = await harness.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()["email"].ShouldBe(["Another account already uses this email."]);
        await harness.AssertNothingCreatedAsync();
    }

    [Fact]
    public async Task AnAddressOnlyADeletedAccountHeldIsFreeAgain()
    {
        var harness = Harness.Create();
        harness.Accounts.FindByEmailAsync("ana@csps.test", Arg.Any<CancellationToken>()).Returns(Task.FromResult<UserAccount?>(Existing(deleted: true)));

        var result = await harness.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
    }

    [Theory]
    [InlineData(null, "Ana", "Abad", "Admin", "invitation", "firstName", "Enter a first name.")]
    [InlineData("  ", "Ana", "Abad", "Admin", "invitation", "firstName", "Enter a first name.")]
    [InlineData("Ana", null, "Abad", "Admin", "invitation", "lastName", "Enter a last name.")]
    [InlineData("Ana", "Abad", null, "Admin", "invitation", "email", "Enter their email.")]
    [InlineData("Ana", "Abad", "  ", "Admin", "invitation", "email", "Enter their email.")]
    [InlineData("Ana", "Abad", "not-an-email", "Admin", "invitation", "email", "Enter a valid email, like name@gmail.com")]
    [InlineData("Ana", "Abad", "a@b.c", null, "invitation", "role", "Choose a role.")]
    [InlineData("Ana", "Abad", "a@b.c", "", "invitation", "role", "Choose a role.")]
    [InlineData("Ana", "Abad", "a@b.c", "Owner", "invitation", "role", "Choose a role.")]
    [InlineData("Ana", "Abad", "a@b.c", "Admin", null, "access", "Choose how they get access.")]
    [InlineData("Ana", "Abad", "a@b.c", "Admin", "", "access", "Choose how they get access.")]
    [InlineData("Ana", "Abad", "a@b.c", "Admin", "email-them", "access", "Choose how they get access.")]
    public async Task EveryMissingOrUnknownFieldIsA400OnThatFieldBeforeAnythingIsCreated(
        string? first, string? last, string? email, string? role, string? access, string field, string message)
    {
        var harness = Harness.Create();

        var result = await harness.Handler.HandleAsync(new CreateUserRequest(first, last, email, role, access, null), TestContext.Current.CancellationToken);

        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.FieldErrors.ShouldNotBeNull()[field].ShouldBe([message]);
        await harness.Accounts.DidNotReceive().FindByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
        await harness.AssertNothingCreatedAsync();
    }

    [Fact]
    public async Task AnEmptyRequestNamesEveryField()
    {
        var harness = Harness.Create();

        var result = await harness.Handler.HandleAsync(CreateUserRequest.Empty, TestContext.Current.CancellationToken);

        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["firstName", "lastName", "email", "role", "access"], ignoreOrder: true);
        await harness.AssertNothingCreatedAsync();
    }

    [Fact]
    public async Task ANameOfOneHundredCharactersIsAcceptedAndOneOverIsRefused()
    {
        var harness = Harness.Create();

        var at = await harness.Handler.HandleAsync(Request(first: new string('a', 100), last: new string('b', 100)), TestContext.Current.CancellationToken);
        var over = await harness.Handler.HandleAsync(Request(first: new string('a', 101), last: new string('b', 101)), TestContext.Current.CancellationToken);

        at.IsSuccess.ShouldBeTrue();
        over.Error.FieldErrors.ShouldNotBeNull()["firstName"].ShouldBe(["First name must be 100 characters or fewer."]);
        over.Error.FieldErrors["lastName"].ShouldBe(["Last name must be 100 characters or fewer."]);
    }

    [Theory]
    [InlineData("Ab1!", "Use at least 8 characters.")]
    [InlineData("Abcdefgh!", "Add at least one number.")]
    [InlineData("Abcdefg1h", "Add at least one symbol, like ! or #.")]
    [InlineData("Abcdef1!\tx", "Remove tabs and line breaks from your password.")]
    [InlineData("", "Enter a temporary password.")]
    [InlineData(null, "Enter a temporary password.")]
    public async Task ATemporaryPasswordBreakingTheBasicRuleIsA400OnItsFieldAndNothingIsCreated(string? password, string message)
    {
        var harness = Harness.Create();

        var result = await harness.Handler.HandleAsync(Request(access: "temporary-password", temporaryPassword: password), TestContext.Current.CancellationToken);

        result.Error.FieldErrors.ShouldNotBeNull()["temporaryPassword"].ShouldBe([message]);
        await harness.AssertNothingCreatedAsync();
    }

    [Fact]
    public async Task TheBasicRuleDoesNotCheckNamesOrBreachesAndTheLimitsAreSixtyFourCharacters()
    {
        var harness = Harness.Create();

        var common = await harness.Handler.HandleAsync(Request(first: "Password", access: "temporary-password", temporaryPassword: "Password1!"), TestContext.Current.CancellationToken);
        var atLimit = await harness.Handler.HandleAsync(Request(access: "temporary-password", temporaryPassword: "Aa1!" + new string('x', 60)), TestContext.Current.CancellationToken);
        var over = await harness.Handler.HandleAsync(Request(access: "temporary-password", temporaryPassword: "Aa1!" + new string('x', 61)), TestContext.Current.CancellationToken);

        common.IsSuccess.ShouldBeTrue();
        atLimit.IsSuccess.ShouldBeTrue();
        over.Error.FieldErrors.ShouldNotBeNull()["temporaryPassword"].ShouldBe(["Use 64 characters or fewer."]);
    }

    [Fact]
    public async Task ACallerWithNoSessionOrNoProfileIsRefusedAndNothingIsCreated()
    {
        var anonymous = Harness.Create(signedIn: false);
        var ended = Harness.Create(profile: false);

        var first = await anonymous.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken);
        var second = await ended.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken);

        first.Error.ShouldBe(AuthErrors.SessionEnded);
        second.Error.ShouldBe(AuthErrors.SessionEnded);
        await anonymous.AssertNothingCreatedAsync();
        await ended.AssertNothingCreatedAsync();
    }

    [Fact]
    public async Task AnAddressTakenBetweenTheCheckAndTheSaveIsTheSameEmailFieldErrorAndTheWorkRollsBack()
    {
        var harness = Harness.Create();
        harness.Accounts.CreateAsync(Arg.Any<NewUserAccount>(), Arg.Any<CancellationToken>()).Returns<Guid>(_ => throw new EmailInUseException());

        var result = await harness.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(UserErrors.EmailInUse);
        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(0);
        harness.AddedToken.ShouldBeNull();
        harness.Outbox.Emails.ShouldBeEmpty();
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AFailureAnywhereRollsBack()
    {
        var harness = Harness.Create();
        harness.Outbox.FailWith = new InvalidOperationException("The outbox is down.");

        await Should.ThrowAsync<InvalidOperationException>(() => harness.Handler.HandleAsync(Request(), TestContext.Current.CancellationToken));

        harness.Unit.Rollbacks.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(0);
    }

    private static CreateUserRequest Request(
        string email = "ana@csps.test",
        string first = "Ana",
        string last = "Abad",
        string role = "Admin",
        string access = "invitation",
        string? temporaryPassword = null) =>
        new(first, last, email, role, access, temporaryPassword);

    private static UserAccount Existing(bool deleted) =>
        new(NewId, "ana@csps.test", "Old", "Account", Roles.Admin, true, true, true, null, false, null, IsDeleted: deleted);

    private sealed class Harness
    {
        private Harness(bool signedIn, bool profile)
        {
            Accounts = Substitute.For<IUserAccounts>();
            Accounts.CreateAsync(Arg.Any<NewUserAccount>(), Arg.Any<CancellationToken>()).Returns(NewId);
            Tokens = Substitute.For<IAccountTokens>();
            Tokens.When(t => t.Add(Arg.Any<AccountToken>())).Do(call => AddedToken = call.Arg<AccountToken>());
            var random = Substitute.For<ISecureRandom>();
            random.NewToken().Returns(Secret);
            var directory = Substitute.For<IUserDirectory>();
            directory.GetProfileAsync(ManagerId, Arg.Any<CancellationToken>()).Returns(
                profile ? new ProfileView(ManagerId, "Carmen", "Reyes", "carmen@csps.test", Roles.Manager, null, Start, Guid.NewGuid()) : null);
            var context = Substitute.For<IRequestContext>();
            context.UserId.Returns(signedIn ? ManagerId : null);

            Handler = new CreateUserHandler(
                Accounts,
                directory,
                Tokens,
                random,
                Outbox,
                Audit,
                Unit,
                context,
                new CreateUserRequestValidator(),
                new AuthSettings(),
                new FakeTimeProvider(Start));
        }

        public IUserAccounts Accounts { get; }

        public IAccountTokens Tokens { get; }

        public RecordingOutbox Outbox { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public AccountToken? AddedToken { get; private set; }

        public CreateUserHandler Handler { get; }

        public static Harness Create(bool signedIn = true, bool profile = true) => new(signedIn, profile);

        public async Task AssertNothingCreatedAsync()
        {
            await Accounts.DidNotReceive().CreateAsync(Arg.Any<NewUserAccount>(), Arg.Any<CancellationToken>());
            AddedToken.ShouldBeNull();
            Outbox.Emails.ShouldBeEmpty();
            Audit.Entries.ShouldBeEmpty();
            Unit.Saves.ShouldBe(0);
        }
    }
}

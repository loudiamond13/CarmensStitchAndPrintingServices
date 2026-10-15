using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Auth;

/// <summary>AUTH-08, AUTH-10: a link check names the account for a usable link and gives one answer for every other case.</summary>
public sealed class CheckResetLinkHandlerTests
{
    private const string Email = "paolo.reyes@example.com";
    private const string Secret = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";

    private static readonly DateTimeOffset Start = new(2026, 10, 14, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid UserId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");

    [Fact]
    public async Task AUsableLinkNamesTheAccountAndChangesNothing()
    {
        var harness = Harness.Create();

        var result = await harness.Handler.HandleAsync(new ResetTokenRequest(Secret), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.Email.ShouldBe(Email);
        harness.Token.UsedAt.ShouldBeNull();
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task ALinkIsUsableUntilTheLastInstantBeforeThirtyMinutes()
    {
        var harness = Harness.Create();
        harness.Time.Advance(TimeSpan.FromMinutes(30) - TimeSpan.FromTicks(1));

        var result = await harness.Handler.HandleAsync(new ResetTokenRequest(Secret), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
    }

    [Theory]
    [InlineData("at-expiry")]
    [InlineData("used")]
    [InlineData("revoked")]
    [InlineData("unknown")]
    [InlineData("deactivated")]
    [InlineData("unconfirmed")]
    [InlineData("malformed")]
    [InlineData("empty")]
    [InlineData("missing")]
    public async Task EveryOtherCaseIsTheSameInvalidAnswerAndIsAuditedWithoutATarget(string reason)
    {
        var harness = Harness.Create();
        var token = harness.Break(reason);

        var result = await harness.Handler.HandleAsync(new ResetTokenRequest(token), TestContext.Current.CancellationToken);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.NotFound);
        result.Error.Code.ShouldBe("auth.link-invalid");
        result.Error.Message.ShouldBe("This link has expired");
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        entry.Action.ShouldBe(AuditActions.PasswordResetLinkInvalid);
        entry.Independent.ShouldBeTrue();
        entry.TargetType.ShouldBeNull();
        entry.TargetId.ShouldBeNull();
        entry.Detail.ShouldBeNull();
    }

    private sealed class Harness
    {
        private Harness()
        {
            Accounts = Substitute.For<IUserAccounts>();
            Tokens = Substitute.For<IAccountTokens>();
            Time = new FakeTimeProvider(Start);
            Token = AccountToken.Create(UserId, AccountTokenPurpose.PasswordReset, TokenHash.Compute(Secret), Start, TimeSpan.FromMinutes(30));
            Tokens.FindByHashAsync(Arg.Any<byte[]>(), AccountTokenPurpose.PasswordReset, Arg.Any<CancellationToken>())
                .Returns(call => Task.FromResult(TokenHash.Equal(call.Arg<byte[]>(), TokenHash.Compute(Secret)) ? Token : null));
            Accounts.FindByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<UserAccount?>(Account(true, true)));
            Handler = new CheckResetLinkHandler(Tokens, Accounts, Audit, Time);
        }

        public IUserAccounts Accounts { get; }

        public IAccountTokens Tokens { get; }

        public RecordingAudit Audit { get; } = new();

        public FakeTimeProvider Time { get; }

        public AccountToken Token { get; }

        public CheckResetLinkHandler Handler { get; }

        public static Harness Create() => new();

        // Breaks the link for one reason and returns the token to present.
        public string? Break(string reason)
        {
            switch (reason)
            {
                case "at-expiry":
                    Time.Advance(TimeSpan.FromMinutes(30));
                    break;
                case "used":
                    Token.Use(Start);
                    break;
                case "revoked":
                    Token.Revoke(Start);
                    break;
                case "unknown":
                    return new string('A', 43);
                case "deactivated":
                    Accounts.FindByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<UserAccount?>(Account(false, true)));
                    break;
                case "unconfirmed":
                    Accounts.FindByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<UserAccount?>(Account(true, false)));
                    break;
                case "malformed":
                    return "not-a-token";
                case "empty":
                    return string.Empty;
                case "missing":
                    return null;
                default:
                    throw new ArgumentOutOfRangeException(nameof(reason), reason, "Unknown reason.");
            }

            return Secret;
        }

        private static UserAccount Account(bool isActive, bool confirmed) =>
            new(UserId, Email, "Paolo", "Reyes", "Manager", isActive, confirmed, true, null, false, null);
    }
}

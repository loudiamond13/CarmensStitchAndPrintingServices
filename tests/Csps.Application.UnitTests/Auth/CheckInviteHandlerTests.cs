using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Auth;

/// <summary>D-29: the invite check names the account for a usable invite and gives one answer for every other case.</summary>
public sealed class CheckInviteHandlerTests
{
    private const string Secret = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";

    private static readonly DateTimeOffset Start = new(2026, 10, 14, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid UserId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");

    [Fact]
    public async Task AUsableInviteNamesTheEmailAndFirstNameEvenBeforeTheAddressIsConfirmed()
    {
        var harness = Harness.Create();

        var result = await harness.Handler.HandleAsync(new InviteTokenRequest(Secret), TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(new InviteLinkResponse("carmen@example.com", "Carmen"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("too-short")]
    public async Task AMissingOrMalformedTokenIsInvalidWithoutALookup(string? token)
    {
        var harness = Harness.Create();

        var result = await harness.Handler.HandleAsync(new InviteTokenRequest(token), TestContext.Current.CancellationToken);

        AssertInvalid(result);
        await harness.Tokens.DidNotReceive().FindByHashAsync(Arg.Any<byte[]>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("used")]
    [InlineData("revoked")]
    [InlineData("expired")]
    [InlineData("deactivated")]
    public async Task AnyInviteThatDoesNotWorkIsTheSameInvalidAnswer(string reason)
    {
        var harness = Harness.Create();
        harness.Break(reason);

        var result = await harness.Handler.HandleAsync(new InviteTokenRequest(Secret), TestContext.Current.CancellationToken);

        AssertInvalid(result);
    }

    private static void AssertInvalid(Result<InviteLinkResponse> result)
    {
        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.NotFound);
        result.Error.Code.ShouldBe("auth.invite-invalid");
        result.Error.Message.ShouldBe("This invite has expired");
    }

    private sealed class Harness
    {
        private Harness()
        {
            Tokens = Substitute.For<IAccountTokens>();
            var accounts = Substitute.For<IUserAccounts>();
            Time = new FakeTimeProvider(Start);
            Token = AccountToken.Create(UserId, AccountTokenPurpose.Invitation, TokenHash.Compute(Secret), Start, TimeSpan.FromHours(72));
            Accounts = accounts;
            Account = new UserAccount(UserId, "carmen@example.com", "Carmen", "Reyes", "Manager", true, false, false, null, false, null);
            Tokens.FindByHashAsync(Arg.Any<byte[]>(), AccountTokenPurpose.Invitation, Arg.Any<CancellationToken>())
                .Returns(call => Task.FromResult(TokenHash.Equal(call.Arg<byte[]>(), TokenHash.Compute(Secret)) ? Token : null));
            Accounts.FindByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<UserAccount?>(Account));
            Handler = new CheckInviteHandler(Tokens, Accounts, Time);
        }

        public IAccountTokens Tokens { get; }

        public IUserAccounts Accounts { get; }

        public FakeTimeProvider Time { get; }

        public AccountToken Token { get; }

        public UserAccount Account { get; private set; }

        public CheckInviteHandler Handler { get; }

        public static Harness Create() => new();

        public void Break(string reason)
        {
            switch (reason)
            {
                case "used":
                    Token.Use(Start);
                    break;
                case "revoked":
                    Token.Revoke(Start);
                    break;
                case "expired":
                    Time.Advance(TimeSpan.FromHours(72));
                    break;
                case "deactivated":
                    Account = Account with { IsActive = false };
                    Accounts.FindByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(Task.FromResult<UserAccount?>(Account));
                    break;
                default:
                    throw new ArgumentOutOfRangeException(nameof(reason), reason, "Unknown reason.");
            }
        }
    }
}

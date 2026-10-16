using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Auth;

/// <summary>
/// AUTH-11, OR-3: the must-change screen learns the email, both names and the reason only for a pending sign-in that
/// passed the code step and is still usable; every other case is the same 401, and nothing is ever changed.
/// </summary>
public sealed class CheckSetNewPasswordHandlerTests
{
    private const string Ticket = "ticket-token-0123456789-abcdefghijklmnopqrstuvwxyz";

    private static readonly DateTimeOffset Start = new(2026, 10, 14, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid UserId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");

    [Theory]
    [InlineData(PasswordChangeReason.Temporary)]
    [InlineData(PasswordChangeReason.Breach)]
    public async Task AUsablePendingSignInNamesTheAccountAndTheReason(PasswordChangeReason reason)
    {
        var harness = new Harness(reason: reason);

        var result = await harness.Handler.HandleAsync(Ticket, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(new SetNewPasswordContext("paolo.reyes@example.com", "Paolo", "Reyes", reason));
        harness.Challenge.Status.ShouldBe(TwoFactorChallengeStatus.AwaitingNewPassword);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("some-other-ticket")]
    public async Task AMissingOrUnknownTicketIs401(string? ticket)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(ticket, TestContext.Current.CancellationToken);

        AssertTicketExpired(result);
    }

    [Fact]
    public async Task ASignInThatHasNotPassedTheCodeStepIs401()
    {
        var harness = new Harness(awaiting: false);

        var result = await harness.Handler.HandleAsync(Ticket, TestContext.Current.CancellationToken);

        AssertTicketExpired(result);
    }

    [Fact]
    public async Task ACompletedSignInIs401()
    {
        var harness = new Harness();
        harness.Challenge.Complete(Start);

        var result = await harness.Handler.HandleAsync(Ticket, TestContext.Current.CancellationToken);

        AssertTicketExpired(result);
    }

    [Fact]
    public async Task AChallengeAtItsExpiryIs401()
    {
        var harness = new Harness();
        harness.Time.Advance(TimeSpan.FromMinutes(30));

        var result = await harness.Handler.HandleAsync(Ticket, TestContext.Current.CancellationToken);

        AssertTicketExpired(result);
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("deactivated")]
    [InlineData("locked")]
    public async Task AnAccountThatMaySignInNoLongerIs401(string account)
    {
        var harness = new Harness(account: account);

        var result = await harness.Handler.HandleAsync(Ticket, TestContext.Current.CancellationToken);

        AssertTicketExpired(result);
    }

    private static void AssertTicketExpired(Result<SetNewPasswordContext> result)
    {
        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Unauthenticated);
        result.Error.Code.ShouldBe("auth.ticket-expired");
    }

    private sealed class Harness
    {
        public Harness(bool awaiting = true, PasswordChangeReason reason = PasswordChangeReason.Temporary, string account = "active")
        {
            Time = new FakeTimeProvider(Start);
            var twoFactor = new AuthSettings().ToTwoFactorSettings();
            var mac = Enumerable.Repeat((byte)1, TokenHash.HashLength).ToArray();
            Challenge = TwoFactorChallenge.Start(UserId, TokenHash.Compute(Ticket), true, Start, twoFactor);
            Challenge.IssueCode(mac, Start, twoFactor);
            if (awaiting)
            {
                Challenge.Verify(mac, Start, twoFactor).Outcome.ShouldBe(TwoFactorVerifyOutcome.Ok);
                Challenge.RequirePasswordChange(reason);
            }

            var challenges = Substitute.For<ITwoFactorChallenges>();
            challenges.FindByTicketHashAsync(Arg.Any<byte[]>(), Arg.Any<CancellationToken>())
                .Returns(call => Task.FromResult(TokenHash.Equal(call.Arg<byte[]>(), TokenHash.Compute(Ticket)) ? Challenge : null));

            var accounts = Substitute.For<IUserAccounts>();
            UserAccount? user = account switch
            {
                "missing" => null,
                "deactivated" => Account(isActive: false),
                "locked" => Account(lockoutEnd: Start.AddMinutes(10)),
                _ => Account(),
            };
            accounts.FindByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(Task.FromResult(user));

            Handler = new CheckSetNewPasswordHandler(challenges, accounts, Time);
        }

        public TwoFactorChallenge Challenge { get; }

        public FakeTimeProvider Time { get; }

        public CheckSetNewPasswordHandler Handler { get; }

        private static UserAccount Account(bool isActive = true, DateTimeOffset? lockoutEnd = null) =>
            new(UserId, "paolo.reyes@example.com", "Paolo", "Reyes", "Manager", isActive, true, true, PasswordChangeReason.Temporary, false, lockoutEnd);
    }
}

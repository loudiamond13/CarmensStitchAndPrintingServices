using Csps.Domain.Identity;

namespace Csps.Domain.UnitTests.Identity;

public sealed class TwoFactorChallengeTests
{
    private static readonly DateTimeOffset T0 = new(2026, 10, 14, 12, 0, 0, TimeSpan.Zero);

    private static readonly Guid UserId = new("6f9619ff-8b86-d011-b42d-00cf4fc964ff");

    private static readonly TwoFactorSettings Settings = TwoFactorSettings.Default;

    private static byte[] Mac(string secret) => TokenHash.Compute(secret);

    private static TwoFactorChallenge NewChallenge(bool persistent = true) =>
        TwoFactorChallenge.Start(UserId, Mac("ticket"), persistent, T0, Settings);

    [Fact]
    public void StartKeepsTheTicketHashAndSetsThirtyMinutes()
    {
        var challenge = NewChallenge();

        challenge.UserId.ShouldBe(UserId);
        challenge.TicketHash.ShouldBe(Mac("ticket"));
        challenge.Persistent.ShouldBeTrue();
        challenge.Status.ShouldBe(TwoFactorChallengeStatus.Pending);
        challenge.CreatedAt.ShouldBe(T0);
        challenge.ExpiresAt.ShouldBe(T0.AddMinutes(30));
        challenge.Codes.ShouldBeEmpty();
        challenge.PasswordChangeReason.ShouldBeNull();
        challenge.CompletedAt.ShouldBeNull();
        challenge.InvalidatedAt.ShouldBeNull();
    }

    [Fact]
    public void StartRemembersTheStaySignedInChoice()
    {
        NewChallenge(persistent: false).Persistent.ShouldBeFalse();
    }

    [Fact]
    public void StartRejectsATicketHashThatIsNot32Bytes()
    {
        Should.Throw<ArgumentException>(
            () => TwoFactorChallenge.Start(UserId, new byte[31], true, T0, Settings));
    }

    [Fact]
    public void IssueCodeLivesFifteenMinutes()
    {
        var challenge = NewChallenge();

        var code = challenge.IssueCode(Mac("111111"), T0, Settings);

        code.IssuedAt.ShouldBe(T0);
        code.ExpiresAt.ShouldBe(T0.AddMinutes(15));
        code.CodeMac.ShouldBe(Mac("111111"));
        code.ChallengeId.ShouldBe(challenge.Id);
        code.FailedAttempts.ShouldBe(0);
        code.ConsumedAt.ShouldBeNull();
        code.SupersededAt.ShouldBeNull();
        challenge.Codes.Count.ShouldBe(1);
    }

    [Fact]
    public void IssueCodeRejectsAMacThatIsNot32Bytes()
    {
        var challenge = NewChallenge();

        Should.Throw<ArgumentException>(() => challenge.IssueCode(new byte[5], T0, Settings));
    }

    [Fact]
    public void VerifyAcceptsTheIssuedCodeAndConsumesIt()
    {
        var challenge = NewChallenge();
        var code = challenge.IssueCode(Mac("111111"), T0, Settings);

        var result = challenge.Verify(Mac("111111"), T0.AddMinutes(1), Settings);

        result.Outcome.ShouldBe(TwoFactorVerifyOutcome.Ok);
        code.ConsumedAt.ShouldBe(T0.AddMinutes(1));
    }

    [Fact]
    public void AConsumedCodeNeverWorksAgain()
    {
        var challenge = NewChallenge();
        challenge.IssueCode(Mac("111111"), T0, Settings);
        challenge.Verify(Mac("111111"), T0.AddMinutes(1), Settings);

        var second = challenge.Verify(Mac("111111"), T0.AddMinutes(2), Settings);

        second.Outcome.ShouldBe(TwoFactorVerifyOutcome.ChallengeClosed);
    }

    [Fact]
    public void VerifyWithNoCodeIssuedIsClosed()
    {
        NewChallenge().Verify(Mac("111111"), T0, Settings).Outcome.ShouldBe(TwoFactorVerifyOutcome.ChallengeClosed);
    }
}

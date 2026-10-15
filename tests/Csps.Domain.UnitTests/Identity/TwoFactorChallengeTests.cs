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

    [Fact]
    public void TheFourthWrongAttemptLeavesOneTryAndTheFifthExhaustsTheCode()
    {
        var challenge = NewChallenge();
        challenge.IssueCode(Mac("111111"), T0, Settings);
        var wrong = Mac("222222");

        var remaining = new List<int>();
        for (var attempt = 1; attempt <= 4; attempt++)
        {
            var result = challenge.Verify(wrong, T0.AddSeconds(attempt), Settings);
            result.Outcome.ShouldBe(TwoFactorVerifyOutcome.Wrong);
            remaining.Add(result.RemainingAttempts);
        }

        remaining.ShouldBe([4, 3, 2, 1]);

        var fifth = challenge.Verify(wrong, T0.AddSeconds(5), Settings);
        fifth.Outcome.ShouldBe(TwoFactorVerifyOutcome.Exhausted);
        fifth.RemainingAttempts.ShouldBe(0);
    }

    [Fact]
    public void AfterTheCodeIsUsedUpEvenTheRightCodeIsRefused()
    {
        var challenge = NewChallenge();
        var code = challenge.IssueCode(Mac("111111"), T0, Settings);
        for (var attempt = 1; attempt <= 5; attempt++)
        {
            challenge.Verify(Mac("222222"), T0.AddSeconds(attempt), Settings);
        }

        var result = challenge.Verify(Mac("111111"), T0.AddSeconds(6), Settings);

        result.Outcome.ShouldBe(TwoFactorVerifyOutcome.Exhausted);
        result.RemainingAttempts.ShouldBe(0);
        code.ConsumedAt.ShouldBeNull();
        code.FailedAttempts.ShouldBe(5);
    }

    [Fact]
    public void ACodeVerifiedAtFourteenFiftyNineIsAccepted()
    {
        var challenge = NewChallenge();
        challenge.IssueCode(Mac("111111"), T0, Settings);

        var result = challenge.Verify(Mac("111111"), T0.AddMinutes(14).AddSeconds(59), Settings);

        result.Outcome.ShouldBe(TwoFactorVerifyOutcome.Ok);
    }

    [Fact]
    public void ACodeVerifiedAtExactlyFifteenMinutesIsExpired()
    {
        var challenge = NewChallenge();
        challenge.IssueCode(Mac("111111"), T0, Settings);

        var result = challenge.Verify(Mac("111111"), T0.AddMinutes(15), Settings);

        result.Outcome.ShouldBe(TwoFactorVerifyOutcome.CodeExpired);
    }

    [Fact]
    public void AWrongCodeOnAnExpiredCodeDoesNotCountAnAttempt()
    {
        var challenge = NewChallenge();
        var code = challenge.IssueCode(Mac("111111"), T0, Settings);

        var result = challenge.Verify(Mac("222222"), T0.AddMinutes(16), Settings);

        result.Outcome.ShouldBe(TwoFactorVerifyOutcome.CodeExpired);
        code.FailedAttempts.ShouldBe(0);
    }

    [Fact]
    public void ANewCodeSupersedesTheOldOneAndTheOldOneCountsAsWrong()
    {
        var challenge = NewChallenge();
        var first = challenge.IssueCode(Mac("111111"), T0, Settings);
        var second = challenge.IssueCode(Mac("333333"), T0.AddSeconds(61), Settings);

        first.SupersededAt.ShouldBe(T0.AddSeconds(61));
        second.SupersededAt.ShouldBeNull();

        var old = challenge.Verify(Mac("111111"), T0.AddSeconds(70), Settings);
        old.Outcome.ShouldBe(TwoFactorVerifyOutcome.Wrong);
        old.RemainingAttempts.ShouldBe(4);
        second.FailedAttempts.ShouldBe(1);
        first.FailedAttempts.ShouldBe(0);

        challenge.Verify(Mac("333333"), T0.AddSeconds(80), Settings).Outcome.ShouldBe(TwoFactorVerifyOutcome.Ok);
    }

    [Fact]
    public void AVerifyJustBeforeThirtyMinutesIsEvaluatedAndAtThirtyMinutesIsClosed()
    {
        var challenge = NewChallenge();
        challenge.IssueCode(Mac("111111"), T0.AddMinutes(20), Settings);

        challenge.Verify(Mac("222222"), T0.AddMinutes(29).AddSeconds(59), Settings).Outcome
            .ShouldBe(TwoFactorVerifyOutcome.Wrong);
        challenge.Verify(Mac("111111"), T0.AddMinutes(30), Settings).Outcome
            .ShouldBe(TwoFactorVerifyOutcome.ChallengeClosed);
    }

    [Fact]
    public void AnInvalidatedChallengeRefusesEveryCode()
    {
        var challenge = NewChallenge();
        challenge.IssueCode(Mac("111111"), T0, Settings);

        challenge.Invalidate(T0.AddMinutes(1));

        challenge.Status.ShouldBe(TwoFactorChallengeStatus.Invalidated);
        challenge.InvalidatedAt.ShouldBe(T0.AddMinutes(1));
        challenge.Verify(Mac("111111"), T0.AddMinutes(2), Settings).Outcome
            .ShouldBe(TwoFactorVerifyOutcome.ChallengeClosed);
        Should.Throw<InvalidOperationException>(() => challenge.IssueCode(Mac("444444"), T0.AddMinutes(2), Settings));
    }

    [Fact]
    public void IssuingACodeOnAnExpiredChallengeIsAProgrammingError()
    {
        var challenge = NewChallenge();

        Should.Throw<InvalidOperationException>(
            () => challenge.IssueCode(Mac("111111"), T0.AddMinutes(30), Settings));
    }

    [Fact]
    public void FailedAttemptsSinceSumsCodesIssuedAtOrAfterTheCutOff()
    {
        var challenge = NewChallenge();
        challenge.IssueCode(Mac("111111"), T0, Settings);
        challenge.Verify(Mac("222222"), T0.AddSeconds(1), Settings);
        challenge.Verify(Mac("222222"), T0.AddSeconds(2), Settings);
        challenge.IssueCode(Mac("333333"), T0.AddMinutes(2), Settings);
        challenge.Verify(Mac("222222"), T0.AddMinutes(3), Settings);

        challenge.FailedAttemptsSince(T0).ShouldBe(3);
        challenge.FailedAttemptsSince(T0.AddMinutes(2)).ShouldBe(1);
        challenge.FailedAttemptsSince(T0.AddMinutes(2).AddTicks(1)).ShouldBe(0);
    }
}

using Csps.Domain.Auditing;

namespace Csps.Domain.UnitTests.Auditing;

/// <summary>AUDIT-01, USER-06: the action catalog is valid, unique and complete.</summary>
public sealed class AuditActionsTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 14, 0, 0, 0, TimeSpan.Zero);

    [Fact]
    public void CatalogHoldsTheTwentyOneAuthCodesAndTheProfileCodes()
    {
        AuditActions.All.Count.ShouldBe(25);
        AuditActions.All.ShouldContain(AuditActions.SignInFailed);
        AuditActions.SignInFailed.ShouldBe("auth.sign-in-failed");
    }

    [Fact]
    public void TheProfileNameChangeCodeIsInTheCatalog()
    {
        AuditActions.ProfileNameChanged.ShouldBe("profile.name-changed");
        AuditActions.All.ShouldContain(AuditActions.ProfileNameChanged);
    }

    [Fact]
    public void TheEmailChangeCodesAreInTheCatalog()
    {
        AuditActions.ProfileEmailChangeRequested.ShouldBe("profile.email-change-requested");
        AuditActions.ProfileEmailChanged.ShouldBe("profile.email-changed");
        AuditActions.ProfileEmailChangeCanceled.ShouldBe("profile.email-change-canceled");
        AuditActions.All.ShouldContain(AuditActions.ProfileEmailChangeRequested);
        AuditActions.All.ShouldContain(AuditActions.ProfileEmailChanged);
        AuditActions.All.ShouldContain(AuditActions.ProfileEmailChangeCanceled);
    }

    [Fact]
    public void EveryCodeIsAcceptedByAuditEntry()
    {
        foreach (var action in AuditActions.All)
        {
            action.Length.ShouldBeLessThanOrEqualTo(AuditEntry.ActionMaxLength);

            var entry = AuditEntry.Create(Now, null, action, null, null, null, null, new string('a', AuditEntry.CorrelationIdLength), null);

            entry.Action.ShouldBe(action);
        }
    }

    [Fact]
    public void CatalogHasNoDuplicates()
    {
        AuditActions.All.Distinct(StringComparer.Ordinal).Count().ShouldBe(AuditActions.All.Count);
    }

    [Fact]
    public void SignInFailureReasonsAreTheEightDocumentedOnes()
    {
        AuditActions.SignInFailureReasons.ShouldBe(["unknown-account", "bad-password", "locked", "deactivated", "unconfirmed", "no-password", "manager-locked", "deleted"]);
    }

    [Fact]
    public void LockoutAndSessionRevokeDetailsAreFixed()
    {
        AuditActions.LockoutDetails.ShouldBe(["password", "code"]);
        AuditActions.SessionsRevokedDetails.ShouldBe(["sign-out-others", "password-reset", "password-changed"]);
    }
}

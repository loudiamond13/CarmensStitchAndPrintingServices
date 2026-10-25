using System.Reflection;
using Csps.Domain.Auditing;

namespace Csps.Domain.UnitTests.Auditing;

/// <summary>AUDIT-01, USER-06: the action catalog is valid, unique and complete.</summary>
public sealed class AuditActionsTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 14, 0, 0, 0, TimeSpan.Zero);

    [Fact]
    public void CatalogHoldsTheAuthProfileUserAndPhaseSixCodes()
    {
        AuditActions.All.Count.ShouldBe(49);
        AuditActions.All.ShouldContain(AuditActions.SignInFailed);
        AuditActions.SignInFailed.ShouldBe("auth.sign-in-failed");
    }

    [Fact]
    public void TheManagerResetLinkCodeIsInTheCatalog()
    {
        AuditActions.UserResetLinkSent.ShouldBe("user.reset-link-sent");
        AuditActions.All.ShouldContain(AuditActions.UserResetLinkSent);
    }

    [Fact]
    public void TheTemporaryPasswordSetCodeIsInTheCatalogAndTheRevocationDetailIsListed()
    {
        AuditActions.UserTemporaryPasswordSet.ShouldBe("user.temporary-password-set");
        AuditActions.All.ShouldContain(AuditActions.UserTemporaryPasswordSet);
        AuditActions.SessionsRevokedDetails.ShouldContain("temporary-password");
    }

    [Fact]
    public void TheTemporaryPasswordCreateCodeIsInTheCatalog()
    {
        AuditActions.UserCreatedTemporary.ShouldBe("user.created-temporary");
        AuditActions.All.ShouldContain(AuditActions.UserCreatedTemporary);
    }

    [Fact]
    public void TheDeactivateAndActivateCodesAreInTheCatalog()
    {
        AuditActions.UserDeactivated.ShouldBe("user.deactivated");
        AuditActions.UserActivated.ShouldBe("user.activated");
        AuditActions.All.ShouldContain(AuditActions.UserDeactivated);
        AuditActions.All.ShouldContain(AuditActions.UserActivated);
    }

    [Fact]
    public void TheLockAndUnlockCodesAreInTheCatalog()
    {
        AuditActions.UserLocked.ShouldBe("user.locked");
        AuditActions.UserUnlocked.ShouldBe("user.unlocked");
        AuditActions.All.ShouldContain(AuditActions.UserLocked);
        AuditActions.All.ShouldContain(AuditActions.UserUnlocked);
    }

    [Fact]
    public void TheManagerEditCodeIsInTheCatalog()
    {
        AuditActions.UserDetailsChanged.ShouldBe("user.details-changed");
        AuditActions.All.ShouldContain(AuditActions.UserDetailsChanged);
    }

    [Fact]
    public void TheRoleChangeCodeIsInTheCatalog()
    {
        AuditActions.UserRoleChanged.ShouldBe("user.role-changed");
        AuditActions.All.ShouldContain(AuditActions.UserRoleChanged);
    }

    [Fact]
    public void TheManagerEmailChangeAndInvitationCodesAreInTheCatalog()
    {
        AuditActions.UserEmailChangeStarted.ShouldBe("user.email-change-started");
        AuditActions.UserInvitationResent.ShouldBe("user.invitation-resent");
        AuditActions.All.ShouldContain(AuditActions.UserEmailChangeStarted);
        AuditActions.All.ShouldContain(AuditActions.UserInvitationResent);
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

    [Theory]
    [InlineData(nameof(AuditActions.CompanyExpenseAdded), "company-expense.added")]
    [InlineData(nameof(AuditActions.CompanyExpenseChanged), "company-expense.changed")]
    [InlineData(nameof(AuditActions.CompanyExpensePayerChanged), "company-expense.payer-changed")]
    [InlineData(nameof(AuditActions.CompanyExpenseDeleted), "company-expense.deleted")]
    [InlineData(nameof(AuditActions.CompanyExpenseRestored), "company-expense.restored")]
    [InlineData(nameof(AuditActions.CompanyExpensePermanentlyDeleted), "company-expense.permanently-deleted")]
    [InlineData(nameof(AuditActions.ExpenseCategoryAdded), "expense-category.added")]
    [InlineData(nameof(AuditActions.ExpenseCategoryRenamed), "expense-category.renamed")]
    [InlineData(nameof(AuditActions.ExpenseCategoryRecolored), "expense-category.recolored")]
    [InlineData(nameof(AuditActions.ExpenseCategoryRetired), "expense-category.retired")]
    [InlineData(nameof(AuditActions.ExpenseCategoryReactivated), "expense-category.reactivated")]
    [InlineData(nameof(AuditActions.ExpenseCategoryDeleted), "expense-category.deleted")]
    public void ThePhaseSixCodesAreInTheCatalogAndAcceptedByAuditEntry(string constantName, string code)
    {
        var constant = (string)typeof(AuditActions).GetField(constantName)!.GetRawConstantValue()!;

        constant.ShouldBe(code);
        AuditActions.All.ShouldContain(code);
        AuditEntry.Create(Now, null, code, null, null, null, null, new string('a', AuditEntry.CorrelationIdLength), null).Action.ShouldBe(code);
    }

    [Fact]
    public void ThePhaseSixCodesComeAfterThePhaseFiveCodes()
    {
        AuditActions.All.Skip(37).ShouldBe(
        [
            "company-expense.added",
            "company-expense.changed",
            "company-expense.payer-changed",
            "company-expense.deleted",
            "company-expense.restored",
            "company-expense.permanently-deleted",
            "expense-category.added",
            "expense-category.renamed",
            "expense-category.recolored",
            "expense-category.retired",
            "expense-category.reactivated",
            "expense-category.deleted",
        ]);
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
        AuditActions.SessionsRevokedDetails.ShouldBe(["sign-out-others", "password-reset", "password-changed", "account-changed", "temporary-password"]);
    }

    [Fact]
    public void EveryDetailWordHasAConstant()
    {
        var constants = typeof(AuditActions)
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(field => field.IsLiteral && field.FieldType == typeof(string))
            .Select(field => (string)field.GetRawConstantValue()!)
            .ToList();

        foreach (var word in AuditActions.SignInFailureReasons.Concat(AuditActions.LockoutDetails).Concat(AuditActions.SessionsRevokedDetails).Concat(["capped", "sent"]))
        {
            constants.ShouldContain(word);
        }
    }

    [Fact]
    public void EveryDetailListIsBuiltFromItsConstants()
    {
        var listed = typeof(AuditActions)
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(field => field.IsLiteral && field.FieldType == typeof(string) && field.Name.StartsWith("Detail", StringComparison.Ordinal))
            .Select(field => (string)field.GetRawConstantValue()!)
            .ToList();

        listed.Count.ShouldBeGreaterThan(0);
        AuditActions.SignInFailureReasons.ShouldBeSubsetOf(listed);
        AuditActions.LockoutDetails.ShouldBeSubsetOf(listed);
        AuditActions.SessionsRevokedDetails.ShouldBeSubsetOf(listed);
    }

    [Fact]
    public void TheDetailWordsTheHandlersWriteAreOneConstantEach()
    {
        AuditActions.DetailProfile.ShouldBe("profile");
        AuditActions.DetailManager.ShouldBe("manager");
        AuditActions.DetailTaken.ShouldBe("taken");
        AuditActions.DetailResent.ShouldBe("resent");
    }

    [Fact]
    public void ResetRequestDetailsAreTheFiveDocumentedOnes()
    {
        AuditActions.ResetRequestDetails.ShouldBe(["unknown-account", "manager-locked", "capped", "sent", "deactivated"]);
    }

    [Fact]
    public void SelfServiceHoldsOnlyCodesFromTheCatalogWithoutDuplicates()
    {
        AuditActions.SelfService.ShouldBeSubsetOf(AuditActions.All);
        AuditActions.SelfService.Distinct(StringComparer.Ordinal).Count().ShouldBe(AuditActions.SelfService.Count);
    }

    [Fact]
    public void SelfServiceCoversSignInCodesResetInvitationAndEmailConfirmationButNotManagerActions()
    {
        AuditActions.SelfService.ShouldContain(AuditActions.SignInFailed);
        AuditActions.SelfService.ShouldContain(AuditActions.TwoFactorVerified);
        AuditActions.SelfService.ShouldContain(AuditActions.SignedIn);
        AuditActions.SelfService.ShouldContain(AuditActions.PasswordResetCompleted);
        AuditActions.SelfService.ShouldContain(AuditActions.InviteAccepted);
        AuditActions.SelfService.ShouldContain(AuditActions.ProfileEmailChanged);
        AuditActions.SelfService.ShouldNotContain(AuditActions.UserDeactivated);
        AuditActions.SelfService.ShouldNotContain(AuditActions.UserRoleChanged);
        AuditActions.SelfService.ShouldNotContain(AuditActions.BootstrapManagerCreated);
        AuditActions.SelfService.ShouldNotContain(AuditActions.UserInvited);
    }

    [Fact]
    public void AuditEntriesAreKeptForEightMonths()
    {
        AuditRetention.Months.ShouldBe(8);
    }
}

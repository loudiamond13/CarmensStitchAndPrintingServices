using Csps.Application.Email;
using Csps.Domain.Identity;

namespace Csps.Application.UnitTests.Email;

/// <summary>AUTH-13, D-45: the ten auth email kinds, when each stops being worth sending, and that a secret never prints.</summary>
public sealed class AuthEmailTests
{
    private static readonly DateTimeOffset CreatedAt = new(2026, 10, 14, 8, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset ExpiresAt = CreatedAt.AddMinutes(15);
    private static readonly DeviceDescription Device = new("Chrome on Android", true);

    [Fact]
    public void EachRecordReportsItsKind()
    {
        Kinds().Select(email => email.Kind).ShouldBe(
        [
            AuthEmailKind.SignInCode,
            AuthEmailKind.AccountLocked,
            AuthEmailKind.PasswordReset,
            AuthEmailKind.PasswordChanged,
            AuthEmailKind.ManagerReset,
            AuthEmailKind.DeactivatedNotice,
            AuthEmailKind.Invite,
            AuthEmailKind.EmailChangeConfirm,
            AuthEmailKind.EmailChangeNotice,
            AuthEmailKind.ManagerEmailChanged,
        ]);
    }

    [Fact]
    public void CodeResetAndInviteEmailsExpireWithTheirCodeOrLink()
    {
        new SignInCodeEmail("a@example.com", "048213", ExpiresAt, CreatedAt, Device).NotAfter(CreatedAt).ShouldBe(ExpiresAt);
        new PasswordResetEmail("a@example.com", "token", ExpiresAt, CreatedAt, Device).NotAfter(CreatedAt).ShouldBe(ExpiresAt);
        new InviteEmail("a@example.com", "token", ExpiresAt, CreatedAt).NotAfter(CreatedAt).ShouldBe(ExpiresAt);
        new EmailChangeConfirmEmail("b@example.com", "token", ExpiresAt, CreatedAt, "a@example.com").NotAfter(CreatedAt).ShouldBe(ExpiresAt);
    }

    [Fact]
    public void OtherEmailsAreWorthSendingForADay()
    {
        var expected = CreatedAt.AddDays(1);

        new AccountLockedEmail("a@example.com", ExpiresAt, LockoutCause.Password, TimeSpan.FromMinutes(15)).NotAfter(CreatedAt).ShouldBe(expected);
        new PasswordChangedEmail("a@example.com", CreatedAt, SessionsEnded: true).NotAfter(CreatedAt).ShouldBe(expected);
        new ManagerResetEmail("a@example.com", "Carmen Reyes", CreatedAt).NotAfter(CreatedAt).ShouldBe(expected);
        new DeactivatedNoticeEmail("a@example.com").NotAfter(CreatedAt).ShouldBe(expected);
        new EmailChangeNoticeEmail("a@example.com", "b@example.com", CreatedAt, Device).NotAfter(CreatedAt).ShouldBe(expected);
        new ManagerEmailChangedEmail("a@example.com", "b@example.com", "Carmen Reyes", CreatedAt).NotAfter(CreatedAt).ShouldBe(expected);
    }

    [Fact]
    public void RecordsThatCarryASecretPrintOnlyTheirKind()
    {
        new SignInCodeEmail("a@example.com", "048213", ExpiresAt, CreatedAt, Device).ToString()
            .ShouldBe("SignInCodeEmail");
        new PasswordResetEmail("a@example.com", "reset-token-value", ExpiresAt, CreatedAt, Device).ToString()
            .ShouldBe("PasswordResetEmail");
        new InviteEmail("a@example.com", "invite-token-value", ExpiresAt, CreatedAt).ToString()
            .ShouldBe("InviteEmail");
        new EmailChangeConfirmEmail("b@example.com", "email-change-token-value", ExpiresAt, CreatedAt, "a@example.com").ToString()
            .ShouldBe("EmailChangeConfirmEmail");
    }

    [Fact]
    public void RecordsCarryTheirValues()
    {
        var locked = new AccountLockedEmail("a@example.com", ExpiresAt, LockoutCause.Code, TimeSpan.FromMinutes(15));
        locked.To.ShouldBe("a@example.com");
        locked.LockedUntil.ShouldBe(ExpiresAt);
        locked.Cause.ShouldBe(LockoutCause.Code);
        locked.LockedFor.ShouldBe(TimeSpan.FromMinutes(15));

        var changed = new PasswordChangedEmail("a@example.com", CreatedAt, SessionsEnded: false);
        changed.ChangedAt.ShouldBe(CreatedAt);
        changed.SessionsEnded.ShouldBeFalse();

        var reset = new ManagerResetEmail("a@example.com", "Carmen Reyes", CreatedAt);
        reset.ManagerName.ShouldBe("Carmen Reyes");
        reset.ResetAt.ShouldBe(CreatedAt);

        var code = new SignInCodeEmail("a@example.com", "048213", ExpiresAt, CreatedAt, Device);
        code.Code.ShouldBe("048213");
        code.ExpiresAt.ShouldBe(ExpiresAt);
        code.RequestedAt.ShouldBe(CreatedAt);
        code.Device.ShouldBe(Device);

        new PasswordResetEmail("a@example.com", "t", ExpiresAt, CreatedAt, Device).Token.ShouldBe("t");
        new InviteEmail("a@example.com", "t", ExpiresAt, CreatedAt).Token.ShouldBe("t");

        var confirm = new EmailChangeConfirmEmail("b@example.com", "t", ExpiresAt, CreatedAt, "a@example.com");
        confirm.Token.ShouldBe("t");
        confirm.OldEmail.ShouldBe("a@example.com");
        var notice = new EmailChangeNoticeEmail("a@example.com", "b@example.com", CreatedAt, Device);
        notice.NewEmail.ShouldBe("b@example.com");
        notice.RequestedAt.ShouldBe(CreatedAt);
        notice.Device.ShouldBe(Device);
        confirm.ChangedBy.ShouldBeNull();
        new EmailChangeConfirmEmail("b@example.com", "t", ExpiresAt, CreatedAt, "a@example.com", "Carmen Reyes").ChangedBy.ShouldBe("Carmen Reyes");

        var moved = new ManagerEmailChangedEmail("a@example.com", "b@example.com", "Carmen Reyes", CreatedAt);
        moved.To.ShouldBe("a@example.com");
        moved.NewEmail.ShouldBe("b@example.com");
        moved.ChangedBy.ShouldBe("Carmen Reyes");
        moved.ChangedAt.ShouldBe(CreatedAt);
    }

    private static AuthEmail[] Kinds() =>
    [
        new SignInCodeEmail("a@example.com", "048213", ExpiresAt, CreatedAt, Device),
        new AccountLockedEmail("a@example.com", ExpiresAt, LockoutCause.Password, TimeSpan.FromMinutes(15)),
        new PasswordResetEmail("a@example.com", "token", ExpiresAt, CreatedAt, Device),
        new PasswordChangedEmail("a@example.com", CreatedAt, SessionsEnded: true),
        new ManagerResetEmail("a@example.com", "Carmen Reyes", CreatedAt),
        new DeactivatedNoticeEmail("a@example.com"),
        new InviteEmail("a@example.com", "token", ExpiresAt, CreatedAt),
        new EmailChangeConfirmEmail("b@example.com", "token", ExpiresAt, CreatedAt, "a@example.com"),
        new EmailChangeNoticeEmail("a@example.com", "b@example.com", CreatedAt, Device),
        new ManagerEmailChangedEmail("a@example.com", "b@example.com", "Carmen Reyes", CreatedAt),
    ];
}

using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace Csps.HostProbe.Tests;

public sealed class CertificateChecksTests
{
    private const string Password = "pfx-test-value";

    private static CertificateAttempt FailedWithRichMessage()
    {
        var message = "Keyset does not exist\r\n\t at C:\\inetpub\\vhosts\\site\\keys\\k.dat via \\\\server\\share\\k and "
            + "/var/lib/csps/k  with " + Password;
        var error = new CryptographicException(message) { HResult = unchecked((int)0x80090016) };
        return CertificateChecks.Failed("machine", "load", error, Password);
    }

    [Fact]
    public void AFailureNamesItsStepTypeAndCode()
    {
        var attempt = FailedWithRichMessage();

        attempt.Ok.ShouldBeFalse();
        attempt.Name.ShouldBe("machine");
        attempt.Step.ShouldBe("load");
        attempt.ExceptionType.ShouldBe("CryptographicException");
        attempt.HResult.ShouldBe("0x80090016");
        attempt.KeyCleanup.ShouldBe("none");
    }

    [Fact]
    public void TheMessageIsCleaned()
    {
        var message = FailedWithRichMessage().Message;

        message.ShouldNotBeNull();
        message.ShouldContain("Keyset does not exist");
        message.ShouldNotContain('\r');
        message.ShouldNotContain('\n');
        message.ShouldNotContain('\t');
        message.ShouldNotContain("  ");
        message.ShouldNotContain(Password);
        message.ShouldContain("[hidden]");
        message.ShouldContain("[path]");
        message.ShouldNotContain("inetpub");
        message.ShouldNotContain("server\\share");
        message.ShouldNotContain("/var/lib");
    }

    [Fact]
    public void ALongMessageIsCappedAndAnEmptyPasswordIsAllowed()
    {
        var error = new CryptographicException(new string('x', 500));
        CertificateChecks.Failed("user", "export", error, Password).Message!.Length.ShouldBeLessThanOrEqualTo(200);

        CertificateChecks.Clean("Plain text, RSA/ECB stays.", string.Empty).ShouldBe("Plain text, RSA/ECB stays.");
    }

    private static readonly string[] AllowedCleanups = ["none", "removed", "removed-by-probe", "unchecked"];

    [Fact]
    public void RunTriesTheFourAttemptsInOrder()
    {
        CertificateChecks.Run(TimeProvider.System).Select(attempt => attempt.Name)
            .ShouldBe(["ephemeral", "machine", "user", "ephemeral-3des"]);
    }

    [Fact]
    public void TheEphemeralAttemptsSucceedHere()
    {
        var attempts = CertificateChecks.Run(TimeProvider.System);

        foreach (var attempt in attempts.Where(a => a.Name is "ephemeral" or "ephemeral-3des"))
        {
            attempt.Ok.ShouldBeTrue(attempt.Name + ": " + attempt.Message);
            attempt.KeyCleanup.ShouldBe("none");
        }

        if (!OperatingSystem.IsWindows())
        {
            attempts.ShouldAllBe(a => a.Ok && a.KeyCleanup == "none");
        }
    }

    [Fact]
    public void EveryAttemptIsOkOrSaysWhereItFailed()
    {
        foreach (var attempt in CertificateChecks.Run(TimeProvider.System))
        {
            if (attempt.Ok)
            {
                (attempt.Step ?? attempt.ExceptionType ?? attempt.HResult ?? attempt.Message).ShouldBeNull();
                continue;
            }

            attempt.Step.ShouldBeOneOf("create", "export", "load", "use");
            attempt.Message.ShouldNotBeNullOrEmpty();
            attempt.Message.Length.ShouldBeLessThanOrEqualTo(200);
            attempt.Message.ShouldNotContain('\n');
            (attempt.ExceptionType is null).ShouldBe(attempt.HResult is null);
            if (attempt.HResult is not null)
            {
                Regex.IsMatch(attempt.HResult, "^0x[0-9A-F]{8}$").ShouldBeTrue(attempt.HResult);
            }
            else
            {
                attempt.Step.ShouldBe("use");
            }
        }
    }

    [Fact]
    public void NoAttemptLeavesAKeyBehind()
    {
        foreach (var attempt in CertificateChecks.Run(TimeProvider.System))
        {
            attempt.KeyCleanup.ShouldBeOneOf(AllowedCleanups);
        }
    }

    [Fact]
    [SupportedOSPlatform("windows")]
    public void LeftoverKeyIsDeletedThroughItsHandle()
    {
        Assert.SkipUnless(OperatingSystem.IsWindows(), "CNG key stores exist only on Windows.");

        var name = "csps-hostprobe-test-" + Guid.NewGuid().ToString("N");
        var provider = CngProvider.MicrosoftSoftwareKeyStorageProvider;
        try
        {
            CngKey.Create(CngAlgorithm.Rsa, name, new CngKeyCreationParameters { Provider = provider }).Dispose();

            CertificateChecks.RemoveKeyIfLeft(name, provider, machineKey: false).ShouldBe("removed-by-probe");
            CngKey.Exists(name, provider).ShouldBeFalse();
            CertificateChecks.RemoveKeyIfLeft(name, provider, machineKey: false).ShouldBe("removed");
        }
        finally
        {
            if (CngKey.Exists(name, provider))
            {
                using var key = CngKey.Open(name, provider);
                key.Delete();
            }
        }
    }
}

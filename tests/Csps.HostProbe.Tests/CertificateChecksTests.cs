using System.Security.Cryptography;

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
}

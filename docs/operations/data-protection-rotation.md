# Data Protection certificate: setup, backup, rotation and recovery

The API keeps a small set of secret keys, the **key ring**, that it uses to protect sign-in cookies, password-reset
links and similar short-lived tokens (SEC-04). The key ring is stored in the database table `dbo.DataProtectionKeys`,
so every app-pool restart on the host reads the same keys and nobody is signed out when the 256 MB pool recycles.

Each key in that table is **encrypted with a certificate** before it is stored (D-15). Someone who gets a copy of the
database alone still cannot read the keys. The certificate is the one secret that unlocks them.

| | |
|---|---|
| Decision | D-15, Phase 1 (2026-10-07) |
| Cost | Free. The certificate is self-signed and made with built-in Windows/.NET tools. It is only used inside the app to encrypt keys, never shown to browsers, so no paid certificate is needed. |
| Reversibility | **Costly.** Losing the certificate, or replacing it without keeping the old one, makes the stored keys unreadable and **signs everyone out**. No orders, payments or other business data are lost, because none of it is encrypted with these keys. |

## Where the certificate lives

The certificate is a PFX file (certificate plus private key), stored as two settings:

| Setting | Environment-variable form on the host | What it is |
|---|---|---|
| `DataProtection:CertificateBase64` | `DataProtection__CertificateBase64` | The PFX file, written as base64 text |
| `DataProtection:CertificatePassword` | `DataProtection__CertificatePassword` | The PFX password |
| `DataProtection:PreviousCertificates:0:CertificateBase64` (and `:1:`, `:2:` ...) | `DataProtection__PreviousCertificates__0__CertificateBase64` | Older certificates kept after a rotation |
| `DataProtection:PreviousCertificates:0:CertificatePassword` | `DataProtection__PreviousCertificates__0__CertificatePassword` | Their passwords |

- **Development:** `tools/scripts/Initialize-DevSecrets.ps1` creates a dev certificate once and stores both values in
  your own `dotnet user-secrets` store. Running it again changes nothing.
- **Production:** only in the host's app settings on SmarterASP.NET. **Never** in git, `appsettings.json`,
  `web.config`, e-mail or chat. `*.pfx` files are git-ignored, and the API never writes these values to its logs.

The API **refuses to start** when the current certificate or any previous one is missing, is not valid base64, has the
wrong password, or has no private key. The error names the setting (for example
`DataProtection:CertificateBase64: The certificate could not be opened. Check the PFX and its password.`) and never
shows the value. This is deliberate: a host that silently ran without the certificate would sign everyone out on the
next restart.

## Creating the production certificate

Do this once, on a trusted Windows computer, before the first production deploy. It makes an RSA-3072 certificate valid
for 10 years, entirely in memory, and writes two small text files into a folder **you choose outside the project
folder** (for example an encrypted USB drive). It prints nothing secret.

```powershell
# Windows PowerShell 5.1 or later. Change $out to your backup folder; never use the project folder.
$out = 'E:\CSPS-secrets\data-protection-2026'
New-Item -ItemType Directory -Force -Path $out | Out-Null

$rsa = [System.Security.Cryptography.RSA]::Create(3072)
$request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
    'CN=Csps Production Data Protection', $rsa,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256,
    [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
$notBefore = [DateTimeOffset]::UtcNow.AddDays(-1)
$certificate = $request.CreateSelfSigned($notBefore, $notBefore.AddYears(10))

$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$password = [Convert]::ToBase64String($bytes)

[IO.File]::WriteAllText((Join-Path $out 'CertificateBase64.txt'),
    [Convert]::ToBase64String($certificate.Export('Pfx', $password)))
[IO.File]::WriteAllText((Join-Path $out 'CertificatePassword.txt'), $password)
$certificate.Dispose(); $rsa.Dispose()
Write-Host "Saved to $out. Copy each file's text into the matching host setting."
```

Then add the two host settings `DataProtection__CertificateBase64` and `DataProtection__CertificatePassword` with the
text of those two files, and restart the site. (The first-deploy phase records exactly where SmarterASP.NET keeps app
settings; the names stay the same.)

## Backup (do this the same day)

- Keep **both** text files (or the base64 and the password) in **two separate places outside the host**, for example
  your password manager and an encrypted USB drive kept at home.
- Write down which certificate is current and the date it became current.
- The host is not a backup: if the site is rebuilt, its settings may be gone.

## Rotation (replacing the certificate)

Rotate only when you have a reason, for example if you think the password or the file was exposed. The certificate is
valid for 10 years, so there is no routine deadline.

1. Create a new certificate with the steps above, into a new folder (for example `data-protection-2031`). Back it up.
2. In the host settings, **move the current values to a previous slot**: copy `DataProtection__CertificateBase64` to
   `DataProtection__PreviousCertificates__0__CertificateBase64`, and the password to
   `DataProtection__PreviousCertificates__0__CertificatePassword`. If slot `0` is already used, use the next free
   number (`1`, `2`, ...).
3. Put the **new** certificate's text and password into `DataProtection__CertificateBase64` and
   `DataProtection__CertificatePassword`.
4. Restart the site. Check that it starts, that `/health` answers, and that staff are still signed in.
5. From now on, new keys are encrypted with the new certificate. Previous certificates are used **only to read** the
   older keys; they never encrypt anything new.

**Never delete an old certificate while any key it encrypted is still in `dbo.DataProtectionKeys`.** Keys expire 90
days after they are created (the framework default), but the expired rows stay in the table. Remove an old certificate
from the previous slots only when both of these are true:

- at least 90 days have passed since the rotation, so every key it encrypted has expired, and
- a developer has removed those expired key rows with a reviewed script (the first such script is a later-phase task).

If you are unsure, keep the old certificate listed. Keeping it costs nothing; removing it too early signs everyone out.
Keep the backup of every old certificate even after you remove it from the host.

## If the certificate is lost

If the current certificate and its backups are gone, the stored keys can no longer be read. Nothing else is lost.

1. Create a new certificate (steps above) and set it as the current one. Leave the previous slots empty.
2. Restart the site. The API creates a new key, encrypted with the new certificate.
3. Everyone has to **sign in again**, and any password-reset or similar links that were already sent stop working.
   Orders, payments, customers and all other data are untouched.
4. A developer may later remove the old, unreadable key rows from `dbo.DataProtectionKeys` with a reviewed script.
   Until then the API logs that it skipped them, which is harmless.

## How to tell it is working

- The API starts. A missing or broken certificate stops it at start-up with a message naming the setting.
- The log files in `logs/` never contain the warning `No XML encryptor configured`. That warning would mean keys were
  being stored unencrypted, and this setup is built so it cannot happen.
- In the database, every `Xml` value in `dbo.DataProtectionKeys` contains `encryptedSecret` and never a plain
  `masterKey` value.

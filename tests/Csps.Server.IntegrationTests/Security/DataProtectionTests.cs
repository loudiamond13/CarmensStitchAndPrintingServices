using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Csps.Testing;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Csps.Server.IntegrationTests.Security;

/// <summary>
/// SEC-04, D-15: the Data Protection key ring lives in the database, encrypted with the configured certificate, so a
/// payload protected before an app-pool recycle is still readable after it. Each database test uses its own ad-hoc
/// <c>CSPS_Test_&lt;guid&gt;</c> database, because key rows are what the tests count.
/// </summary>
public sealed class DataProtectionTests
{
    private const string Purpose = "Csps.Tests";
    private const string Payload = "hello";

    // -1 means the table does not exist; dynamic SQL so the batch compiles either way.
    private const string CountKeysSql =
        "IF OBJECT_ID(N'dbo.DataProtectionKeys', N'U') IS NULL SELECT -1; ELSE EXEC(N'SELECT COUNT(*) FROM dbo.DataProtectionKeys;');";

    private const string ReadKeysSql = "SELECT Xml FROM dbo.DataProtectionKeys ORDER BY Id;";

    [Fact]
    public async Task KeyRingSurvivesRestart()
    {
        await using var database = await CspsDatabase.CreateAsync();

        string protectedPayload;
        await using (var first = CspsApiFactory.ForDatabase(database.ConnectionString))
        {
            protectedPayload = Protector(first).Protect(Payload);
        }

        // The key ring is in the database, not in this machine's user profile (the IIS app pool has none).
        (await CountKeysAsync(database)).ShouldBe(1);

        await using var second = CspsApiFactory.ForDatabase(database.ConnectionString);
        Protector(second).Unprotect(protectedPayload).ShouldBe(Payload);
    }

    [Fact]
    public async Task StoredKeyXmlIsEncrypted()
    {
        await using var database = await CspsDatabase.CreateAsync();
        await using (var factory = CspsApiFactory.ForDatabase(database.ConnectionString))
        {
            Protector(factory).Protect(Payload);
        }

        var keys = await ReadKeyXmlAsync(database);

        keys.ShouldNotBeEmpty();
        keys.ShouldAllBe(xml => xml.Contains("encryptedSecret") && xml.Contains("EncryptedData"));
        keys.ShouldAllBe(xml => !xml.Contains("unencrypted form") && !xml.Contains("<masterKey"));
    }

    [Fact]
    public async Task NoUnencryptedKeyWarning()
    {
        await using var database = await CspsDatabase.CreateAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);

        // A fresh database: protecting creates and stores the first key, the moment the warning would appear.
        Protector(factory).Protect(Payload);

        (await CountKeysAsync(database)).ShouldBe(1);
        factory.Sink.Events
            .Select(logEvent => logEvent.RenderMessage(System.Globalization.CultureInfo.InvariantCulture))
            .ShouldNotContain(message => message.Contains("No XML encryptor configured", StringComparison.OrdinalIgnoreCase));
    }

    [Theory]
    [InlineData("empty")]
    [InlineData("not-base64")]
    [InlineData("wrong-password")]
    [InlineData("no-private-key")]
    [InlineData("previous-wrong-password")]
    public async Task MissingCertificateFailsStartup(string fault)
    {
        var settings = FaultySettings(fault);
        await using var baseFactory = new CspsApiFactory();
        await using var factory = baseFactory.WithWebHostBuilder(builder => Apply(builder, settings));

        var exception = Should.Throw<OptionsValidationException>(() => factory.CreateClient());

        // The message names the setting and never echoes a secret.
        exception.Message.ShouldContain("DataProtection:");
        foreach (var secret in settings.Values.Where(value => value.Length > 0))
        {
            exception.Message.ShouldNotContain(secret);
        }
    }

    [Fact]
    public async Task SecondStartReusesKey()
    {
        await using var database = await CspsDatabase.CreateAsync();

        await using (var first = CspsApiFactory.ForDatabase(database.ConnectionString))
        {
            Protector(first).Protect(Payload);
        }

        await using (var second = CspsApiFactory.ForDatabase(database.ConnectionString))
        {
            Protector(second).Protect(Payload);
        }

        (await CountKeysAsync(database)).ShouldBe(1);
    }

    [Fact]
    public async Task RotationKeepsOldKeysReadable()
    {
        await using var database = await CspsDatabase.CreateAsync();
        string protectedPayload;
        await using (var before = CspsApiFactory.ForDatabase(database.ConnectionString))
        {
            protectedPayload = Protector(before).Protect(Payload);
        }

        await using (var rotated = new ConfiguredFactory(database.ConnectionString, RotatedSettings(keepPrevious: true)))
        {
            var protector = Protector(rotated);
            Should.NotThrow(() => protector.Unprotect(protectedPayload)).ShouldBe(Payload);
        }

        await using var withoutPrevious = new ConfiguredFactory(database.ConnectionString, RotatedSettings(keepPrevious: false));
        var unreadable = Protector(withoutPrevious);
        Should.Throw<CryptographicException>(() => unreadable.Unprotect(protectedPayload));
    }

    [Fact]
    public async Task NewKeysUseOnlyTheCurrentCertificate()
    {
        await using var database = await CspsDatabase.CreateAsync();
        await using (var before = CspsApiFactory.ForDatabase(database.ConnectionString))
        {
            Protector(before).Protect(Payload);
        }

        await using (var rotated = new ConfiguredFactory(database.ConnectionString, RotatedSettings(keepPrevious: true)))
        {
            // A key created after rotation is encrypted with the new current certificate, never a previous one.
            var now = TimeProvider.System.GetUtcNow();
            rotated.Services.GetRequiredService<IKeyManager>().CreateNewKey(now, now.AddDays(90));
        }

        var keys = await ReadKeyXmlAsync(database);
        keys.Count.ShouldBe(2);
        keys[0].ShouldContain(PublicCertificateBase64(TestCertificates.Current));
        keys[1].ShouldContain(PublicCertificateBase64(TestCertificates.Other));
        keys[1].ShouldNotContain(PublicCertificateBase64(TestCertificates.Current));
    }

    private static IDataProtector Protector(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> factory) =>
        factory.Services.GetRequiredService<IDataProtectionProvider>().CreateProtector(Purpose);

    private static Dictionary<string, string> RotatedSettings(bool keepPrevious)
    {
        var settings = new Dictionary<string, string>
        {
            [TestCertificates.CertificateBase64Setting] = TestCertificates.Other.Base64,
            [TestCertificates.CertificatePasswordSetting] = TestCertificates.Other.Password,
        };

        if (keepPrevious)
        {
            settings[TestCertificates.PreviousBase64Setting(0)] = TestCertificates.Current.Base64;
            settings[TestCertificates.PreviousPasswordSetting(0)] = TestCertificates.Current.Password;
        }

        return settings;
    }

    private static Dictionary<string, string> FaultySettings(string fault) => fault switch
    {
        "empty" => new()
        {
            [TestCertificates.CertificateBase64Setting] = string.Empty,
            [TestCertificates.CertificatePasswordSetting] = string.Empty,
        },
        "not-base64" => new()
        {
            [TestCertificates.CertificateBase64Setting] = "this is not base64!",
            [TestCertificates.CertificatePasswordSetting] = TestCertificates.Current.Password,
        },
        "wrong-password" => new()
        {
            [TestCertificates.CertificateBase64Setting] = TestCertificates.Current.Base64,
            [TestCertificates.CertificatePasswordSetting] = TestCertificates.Other.Password,
        },
        "no-private-key" => new()
        {
            [TestCertificates.CertificateBase64Setting] = TestCertificates.PublicOnly.Base64,
            [TestCertificates.CertificatePasswordSetting] = TestCertificates.PublicOnly.Password,
        },
        "previous-wrong-password" => new()
        {
            [TestCertificates.PreviousBase64Setting(0)] = TestCertificates.Other.Base64,
            [TestCertificates.PreviousPasswordSetting(0)] = TestCertificates.Current.Password,
        },
        _ => throw new ArgumentOutOfRangeException(nameof(fault), fault, "Unknown fault."),
    };

    private static void Apply(IWebHostBuilder builder, IReadOnlyDictionary<string, string> settings)
    {
        foreach (var (key, value) in settings)
        {
            builder.UseSetting(key, value);
        }
    }

    private static string PublicCertificateBase64(TestCertificate certificate)
    {
        using var loaded = X509CertificateLoader.LoadPkcs12(
            Convert.FromBase64String(certificate.Base64), certificate.Password, X509KeyStorageFlags.EphemeralKeySet);
        return Convert.ToBase64String(loaded.RawData);
    }

    private static async Task<int> CountKeysAsync(CspsDatabase database)
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = CountKeysSql;
                var count = await command.ExecuteScalarAsync(TestContext.Current.CancellationToken);
                return Convert.ToInt32(count, System.Globalization.CultureInfo.InvariantCulture);
            }
        }
    }

    private static async Task<List<string>> ReadKeyXmlAsync(CspsDatabase database)
    {
        var keys = new List<string>();
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = ReadKeysSql;
                var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
                await using (reader)
                {
                    while (await reader.ReadAsync(TestContext.Current.CancellationToken))
                    {
                        keys.Add(reader.GetString(0));
                    }
                }
            }
        }

        return keys;
    }

    /// <summary>A database-backed host whose Data Protection settings are replaced, for rotation scenarios.</summary>
    private sealed class ConfiguredFactory(string connectionString, IReadOnlyDictionary<string, string> settings)
        : CspsApiFactory(connectionString)
    {
        protected override void ConfigureSettings(IWebHostBuilder builder) => Apply(builder, settings);
    }
}

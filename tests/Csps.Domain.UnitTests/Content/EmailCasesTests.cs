using System.Text.Json;
using Csps.Domain.Content;

namespace Csps.Domain.UnitTests.Content;

/// <summary>
/// D-42: the shop email and the Quote alerts address share one rule, checked here against the cases the web zod test also reads
/// (tests/fixtures/email-cases.json). The file is only read here.
/// </summary>
public sealed class EmailCasesTests
{
    private static readonly Lazy<JsonDocument> File = new(Load);

    /// <summary>Every accepted shop or alerts email.</summary>
    public static TheoryData<string> ContactAccept => Strings("contactEmail", "accept");

    /// <summary>Every refused shop or alerts email.</summary>
    public static TheoryData<string> ContactRefuse => Strings("contactEmail", "refuse");

    [Theory]
    [MemberData(nameof(ContactAccept))]
    public void AContactEmailOfTheSharedCasesIsAccepted(string email) =>
        SiteLinks.IsContactEmail(email).ShouldBeTrue(email);

    [Theory]
    [MemberData(nameof(ContactRefuse))]
    public void AContactEmailOutsideTheRuleIsRefused(string email) =>
        SiteLinks.IsContactEmail(email).ShouldBeFalse(email);

    private static TheoryData<string> Strings(string rule, string kind)
    {
        var data = new TheoryData<string>();
        foreach (var item in File.Value.RootElement.GetProperty(rule).GetProperty(kind).EnumerateArray())
        {
            data.Add(item.GetString()!);
        }

        return data;
    }

    private static JsonDocument Load() =>
        JsonDocument.Parse(System.IO.File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixtures", "email-cases.json")));
}

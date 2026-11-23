using System.Text.Json;
using Csps.Domain.Content;
using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Content;

/// <summary>
/// D-42 and the quote form: the shop and alerts email rule, and the plain-address rule of the public quote form, are checked here
/// against the cases the web zod tests also read (tests/fixtures/email-cases.json). The file is only read here.
/// </summary>
public sealed class EmailCasesTests
{
    private static readonly Lazy<JsonDocument> File = new(Load);

    /// <summary>Every accepted shop or alerts email.</summary>
    public static TheoryData<string> ContactAccept => Strings("contactEmail", "accept");

    /// <summary>Every refused shop or alerts email.</summary>
    public static TheoryData<string> ContactRefuse => Strings("contactEmail", "refuse");

    /// <summary>Every accepted quote form email.</summary>
    public static TheoryData<string> QuoteAccept => Strings("quoteEmail", "accept");

    /// <summary>Every refused quote form email.</summary>
    public static TheoryData<string> QuoteRefuse => Strings("quoteEmail", "refuse");

    /// <summary>Quote form emails the server allows and the browser refuses.</summary>
    public static TheoryData<string> QuoteBrowserOnlyRefuse => Strings("quoteEmail", "browserOnlyRefuse");

    [Theory]
    [MemberData(nameof(ContactAccept))]
    public void AContactEmailOfTheSharedCasesIsAccepted(string email) =>
        SiteLinks.IsContactEmail(email).ShouldBeTrue(email);

    [Theory]
    [MemberData(nameof(ContactRefuse))]
    public void AContactEmailOutsideTheRuleIsRefused(string email) =>
        SiteLinks.IsContactEmail(email).ShouldBeFalse(email);

    [Theory]
    [MemberData(nameof(QuoteAccept))]
    public void AQuoteEmailOfTheSharedCasesIsAccepted(string email) =>
        OrderRules.IsValidEmail(email).ShouldBeTrue(email);

    [Theory]
    [MemberData(nameof(QuoteRefuse))]
    public void AQuoteEmailOutsideTheRuleIsRefused(string email) =>
        OrderRules.IsValidEmail(email).ShouldBeFalse(email);

    [Theory]
    [MemberData(nameof(QuoteBrowserOnlyRefuse))]
    public void TheServerAllowsWhatOnlyTheBrowserRefuses(string email) =>
        OrderRules.IsValidEmail(email).ShouldBeTrue(email);

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

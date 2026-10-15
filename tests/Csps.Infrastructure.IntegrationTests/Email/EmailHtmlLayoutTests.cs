using System.Buffers.Binary;
using System.Text.RegularExpressions;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.Identity;
using Csps.Domain.Time;
using Csps.Infrastructure.Email;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.IntegrationTests.Email;

/// <summary>D-30, D-08, D-32: the sign-in code email is the UI-SPEC branded frame, with an inline logo and nothing remote.</summary>
public sealed partial class EmailHtmlLayoutTests
{
    private const string BaseUrl = "https://carmens.example.com";

    // 07:42 UTC is 3:42 PM at +08:00, the business zone offset.
    private static readonly DateTimeOffset At = new(2026, 10, 14, 7, 42, 0, TimeSpan.Zero);

    [Fact]
    public async Task CodeEmailIsTheBrandedFrameWithTheDocumentHeadAndAPreheader()
    {
        var html = (await RenderCodeAsync()).Html;

        html.ShouldStartWith("<!doctype html>");
        html.ShouldContain("<html lang=\"en\"");
        html.ShouldContain("<meta name=\"color-scheme\" content=\"light\">");
        html.ShouldContain("<title>482913 is your CSPS sign-in code</title>");
        html.ShouldContain("It works for 15 minutes. Never share it.");
        html.ShouldContain("display:none");
        html.ShouldContain("max-width:600px");
        html.ShouldContain("#f6dfd1");
        html.ShouldContain("#fff6f0");
        html.ShouldContain("height:4px");
        html.ShouldContain("#ff6600");
        html.ShouldContain("text-transform:uppercase");
        html.ShouldContain("Your sign-in code");
        html.ShouldContain("Carmen&#39;s Stitch &amp; Printing Services &middot; This is an automatic email.");
        Regex.Matches(html, "<table\b[^>]*>").ShouldAllBe(match => match.Value.Contains("role=\"presentation\"", StringComparison.Ordinal));
    }

    [Fact]
    public async Task CodeEmailShowsTheCodeInASelectableMonospaceBlockAndSaysWhenAndFromWhere()
    {
        var html = (await RenderCodeAsync()).Html;

        var block = CodeBlock().Match(html);
        block.Success.ShouldBeTrue();
        block.Value.ShouldContain("font-size:32px");
        block.Value.ShouldContain("Consolas");
        block.Value.ShouldContain("letter-spacing:8px");
        block.Value.ShouldNotContain("<a ");
        html.ShouldContain("Requested Oct 14, 2026, 3:42 PM from Chrome on Android.");
    }

    [Fact]
    public async Task CodeEmailHasExactlyOneImageAndItIsTheInlineLogo()
    {
        var html = (await RenderCodeAsync()).Html;

        Regex.Count(html, "<img\b").ShouldBe(1);
        html.ShouldContain("src=\"cid:csps-logo\"");
        html.ShouldContain("alt=\"CSPS — Carmen&#39;s Stitch &amp; Printing Services\"");
        html.ShouldContain("width=\"180\"");
    }

    [Fact]
    public async Task CodeEmailLoadsNothingRemote()
    {
        var html = (await RenderCodeAsync()).Html;

        html.ShouldNotContain("<script");
        html.ShouldNotContain("<link");
        html.ShouldNotContain("@import");
        html.ShouldNotContain("url(");
        html.ShouldNotContain("http://");
        Regex.Matches(html, "src=\"([^\"]*)\"").Select(match => match.Groups[1].Value).ShouldBe(["cid:csps-logo"]);
        Regex.Matches(html, "href=\"([^\"]*)\"").Select(match => match.Groups[1].Value).ShouldBe([$"{BaseUrl}/admin/forgot-password"]);
    }

    [Fact]
    public async Task CodeEmailStillReadsAsPlainTextWithTheSameWords()
    {
        var text = (await RenderCodeAsync()).Text;

        text.ShouldContain("Your sign-in code");
        text.ShouldContain("482913");
        text.ShouldContain("Enter this code on the CSPS sign-in screen. It works for 15 minutes and only once.");
        text.ShouldContain("Requested Oct 14, 2026, 3:42 PM from Chrome on Android.");
    }

    [Fact]
    public void LogoIsA360PixelWidePng()
    {
        var png = EmailHtmlLayout.LogoPng();

        png.AsSpan(0, 8).SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }).ShouldBeTrue();
        BinaryPrimitives.ReadInt32BigEndian(png.AsSpan(16, 4)).ShouldBe(360);
    }

    [GeneratedRegex("<td[^>]*font-size:32px[^>]*>.*?</td>", RegexOptions.Singleline)]
    private static partial Regex CodeBlock();

    private static async Task<RenderedEmail> RenderCodeAsync()
    {
        var links = Options.Create(new AppLinksOptions { PublicBaseUrl = BaseUrl });
        var renderer = new EmailRenderer(new FixedCalendar(), links);
        var email = new SignInCodeEmail("paolo.garcia@gmail.com", "482913", At.AddMinutes(15), At, new DeviceDescription("Chrome on Android", true));
        return await renderer.RenderAsync(email, TestContext.Current.CancellationToken);
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken)
        {
            var zone = TimeZoneInfo.CreateCustomTimeZone("business", TimeSpan.FromHours(8), "business", "business");
            return ValueTask.FromResult(new BusinessClock(zone, ZoneSource.Stored, At));
        }
    }
}

using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.Identity;
using Csps.Domain.Time;
using Csps.Infrastructure.Email;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.IntegrationTests.Email;

/// <summary>AUTH-02, D-08, D-32: the sign-in code email's subject, text and HTML, in business time with every value encoded.</summary>
public sealed class SignInCodeEmailRenderTests
{
    // 08:00 UTC is 4:00 PM at +08:00, the business zone offset.
    private static readonly DateTimeOffset RequestedAt = new(2026, 10, 14, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task CodeEmailCarriesTheCodeInTheSubjectAndTheRequestInBusinessTime()
    {
        var rendered = await RenderAsync(Code("048213", new DeviceDescription("Chrome on Android", true)));

        rendered.Subject.ShouldBe("048213 is your CSPS sign-in code");
        rendered.Text.ShouldContain("Your sign-in code");
        rendered.Text.ShouldContain("048213");
        rendered.Text.ShouldContain("Enter this code on the CSPS sign-in screen. It works for 15 minutes and only once.");
        rendered.Text.ShouldContain("Requested Oct 14, 2026, 4:00 PM from Chrome on Android.");
        rendered.Text.ShouldContain("Didn't try to sign in? Someone may know your password. Reset it now from the sign-in page: https://carmens.example.com/admin/forgot-password");
        rendered.Text.ShouldContain("Replies to this address aren't read.");
        rendered.Html.ShouldContain("<title>048213 is your CSPS sign-in code</title>");
        rendered.Html.ShouldContain("Requested Oct 14, 2026, 4:00 PM from Chrome on Android.");
        rendered.Html.ShouldContain("href=\"https://carmens.example.com/admin/forgot-password\"");
        rendered.Html.ShouldContain("It works for 15 minutes. Never share it.");
    }

    [Fact]
    public async Task UnknownBrowserReadsAsAnUnknownBrowser()
    {
        var rendered = await RenderAsync(Code("048213", new DeviceDescription("Unknown browser", false)));

        rendered.Text.ShouldContain("Requested Oct 14, 2026, 4:00 PM from an unknown browser.");
        rendered.Html.ShouldContain("from an unknown browser.");
    }

    [Fact]
    public async Task ValuesAreHtmlEncodedAndNoRemoteResourceIsLoaded()
    {
        var rendered = await RenderAsync(Code("<b>&", new DeviceDescription("<script>alert(1)</script>", true)));

        rendered.Html.ShouldNotContain("<b>&");
        rendered.Html.ShouldNotContain("<script>");
        rendered.Html.ShouldContain("&lt;b&gt;&amp;");
        rendered.Html.ShouldContain("&lt;script&gt;");
        rendered.Html.ShouldNotContain("<script");
        rendered.Html.ShouldNotContain("url(");
        rendered.Html.ShouldNotContain("http://");
    }

    private static SignInCodeEmail Code(string code, DeviceDescription device) =>
        new("paolo.garcia@gmail.com", code, RequestedAt.AddMinutes(15), RequestedAt, device);

    private static async Task<RenderedEmail> RenderAsync(AuthEmail email)
    {
        var links = Options.Create(new AppLinksOptions { PublicBaseUrl = "https://carmens.example.com" });
        var renderer = new EmailRenderer(new FixedCalendar(), links);
        return await renderer.RenderAsync(email, TestContext.Current.CancellationToken);
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken)
        {
            var zone = TimeZoneInfo.CreateCustomTimeZone("business", TimeSpan.FromHours(8), "business", "business");
            return ValueTask.FromResult(new BusinessClock(zone, ZoneSource.Stored, RequestedAt));
        }
    }
}

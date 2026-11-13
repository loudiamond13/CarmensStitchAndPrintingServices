using System.Net.Mime;
using System.Security.Cryptography;
using System.Text;
using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Infrastructure.Email;
using Csps.Server.Http;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Primitives;
using Microsoft.Net.Http.Headers;

namespace Csps.Server.Endpoints;

/// <summary>
/// The shaped shell endpoint (PUB-01, PUB-04). Link-preview crawlers never run JavaScript, so the page's own head and
/// its real status must come from the first response. It fills the marked block of the built <c>index.html</c> with the
/// head for the matched route: 200 for a known page, the admin app and (where they exist) dev paths, 404 with the shell
/// for anything else. Admin and 404 are <c>noindex</c>.
/// </summary>
public static class ShellPage
{
    /// <summary>
    /// Writes the shell for the request path. <c>MapFallback</c> alone would match every method, so the mapping adds
    /// GET and HEAD metadata and any other method meets the default-deny policy (L-01). HEAD gets the status and the
    /// headers with no body.
    /// </summary>
    /// <param name="context">The request.</param>
    /// <returns>A task that completes when the response is written.</returns>
    public static Task WriteAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        return context.RequestServices.GetRequiredService<ShellRenderer>().WriteAsync(context);
    }
}

/// <summary>The built <c>index.html</c>, split at the head markers.</summary>
/// <param name="Before">Everything before the opening marker.</param>
/// <param name="DefaultHead">The template's own head block between the markers.</param>
/// <param name="After">Everything after the closing marker.</param>
internal sealed record ShellTemplateParts(string Before, string DefaultHead, string After);

/// <summary>
/// Reads the built <c>index.html</c> once and keeps it. In Development it reads again when the file changes. A template
/// without both markers cannot be shaped, so <see cref="Get"/> gives its parts with an empty head block and the page
/// is sent as built.
/// </summary>
internal sealed class ShellTemplate : IDisposable
{
    internal const string OpenMarker = "<!--csps:head-->";
    internal const string CloseMarker = "<!--/csps:head-->";

    private readonly IWebHostEnvironment _environment;
    private readonly Lock _gate = new();
    private ShellTemplateParts? _parts;
    private IDisposable? _watch;

    public ShellTemplate(IWebHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(environment);
        _environment = environment;
    }

    /// <summary>Returns the template, or null when the web root has no <c>index.html</c>.</summary>
    public ShellTemplateParts? Get()
    {
        var cached = Volatile.Read(ref _parts);
        if (cached is not null)
        {
            return cached;
        }

        lock (_gate)
        {
            var provider = _environment.WebRootFileProvider;
            var file = provider.GetFileInfo(SpaHosting.ShellFile);
            if (!file.Exists)
            {
                return null;
            }

            using var stream = file.CreateReadStream();
            using var reader = new StreamReader(stream, Encoding.UTF8);
            var parts = Split(reader.ReadToEnd());
            _parts = parts;
            if (_environment.IsDevelopment() && _watch is null)
            {
                _watch = ChangeToken.OnChange(() => provider.Watch(SpaHosting.ShellFile), Reset);
            }

            return parts;
        }
    }

    public void Dispose() => _watch?.Dispose();

    internal static ShellTemplateParts Split(string html)
    {
        var open = html.IndexOf(OpenMarker, StringComparison.Ordinal);
        var close = html.IndexOf(CloseMarker, StringComparison.Ordinal);
        if (open < 0 || close < open)
        {
            return new ShellTemplateParts(html, string.Empty, string.Empty);
        }

        return new ShellTemplateParts(
            html[..open],
            html[(open + OpenMarker.Length)..close].Trim(),
            html[(close + CloseMarker.Length)..]);
    }

    private void Reset()
    {
        lock (_gate)
        {
            _parts = null;
        }
    }
}

/// <summary>Builds and writes the shell response for one request (see <see cref="ShellPage"/>).</summary>
internal sealed partial class ShellRenderer(
    ShellTemplate template,
    IOptions<AppLinksOptions> links,
    IWebHostEnvironment environment,
    IPublicContentReader reader,
    HybridCache cache,
    ILogger<ShellRenderer> logger)
{
    private const string RobotsHeader = "X-Robots-Tag";

    private const string NotFoundKey = "notfound";

    private static readonly string[] Tags = [PublicCacheTags.PublicContent];

    // Within the hour, so date-relative parts (the year in the boot data) refresh without a write; a content change clears the entries at once.
    private static readonly HybridCacheEntryOptions HeadCacheOptions = new()
    {
        Expiration = TimeSpan.FromHours(1),
        LocalCacheExpiration = TimeSpan.FromHours(1),
    };

    // 1 while the last content read failed, so an outage logs one event, not one per request.
    private int _settingsFailing;

    // The same for the product lines read.
    private int _linesFailing;

    // The same for the Home read.
    private int _homeFailing;

    // The same for the Gallery read.
    private int _galleryFailing;

    public async Task WriteAsync(HttpContext context)
    {
        var parts = template.Get();
        if (parts is null)
        {
            await WriteMissingTemplateAsync(context).ConfigureAwait(false);
            return;
        }

        var devRoutesKnown = environment.IsDevelopment() || environment.IsEnvironment("Testing");
        var match = PublicRouteTable.Match(context.Request.Path, devRoutesKnown);
        var html = parts.Before + await HeadAsync(context, match, parts).ConfigureAwait(false) + parts.After;
        var bytes = Encoding.UTF8.GetBytes(html);

        var response = context.Response;
        var found = match.Kind != PublicRouteKind.NotFound;
        response.StatusCode = found ? StatusCodes.Status200OK : StatusCodes.Status404NotFound;
        response.ContentType = "text/html; charset=utf-8";
        response.Headers[HeaderNames.CacheControl] = "no-cache";
        if (match.Kind == PublicRouteKind.Admin)
        {
            response.Headers[RobotsHeader] = PublicHeadWriter.NoIndexValue;
        }

        // Weak: the body is compressed after the tag is set, so br, gzip and identity are not byte-identical.
        var etag = new EntityTagHeaderValue($"\"{Convert.ToHexString(SHA256.HashData(bytes))[..32]}\"", isWeak: true);
        response.GetTypedHeaders().ETag = etag;
        if (found && EntityTags.Matches(context.Request, etag))
        {
            response.StatusCode = StatusCodes.Status304NotModified;
            response.ContentType = null;
            return;
        }

        if (!HttpMethods.IsHead(context.Request.Method))
        {
            await response.Body.WriteAsync(bytes, context.RequestAborted).ConfigureAwait(false);
        }
    }

    private async Task<string> HeadAsync(HttpContext context, PublicRouteMatch match, ShellTemplateParts parts)
    {
        switch (match.Kind)
        {
            case PublicRouteKind.Page:
            case PublicRouteKind.NotFound:
                return await PublicHeadAsync(context, match, parts).ConfigureAwait(false);

            case PublicRouteKind.Admin:
                var head = new StringBuilder(parts.DefaultHead);
                PublicHeadWriter.AppendRobots(head);
                return head.ToString();

            default:
                return parts.DefaultHead;
        }
    }

    // A public page or the 404 shell. The shaped head is cached per page under the public-content tag. When the content cannot be read,
    // a page is sent with the template's own head and the 404 with its own title; neither carries data blocks, and the failure is never cached.
    private async Task<string> PublicHeadAsync(HttpContext context, PublicRouteMatch match, ShellTemplateParts parts)
    {
        var snapshot = await ReadSiteAsync(context).ConfigureAwait(false);
        if (snapshot is null)
        {
            return match.Kind == PublicRouteKind.Page ? parts.DefaultHead : NotFoundHead(boot: null);
        }

        var origin = links.Value.PublicBaseUrl.TrimEnd('/');

        // The Products page also carries the product lines and the Home page the Home data. When they cannot be read, the page keeps the
        // site data and the head is not cached, so the next visit tries again.
        string? linesJson = null;
        string? shareImage = null;
        string? homeJson = null;
        var siteImage = AbsoluteAddress(origin, snapshot.ShareImageUrl);
        if (match.Kind == PublicRouteKind.Page && match.Page == PublicPage.Products)
        {
            var lines = await ReadLinesAsync(context).ConfigureAwait(false);
            if (lines is null)
            {
                return ShapedHead(snapshot, match, origin, linesJson: null, shareImage: siteImage, homeJson: null, siteImage);
            }

            linesJson = lines.Json.Json;
            shareImage = AbsoluteAddress(origin, lines.ShareImageUrl) ?? siteImage;
        }
        else if (match.Kind == PublicRouteKind.Page && match.Page == PublicPage.Gallery)
        {
            // The Gallery fetches its items, so only the link preview picture comes from the read.
            var gallery = await ReadGalleryAsync(context).ConfigureAwait(false);
            if (gallery is null)
            {
                return ShapedHead(snapshot, match, origin, linesJson: null, shareImage: siteImage, homeJson: null, siteImage);
            }

            shareImage = AbsoluteAddress(origin, gallery.ShareImageUrl) ?? siteImage;
        }
        else if (match.Kind == PublicRouteKind.Page && match.Page == PublicPage.Home)
        {
            var home = await ReadHomeAsync(context).ConfigureAwait(false);
            if (home is null)
            {
                return ShapedHead(snapshot, match, origin, linesJson: null, shareImage: siteImage, homeJson: null, siteImage);
            }

            homeJson = home.Json.Json;
            shareImage = siteImage;
        }
        else
        {
            // Contact and the 404 have no picture of their own, so they carry the default one.
            shareImage = siteImage;
        }

        var key = $"csps:shell:{(match.Kind == PublicRouteKind.Page ? match.Page!.Value.ToString().ToLowerInvariant() : NotFoundKey)}:v1";
        return await cache.GetOrCreateAsync(
            key,
            (snapshot, match, origin, linesJson, shareImage, homeJson, siteImage),
            static (state, _) => ValueTask.FromResult(ShapedHead(state.snapshot, state.match, state.origin, state.linesJson, state.shareImage, state.homeJson, state.siteImage)),
            HeadCacheOptions,
            Tags,
            context.RequestAborted).ConfigureAwait(false);
    }

    // A Cloudinary address is already absolute; the Testing image route is a path on this site, so it gets the site's own origin.
    private static string? AbsoluteAddress(string origin, string? address) =>
        address is { Length: > 0 } && address[0] == '/' ? origin + address : address;

    private static string ShapedHead(PublicSiteSnapshot snapshot, PublicRouteMatch match, string origin, string? linesJson, string? shareImage, string? homeJson, string? siteImage)
    {
        var boot = PublicHeadWriter.BootData(snapshot.Json.Json, linesJson, homeJson);
        if (match.Kind == PublicRouteKind.NotFound)
        {
            return NotFoundHead(boot, snapshot.Site.BusinessName, shareImage);
        }

        var site = snapshot.Site;
        var page = PublicPageHeads.For(match.Page!.Value, site.Tagline);
        var head = new StringBuilder();
        PublicHeadWriter.Write(
            head,
            new PublicHeadModel(
                page.Title,
                page.Description,
                origin + match.CanonicalPath,
                site.BusinessName,
                NoIndex: false,
                JsonLd: PublicHeadWriter.LocalBusinessJsonLd(site, snapshot.Closures, origin, siteImage),
                BootJson: boot,
                ShareImageUrl: shareImage));
        return head.ToString();
    }

    private static string NotFoundHead(string? boot, string? siteName = null, string? shareImage = null)
    {
        var notFound = PublicPageHeads.NotFound;
        var head = new StringBuilder();
        PublicHeadWriter.Write(head, new PublicHeadModel(notFound.Title, notFound.Description, null, siteName, NoIndex: true, BootJson: boot, ShareImageUrl: shareImage));
        return head.ToString();
    }

    // Null when the content cannot be read.
    private async Task<PublicSiteSnapshot?> ReadSiteAsync(HttpContext context)
    {
        try
        {
            var snapshot = await reader.GetSiteAsync(context.RequestAborted).ConfigureAwait(false);
            Interlocked.Exchange(ref _settingsFailing, 0);
            return snapshot;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            if (Interlocked.Exchange(ref _settingsFailing, 1) == 0)
            {
                LogSettingsFailed(exception);
            }

            return null;
        }
    }

    // Null when the product lines cannot be read.
    private async Task<PublicProductLinesSnapshot?> ReadLinesAsync(HttpContext context)
    {
        try
        {
            var snapshot = await reader.GetProductLinesAsync(context.RequestAborted).ConfigureAwait(false);
            Interlocked.Exchange(ref _linesFailing, 0);
            return snapshot;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            if (Interlocked.Exchange(ref _linesFailing, 1) == 0)
            {
                LogLinesFailed(exception);
            }

            return null;
        }
    }

    // Null when the Gallery cannot be read.
    private async Task<PublicGallerySnapshot?> ReadGalleryAsync(HttpContext context)
    {
        try
        {
            var snapshot = await reader.GetGalleryAsync(context.RequestAborted).ConfigureAwait(false);
            Interlocked.Exchange(ref _galleryFailing, 0);
            return snapshot;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            if (Interlocked.Exchange(ref _galleryFailing, 1) == 0)
            {
                LogGalleryFailed(exception);
            }

            return null;
        }
    }

    // Null when the Home data cannot be read.
    private async Task<PublicHomeSnapshot?> ReadHomeAsync(HttpContext context)
    {
        try
        {
            var snapshot = await reader.GetHomeAsync(context.RequestAborted).ConfigureAwait(false);
            Interlocked.Exchange(ref _homeFailing, 0);
            return snapshot;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            if (Interlocked.Exchange(ref _homeFailing, 1) == 0)
            {
                LogHomeFailed(exception);
            }

            return null;
        }
    }

    private static Task WriteMissingTemplateAsync(HttpContext context)
    {
        if (HttpMethods.IsHead(context.Request.Method))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            context.Response.ContentType = MediaTypeNames.Application.ProblemJson;
            return Task.CompletedTask;
        }

        return CspsProblemDetails.WriteAsync(context, StatusCodes.Status404NotFound);
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "The site settings could not be read, so the shell page is sent with the plain template head")]
    private partial void LogSettingsFailed(Exception exception);

    [LoggerMessage(Level = LogLevel.Warning, Message = "The product lines could not be read, so the Products page is sent without them")]
    private partial void LogLinesFailed(Exception exception);

    [LoggerMessage(Level = LogLevel.Warning, Message = "The Home data could not be read, so the Home page is sent without it")]
    private partial void LogHomeFailed(Exception exception);

    [LoggerMessage(Level = LogLevel.Warning, Message = "The Gallery could not be read, so the Gallery page is sent without a link preview picture")]
    private partial void LogGalleryFailed(Exception exception);
}

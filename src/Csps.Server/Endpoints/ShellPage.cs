using System.Net.Mime;
using System.Security.Cryptography;
using System.Text;
using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Infrastructure.Email;
using Csps.Server.Http;
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
    ILogger<ShellRenderer> logger)
{
    private const string RobotsHeader = "X-Robots-Tag";

    // 1 while the last settings read failed, so an outage logs one event, not one per request.
    private int _settingsFailing;

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
        var head = new StringBuilder();
        switch (match.Kind)
        {
            case PublicRouteKind.Page:
                var model = await PageModelAsync(context, match).ConfigureAwait(false);
                if (model is null)
                {
                    head.Append(parts.DefaultHead);
                }
                else
                {
                    PublicHeadWriter.Write(head, model);
                }

                break;

            case PublicRouteKind.NotFound:
                var notFound = PublicPageHeads.NotFound;
                PublicHeadWriter.Write(head, new PublicHeadModel(notFound.Title, notFound.Description, null, null, NoIndex: true));
                break;

            case PublicRouteKind.Admin:
                head.Append(parts.DefaultHead);
                PublicHeadWriter.AppendRobots(head);
                break;

            default:
                head.Append(parts.DefaultHead);
                break;
        }

        return head.ToString();
    }

    // Null when the settings cannot be read: the caller then sends the template's own head.
    private async Task<PublicHeadModel?> PageModelAsync(HttpContext context, PublicRouteMatch match)
    {
        PublicSiteDto site;
        try
        {
            site = (await context.RequestServices.GetRequiredService<IPublicContentReader>()
                .GetSiteAsync(context.RequestAborted).ConfigureAwait(false)).Site;
            Interlocked.Exchange(ref _settingsFailing, 0);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            if (Interlocked.Exchange(ref _settingsFailing, 1) == 0)
            {
                LogSettingsFailed(exception);
            }

            return null;
        }

        var origin = links.Value.PublicBaseUrl.TrimEnd('/');
        var head = PublicPageHeads.For(match.Page!.Value, site.Tagline);
        return new PublicHeadModel(head.Title, head.Description, origin + match.CanonicalPath, site.BusinessName, NoIndex: false);
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
}

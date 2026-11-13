using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;
using Microsoft.Net.Http.Headers;

namespace Csps.Server.Http;

/// <summary>
/// Serves the build-time Brotli twin of a static asset (D-28, D-46, plan 11-36). The web build writes <c>name.js.br</c> next to
/// every <c>.js</c>, <c>.css</c> and <c>.svg</c> over 1 KB at the best compression level. When a GET or HEAD names such an asset
/// and the browser lists <c>br</c> in <c>Accept-Encoding</c>, the static file step is pointed at the twin, which answers with
/// <c>Content-Encoding: br</c> and the original content type. Every other client gets the plain file, and the host's own
/// response compression may still gzip it: Facebook's link-preview crawler accepts only gzip and deflate. A response that
/// already has a <c>Content-Encoding</c> is never compressed again (T-11-87, T-11-88).
/// </summary>
public static class PrecompressedStaticFiles
{
    internal const string Suffix = ".br";

    /// <summary>Marks a request that was pointed at a <c>.br</c> twin, so the file response gets its encoding header.</summary>
    internal const string ItemKey = "Csps.PrecompressedStaticFile";

    private static readonly string[] Extensions = [".js", ".css", ".svg"];

    /// <summary>Adds the precompressed-file step. Call it right before <c>UseStaticFiles</c>.</summary>
    /// <param name="app">The web application.</param>
    /// <returns>The same web application.</returns>
    public static WebApplication UsePrecompressedStaticFiles(this WebApplication app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var files = app.Environment.WebRootFileProvider;
        app.Use((context, next) => InvokeAsync(context, next, files));
        return app;
    }

    /// <summary>Adds <c>Content-Encoding: br</c> to a static file response that was served from a <c>.br</c> twin.</summary>
    /// <param name="context">The HTTP context of the file response being prepared.</param>
    internal static void ApplyEncoding(HttpContext context)
    {
        if (context.Items.ContainsKey(ItemKey))
        {
            context.Response.Headers.ContentEncoding = "br";
        }
    }

    /// <summary>Maps a <c>.br</c> path to the content type of the file it holds, and every other path as the default provider does.</summary>
    /// <returns>The content type provider for <c>UseStaticFiles</c>.</returns>
    internal static IContentTypeProvider CreateContentTypeProvider() => new TwinContentTypeProvider(new FileExtensionContentTypeProvider());

    private static async Task InvokeAsync(HttpContext context, RequestDelegate next, IFileProvider files)
    {
        var request = context.Request;
        var path = request.Path;
        if ((!HttpMethods.IsGet(request.Method) && !HttpMethods.IsHead(request.Method)) || !path.HasValue)
        {
            await next(context);
            return;
        }

        var value = path.Value ?? string.Empty;
        if (IsFile(files, value) && value.EndsWith(Suffix, StringComparison.OrdinalIgnoreCase))
        {
            // The twin is only ever reached through its asset's own address.
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        if (!HasTwin(files, value))
        {
            await next(context);
            return;
        }

        // The answer depends on Accept-Encoding for this asset, so a shared cache must keep the variants apart.
        AppendVaryAcceptEncoding(context.Response);
        if (!AcceptsBrotli(request))
        {
            await next(context);
            return;
        }

        context.Items[ItemKey] = true;
        request.Path = new PathString(value + Suffix);
        try
        {
            await next(context);
        }
        finally
        {
            request.Path = path;
        }
    }

    private static bool IsFile(IFileProvider files, string path)
    {
        var file = files.GetFileInfo(path);
        return file is { Exists: true, IsDirectory: false };
    }

    private static bool HasTwin(IFileProvider files, string path) =>
        Extensions.Any(extension => path.EndsWith(extension, StringComparison.OrdinalIgnoreCase))
        && IsFile(files, path)
        && IsFile(files, path + Suffix);

    /// <summary>True when <c>br</c> is listed and not refused with <c>q=0</c>. A wildcard alone does not count.</summary>
    private static bool AcceptsBrotli(HttpRequest request) =>
        request.GetTypedHeaders().AcceptEncoding.Any(value =>
            string.Equals(value.Value.Value, "br", StringComparison.OrdinalIgnoreCase) && value.Quality is null or > 0);

    private static void AppendVaryAcceptEncoding(HttpResponse response)
    {
        var listed = response.Headers.GetCommaSeparatedValues(HeaderNames.Vary)
            .Any(value => string.Equals(value, HeaderNames.AcceptEncoding, StringComparison.OrdinalIgnoreCase));
        if (!listed)
        {
            response.Headers.Append(HeaderNames.Vary, HeaderNames.AcceptEncoding);
        }
    }

    private sealed class TwinContentTypeProvider(IContentTypeProvider inner) : IContentTypeProvider
    {
        public bool TryGetContentType(string subpath, out string contentType)
        {
            var name = subpath.EndsWith(Suffix, StringComparison.OrdinalIgnoreCase) ? subpath[..^Suffix.Length] : subpath;
            return inner.TryGetContentType(name, out contentType!);
        }
    }
}

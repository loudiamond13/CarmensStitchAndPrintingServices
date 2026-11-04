using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace Csps.Infrastructure.IntegrationTests.Images;

/// <summary>One request the stub received, with its form fields already read.</summary>
/// <param name="Method">The HTTP method.</param>
/// <param name="Uri">The full address, query included.</param>
/// <param name="Fields">The multipart or form fields by name; the file part is listed as <c>file</c> with its length.</param>
/// <param name="Authorization">The Authorization header value, or null.</param>
internal sealed record StubRequest(HttpMethod Method, Uri Uri, IReadOnlyDictionary<string, string> Fields, string? Authorization);

/// <summary>
/// Stands in for Cloudinary (D-07): records every request and answers from a queue, so no test ever reaches the network.
/// Fake values only; the answers it is given never hold a real key or secret.
/// </summary>
internal sealed partial class StubCloudinaryHandler : HttpMessageHandler
{
    private readonly Queue<Func<HttpResponseMessage>> _replies = new();
    private readonly List<StubRequest> _requests = [];

    /// <summary>Gets the requests received, oldest first.</summary>
    public IReadOnlyList<StubRequest> Requests => _requests;

    /// <summary>Queues an answer with a JSON body.</summary>
    /// <param name="status">The status code.</param>
    /// <param name="json">The body.</param>
    public void Reply(HttpStatusCode status, string json) =>
        _replies.Enqueue(() => new HttpResponseMessage(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") });

    /// <summary>Queues an answer with a plain text body, like a gateway error page.</summary>
    /// <param name="status">The status code.</param>
    /// <param name="text">The body.</param>
    public void ReplyText(HttpStatusCode status, string text) =>
        _replies.Enqueue(() => new HttpResponseMessage(status) { Content = new StringContent(text, Encoding.UTF8, "text/html") });

    /// <summary>Queues a failure thrown by the call, like a timeout or a dropped connection.</summary>
    /// <param name="failure">The exception to throw.</param>
    public void Fail(Exception failure) => _replies.Enqueue(() => throw failure);

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var fields = new Dictionary<string, string>(StringComparer.Ordinal);
        if (request.Content is not null)
        {
            var bytes = await request.Content.ReadAsByteArrayAsync(cancellationToken).ConfigureAwait(false);
            var body = Encoding.Latin1.GetString(bytes);
            var contentType = request.Content.Headers.ContentType?.ToString() ?? string.Empty;
            if (contentType.StartsWith("multipart/", StringComparison.OrdinalIgnoreCase))
            {
                ReadMultipart(body, fields);
            }
            else
            {
                ReadForm(body, fields);
            }
        }

        _requests.Add(new StubRequest(request.Method, request.RequestUri!, fields, request.Headers.Authorization?.ToString()));
        if (!_replies.TryDequeue(out var reply))
        {
            throw new InvalidOperationException("The stub has no answer queued for this request.");
        }

        return reply();
    }

    private static void ReadMultipart(string body, Dictionary<string, string> fields)
    {
        foreach (Match part in MultipartField().Matches(body))
        {
            var name = part.Groups["name"].Value;
            var value = part.Groups["value"].Value;
            fields[name] = part.Groups["file"].Success ? $"{value.Length} bytes" : value;
        }
    }

    private static void ReadForm(string body, Dictionary<string, string> fields)
    {
        foreach (var pair in body.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var index = pair.IndexOf('=', StringComparison.Ordinal);
            var name = index < 0 ? pair : pair[..index];
            var value = index < 0 ? string.Empty : pair[(index + 1)..];
            fields[WebUtility.UrlDecode(name)] = WebUtility.UrlDecode(value);
        }
    }

    [GeneratedRegex("""Content-Disposition: form-data; name="(?<name>[^"]*)"(?<file>; filename="[^"]*")?[^\r\n]*\r\n(?:Content-Type:[^\r\n]*\r\n)?\r\n(?<value>.*?)\r\n--""", RegexOptions.Singleline | RegexOptions.CultureInvariant)]
    private static partial Regex MultipartField();
}

/// <summary>An <see cref="IHttpClientFactory"/> that hands out clients over one handler.</summary>
/// <param name="handler">The handler every client uses.</param>
internal sealed class StubHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
{
    /// <summary>Gets the names the factory was asked for.</summary>
    public List<string> Names { get; } = [];

    public HttpClient CreateClient(string name)
    {
        Names.Add(name);
        return new HttpClient(handler, disposeHandler: false);
    }
}

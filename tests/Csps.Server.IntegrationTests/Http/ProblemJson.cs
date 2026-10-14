using System.Text.Json;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>Reads and checks RFC 9457 ProblemDetails bodies in integration tests.</summary>
internal static class ProblemJson
{
    /// <summary>The media type every API error must use.</summary>
    public const string MediaType = "application/problem+json";

    /// <summary>A W3C trace id: exactly 32 lowercase hex characters (assumption A9).</summary>
    public const string TraceIdPattern = "^[0-9a-f]{32}$";

    /// <summary>Asserts the problem media type and returns the parsed body.</summary>
    /// <param name="response">The HTTP response.</param>
    /// <param name="cancellationToken">The test cancellation token.</param>
    /// <returns>A detached copy of the JSON root element.</returns>
    public static async Task<JsonElement> ReadAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        response.Content.Headers.ContentType.ShouldNotBeNull("an API error must declare its media type").MediaType.ShouldBe(MediaType);
        var text = await response.Content.ReadAsStringAsync(cancellationToken);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    /// <summary>Returns the <c>traceId</c> extension after checking it is a 32-character lowercase hex id.</summary>
    /// <param name="problem">The parsed ProblemDetails body.</param>
    /// <returns>The trace id.</returns>
    public static string TraceId(JsonElement problem)
    {
        var traceId = problem.GetProperty("traceId").GetString().ShouldNotBeNull();
        traceId.ShouldMatch(TraceIdPattern);
        return traceId;
    }
}

using System.Text.Json;
using Csps.Server.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>
/// Executes an <see cref="IResult"/> against a <see cref="DefaultHttpContext"/> whose services hold the same
/// ProblemDetails customization as Program (research Pattern 3 unit-test approach).
/// </summary>
internal sealed class ResultHarness : IDisposable
{
    private readonly ServiceProvider _services = new ServiceCollection()
        .AddLogging()
        .AddProblemDetails(options =>
            options.CustomizeProblemDetails = context => CspsProblemDetails.Apply(context.ProblemDetails, context.HttpContext))
        .BuildServiceProvider();

    /// <summary>Creates a fresh context with a readable response body.</summary>
    /// <returns>The context.</returns>
    public DefaultHttpContext NewContext() => new()
    {
        RequestServices = _services,
        Response = { Body = new MemoryStream() },
    };

    /// <summary>Executes <paramref name="result"/> and returns the written JSON body.</summary>
    /// <param name="result">The result to execute.</param>
    /// <param name="context">A context from <see cref="NewContext"/>.</param>
    /// <returns>The raw body text and its parsed root element.</returns>
    public static async Task<(string Text, JsonElement Json)> ExecuteAsync(IResult result, HttpContext context)
    {
        await result.ExecuteAsync(context);
        context.Response.ContentType.ShouldNotBeNull().ShouldStartWith(ProblemJson.MediaType);
        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body);
        var text = await reader.ReadToEndAsync(TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(text);
        return (text, document.RootElement.Clone());
    }

    /// <inheritdoc />
    public void Dispose() => _services.Dispose();
}

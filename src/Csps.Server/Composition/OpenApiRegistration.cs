using System.Text.Json.Nodes;
using Microsoft.OpenApi;
using Scalar.AspNetCore;

namespace Csps.Server.Composition;

/// <summary>
/// The OpenAPI document and the Scalar viewer, both Development only (D-14). Production registers and maps
/// neither, which also keeps the document generator out of the 256 MB app pool (D-10).
/// </summary>
public static class OpenApiRegistration
{
    /// <summary>Registers the OpenAPI document generator in Development only.</summary>
    /// <param name="services">The service collection.</param>
    /// <param name="environment">The host environment.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsOpenApi(this IServiceCollection services, IHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(environment);

        if (environment.IsDevelopment())
        {
            services.AddOpenApi(options =>
            {
                options.AddOperationTransformer(
                    (operation, context, _) =>
                    {
                        MarkFileFormsAsMultipart(operation, context.Description.ParameterDescriptions.Any(parameter => parameter.Type == typeof(IFormFile)));
                        return Task.CompletedTask;
                    });
                options.AddOperationTransformer(
                    (operation, _, _) =>
                    {
                        RestrictChartMonths(operation);
                        return Task.CompletedTask;
                    });
            });
        }

        return services;
    }

    // A form that carries a file is multipart. The action cannot say so with [Consumes], because that would answer 404 to a request with
    // no content type, so the document is corrected here.
    private static void MarkFileFormsAsMultipart(OpenApiOperation operation, bool hasFile)
    {
        const string UrlEncoded = "application/x-www-form-urlencoded";
        const string Multipart = "multipart/form-data";
        if (hasFile && operation.RequestBody?.Content is { } content && content.Remove(UrlEncoded, out var media))
        {
            content[Multipart] = media;
        }
    }

    // The chart window is 6 or 12 and the query is read as text so a bad value is a plain 400, so the document lists the two values.
    private static void RestrictChartMonths(OpenApiOperation operation)
    {
        if (operation.OperationId == "GetDashboardChart"
            && operation.Parameters?.FirstOrDefault(parameter => parameter.Name == "months")?.Schema is OpenApiSchema schema)
        {
            schema.Enum = [JsonValue.Create("6"), JsonValue.Create("12")];
        }
    }

    /// <summary>
    /// Maps <c>/openapi/v1.json</c> and <c>/scalar</c> in Development only. Scalar serves its bundle from embedded
    /// resources, loads no CDN fonts, sends no telemetry, and stamps a per-request nonce on its inline scripts that
    /// <see cref="Http.SecurityHeadersMiddleware"/> puts in the Development carve-out CSP.
    /// </summary>
    /// <param name="app">The web application.</param>
    /// <returns>The same application.</returns>
    public static WebApplication MapCspsApiDocs(this WebApplication app)
    {
        ArgumentNullException.ThrowIfNull(app);

        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi().AllowAnonymous();
            app.MapScalarApiReference(options => options.WithNonce().DisableDefaultFonts().DisableTelemetry()).AllowAnonymous();
        }

        return app;
    }
}

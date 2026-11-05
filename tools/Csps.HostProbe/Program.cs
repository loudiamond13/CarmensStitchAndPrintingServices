using Csps.HostProbe;

// Throwaway FND-13 host probe (D-09, D-28). Only GET /probe exists. It answers 503 when no key of 32+ characters is
// configured, 401 without a matching X-Probe-Key header, and the host facts as JSON otherwise. Every response is
// no-store with an empty body unless the key matched. Owner steps: README.md.
var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

var app = builder.Build();

app.MapGet("/probe", (HttpContext context, IConfiguration configuration, IHostEnvironment environment) =>
{
    context.Response.Headers.CacheControl = "no-store";

    var configured = configuration[ProbeKey.ConfigurationKey];
    if (!ProbeKey.IsConfigured(configured))
    {
        return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
    }

    string? provided = context.Request.Headers[ProbeKey.HeaderName];
    if (!ProbeKey.Matches(provided, configured))
    {
        return Results.StatusCode(StatusCodes.Status401Unauthorized);
    }

    return Results.Json(HostFacts.Collect(context, environment, TimeProvider.System));
});

await app.RunAsync().ConfigureAwait(false);

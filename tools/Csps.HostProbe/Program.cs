using Csps.HostProbe;
using Csps.Infrastructure.Maintenance;

// Throwaway FND-13 host probe (D-09, D-28). GET /probe and POST /probe/backup (D-42) exist. Both answer 503 when no key
// of 32+ characters is configured, 401 without a matching X-Probe-Key header, and their facts as JSON otherwise. Every
// response is no-store with an empty body unless the key matched. Owner steps: README.md.
var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

var app = builder.Build();

app.MapGet("/probe", (HttpContext context, IConfiguration configuration, IHostEnvironment environment) =>
{
    context.Response.Headers.CacheControl = "no-store";

    var denied = Denied(context, configuration);
    return denied ?? Results.Json(HostFacts.Collect(context, environment, TimeProvider.System));
});

app.MapPost("/probe/backup", async (HttpContext context, IConfiguration configuration, IHostEnvironment environment, CancellationToken cancellationToken) =>
{
    context.Response.Headers.CacheControl = "no-store";

    var denied = Denied(context, configuration);
    if (denied is not null)
    {
        return denied;
    }

    var facts = await BackupCheck.RunAsync(
        BackupSettings.From(configuration),
        environment.ContentRootPath,
        SqlServerBackupStatement.RunAsync,
        TimeProvider.System,
        cancellationToken).ConfigureAwait(false);
    return Results.Json(facts);
});

await app.RunAsync().ConfigureAwait(false);

// Null lets the request through; otherwise the empty 503 or 401 answer.
static IResult? Denied(HttpContext context, IConfiguration configuration)
{
    string? provided = context.Request.Headers[ProbeKey.HeaderName];
    var status = ProbeKey.DeniedStatusCode(provided, configuration[ProbeKey.ConfigurationKey]);
    return status is null ? null : Results.StatusCode(status.Value);
}

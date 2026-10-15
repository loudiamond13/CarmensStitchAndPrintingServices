using Csps.Application.Ports;
using Csps.Infrastructure;
using Csps.Server.Composition;
using Csps.Server.Endpoints;
using Csps.Server.Http;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Serilog with the request's W3C trace id on every event; files under {contentRoot}/logs (FND-07, D-21, D-22).
builder.Services.AddCspsLogging(builder.Configuration, builder.Environment);

// No "Server: Kestrel" banner (SEC-01); IIS removes its own through web.config. 1 MB body cap on Kestrel (SEC-03).
builder.WebHost.ConfigureKestrel(options =>
{
    options.AddServerHeader = false;
    options.Limits.MaxRequestBodySize = RequestBodyLimitMiddleware.MaxBytes;
});

// The same 1 MB cap for IIS in-process; web.config requestFiltering is the IIS-level twin (SEC-03).
builder.Services.Configure<IISServerOptions>(options => options.MaxRequestBodySize = RequestBodyLimitMiddleware.MaxBytes);

// Plain HTTP is redirected to HTTPS on the real host. Development and the "Testing" integration-test environment
// (CspsApiFactory.EnvironmentName) are exempt so they can exercise both transports.
var redirectToHttps = !builder.Environment.IsDevelopment() && !builder.Environment.IsEnvironment("Testing");
if (redirectToHttps)
{
    builder.Services.AddHttpsRedirection(options => options.HttpsPort = 443);
}

// Every ProblemDetails the framework creates gets the CSPS title, traceId and 5xx rules (FND-05, D-26, D-27).
builder.Services.AddProblemDetails(options =>
    options.CustomizeProblemDetails = context => CspsProblemDetails.Apply(context.ProblemDetails, context.HttpContext));

builder.Services
    .AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy());

// Request facts for Application code (user, connection IP, User-Agent, correlation id). No forwarded headers until
// the FND-13 hosting record proves the proxy topology (research Pitfall 17).
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IRequestContext, HttpRequestContext>();

// Composes EF Core, the cache and the ports. Never migrates or seeds at startup (D-08).
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);

// Access-token validation (JwtBearer) and default-deny authorization: a fallback policy that requires an authenticated
// user plus the named Staff and Manager policies (SEC-02). The API refuses to start without valid Jwt settings.
builder.Services.AddCspsSecurity();

// One handler per use case, no mediator (PRD section 3.3).
builder.Services.AddCspsApplication();

// Controllers (owner rule 2026-10-07). Model-state 400s are off: validation is FluentValidation in the handlers.
var mvc = builder.Services.AddControllers().ConfigureApiBehaviorOptions(options => options.SuppressModelStateInvalidFilter = true);

#if CSPS_TESTING
// Debug builds only: the Testing-only controllers exist in the Testing environment alone, and a Debug build never runs as
// Production (QUAL-05, D-37).
Csps.Server.Testing.TestingHostRegistration.AddTestingFeatures(mvc, builder);
#endif

// OpenAPI is registered in Development only (D-14).
builder.Services.AddCspsOpenApi(builder.Environment);

// Brotli/gzip for the SPA's static html, css, js and svg only; JSON is never compressed (PERF-02, BREACH).
builder.Services.AddCspsSpaHosting();

var app = builder.Build();

// The web root itself hides paths with a dot or tilde segment (build internals such as .vite/license.md, 8.3 aliases):
// they read as missing and get the file 404 (L-04). Wrapped once, before any middleware, so every consumer of the web
// root (static files, the shell fallback, any service reading IWebHostEnvironment) gets the same rule (NET-WR-03).
app.Environment.WebRootFileProvider = new HiddenSegmentFileProvider(app.Environment.WebRootFileProvider);

// Outermost: its OnStarting callback covers redirect, exception-handler and status-code-page responses too (SEC-01).
app.UseMiddleware<SecurityHeadersMiddleware>();

// Refuses bodies above 1 MB with a 413 before anything else reads them (SEC-03).
app.UseMiddleware<RequestBodyLimitMiddleware>();

if (redirectToHttps)
{
    app.UseHttpsRedirection();
}

// Unhandled exceptions become a generic 500 with a reference, never exception text (D-27).
app.UseExceptionHandler(new ExceptionHandlerOptions
{
    ExceptionHandler = static context => CspsProblemDetails.WriteAsync(context, StatusCodes.Status500InternalServerError),
});

// Empty error responses (404, 405, ...) become ProblemDetails, written as JSON whatever the Accept header says.
app.UseStatusCodePages(static context => CspsProblemDetails.WriteAsync(context.HttpContext, context.HttpContext.Response.StatusCode));

// One completion event per request: method, path (no query string), status and elapsed time. It writes through this
// host's own logger, never the process-wide static one, and never logs headers or bodies (FND-07). It runs before
// static files, which end the request without calling the next middleware, so asset requests are logged too.
var requestLogger = app.Services.GetRequiredService<Serilog.ILogger>();
app.UseSerilogRequestLogging(options => options.Logger = requestLogger);

// Compresses the static text below (and the shell) when the browser accepts it; the MIME list excludes JSON (PERF-02).
app.UseResponseCompression();

// The built React app's files from the (wrapped) web root, anonymously and before authorization (WEB-01). Hashed
// /assets/* files are cached as immutable, everything else revalidates (PERF-02).
app.UseStaticFiles(new StaticFileOptions { OnPrepareResponse = SpaCaching.Apply });

// Explicit, so static files run before endpoint matching and the SPA fallbacks never shadow a real file (WEB-01).
app.UseRouting();

// Inside status-code pages, so an empty 401 challenge or 403 forbid becomes a ProblemDetails (FND-05).
app.UseAuthentication();
app.UseAuthorization();

app.MapCspsHealth();
app.MapApiFallback();
app.MapControllers();
app.MapCspsApiDocs();

// The SPA host (WEB-01): a missing file is a 404, never a 401 (research Pitfall 11); outside Development /openapi and
// /scalar stay reserved 404s (D-29); any other GET or HEAD on a page path gets the shell, anonymously.
app.MapSpaHost();

app.Run();

/// <summary>Composition root of the CSPS API. Public so <c>WebApplicationFactory&lt;Program&gt;</c> can host it in tests.</summary>
public partial class Program;

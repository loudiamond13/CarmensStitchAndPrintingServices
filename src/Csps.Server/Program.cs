using Csps.Infrastructure;
using Csps.Server.Composition;
using Csps.Server.Endpoints;
using Csps.Server.Http;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Serilog with the request's W3C trace id on every event; files under {contentRoot}/logs (FND-07, D-21, D-22).
builder.Services.AddCspsLogging(builder.Configuration, builder.Environment);

// No "Server: Kestrel" banner (SEC-01). IIS removes its own banner through web.config.
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

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

// Composes EF Core, the cache and the ports. Never migrates or seeds at startup (D-08).
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);

// OpenAPI is registered in Development only (D-14).
builder.Services.AddCspsOpenApi(builder.Environment);

var app = builder.Build();

// Outermost: its OnStarting callback covers redirect, exception-handler and status-code-page responses too (SEC-01).
app.UseMiddleware<SecurityHeadersMiddleware>();

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
// host's own logger, never the process-wide static one, and never logs headers or bodies (FND-07).
var requestLogger = app.Services.GetRequiredService<Serilog.ILogger>();
app.UseSerilogRequestLogging(options => options.Logger = requestLogger);

app.MapCspsHealth();
app.MapApiFallback();
app.MapCspsApiDocs();

app.Run();

/// <summary>Composition root of the CSPS API. Public so <c>WebApplicationFactory&lt;Program&gt;</c> can host it in tests.</summary>
public partial class Program;

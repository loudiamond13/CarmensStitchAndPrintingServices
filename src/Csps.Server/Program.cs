using Csps.Infrastructure;
using Csps.Server.Endpoints;
using Csps.Server.Http;
using Microsoft.Extensions.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

// Every ProblemDetails the framework creates gets the CSPS title, traceId and 5xx rules (FND-05, D-26, D-27).
builder.Services.AddProblemDetails(options =>
    options.CustomizeProblemDetails = context => CspsProblemDetails.Apply(context.ProblemDetails, context.HttpContext));

builder.Services
    .AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy());

// Composes EF Core, the cache and the ports. Never migrates or seeds at startup (D-08).
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);

var app = builder.Build();

// Outermost: its OnStarting callback covers exception-handler and status-code-page responses too (SEC-01).
app.UseMiddleware<SecurityHeadersMiddleware>();

// Unhandled exceptions become a generic 500 with a reference, never exception text (D-27).
app.UseExceptionHandler(new ExceptionHandlerOptions
{
    ExceptionHandler = static context => CspsProblemDetails.WriteAsync(context, StatusCodes.Status500InternalServerError),
});

// Empty error responses (404, 405, ...) become ProblemDetails, written as JSON whatever the Accept header says.
app.UseStatusCodePages(static context => CspsProblemDetails.WriteAsync(context.HttpContext, context.HttpContext.Response.StatusCode));

app.MapCspsHealth();
app.MapApiFallback();

app.Run();

/// <summary>Composition root of the CSPS API. Public so <c>WebApplicationFactory&lt;Program&gt;</c> can host it in tests.</summary>
public partial class Program;

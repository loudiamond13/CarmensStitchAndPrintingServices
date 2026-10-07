using Csps.Infrastructure;
using Csps.Server.Endpoints;
using Microsoft.Extensions.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy());

// Composes EF Core, the cache and the ports. Never migrates or seeds at startup (D-08).
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);

var app = builder.Build();

app.MapCspsHealth();

app.Run();

/// <summary>Composition root of the CSPS API. Public so <c>WebApplicationFactory&lt;Program&gt;</c> can host it in tests.</summary>
public partial class Program;

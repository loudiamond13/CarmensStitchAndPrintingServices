var builder = WebApplication.CreateBuilder(args);

var app = builder.Build();

app.Run();

/// <summary>Composition root of the CSPS API. Public so <c>WebApplicationFactory&lt;Program&gt;</c> can host it in tests.</summary>
public partial class Program;

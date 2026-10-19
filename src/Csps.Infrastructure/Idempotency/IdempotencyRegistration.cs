using Microsoft.Extensions.DependencyInjection;

namespace Csps.Infrastructure.Idempotency;

/// <summary>Registers the idempotency gate (SEC-06).</summary>
public static class IdempotencyRegistration
{
    /// <summary>Adds the scoped <see cref="IdempotencyGate"/> and the singleton <see cref="IdempotencyRequestHasher"/>. Register <c>CspsDbContext</c> and the auth secrets first.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsIdempotency(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);
        services.AddSingleton<IdempotencyRequestHasher>();
        services.AddScoped<IdempotencyGate>();
        return services;
    }
}

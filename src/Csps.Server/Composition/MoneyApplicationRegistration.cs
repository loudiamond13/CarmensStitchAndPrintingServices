using Csps.Application.Money;
using FluentValidation;

namespace Csps.Server.Composition;

/// <summary>Registers the staff money use cases: one handler class per use case, no mediator.</summary>
public static class MoneyApplicationRegistration
{
    /// <summary>Adds the staff money handlers as scoped services and their validators as singletons.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsMoneyHandlers(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddSingleton<IValidator<CreateMoneyTransferRequest>, CreateMoneyTransferRequestValidator>();

        services.AddScoped<GetMyMoneyHandler>();
        services.AddScoped<CreateMoneyTransferHandler>();
        return services;
    }
}

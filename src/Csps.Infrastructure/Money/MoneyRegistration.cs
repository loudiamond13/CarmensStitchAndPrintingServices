using Csps.Application.Ports;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Infrastructure.Money;

/// <summary>Registers the staff money services.</summary>
public static class MoneyRegistration
{
    /// <summary>Adds the staff money reader, the transfer store and the staff money lock.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsMoney(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddScoped<IStaffMoneyReader, StaffMoneyReader>();
        services.AddScoped<IMoneyTransfers, MoneyTransferStore>();
        services.AddScoped<IStaffMoneyLock, StaffMoneyLock>();
        return services;
    }
}

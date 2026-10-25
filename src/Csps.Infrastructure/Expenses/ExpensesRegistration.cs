using Csps.Application.Ports;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Infrastructure.Expenses;

/// <summary>Registers the company expense services.</summary>
public static class ExpensesRegistration
{
    /// <summary>Adds the expense category store.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsExpenses(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddScoped<IExpenseCategories, ExpenseCategoryStore>();
        return services;
    }
}

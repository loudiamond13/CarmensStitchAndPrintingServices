using Csps.Application.Ports;
using Csps.Infrastructure.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Infrastructure.Expenses;

/// <summary>Registers the company expense services.</summary>
public static class ExpensesRegistration
{
    /// <summary>Adds the expense category store, the expense store and the expense reader.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsExpenses(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddScoped<IExpenseCategories, ExpenseCategoryStore>();
        services.AddScoped<ICompanyExpenses, CompanyExpenseStore>();
        services.AddScoped<ICompanyExpenseReader, CompanyExpenseReader>();
        services.AddScoped<IStaffDirectory, StaffDirectory>();
#if CSPS_TESTING
        services.AddScoped<TestingExpenseSeeder>();
#endif
        return services;
    }
}

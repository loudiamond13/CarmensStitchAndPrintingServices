using Csps.Application.ExpenseCategories;

namespace Csps.Server.Composition;

/// <summary>Registers the company expense use cases: one handler class per use case, no mediator.</summary>
public static class ExpensesApplicationRegistration
{
    /// <summary>Adds the expense and category handlers as scoped services.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsExpenseHandlers(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddScoped<ListExpenseCategoriesHandler>();
        return services;
    }
}

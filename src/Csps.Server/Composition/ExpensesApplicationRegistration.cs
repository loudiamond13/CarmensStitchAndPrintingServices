using Csps.Application.ExpenseCategories;
using Csps.Application.Expenses;
using Csps.Application.Staff;
using FluentValidation;

namespace Csps.Server.Composition;

/// <summary>Registers the company expense use cases: one handler class per use case, no mediator.</summary>
public static class ExpensesApplicationRegistration
{
    /// <summary>Adds the expense and category handlers as scoped services and their validators as singletons.</summary>
    /// <param name="services">The service collection.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddCspsExpenseHandlers(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        services.AddSingleton<IValidator<CreateCompanyExpenseRequest>, CreateCompanyExpenseRequestValidator>();
        services.AddSingleton<IValidator<UpdateCompanyExpenseRequest>, UpdateCompanyExpenseRequestValidator>();
        services.AddSingleton<IValidator<ListCompanyExpensesRequest>, ListCompanyExpensesRequestValidator>();
        services.AddSingleton<IValidator<ListDeletedExpensesRequest>, ListDeletedExpensesRequestValidator>();

        services.AddScoped<ListExpenseCategoriesHandler>();
        services.AddScoped<ListStaffHandler>();
        services.AddScoped<CreateCompanyExpenseHandler>();
        services.AddScoped<UpdateCompanyExpenseHandler>();
        services.AddScoped<GetCompanyExpenseHandler>();
        services.AddScoped<ListCompanyExpensesHandler>();
        services.AddScoped<GetCompanyExpenseKpisHandler>();
        services.AddScoped<DeleteCompanyExpenseHandler>();
        services.AddScoped<RestoreCompanyExpenseHandler>();
        services.AddScoped<ListDeletedExpensesHandler>();
        return services;
    }
}

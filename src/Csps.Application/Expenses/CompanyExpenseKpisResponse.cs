namespace Csps.Application.Expenses;

/// <summary>One month of the KPI row.</summary>
/// <param name="Month">The first day of the month, in the business zone.</param>
/// <param name="Total">The sum of the month's expenses by expense date; 0.00 when none.</param>
/// <param name="Count">How many expenses the month holds.</param>
public sealed record MonthKpi(DateOnly Month, decimal Total, int Count);

/// <summary>The category with the highest total this month.</summary>
/// <param name="Category">The category.</param>
/// <param name="Total">Its total this month.</param>
/// <param name="SharePercent">Its share of this month's total, rounded half away from zero to a whole percent.</param>
public sealed record TopCategoryKpi(ExpenseCategoryRef Category, decimal Total, int SharePercent);

/// <summary>The month figures for the expenses page (CEXP-03). They ignore the list filters.</summary>
/// <param name="Today">The business today, so the browser never reads the device clock for it.</param>
/// <param name="ThisMonth">The business month that holds today.</param>
/// <param name="LastMonth">The month before it.</param>
/// <param name="TopCategory">The top category this month; null when this month has no expenses.</param>
public sealed record CompanyExpenseKpisResponse(DateOnly Today, MonthKpi ThisMonth, MonthKpi LastMonth, TopCategoryKpi? TopCategory);

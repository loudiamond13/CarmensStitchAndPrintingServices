using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Time;
using FluentValidation;

namespace Csps.Application.Dashboard;

/// <summary>
/// Use case: staff of either role read the chart of the last 6 or 12 business months (DASH-03). The query is checked first and the
/// port is never called for a bad one. The window ends with the business month and every month in it is sent, so the browser
/// never fills a gap or works out a profit.
/// </summary>
/// <param name="reader">The dashboard read port.</param>
/// <param name="calendar">The business calendar.</param>
/// <param name="validator">Checks the query.</param>
public sealed class GetDashboardChartHandler(IDashboardReader reader, IBusinessCalendar calendar, IValidator<GetDashboardChartRequest> validator)
{
    /// <summary>Reads the chart.</summary>
    /// <param name="request">The query.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The chart, or a 400 naming the bad field.</returns>
    public async Task<Result<DashboardChartResponse>> HandleAsync(GetDashboardChartRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<DashboardChartResponse>(ValidationResults.ToError(validation, GetDashboardChartRequestValidator.InvalidCode, GetDashboardChartRequestValidator.InvalidMessage));
        }

        var months = GetDashboardChartRequest.TryReadMonths(request.Months, out var asked) ? asked : GetDashboardChartRequest.DefaultMonths;
        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var (thisFirst, thisLast) = BusinessClock.MonthOf(clock.Today);
        var (firstMonth, _) = BusinessClock.MonthOf(thisFirst.AddMonths(1 - months));

        var sums = await reader.GetMonthSumsAsync(firstMonth, thisLast, cancellationToken).ConfigureAwait(false);
        return Result.Success(new DashboardChartResponse(
            months,
            ChartMonths.Build(firstMonth, months, sums.Payments, sums.Refunds, sums.CompanyExpenses, sums.OrderExpenses)));
    }
}

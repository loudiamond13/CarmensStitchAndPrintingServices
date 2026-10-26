#if CSPS_TESTING
using System.Text.Json;
using Csps.Application.Expenses;
using Csps.Application.Ports;
using Csps.Domain.Expenses;
using Csps.Infrastructure.Expenses;
using Csps.Server.Http;
using Csps.Server.Security;
using Csps.Server.Testing;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>
/// Lets E2E specs seed company expenses with a chosen payer, recorder, date and delete state (QUAL-05, D-37). It exists in the Testing
/// environment of a Debug build only. The controller holds no database types: the seeder in Infrastructure does the work.
/// </summary>
/// <param name="seeder">Inserts the expense and stamps its recorder.</param>
/// <param name="calendar">The business calendar, for the date rule.</param>
[TestingOnly]
[ApiController]
[Route("api/testing/expenses")]
[AllowAnonymous]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class TestingExpensesController(TestingExpenseSeeder seeder, IBusinessCalendar calendar) : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>The body of the create call.</summary>
    /// <param name="PaidByUserId">The payer; required.</param>
    /// <param name="RecordedByUserId">The recorder; none reads as System.</param>
    /// <param name="Date">The expense date as <c>yyyy-MM-dd</c>; required.</param>
    /// <param name="CategoryId">The category; required.</param>
    /// <param name="Description">What it was for; required.</param>
    /// <param name="Amount">The amount; required.</param>
    /// <param name="Notes">Optional notes.</param>
    /// <param name="Deleted">True to soft-delete the expense at once.</param>
    public sealed record TestingExpenseRequest(
        Guid? PaidByUserId = null,
        Guid? RecordedByUserId = null,
        string? Date = null,
        Guid? CategoryId = null,
        string? Description = null,
        decimal? Amount = null,
        string? Notes = null,
        bool Deleted = false);

    /// <summary>The new expense.</summary>
    /// <param name="Id">The expense id.</param>
    public sealed record TestingExpenseCreated(Guid Id);

    /// <summary>Creates an expense whose recorder is the requested person.</summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>201 with the id, or a 400 listing the fields that failed.</returns>
    [HttpPost]
    [IdempotencyExempt("Testing-only test data, compiled out of Release.")]
    [ProducesResponseType<TestingExpenseCreated>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IResult> Create(CancellationToken cancellationToken)
    {
        // Read here, not bound, so a missing or malformed body is the same plain 400 for every caller.
        TestingExpenseRequest? request;
        try
        {
            request = await JsonSerializer.DeserializeAsync<TestingExpenseRequest>(Request.Body, JsonOptions, cancellationToken).ConfigureAwait(false);
        }
        catch (JsonException)
        {
            request = null;
        }

        request ??= new TestingExpenseRequest();
        var missing = new Dictionary<string, string[]>(StringComparer.Ordinal);
        DateOnly date = default;
        if (string.IsNullOrWhiteSpace(request.Date))
        {
            missing[ExpenseRules.DateField] = [ExpenseRules.DateRequired];
        }
        else if (!CreateCompanyExpenseRequestValidator.TryParseDate(request.Date, out date))
        {
            missing[ExpenseRules.DateField] = [ExpenseRules.DateInvalid];
        }

        if (request.CategoryId is null || request.CategoryId == Guid.Empty)
        {
            missing[ExpenseRules.CategoryField] = [ExpenseRules.CategoryRequired];
        }

        if (string.IsNullOrWhiteSpace(request.Description))
        {
            missing[ExpenseRules.DescriptionField] = [ExpenseRules.DescriptionRequired];
        }

        if (request.Amount is null)
        {
            missing[ExpenseRules.AmountField] = [ExpenseRules.AmountTooSmall];
        }

        if (request.PaidByUserId is null || request.PaidByUserId == Guid.Empty)
        {
            missing[ExpenseRules.PaidByField] = [ExpenseRules.PaidByRequired];
        }

        if (missing.Count > 0)
        {
            return Rejected(ExpenseRules.InvalidMessage, missing);
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var created = await seeder.CreateAsync(
            new TestingExpenseInput(
                date,
                request.CategoryId!.Value,
                request.Description!,
                request.Amount!.Value,
                request.PaidByUserId!.Value,
                request.RecordedByUserId,
                request.Notes,
                request.Deleted,
                clock.Today),
            cancellationToken).ConfigureAwait(false);
        if (created.IsFailure)
        {
            var fields = created.Error.FieldErrors?.ToDictionary(static pair => pair.Key, static pair => pair.Value, StringComparer.Ordinal)
                ?? new Dictionary<string, string[]>(StringComparer.Ordinal);
            return Rejected(created.Error.Message, fields);
        }

        return TypedResults.Json(new TestingExpenseCreated(created.Value), JsonOptions, statusCode: StatusCodes.Status201Created);
    }

    private ProblemHttpResult Rejected(string detail, Dictionary<string, string[]> errors) =>
        TypedResults.Problem(CspsProblemDetails.Build(HttpContext, StatusCodes.Status400BadRequest, detail, errors));
}
#endif

using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Expenses;
using FluentValidation;
using FluentValidation.Results;

namespace Csps.Application.ExpenseCategories;

/// <summary>
/// Use case: a Manager renames or recolors a category with the version the form was opened with (CEXP-02, D-12, D-13, SEC-07). The
/// steps run in this order and stop at the first failure: the form is checked (400), the category is found (404), the version is the
/// stored one (409), then the name is checked against Others and the other names (400). A form save never retries on a conflict: the
/// person reloads and decides. A form with no change saves nothing, writes no audit entry and keeps the version. A rename writes
/// <c>expense-category.renamed</c> and a recolor writes <c>expense-category.recolored</c>, both in the same save (D-27). Who changed
/// it and when come from the token and the clock (SEC-08).
/// </summary>
public sealed class UpdateExpenseCategoryHandler(
    IExpenseCategories categories,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IValidator<UpdateExpenseCategoryRequest> validator)
{
    private const string CategoryTarget = "ExpenseCategory";

    /// <summary>Saves the edit.</summary>
    /// <param name="id">The category to edit.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The category as saved, a 400 listing every field that failed, a 404 when it does not exist, or a 409 for a stale version or a lost race.</returns>
    public async Task<Result<ExpenseCategoryDetailResponse>> HandleAsync(Guid id, UpdateExpenseCategoryRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Failed(validation);
        }

        _ = RowVersions.TryParse(request.Version, out var version);
        try
        {
            var outcome = await unitOfWork.InTransactionAsync(
                token => AttemptAsync(id, request.Name!, request.Tone!, version, token),
                cancellationToken).ConfigureAwait(false);
            if (outcome.IsFailure)
            {
                return Result.Failure<ExpenseCategoryDetailResponse>(outcome.Error);
            }
        }
        catch (ConcurrencyConflictException)
        {
            return Result.Failure<ExpenseCategoryDetailResponse>(EditErrors.Stale);
        }
        catch (CategoryNameTakenException)
        {
            return Failed(new ValidationResult([NameTaken()]));
        }

        var view = await categories.GetDetailAsync(id, cancellationToken).ConfigureAwait(false);
        return view is null
            ? Result.Failure<ExpenseCategoryDetailResponse>(ExpenseCategoryErrors.NotFound)
            : Result.Success(ExpenseCategoryDetailResponse.From(view));
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, string name, string tone, byte[] version, CancellationToken cancellationToken)
    {
        var category = await categories.FindAsync(id, cancellationToken).ConfigureAwait(false);
        if (category is null)
        {
            return Result.Failure<bool>(ExpenseCategoryErrors.NotFound);
        }

        if (!category.RowVersion.AsSpan().SequenceEqual(version))
        {
            return Result.Failure<bool>(EditErrors.Stale);
        }

        var nameFailure = await CheckNameAsync(category, name, cancellationToken).ConfigureAwait(false);
        if (nameFailure is not null)
        {
            return Result.Failure<bool>(ToError(new ValidationResult([nameFailure])));
        }

        var renamed = category.Rename(name);
        if (renamed.IsFailure)
        {
            return Result.Failure<bool>(renamed.Error);
        }

        var recolored = category.Recolor(tone);
        if (recolored.IsFailure)
        {
            return Result.Failure<bool>(recolored.Error);
        }

        var oldName = renamed.Value;
        var oldTone = recolored.Value;
        var nameChanged = !string.Equals(oldName, category.Name, StringComparison.Ordinal);
        var toneChanged = !string.Equals(oldTone, category.Tone, StringComparison.Ordinal);
        if (!nameChanged && !toneChanged)
        {
            return Result.Success(false);
        }

        var key = AuditKey.Of(category.Id);
        if (nameChanged)
        {
            audit.Record(AuditActions.ExpenseCategoryRenamed, CategoryTarget, key, CategoryAuditDetail.Renamed(oldName, category.Name));
        }

        if (toneChanged)
        {
            audit.Record(AuditActions.ExpenseCategoryRecolored, CategoryTarget, key, CategoryAuditDetail.Recolored(oldTone, category.Tone));
        }

        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }

    // Others keeps its name (OQ-6). Another category's name is refused unless only the letter case of this one's own name changes.
    private async Task<ValidationFailure?> CheckNameAsync(ExpenseCategory category, string name, CancellationToken cancellationToken)
    {
        var trimmed = name.Trim();
        if (category.IsOthers)
        {
            return string.Equals(trimmed, category.Name, StringComparison.Ordinal)
                ? null
                : new ValidationFailure(nameof(UpdateExpenseCategoryRequest.Name), ExpenseCategoryRules.OthersNameLocked);
        }

        var normalized = ExpenseCategory.Normalize(trimmed);
        return normalized != category.NormalizedName
            && await categories.NameTakenAsync(normalized, category.Id, cancellationToken).ConfigureAwait(false)
                ? NameTaken()
                : null;
    }

    private static ValidationFailure NameTaken() => new(nameof(UpdateExpenseCategoryRequest.Name), ExpenseCategoryRules.NameTaken);

    private static Error ToError(ValidationResult validation) =>
        ValidationResults.ToError(validation, ExpenseCategoryErrors.ValidationCode, ExpenseCategoryErrors.ValidationMessage);

    private static Result<ExpenseCategoryDetailResponse> Failed(ValidationResult validation) =>
        Result.Failure<ExpenseCategoryDetailResponse>(ToError(validation));
}

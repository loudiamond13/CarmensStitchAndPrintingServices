using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Profile;

/// <summary>
/// Use case: the caller changes their own first and last name (PROF-01). The save carries the edit version the form
/// was opened with; any other version is refused with edit.stale and nothing changes (SEC-07, D-20). The target is
/// always the token's user (CWE-639).
/// A real change is audited in the same transaction with the changed field names only, never the names (USER-06, D-40).
/// </summary>
public sealed class UpdateProfileNameHandler(
    IUserAccounts accounts,
    IUserDirectory directory,
    IRequestContext requestContext,
    IValidator<UpdateProfileNameRequest> validator,
    IAuditTrail audit,
    IUnitOfWork unitOfWork)
{
    private const string UserTarget = "User";

    /// <summary>Saves the name.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The saved profile, a 400 for bad fields, a 409 for a stale version, or a 401 when the token names no account.</returns>
    public async Task<Result<ProfileResponse>> HandleAsync(UpdateProfileNameRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is not { } userId)
        {
            return Result.Failure<ProfileResponse>(AuthErrors.SessionEnded);
        }

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<ProfileResponse>(ValidationResults.ToError(validation, AuthErrors.ValidationCode, AuthErrors.ValidationMessage));
        }

        var current = await directory.GetProfileAsync(userId, cancellationToken).ConfigureAwait(false);
        if (current is null)
        {
            return Result.Failure<ProfileResponse>(AuthErrors.SessionEnded);
        }

        _ = UpdateProfileNameRequestValidator.TryParseVersion(request.Version, out var version);
        var firstName = request.FirstName!.Trim();
        var lastName = request.LastName!.Trim();
        var edit = await unitOfWork
            .InTransactionAsync(token => SaveAsync(userId, current, firstName, lastName, version, token), cancellationToken)
            .ConfigureAwait(false);
        if (edit.Outcome == EditOutcome.Stale)
        {
            return Result.Failure<ProfileResponse>(EditErrors.Stale);
        }

        if (edit.Outcome == EditOutcome.NotFound)
        {
            return Result.Failure<ProfileResponse>(AuthErrors.SessionEnded);
        }

        var view = await directory.GetProfileAsync(userId, cancellationToken).ConfigureAwait(false);
        return view is null
            ? Result.Failure<ProfileResponse>(AuthErrors.SessionEnded)
            : Result.Success(ProfileResponse.From(view));
    }

    private async Task<EditResult> SaveAsync(Guid userId, ProfileView current, string firstName, string lastName, Guid version, CancellationToken cancellationToken)
    {
        var edit = await accounts.UpdateNameAsync(userId, firstName, lastName, version, cancellationToken).ConfigureAwait(false);
        if (edit.Outcome == EditOutcome.Saved)
        {
            audit.Record(AuditActions.ProfileNameChanged, UserTarget, AuditKey.Of(userId), ChangedFields(current, firstName, lastName));
            await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return edit;
    }

    // Field names only: an audit entry is kept for 8 months and must never hold a person's name (D-40).
    private static string ChangedFields(ProfileView current, string firstName, string lastName)
    {
        var fields = new List<string>(2);
        if (!string.Equals(current.FirstName, firstName, StringComparison.Ordinal))
        {
            fields.Add("first-name");
        }

        if (!string.Equals(current.LastName, lastName, StringComparison.Ordinal))
        {
            fields.Add("last-name");
        }

        return "fields=" + string.Join(',', fields);
    }
}

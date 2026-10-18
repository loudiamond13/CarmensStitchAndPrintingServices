using Csps.Application.Common;
using FluentValidation;

namespace Csps.Application.Users;

/// <summary>Checks the roster query. The role and status come from fixed lists; size and search use the shared list caps (SEC-03).</summary>
public sealed class ListUsersRequestValidator : AbstractValidator<ListUsersRequest>
{
    /// <summary>The role filter for Admins.</summary>
    public const string AdminRole = "admin";

    /// <summary>The role filter for Managers.</summary>
    public const string ManagerRole = "manager";

    /// <summary>The highest page number accepted, so the row offset can never overflow.</summary>
    public const int MaxPage = 100_000;

    /// <summary>The message for a role outside the list.</summary>
    public const string RoleInvalid = "Choose Admin or Manager.";

    /// <summary>The message for a status outside the list.</summary>
    public const string StatusInvalid = "Choose Active, Inactive or Locked.";

    /// <summary>The message for a page outside the range.</summary>
    public const string PageInvalid = "Use a page from 1 to 100000.";

    /// <summary>Creates the validator.</summary>
    public ListUsersRequestValidator()
    {
        RuleFor(request => request.Q).SearchText();
        RuleFor(request => request.PageSize).PageSize();
        RuleFor(request => request.Page).InclusiveBetween(1, MaxPage).WithMessage(PageInvalid);
        RuleFor(request => request.Role)
            .Must(static role => role is null or AdminRole or ManagerRole)
            .WithMessage(RoleInvalid);
        RuleFor(request => request.Status)
            .Must(static status => status is null or UserStatuses.Active or UserStatuses.Inactive or UserStatuses.Locked)
            .WithMessage(StatusInvalid);
    }
}

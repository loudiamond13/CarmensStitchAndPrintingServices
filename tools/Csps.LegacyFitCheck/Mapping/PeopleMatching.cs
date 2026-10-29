using System.Globalization;
using Csps.Application.Security;
using Csps.Domain.Identity;
using Csps.LegacyFitCheck.Source;

namespace Csps.LegacyFitCheck.Mapping;

/// <summary>A pseudonymous staff account that exists only in the trial database (D-01, D-06).</summary>
/// <param name="Id">The id the snapshots point at.</param>
/// <param name="Pseudonym">The display name, such as "Legacy staff 1". It holds no part of the legacy user.</param>
/// <param name="Email">The made-up address on a reserved domain.</param>
internal sealed record TrialStaff(Guid Id, string Pseudonym, string Email);

/// <summary>Who a legacy name resolved to.</summary>
/// <param name="UserId">The trial staff id, or the Legacy holder id.</param>
/// <param name="RuleKey">Why the holder was used, or null when a trial staff member matched.</param>
/// <param name="ListValue">The legacy text or role name behind the fallback, for the local findings file.</param>
internal sealed record PersonMatch(Guid UserId, string? RuleKey, string? ListValue)
{
    /// <summary>Gets a value indicating whether the Legacy holder stands in for the person.</summary>
    public bool IsHolder => RuleKey is not null;
}

/// <summary>
/// Matches the people named in legacy payments and order expenses to trial staff (D-06). A legacy user whose role maps (Admin) becomes
/// one pseudonymous trial staff member. Any other name uses the Legacy holder, and the caller reports why.
/// </summary>
internal sealed class PeopleMatching
{
    private const string UnknownName = "person.unknown-name";
    private const string Blank = "person.blank";
    private const string RoleNoMatch = "person.role-no-match";

    private readonly Dictionary<string, Candidate> _byUserName;

    private PeopleMatching(Dictionary<string, Candidate> byUserName, IReadOnlyList<TrialStaff> trialStaff)
    {
        _byUserName = byUserName;
        TrialStaff = trialStaff;
    }

    /// <summary>Gets a matching that knows no one, so every name uses the holder.</summary>
    public static PeopleMatching Empty { get; } = new(new Dictionary<string, Candidate>(StringComparer.OrdinalIgnoreCase), []);

    /// <summary>Gets the trial staff to seed before the first import.</summary>
    public IReadOnlyList<TrialStaff> TrialStaff { get; }

    /// <summary>Builds the matching from the legacy users, roles and role links. Users are numbered in legacy id order.</summary>
    public static PeopleMatching Build(IEnumerable<LegacyUserRow> users, IEnumerable<LegacyRoleRow> roles, IEnumerable<LegacyUserRoleRow> userRoles)
    {
        ArgumentNullException.ThrowIfNull(users);
        ArgumentNullException.ThrowIfNull(roles);
        ArgumentNullException.ThrowIfNull(userRoles);

        var roleNames = roles.ToDictionary(static role => role.Id, static role => role.Name?.Trim() ?? string.Empty, StringComparer.Ordinal);
        var rolesByUser = userRoles
            .Where(link => roleNames.ContainsKey(link.RoleId))
            .ToLookup(static link => link.UserId, link => roleNames[link.RoleId], StringComparer.Ordinal);

        var byUserName = new Dictionary<string, Candidate>(StringComparer.OrdinalIgnoreCase);
        var staff = new List<TrialStaff>();
        foreach (var user in users.OrderBy(static user => user.Id, StringComparer.Ordinal))
        {
            var names = rolesByUser[user.Id].Where(static name => name.Length > 0).Order(StringComparer.Ordinal).ToList();
            var isAdmin = names.Exists(static name => string.Equals(name, Roles.Admin, StringComparison.OrdinalIgnoreCase));
            TrialStaff? trial = null;
            if (isAdmin)
            {
                var number = (staff.Count + 1).ToString(CultureInfo.InvariantCulture);
                trial = new TrialStaff(Guid.NewGuid(), $"Legacy staff {number}", $"legacy-staff-{number}@example.invalid");
                staff.Add(trial);
            }

            var userName = user.UserName?.Trim();
            if (!string.IsNullOrEmpty(userName))
            {
                byUserName.TryAdd(userName, new Candidate(trial?.Id, names.Count > 0 ? names[0] : null));
            }
        }

        return new PeopleMatching(byUserName, staff);
    }

    /// <summary>Resolves a legacy receiver or payer text to a trial staff member, or to the Legacy holder with a reason.</summary>
    public PersonMatch Resolve(string? text)
    {
        var trimmed = text?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return new PersonMatch(LegacyHolder.Id, Blank, null);
        }

        if (!_byUserName.TryGetValue(trimmed, out var candidate))
        {
            return new PersonMatch(LegacyHolder.Id, UnknownName, trimmed);
        }

        return candidate.StaffId is { } id
            ? new PersonMatch(id, null, null)
            : new PersonMatch(LegacyHolder.Id, RoleNoMatch, candidate.RoleName);
    }

    private sealed record Candidate(Guid? StaffId, string? RoleName);
}

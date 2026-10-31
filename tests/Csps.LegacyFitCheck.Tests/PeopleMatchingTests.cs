using Csps.Domain.Identity;
using Csps.LegacyFitCheck.Mapping;
using Csps.LegacyFitCheck.Source;

namespace Csps.LegacyFitCheck.Tests;

public sealed class PeopleMatchingTests
{
    private const string AdminName = "SENTINEL-USER-1@example.invalid";

    [Theory]
    [InlineData("SENTINEL-USER-1@example.invalid")]
    [InlineData(" sentinel-user-1@EXAMPLE.invalid ")]
    public void ANameMatchesIgnoringCaseAndSpaces(string text)
    {
        var people = Build([User("u1", AdminName)], [Role("r-admin", "Admin")], [Link("u1", "r-admin")]);

        var match = people.Resolve(text);

        match.IsHolder.ShouldBeFalse();
        match.UserId.ShouldBe(people.TrialStaff.ShouldHaveSingleItem().Id);
        match.RuleKey.ShouldBeNull();
    }

    [Fact]
    public void TwoAdminsGetNumberedPseudonymsInLegacyIdOrder()
    {
        var people = Build(
            [User("b", "SENTINEL-USER-2@example.invalid"), User("a", "SENTINEL-USER-1@example.invalid")],
            [Role("r-admin", "Admin")],
            [Link("a", "r-admin"), Link("b", "r-admin")]);

        people.TrialStaff.Select(static staff => staff.Pseudonym).ShouldBe(["Legacy staff 1", "Legacy staff 2"]);
        people.TrialStaff.Select(static staff => staff.Email).ShouldBe(["legacy-staff-1@example.invalid", "legacy-staff-2@example.invalid"]);
        people.TrialStaff.Select(static staff => staff.Id).Distinct().Count().ShouldBe(2);
        people.Resolve("SENTINEL-USER-1@example.invalid").UserId.ShouldBe(people.TrialStaff[0].Id);
        people.Resolve("SENTINEL-USER-2@example.invalid").UserId.ShouldBe(people.TrialStaff[1].Id);
    }

    [Theory]
    [InlineData("Company")]
    [InlineData("Employee")]
    [InlineData("Manager")]
    public void ARoleWithoutACspsMatchUsesTheHolderAndNamesTheRole(string roleName)
    {
        var people = Build([User("u1", AdminName)], [Role("r1", roleName)], [Link("u1", "r1")]);

        var match = people.Resolve(AdminName);

        match.UserId.ShouldBe(LegacyHolder.Id);
        match.RuleKey.ShouldBe("person.role-no-match");
        match.ListValue.ShouldBe(roleName);
        people.TrialStaff.ShouldBeEmpty();
    }

    [Fact]
    public void AUserWithNoRoleUsesTheHolderWithNoRoleName()
    {
        var people = Build([User("u1", AdminName)], [Role("r-admin", "Admin")], []);

        var match = people.Resolve(AdminName);

        match.UserId.ShouldBe(LegacyHolder.Id);
        match.RuleKey.ShouldBe("person.role-no-match");
        match.ListValue.ShouldBeNull();
        people.TrialStaff.ShouldBeEmpty();
    }

    [Fact]
    public void AnAdminWhoAlsoHasAnotherRoleStillBecomesTrialStaff()
    {
        var people = Build([User("u1", AdminName)], [Role("r-admin", "admin"), Role("r-co", "Company")], [Link("u1", "r-admin"), Link("u1", "r-co")]);

        people.Resolve(AdminName).IsHolder.ShouldBeFalse();
        people.TrialStaff.ShouldHaveSingleItem();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void BlankTextUsesTheHolderWithTheBlankReason(string? text)
    {
        var people = Build([User("u1", AdminName)], [Role("r-admin", "Admin")], [Link("u1", "r-admin")]);

        var match = people.Resolve(text);

        match.UserId.ShouldBe(LegacyHolder.Id);
        match.RuleKey.ShouldBe("person.blank");
        match.ListValue.ShouldBeNull();
    }

    [Fact]
    public void AnUnknownNameUsesTheHolderAndKeepsTheTrimmedTextForTheLocalFile()
    {
        var people = Build([User("u1", AdminName)], [Role("r-admin", "Admin")], [Link("u1", "r-admin")]);

        var match = people.Resolve(" SENTINEL-NOBODY ");

        match.UserId.ShouldBe(LegacyHolder.Id);
        match.RuleKey.ShouldBe("person.unknown-name");
        match.ListValue.ShouldBe("SENTINEL-NOBODY");
    }

    [Fact]
    public void TheEmptyMatchingSendsEveryNameToTheHolder()
    {
        PeopleMatching.Empty.Resolve(AdminName).RuleKey.ShouldBe("person.unknown-name");
        PeopleMatching.Empty.TrialStaff.ShouldBeEmpty();
    }

    [Fact]
    public void ThePseudonymHoldsNoPartOfTheLegacyUser()
    {
        var people = Build(
            [new LegacyUserRow { Id = "u1", UserName = AdminName, Email = "SENTINEL-MAIL@example.invalid" }],
            [Role("r-admin", "Admin")],
            [Link("u1", "r-admin")]);

        var staff = people.TrialStaff.ShouldHaveSingleItem();

        foreach (var part in new[] { "SENTINEL", "USER", "MAIL" })
        {
            staff.Pseudonym.ShouldNotContain(part, Case.Insensitive);
            staff.Email.ShouldNotContain(part, Case.Insensitive);
        }
    }

    private static PeopleMatching Build(LegacyUserRow[] users, LegacyRoleRow[] roles, LegacyUserRoleRow[] links) =>
        PeopleMatching.Build(users, roles, links);

    private static LegacyUserRow User(string id, string userName) => new() { Id = id, UserName = userName, Email = userName };

    private static LegacyRoleRow Role(string id, string name) => new() { Id = id, Name = name };

    private static LegacyUserRoleRow Link(string userId, string roleId) => new() { UserId = userId, RoleId = roleId };
}

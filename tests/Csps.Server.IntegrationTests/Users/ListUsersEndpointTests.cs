using System.Net;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Users;

/// <summary>USER-01, USER-08, D-09, SEC-03, CWE-862: a Manager pages, searches and filters the staff roster; an Admin and a stranger are refused.</summary>
public sealed class ListUsersEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly string[] ManagerNames = ["Ana", "Dina", "Gina", "Mae"];
    private static readonly string[] AdminNames = ["Bea", "Carla", "Eli", "Fe", "Hal", "Ivo"];
    private static readonly string[] RosterOrder = ["Ana", "Bea", "Carla", "Dina", "Eli", "Fe", "Gina", "Hal", "Ivo", "Mae"];

    [Fact]
    public async Task AManagerListsTheStaffByFirstNameAndDeletedPeopleNeverShow()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var seed = await UserFixtures.SeedRosterAsync(factory, database);

        using var response = await UserFixtures.ListAsync(client, manager.AccessToken, $"q={seed.Tag}");
        var page = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={seed.Tag}");

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        page.Total.ShouldBe(10);
        page.Page.ShouldBe(1);
        page.PageSize.ShouldBe(20);
        page.Items.Select(item => item.FirstName).ShouldBe(RosterOrder.Select(name => name + seed.Tag));
        page.Items.ShouldNotContain(item => item.Id == seed.Deleted.Id);
        page.Items.ShouldAllBe(item => item.CreatedAt.Offset == TimeSpan.Zero);
    }

    [Fact]
    public async Task EachRowCarriesItsFieldsRoleStatusAndInviteState()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var seed = await UserFixtures.SeedRosterAsync(factory, database);

        var page = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={seed.Tag}");

        var bea = page.Items.Single(item => item.Id == seed.Named("Bea").Id);
        var expected = seed.Named("Bea");
        (bea.FirstName, bea.LastName, bea.Email, bea.Role, bea.Status, bea.InviteState)
            .ShouldBe((expected.FirstName, expected.LastName, expected.Email, Roles.Admin, "active", "none"));
        page.Items.Single(item => item.Id == seed.Named("Ana").Id).Role.ShouldBe(Roles.Manager);
        page.Items.Single(item => item.Id == seed.Named("Hal").Id).InviteState.ShouldBe("pending");
        page.Items.Single(item => item.Id == seed.Named("Ivo").Id).InviteState.ShouldBe("expired");
        page.Items.Where(item => item.Id != seed.Named("Hal").Id && item.Id != seed.Named("Ivo").Id).ShouldAllBe(item => item.InviteState == "none");
    }

    [Fact]
    public async Task TheRoleFilterKeepsOnlyThatRole()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var seed = await UserFixtures.SeedRosterAsync(factory, database);

        var managers = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={seed.Tag}&role=manager");
        var admins = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={seed.Tag}&role=admin");

        managers.Items.Select(item => item.FirstName).ShouldBe(ManagerNames.Select(name => name + seed.Tag));
        managers.Total.ShouldBe(4);
        managers.Items.ShouldAllBe(item => item.Role == Roles.Manager);
        admins.Items.Select(item => item.FirstName).ShouldBe(AdminNames.Select(name => name + seed.Tag));
        admins.Total.ShouldBe(6);
        admins.Items.ShouldAllBe(item => item.Role == Roles.Admin);
    }

    [Fact]
    public async Task TheStatusFilterMatchesTheStatusShownWithInactiveBeforeLockedBeforeActive()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var seed = await UserFixtures.SeedRosterAsync(factory, database);

        var inactive = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={seed.Tag}&status=inactive");
        var locked = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={seed.Tag}&status=locked");
        var active = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={seed.Tag}&status=active");

        // Fe is deactivated and also locked by a Manager: Inactive wins. Mae's failed-password lockout is not Locked (D-16, D-18).
        inactive.Items.Select(item => item.Id).ShouldBe([seed.Named("Fe").Id]);
        inactive.Items.ShouldAllBe(item => item.Status == "inactive");
        locked.Items.Select(item => item.Id).ShouldBe([seed.Named("Gina").Id]);
        locked.Items.ShouldAllBe(item => item.Status == "locked");
        active.Total.ShouldBe(8);
        active.Items.ShouldAllBe(item => item.Status == "active");
        active.Items.ShouldContain(item => item.Id == seed.Named("Mae").Id);
    }

    [Fact]
    public async Task SearchMatchesFirstNameLastNameFullNameAndEmailWithoutRegardToCase()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var seed = await UserFixtures.SeedRosterAsync(factory, database);
        var carla = seed.Named("Carla");

        var byFirst = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={carla.FirstName.ToUpperInvariant()}");
        var byLast = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={carla.LastName.ToLowerInvariant()}");
        var byFull = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={Uri.EscapeDataString(carla.FirstName + " " + carla.LastName)}");
        var byEmail = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={Uri.EscapeDataString(carla.Email.ToUpperInvariant())}");

        foreach (var found in new[] { byFirst, byLast, byFull, byEmail })
        {
            found.Items.Select(item => item.Id).ShouldBe([carla.Id]);
            found.Total.ShouldBe(1);
        }
    }

    [Fact]
    public async Task APercentUnderscoreBracketOrBackslashInTheSearchMatchesOnlyItself()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var seed = await UserFixtures.SeedRosterAsync(factory, database);
        var tag = seed.Tag;
        var percent = await UserFixtures.CreateAsync(factory, tag, "Pct%", "Lopez");
        await UserFixtures.CreateAsync(factory, tag, "PctX", "Lopez");
        var underscore = await UserFixtures.CreateAsync(factory, tag, "Und_", "Lopez");
        await UserFixtures.CreateAsync(factory, tag, "UndX", "Lopez");
        var bracket = await UserFixtures.CreateAsync(factory, tag, "Brk[", "Lopez");
        var backslash = await UserFixtures.CreateAsync(factory, tag, "Bks\\", "Lopez");

        var byPercent = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={Uri.EscapeDataString(percent.FirstName)}");
        var byUnderscore = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={Uri.EscapeDataString(underscore.FirstName)}");
        var byBracket = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={Uri.EscapeDataString(bracket.FirstName)}");
        var byBackslash = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={Uri.EscapeDataString(backslash.FirstName)}");
        var aClassIsNotAClass = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={Uri.EscapeDataString("[A]na" + tag)}");
        var lonePercent = await UserFixtures.ReadPageAsync(client, manager.AccessToken, "q=%25&pageSize=100");

        byPercent.Items.Select(item => item.Id).ShouldBe([percent.Id]);
        byUnderscore.Items.Select(item => item.Id).ShouldBe([underscore.Id]);
        byBracket.Items.Select(item => item.Id).ShouldBe([bracket.Id]);
        byBackslash.Items.Select(item => item.Id).ShouldBe([backslash.Id]);
        aClassIsNotAClass.Items.ShouldBeEmpty();
        lonePercent.Items.ShouldContain(item => item.Id == percent.Id);
        lonePercent.Items.ShouldAllBe(item => item.FirstName.Contains('%', StringComparison.Ordinal) || item.LastName.Contains('%', StringComparison.Ordinal) || item.Email.Contains('%', StringComparison.Ordinal));
    }

    [Fact]
    public async Task PagesSplitTheRowsAndThePageAfterTheLastIsEmptyWithTheTrueTotal()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var seed = await UserFixtures.SeedRosterAsync(factory, database);
        string Names(UserPage page) => string.Join(",", page.Items.Select(item => item.FirstName[..^seed.Tag.Length]));

        var second = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={seed.Tag}&page=2&pageSize=2");
        var lastWithRemainder = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={seed.Tag}&page=3&pageSize=4");
        var past = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={seed.Tag}&page=4&pageSize=4");
        var hundred = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={seed.Tag}&pageSize=100");

        Names(second).ShouldBe("Carla,Dina");
        (second.Page, second.PageSize, second.Total).ShouldBe((2, 2, 10));
        Names(lastWithRemainder).ShouldBe("Ivo,Mae");
        lastWithRemainder.Total.ShouldBe(10);
        past.Items.ShouldBeEmpty();
        (past.Page, past.Total).ShouldBe((4, 10));
        hundred.PageSize.ShouldBe(100);
        hundred.Items.Count.ShouldBe(10);
    }

    [Fact]
    public async Task EqualNamesAreOrderedByIdSoPagingNeverRepeatsOrDropsARow()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var tag = UserFixtures.NewTag();
        for (var i = 0; i < 3; i++)
        {
            await UserFixtures.CreateAsync(factory, tag, "Twin", "Same");
        }

        var everything = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={tag}&pageSize=100");
        var onePerPage = new List<Guid>();
        for (var page = 1; page <= 3; page++)
        {
            onePerPage.AddRange((await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"q={tag}&page={page}&pageSize=1")).Items.Select(item => item.Id));
        }

        everything.Total.ShouldBe(3);
        onePerPage.ShouldBe(everything.Items.Select(item => item.Id));
        onePerPage.Distinct().Count().ShouldBe(3);
    }

    [Fact]
    public async Task ABlankSearchAppliesNoSearchAndTheUnfilteredRosterIncludesTheCaller()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var everyone = await UserFixtures.ReadPageAsync(client, manager.AccessToken);

        var blank = await UserFixtures.ReadPageAsync(client, manager.AccessToken, "q=%20%20%20");
        var empty = await UserFixtures.ReadPageAsync(client, manager.AccessToken, "q=");

        blank.Total.ShouldBe(everyone.Total);
        empty.Total.ShouldBe(everyone.Total);
        var found = false;
        for (var pageNumber = 1; !found && (pageNumber - 1) * 100 < everyone.Total; pageNumber++)
        {
            var chunk = await UserFixtures.ReadPageAsync(client, manager.AccessToken, $"page={pageNumber}&pageSize=100");
            found = chunk.Items.Any(item => item.Id == manager.UserId);
        }

        found.ShouldBeTrue();
    }

    [Theory]
    [InlineData("role=owner", "role")]
    [InlineData("status=gone", "status")]
    [InlineData("page=0", "page")]
    [InlineData("pageSize=0", "pageSize")]
    [InlineData("pageSize=101", "pageSize")]
    public async Task ABadFilterOrPageIsA400ThatNamesTheField(string query, string field)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var response = await UserFixtures.ListAsync(client, manager.AccessToken, query);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        using var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        problem.RootElement.GetProperty("errors").TryGetProperty(field, out _).ShouldBeTrue();
    }

    [Fact]
    public async Task ASearchOfOneHundredCharactersIsAcceptedAndOneHundredAndOneIsA400()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var accepted = await UserFixtures.ListAsync(client, manager.AccessToken, $"q={new string('a', 100)}");
        using var refused = await UserFixtures.ListAsync(client, manager.AccessToken, $"q={new string('a', 101)}");

        accepted.StatusCode.ShouldBe(HttpStatusCode.OK);
        refused.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        using var problem = JsonDocument.Parse(await refused.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        problem.RootElement.GetProperty("errors").GetProperty("q").EnumerateArray().Select(static m => m.GetString()).ShouldBe(["Use 100 characters or fewer."]);
    }

    [Fact]
    public async Task AnAdminIsRefusedWith403()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var admin = await TestSessions.StartAsync(factory, Roles.Admin);

        using var response = await UserFixtures.ListAsync(client, admin.AccessToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task AnAnonymousCallerIsRefusedWith401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await UserFixtures.ListAsync(client, null);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}

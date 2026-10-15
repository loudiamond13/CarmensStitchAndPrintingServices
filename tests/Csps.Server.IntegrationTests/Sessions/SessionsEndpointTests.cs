using System.Net;
using Csps.Server.IntegrationTests.Auth;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Sessions;

/// <summary>D-43, AUTH-06, CWE-639: the signed-in devices list shows the caller's own active sessions only.</summary>
public sealed class SessionsEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string EdgeOnWindows =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0";

    [Fact]
    public async Task TwoDevicesAreListedWithThisOneFirstAndMarked()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var phone = AuthClient.CreateClient(factory);
        using var laptop = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        var phoneDevice = await AuthClient.SignInFullyAsync(phone, staff, keepSignedIn: true, signInsSoFar: 0);
        var laptopDevice = await AuthClient.SignInFullyAsync(laptop, staff, keepSignedIn: false, signInsSoFar: 1, userAgent: EdgeOnWindows);

        using var response = await AuthClient.ListSessionsAsync(laptop, laptopDevice.AccessToken);
        var devices = await AuthClient.ReadSessionsAsync(laptop, laptopDevice.AccessToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        devices.Count.ShouldBe(2);
        devices[0].Id.ShouldBe(laptopDevice.SessionId);
        devices[0].Device.ShouldBe("Edge on Windows");
        devices[0].Current.ShouldBeTrue();
        devices[0].Persistent.ShouldBeFalse();
        devices[1].Id.ShouldBe(phoneDevice.SessionId);
        devices[1].Device.ShouldBe("Chrome on Android");
        devices[1].Current.ShouldBeFalse();
        devices[1].Persistent.ShouldBeTrue();
        devices[1].SignedInAt.ShouldBeLessThanOrEqualTo(devices[0].SignedInAt);
        devices[1].LastActiveAt.ShouldBeGreaterThanOrEqualTo(devices[1].SignedInAt);
        devices.ShouldAllBe(device => device.SignedInAt.Offset == TimeSpan.Zero && device.LastActiveAt.Offset == TimeSpan.Zero);
    }

    [Fact]
    public async Task AnotherUsersSessionsNeverAppear()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var mine = AuthClient.CreateClient(factory);
        using var theirs = AuthClient.CreateClient(factory);
        var me = await AuthClient.CreateStaffAsync(factory);
        var someoneElse = await AuthClient.CreateStaffAsync(factory);
        var myDevice = await AuthClient.SignInFullyAsync(mine, me);
        var theirDevice = await AuthClient.SignInFullyAsync(theirs, someoneElse);

        var devices = await AuthClient.ReadSessionsAsync(mine, myDevice.AccessToken);

        devices.Select(device => device.Id).ShouldBe([myDevice.SessionId]);
        devices.ShouldNotContain(device => device.Id == theirDevice.SessionId);
    }

    [Fact]
    public async Task ASignedOutDeviceDisappearsFromTheList()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var phone = AuthClient.CreateClient(factory);
        using var laptop = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffAsync(factory);
        await AuthClient.SignInFullyAsync(phone, staff, signInsSoFar: 0);
        var laptopDevice = await AuthClient.SignInFullyAsync(laptop, staff, signInsSoFar: 1, userAgent: EdgeOnWindows);
        (await AuthClient.ReadSessionsAsync(laptop, laptopDevice.AccessToken)).Count.ShouldBe(2);
        using var signedOut = await AuthClient.SignOutAsync(phone);
        signedOut.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var devices = await AuthClient.ReadSessionsAsync(laptop, laptopDevice.AccessToken);

        devices.Select(device => device.Id).ShouldBe([laptopDevice.SessionId]);
    }

    [Fact]
    public async Task AnAnonymousCallerIsRefused()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);

        using var response = await AuthClient.ListSessionsAsync(client, null);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}

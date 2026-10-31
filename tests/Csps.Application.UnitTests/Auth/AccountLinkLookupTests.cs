using System.Reflection;
using Csps.Application.Auth;

namespace Csps.Application.UnitTests.Auth;

/// <summary>USER-07, AUTH-08: invite and reset links go through one lookup; the old per-purpose copies are gone.</summary>
public sealed class AccountLinkLookupTests
{
    [Fact]
    public void OneLookupServesBothLinkPurposes()
    {
        var assembly = typeof(PasswordRules).Assembly;

        var lookup = assembly.GetType("Csps.Application.Auth.AccountLinkLookup");

        lookup.ShouldNotBeNull();
        lookup.GetMethod("FindAsync", BindingFlags.Public | BindingFlags.Static).ShouldNotBeNull();
        assembly.GetType("Csps.Application.Auth.InviteLinkLookup").ShouldBeNull();
        assembly.GetType("Csps.Application.Auth.ResetLinkLookup").ShouldBeNull();
    }
}

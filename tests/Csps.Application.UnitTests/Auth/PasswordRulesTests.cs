using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Identity;
using NSubstitute;

namespace Csps.Application.UnitTests.Auth;

/// <summary>AUTH-11, D-12: the owner's rule is checked first, then the breached-password service.</summary>
public sealed class PasswordRulesTests
{
    private const string Valid = "Tela-Sukat-7381";

    private static readonly PersonalInfo Person = new("paolo.garcia@example.com", "Paolo", "Garcia");

    private readonly IPwnedPasswords _pwned = Substitute.For<IPwnedPasswords>();

    [Fact]
    public async Task PolicyFailureIsReturnedFirstAndTheBreachServiceIsNeverCalled()
    {
        var rules = new PasswordRules(_pwned);

        var result = await rules.CheckAsync("short1!", Person, BreachCheckMode.FailOpenWithFloor, TestContext.Current.CancellationToken);

        result.Status.ShouldBe(PasswordRulesStatus.Rejected);
        result.Message.ShouldBe(PasswordPolicy.MessageFor(PasswordRuleFailure.TooShort));
        result.BreachCheckSkipped.ShouldBeFalse();
        await _pwned.DidNotReceiveWithAnyArgs().CheckAsync(default!, default);
    }

    [Fact]
    public async Task PersonalInfoIsRefusedBeforeAnyNetworkCall()
    {
        var rules = new PasswordRules(_pwned);

        var result = await rules.CheckAsync("Garcia-Tela-7381", Person, BreachCheckMode.FailClosed, TestContext.Current.CancellationToken);

        result.Status.ShouldBe(PasswordRulesStatus.Rejected);
        result.Message.ShouldBe(PasswordPolicy.MessageFor(PasswordRuleFailure.ContainsPersonalInfo));
        await _pwned.DidNotReceiveWithAnyArgs().CheckAsync(default!, default);
    }

    [Fact]
    public async Task BreachedPasswordIsRejectedWithTheBreachMessage()
    {
        _pwned.CheckAsync(Valid, Arg.Any<CancellationToken>()).Returns(BreachCheckResult.Breached);
        var rules = new PasswordRules(_pwned);

        var result = await rules.CheckAsync(Valid, Person, BreachCheckMode.FailOpenWithFloor, TestContext.Current.CancellationToken);

        result.Status.ShouldBe(PasswordRulesStatus.Rejected);
        result.Message.ShouldBe("This password has appeared in a data breach. Choose a different one.");
        result.Message.ShouldBe(PasswordRules.BreachedMessage);
        result.BreachCheckSkipped.ShouldBeFalse();
    }

    [Fact]
    public async Task PasswordNotInABreachIsAcceptedWithTheCheckNotSkipped()
    {
        _pwned.CheckAsync(Valid, Arg.Any<CancellationToken>()).Returns(BreachCheckResult.NotBreached);
        var rules = new PasswordRules(_pwned);

        var result = await rules.CheckAsync(Valid, Person, BreachCheckMode.FailClosed, TestContext.Current.CancellationToken);

        result.Status.ShouldBe(PasswordRulesStatus.Accepted);
        result.Message.ShouldBeNull();
        result.BreachCheckSkipped.ShouldBeFalse();
    }

    [Fact]
    public async Task TheBreachServiceReceivesTheNormalizedPassword()
    {
        _pwned.CheckAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(BreachCheckResult.NotBreached);
        var rules = new PasswordRules(_pwned);
        const string decomposed = "Café-Tela-7381";

        await rules.CheckAsync(decomposed, Person, BreachCheckMode.FailClosed, TestContext.Current.CancellationToken);

        await _pwned.Received(1).CheckAsync("Café-Tela-7381", Arg.Any<CancellationToken>());
    }
}

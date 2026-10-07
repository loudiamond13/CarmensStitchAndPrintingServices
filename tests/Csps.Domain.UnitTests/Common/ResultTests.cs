using Csps.Domain.Common;

namespace Csps.Domain.UnitTests.Common;

public sealed class ResultTests
{
    private static readonly Error NotFound = Error.NotFound("order.not-found", "We couldn't find that order.");

    [Fact]
    public void SuccessIsSuccess()
    {
        var result = Result.Success();

        result.IsSuccess.ShouldBeTrue();
        result.IsFailure.ShouldBeFalse();
    }

    [Fact]
    public void FailureCarriesTheError()
    {
        var result = Result.Failure(NotFound);

        result.IsSuccess.ShouldBeFalse();
        result.IsFailure.ShouldBeTrue();
        result.Error.ShouldBeSameAs(NotFound);
    }

    [Fact]
    public void ErrorOnASuccessThrows()
    {
        var result = Result.Success();

        Should.Throw<InvalidOperationException>(() => result.Error);
    }

    [Fact]
    public void GenericSuccessCarriesTheValue()
    {
        var result = Result.Success(42);

        result.IsSuccess.ShouldBeTrue();
        result.IsFailure.ShouldBeFalse();
        result.Value.ShouldBe(42);
    }

    [Fact]
    public void GenericSuccessMayCarryNull()
    {
        var result = Result.Success<string?>(null);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBeNull();
    }

    [Fact]
    public void GenericFailureCarriesTheError()
    {
        var result = Result.Failure<int>(NotFound);

        result.IsFailure.ShouldBeTrue();
        result.Error.ShouldBeSameAs(NotFound);
    }

    [Fact]
    public void ValueOnAFailureThrows()
    {
        var result = Result.Failure<int>(NotFound);

        Should.Throw<InvalidOperationException>(() => result.Value);
    }

    [Fact]
    public void ErrorOnAGenericSuccessThrows()
    {
        var result = Result.Success("value");

        Should.Throw<InvalidOperationException>(() => result.Error);
    }

    [Fact]
    public void FailureNeedsAnError()
    {
        Should.Throw<ArgumentNullException>(() => Result.Failure(null!));
        Should.Throw<ArgumentNullException>(() => Result.Failure<int>(null!));
    }
}

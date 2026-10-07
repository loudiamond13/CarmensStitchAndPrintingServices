using Csps.Domain.Common;

namespace Csps.Domain.UnitTests.Common;

public sealed class ErrorTests
{
    private static readonly Dictionary<string, string[]> OneFieldError = new(StringComparer.Ordinal)
    {
        ["name"] = ["Enter a name."],
    };

    [Fact]
    public void ValidationRequiresAtLeastOneFieldError()
    {
        Should.Throw<ArgumentException>(() =>
            Error.Validation("order.invalid", "Some details need fixing.", new Dictionary<string, string[]>(StringComparer.Ordinal)));
    }

    [Fact]
    public void ValidationRejectsANullFieldMap()
    {
        Should.Throw<ArgumentNullException>(() => Error.Validation("order.invalid", "Some details need fixing.", null!));
    }

    [Fact]
    public void ValidationKeepsKindCodeMessageAndFieldErrors()
    {
        var error = Error.Validation("order.invalid", "Some details need fixing.", OneFieldError);

        error.Kind.ShouldBe(ErrorKind.Validation);
        error.Code.ShouldBe("order.invalid");
        error.Message.ShouldBe("Some details need fixing.");
        error.FieldErrors.ShouldBeSameAs(OneFieldError);
    }

    [Fact]
    public void NotFoundSetsKindCodeAndMessage() =>
        AssertSimple(Error.NotFound("order.not-found", "We couldn't find that order."), ErrorKind.NotFound, "order.not-found", "We couldn't find that order.");

    [Fact]
    public void ConflictSetsKindCodeAndMessage() =>
        AssertSimple(Error.Conflict("order.changed", "This order was changed by someone else."), ErrorKind.Conflict, "order.changed", "This order was changed by someone else.");

    [Fact]
    public void BusinessRuleSetsKindCodeAndMessage() =>
        AssertSimple(Error.BusinessRule("payment.too-large", "That payment is more than the balance."), ErrorKind.BusinessRule, "payment.too-large", "That payment is more than the balance.");

    [Fact]
    public void ForbiddenSetsKindCodeAndMessage() =>
        AssertSimple(Error.Forbidden("user.forbidden", "Only an Admin can do that."), ErrorKind.Forbidden, "user.forbidden", "Only an Admin can do that.");

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void BlankCodeIsRejected(string code)
    {
        Should.Throw<ArgumentException>(() => Error.NotFound(code, "We couldn't find that."));
        Should.Throw<ArgumentException>(() => Error.Validation(code, "Some details need fixing.", OneFieldError));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void BlankMessageIsRejected(string message)
    {
        Should.Throw<ArgumentException>(() => Error.Conflict("order.changed", message));
        Should.Throw<ArgumentException>(() => Error.Validation("order.invalid", message, OneFieldError));
    }

    [Fact]
    public void NullCodeOrMessageIsRejected()
    {
        Should.Throw<ArgumentNullException>(() => Error.Forbidden(null!, "Only an Admin can do that."));
        Should.Throw<ArgumentNullException>(() => Error.BusinessRule("payment.too-large", null!));
    }

    private static void AssertSimple(Error error, ErrorKind kind, string code, string message)
    {
        error.Kind.ShouldBe(kind);
        error.Code.ShouldBe(code);
        error.Message.ShouldBe(message);
        error.FieldErrors.ShouldBeNull();
    }
}

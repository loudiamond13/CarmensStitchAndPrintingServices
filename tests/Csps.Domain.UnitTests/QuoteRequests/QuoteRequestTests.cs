using Csps.Domain.QuoteRequests;

namespace Csps.Domain.UnitTests.QuoteRequests;

/// <summary>INQ-01, SEC-08, Pitfall 7: the quote request aggregate, its field rules and its stored numbers.</summary>
public sealed class QuoteRequestTests
{
    private static readonly Guid LineId = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly DateTimeOffset Now = new(2026, 11, 22, 10, 30, 0, TimeSpan.Zero);

    [Fact]
    public void StoredNumbersAreFixed()
    {
        ((byte)QuoteRequestStatus.New).ShouldBe((byte)1);
        ((byte)QuoteRequestStatus.Contacted).ShouldBe((byte)2);
        ((byte)QuoteRequestStatus.Quoted).ShouldBe((byte)3);
        ((byte)QuoteRequestStatus.Converted).ShouldBe((byte)4);
        ((byte)QuoteRequestStatus.Closed).ShouldBe((byte)5);
        ((byte)QuoteRequestStatus.Spam).ShouldBe((byte)6);
        ((byte)QuoteProductChoice.Line).ShouldBe((byte)1);
        ((byte)QuoteProductChoice.Custom).ShouldBe((byte)2);
        ((byte)QuoteProductChoice.NotSure).ShouldBe((byte)3);
        ((byte)QuoteQuantityRange.OneToNine).ShouldBe((byte)1);
        ((byte)QuoteQuantityRange.TenToTwenty).ShouldBe((byte)2);
        ((byte)QuoteQuantityRange.TwentyOneToFifty).ShouldBe((byte)3);
        ((byte)QuoteQuantityRange.FiftyOneToHundred).ShouldBe((byte)4);
        ((byte)QuoteQuantityRange.HundredPlus).ShouldBe((byte)5);
    }

    [Fact]
    public void ReceiveMakesANewRequestWithNoCreator()
    {
        var result = QuoteRequest.Receive(LineId, Full(), Now);

        result.IsSuccess.ShouldBeTrue();
        var request = result.Value;
        request.Id.ShouldBe(LineId);
        request.CustomerName.ShouldBe("Juan Dela Cruz");
        request.TeamName.ShouldBe("Brgy. San Roque Ballers");
        request.ContactNumberE164.ShouldBe("+639171234567");
        request.Email.ShouldBe("juan.dc@example.com");
        request.ProductChoice.ShouldBe(QuoteProductChoice.Line);
        request.ProductLineId.ShouldBe(LineId);
        request.ProductTitle.ShouldBe("Basketball Jerseys");
        request.QuantityRange.ShouldBe(QuoteQuantityRange.TenToTwenty);
        request.Message.ShouldBe("Need 15 jerseys by Dec 12.");
        request.Status.ShouldBe(QuoteRequestStatus.New);
        request.StatusChangedAtUtc.ShouldBe(Now);
        request.CreatedAtUtc.ShouldBe(Now);
        request.CreatedById.ShouldBeNull();
        request.UpdatedById.ShouldBeNull();
        request.UpdatedAtUtc.ShouldBeNull();
        request.EditVersion.ShouldNotBe(Guid.Empty);
        request.RowVersion.ShouldBeEmpty();
    }

    [Fact]
    public void ReceiveTrimsTextAndStoresEmptyOptionalValuesAsNull()
    {
        var input = new QuoteRequestInput("  Juan Dela Cruz  ", "   ", " 0917 123 4567 ", string.Empty, Message: "  ");

        var request = QuoteRequest.Receive(LineId, input, Now).Value;

        request.CustomerName.ShouldBe("Juan Dela Cruz");
        request.TeamName.ShouldBeNull();
        request.Email.ShouldBeNull();
        request.Message.ShouldBeNull();
        request.ProductChoice.ShouldBeNull();
        request.ProductLineId.ShouldBeNull();
        request.ProductTitle.ShouldBeNull();
        request.QuantityRange.ShouldBeNull();
    }

    [Theory]
    [InlineData("0917 123 4567")]
    [InlineData("0917.123.4567")]
    [InlineData("0917-123-4567")]
    [InlineData("(0917) 123-4567")]
    [InlineData("+63 917 123 4567")]
    [InlineData("+639171234567")]
    public void AMobileNumberIsStoredAsE164(string number) =>
        QuoteRequest.Receive(LineId, Full() with { ContactNumber = number }, Now).Value.ContactNumberE164.ShouldBe("+639171234567");

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("02 8123 4567")]
    [InlineData("0917 123 456")]
    [InlineData("banana")]
    [InlineData("+1 415 555 0100")]
    public void ANumberThatIsNotAMobileNumberIsRefused(string number) =>
        Refused(Full() with { ContactNumber = number }, "contactNumber", "Enter a mobile number, like 0917 123 4567.");

    [Fact]
    public void ANumberOverThirtyCharactersIsRefusedEvenWhenItParses()
    {
        var thirty = "0917" + new string('-', 19) + "1234567";
        var thirtyOne = "0917" + new string('-', 20) + "1234567";

        QuoteRequest.Receive(LineId, Full() with { ContactNumber = thirty }, Now).IsSuccess.ShouldBeTrue();
        Refused(Full() with { ContactNumber = thirtyOne }, "contactNumber", "Enter a mobile number, like 0917 123 4567.");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void AMissingNameIsRefused(string name) => Refused(Full() with { CustomerName = name }, "customerName", "Enter your name.");

    [Fact]
    public void ANameIsLimitedToOneHundredUtf16UnitsAfterTrimming()
    {
        QuoteRequest.Receive(LineId, Full() with { CustomerName = "  " + new string('a', 100) + "  " }, Now).IsSuccess.ShouldBeTrue();
        Refused(Full() with { CustomerName = new string('a', 101) }, "customerName", "Keep your name to 100 characters or fewer.");
        Refused(Full() with { CustomerName = new string('a', 99) + "\U0001F600" }, "customerName", "Keep your name to 100 characters or fewer.");
    }

    [Fact]
    public void ATeamNameIsLimitedToOneHundredCharacters()
    {
        QuoteRequest.Receive(LineId, Full() with { TeamName = new string('t', 100) }, Now).IsSuccess.ShouldBeTrue();
        Refused(Full() with { TeamName = new string('t', 101) }, "teamName", "Keep the team name to 100 characters or fewer.");
    }

    [Fact]
    public void AnEmailMustBeAnAddress() =>
        Refused(Full() with { Email = "nope" }, "email", "Enter a valid email, like name@gmail.com");

    [Fact]
    public void AnEmailIsLimitedToTwoHundredFiftyFourCharacters()
    {
        var domain = string.Concat(Enumerable.Repeat(new string('b', 60) + ".", 4)) + "com";
        var atLimit = new string('x', 6) + "@" + domain;
        var overLimit = new string('x', 7) + "@" + domain;

        atLimit.Length.ShouldBe(254);
        QuoteRequest.Receive(LineId, Full() with { Email = atLimit }, Now).IsSuccess.ShouldBeTrue();
        Refused(Full() with { Email = overLimit }, "email", "Keep the email to 254 characters or fewer.");
    }

    [Fact]
    public void AMessageIsLimitedToTwoThousandUtf16Units()
    {
        QuoteRequest.Receive(LineId, Full() with { Message = new string('m', 2000) }, Now).IsSuccess.ShouldBeTrue();
        Refused(Full() with { Message = new string('m', 2001) }, "message", "Keep your message to 2,000 characters or fewer.");
        Refused(Full() with { Message = new string('m', 1999) + "\U0001F600" }, "message", "Keep your message to 2,000 characters or fewer.");
    }

    [Fact]
    public void ACustomOrNotSureChoiceSavesNoLine()
    {
        var custom = QuoteRequest.Receive(LineId, Full() with { ProductChoice = QuoteProductChoice.Custom, ProductLineId = null, ProductTitle = null }, Now).Value;
        var notSure = QuoteRequest.Receive(LineId, Full() with { ProductChoice = QuoteProductChoice.NotSure, ProductLineId = null, ProductTitle = null }, Now).Value;

        custom.ProductChoice.ShouldBe(QuoteProductChoice.Custom);
        custom.ProductLineId.ShouldBeNull();
        notSure.ProductChoice.ShouldBe(QuoteProductChoice.NotSure);
        notSure.ProductTitle.ShouldBeNull();
    }

    [Fact]
    public void ALineChoiceNeedsALineAndATitle()
    {
        Refused(Full() with { ProductLineId = null }, "productLineKey", "Choose a product from the list.");
        Refused(Full() with { ProductTitle = null }, "productLineKey", "Choose a product from the list.");
        Refused(Full() with { ProductTitle = "   " }, "productLineKey", "Choose a product from the list.");
        Refused(Full() with { ProductTitle = new string('t', 61) }, "productLineKey", "Choose a product from the list.");
        QuoteRequest.Receive(LineId, Full() with { ProductTitle = new string('t', 60) }, Now).IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public void AnotherChoiceOrNoChoiceRefusesALineOrATitle()
    {
        Refused(Full() with { ProductChoice = QuoteProductChoice.Custom }, "productChoice", "Choose a product from the list.");
        Refused(Full() with { ProductChoice = QuoteProductChoice.NotSure, ProductLineId = null }, "productChoice", "Choose a product from the list.");
        Refused(Full() with { ProductChoice = null }, "productChoice", "Choose a product from the list.");
        Refused(Full() with { ProductChoice = null, ProductLineId = null }, "productChoice", "Choose a product from the list.");
        Refused(Full() with { ProductChoice = (QuoteProductChoice)9 }, "productChoice", "Choose a product from the list.");
    }

    [Fact]
    public void AQuantityMustBeOneOfTheFiveRanges()
    {
        foreach (var range in Enum.GetValues<QuoteQuantityRange>())
        {
            QuoteRequest.Receive(LineId, Full() with { QuantityRange = range }, Now).Value.QuantityRange.ShouldBe(range);
        }

        Refused(Full() with { QuantityRange = (QuoteQuantityRange)9 }, "quantity", "Choose a quantity from the list.");
    }

    [Fact]
    public void ReceiveRefusesAMissingFormWithAnException()
    {
        Should.Throw<ArgumentNullException>(() => QuoteRequest.Receive(LineId, null!, Now));
        Should.Throw<ArgumentNullException>(() => QuoteRequest.Receive(LineId, Full() with { CustomerName = null! }, Now));
        Should.Throw<ArgumentNullException>(() => QuoteRequest.Receive(LineId, Full() with { ContactNumber = null! }, Now));
        Should.Throw<ArgumentNullException>(() => QuoteRequestRules.TryParseMobile(null!, out _));
    }

    [Fact]
    public void ErrorsCarryTheQuoteCodeAndText()
    {
        var error = QuoteRequest.Receive(LineId, Full() with { CustomerName = string.Empty }, Now).Error;

        error.Code.ShouldBe("quote-requests.validation");
        error.Message.ShouldBe("Check the highlighted fields.");
    }

    [Fact]
    public void StatusKeysRoundTripAndIgnoreCase()
    {
        foreach (var status in Enum.GetValues<QuoteRequestStatus>())
        {
            var key = QuoteRequestStatusNames.ToKey(status);
            QuoteRequestStatusNames.TryParse(key, out var parsed).ShouldBeTrue();
            parsed.ShouldBe(status);
        }

        QuoteRequestStatusNames.TryParse("  SPAM ", out var spam).ShouldBeTrue();
        spam.ShouldBe(QuoteRequestStatus.Spam);
        QuoteRequestStatusNames.TryParse("banana", out _).ShouldBeFalse();
        QuoteRequestStatusNames.TryParse(null, out _).ShouldBeFalse();
        Should.Throw<ArgumentOutOfRangeException>(() => QuoteRequestStatusNames.ToKey((QuoteRequestStatus)0));
    }

    [Fact]
    public void ProductChoiceKeysAreExact()
    {
        foreach (var choice in Enum.GetValues<QuoteProductChoice>())
        {
            QuoteProductChoiceNames.TryParse(QuoteProductChoiceNames.ToKey(choice), out var parsed).ShouldBeTrue();
            parsed.ShouldBe(choice);
        }

        QuoteProductChoiceNames.ToKey(QuoteProductChoice.NotSure).ShouldBe("not-sure");
        QuoteProductChoiceNames.TryParse(" line ", out _).ShouldBeTrue();
        QuoteProductChoiceNames.TryParse("LINE", out _).ShouldBeFalse();
        QuoteProductChoiceNames.TryParse("banana", out _).ShouldBeFalse();
        QuoteProductChoiceNames.TryParse(null, out _).ShouldBeFalse();
        Should.Throw<ArgumentOutOfRangeException>(() => QuoteProductChoiceNames.ToKey((QuoteProductChoice)0));
    }

    [Fact]
    public void QuantityKeysAreExact()
    {
        string[] keys = ["1-9", "10-20", "21-50", "51-100", "100+"];
        foreach (var (range, key) in Enum.GetValues<QuoteQuantityRange>().Zip(keys))
        {
            QuoteQuantityRangeNames.ToKey(range).ShouldBe(key);
            QuoteQuantityRangeNames.TryParse(key, out var parsed).ShouldBeTrue();
            parsed.ShouldBe(range);
        }

        QuoteQuantityRangeNames.TryParse(" 10-20 ", out _).ShouldBeTrue();
        QuoteQuantityRangeNames.TryParse("7-8", out _).ShouldBeFalse();
        QuoteQuantityRangeNames.TryParse(null, out _).ShouldBeFalse();
        Should.Throw<ArgumentOutOfRangeException>(() => QuoteQuantityRangeNames.ToKey((QuoteQuantityRange)0));
    }

    private static QuoteRequestInput Full() => new(
        "Juan Dela Cruz",
        "Brgy. San Roque Ballers",
        "0917 123 4567",
        "juan.dc@example.com",
        QuoteProductChoice.Line,
        LineId,
        "Basketball Jerseys",
        QuoteQuantityRange.TenToTwenty,
        "Need 15 jerseys by Dec 12.");

    private static void Refused(QuoteRequestInput input, string field, string message)
    {
        var result = QuoteRequest.Receive(LineId, input, Now);

        result.IsFailure.ShouldBeTrue();
        var fields = result.Error.FieldErrors.ShouldNotBeNull();
        fields.Keys.ShouldBe([field]);
        fields[field].ShouldBe([message]);
    }
}

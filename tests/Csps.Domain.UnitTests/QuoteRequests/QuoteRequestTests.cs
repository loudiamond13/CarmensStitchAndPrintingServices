using Csps.Domain.Common;
using Csps.Domain.QuoteRequests;

namespace Csps.Domain.UnitTests.QuoteRequests;

/// <summary>INQ-01, INQ-05, SEC-08, D-15, Pitfall 7: the quote request aggregate, its field rules, its status moves and its stored numbers.</summary>
public sealed class QuoteRequestTests
{
    private static readonly Guid LineId = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly Guid StaffId = Guid.Parse("0b6f3c2e-91d4-4a57-8e20-6d1f4c9a7b35");
    private static readonly DateTimeOffset Now = new(2026, 11, 22, 10, 30, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Later = Now.AddHours(3);

    private static readonly QuoteRequestStatus[] HandSet =
        [QuoteRequestStatus.New, QuoteRequestStatus.Contacted, QuoteRequestStatus.Quoted, QuoteRequestStatus.Closed, QuoteRequestStatus.Spam];

    public static TheoryData<QuoteRequestStatus, QuoteRequestStatus> FreeMoves()
    {
        var moves = new TheoryData<QuoteRequestStatus, QuoteRequestStatus>();
        foreach (var from in HandSet)
        {
            foreach (var to in HandSet.Where(to => to != from))
            {
                moves.Add(from, to);
            }
        }

        return moves;
    }

    public static TheoryData<QuoteRequestStatus> HandSetStatuses() => [.. HandSet];

    [Theory]
    [MemberData(nameof(FreeMoves))]
    public void EveryMoveAmongTheFiveHandSetStatusesIsAllowedAndRecorded(QuoteRequestStatus from, QuoteRequestStatus to)
    {
        var request = At(from);
        var version = request.EditVersion;
        var rowsBefore = request.StatusChanges.Count;

        var result = request.ChangeStatus(to, StaffId, Later);

        result.IsSuccess.ShouldBeTrue();
        request.Status.ShouldBe(to);
        request.StatusChangedAtUtc.ShouldBe(Later);
        request.EditVersion.ShouldNotBe(version);
        request.StatusChanges.Count.ShouldBe(rowsBefore + 1);
        var row = request.StatusChanges[^1];
        row.Id.ShouldNotBe(Guid.Empty);
        row.QuoteRequestId.ShouldBe(request.Id);
        row.FromStatus.ShouldBe(from);
        row.ToStatus.ShouldBe(to);
        row.ChangedById.ShouldBe(StaffId);
        row.ChangedAtUtc.ShouldBe(Later);
        row.OrderId.ShouldBeNull();
    }

    [Theory]
    [InlineData(QuoteRequestStatus.New, "This request is already New.")]
    [InlineData(QuoteRequestStatus.Contacted, "This request is already Contacted.")]
    [InlineData(QuoteRequestStatus.Quoted, "This request is already Quoted.")]
    [InlineData(QuoteRequestStatus.Closed, "This request is already Closed.")]
    [InlineData(QuoteRequestStatus.Spam, "This request is already Spam.")]
    public void AMoveToTheSameStatusIsRefusedAndChangesNothing(QuoteRequestStatus status, string message)
    {
        var request = At(status);
        var version = request.EditVersion;
        var rows = request.StatusChanges.Count;
        var changedAt = request.StatusChangedAtUtc;

        var result = request.ChangeStatus(status, StaffId, Later);

        StatusRefused(result, "quote-requests.validation", message);
        request.Status.ShouldBe(status);
        request.StatusChangedAtUtc.ShouldBe(changedAt);
        request.EditVersion.ShouldBe(version);
        request.StatusChanges.Count.ShouldBe(rows);
    }

    [Theory]
    [InlineData(QuoteRequestStatus.Converted)]
    [InlineData((QuoteRequestStatus)0)]
    [InlineData((QuoteRequestStatus)7)]
    public void ConvertedOrAnUnknownStatusIsNeverSetByHand(QuoteRequestStatus target)
    {
        var request = At(QuoteRequestStatus.Contacted);
        var rows = request.StatusChanges.Count;

        var result = request.ChangeStatus(target, StaffId, Later);

        StatusRefused(result, "quote-requests.validation", "Choose a status.");
        request.Status.ShouldBe(QuoteRequestStatus.Contacted);
        request.StatusChanges.Count.ShouldBe(rows);
    }

    [Theory]
    [MemberData(nameof(HandSetStatuses))]
    [InlineData(QuoteRequestStatus.Converted)]
    public void AConvertedRequestCannotChangeStatusByHand(QuoteRequestStatus target)
    {
        var request = Received();
        typeof(QuoteRequest).GetProperty(nameof(QuoteRequest.Status))!.SetValue(request, QuoteRequestStatus.Converted);
        var version = request.EditVersion;

        var result = request.ChangeStatus(target, StaffId, Later);

        StatusRefused(result, "quote-requests.converted-locked", "A request that became an order can't change status.");
        result.Error.Message.ShouldBe("A request that became an order can't change status.");
        request.Status.ShouldBe(QuoteRequestStatus.Converted);
        request.EditVersion.ShouldBe(version);
        request.StatusChanges.ShouldBeEmpty();
    }

    [Fact]
    public void EnteringSpamReturnsEveryStoredPhotoIdRemovesEveryPlaceAndKeepsTheTime()
    {
        var request = WithPhotos(("front.jpg", "quotes/a/front"), ("back.png", "quotes/a/back"), ("sketch.heic", null));

        var result = request.ChangeStatus(QuoteRequestStatus.Spam, StaffId, Later);

        result.Value.ShouldBe(["quotes/a/front", "quotes/a/back"]);
        request.Photos.ShouldBeEmpty();
        request.PhotosRemovedAtUtc.ShouldBe(Later);
        request.Status.ShouldBe(QuoteRequestStatus.Spam);
    }

    [Fact]
    public void LeavingSpamNeverBringsThePhotosBackAndKeepsTheRemovalTime()
    {
        var request = WithPhotos(("front.jpg", "quotes/a/front"));
        request.ChangeStatus(QuoteRequestStatus.Spam, StaffId, Later).IsSuccess.ShouldBeTrue();

        var back = request.ChangeStatus(QuoteRequestStatus.New, StaffId, Later.AddHours(1));
        var again = request.ChangeStatus(QuoteRequestStatus.Spam, StaffId, Later.AddHours(2));

        back.Value.ShouldBeEmpty();
        again.Value.ShouldBeEmpty();
        request.Photos.ShouldBeEmpty();
        request.PhotosRemovedAtUtc.ShouldBe(Later);
    }

    [Fact]
    public void SpamWithNoPhotosRemovesNothingAndSetsNoRemovalTime()
    {
        var request = Received();

        var result = request.ChangeStatus(QuoteRequestStatus.Spam, StaffId, Later);

        result.Value.ShouldBeEmpty();
        request.PhotosRemovedAtUtc.ShouldBeNull();
    }

    [Fact]
    public void SpamWithOnlyMissingPlacesRemovesThePlacesAndQueuesNoFile()
    {
        var request = WithPhotos(("sketch.heic", null));

        var result = request.ChangeStatus(QuoteRequestStatus.Spam, StaffId, Later);

        result.Value.ShouldBeEmpty();
        request.Photos.ShouldBeEmpty();
        request.PhotosRemovedAtUtc.ShouldBe(Later);
    }

    [Fact]
    public void AMoveOutsideSpamRemovesNoPhotoAndReturnsNoIds()
    {
        var request = Received();

        var result = request.ChangeStatus(QuoteRequestStatus.Contacted, StaffId, Later);

        result.Value.ShouldBeEmpty();
        request.PhotosRemovedAtUtc.ShouldBeNull();
    }

    [Fact]
    public void AddingANoteKeepsTheTrimmedTextWithWhoAndWhenAndMovesTheEditVersion()
    {
        var request = Received();
        var version = request.EditVersion;

        var result = request.AddNote("  Called, will send mockup Friday.\nAsked for sizes.  ", StaffId, Later);

        result.IsSuccess.ShouldBeTrue();
        var note = result.Value;
        request.Notes.ShouldBe([note]);
        note.Id.ShouldNotBe(Guid.Empty);
        note.QuoteRequestId.ShouldBe(request.Id);
        note.Text.ShouldBe("Called, will send mockup Friday.\nAsked for sizes.");
        note.CreatedById.ShouldBe(StaffId);
        note.CreatedAtUtc.ShouldBe(Later);
        request.EditVersion.ShouldNotBe(version);
        request.Status.ShouldBe(QuoteRequestStatus.New);
    }

    [Fact]
    public void NotesOnlyAppend()
    {
        var request = Received();

        var first = request.AddNote("First.", StaffId, Now.AddMinutes(1)).Value;
        var second = request.AddNote("Second.", StaffId, Now.AddMinutes(2)).Value;

        request.Notes.ShouldBe([first, second]);
        first.Id.ShouldNotBe(second.Id);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\n\t ")]
    public void AnEmptyNoteIsRefusedAndChangesNothing(string text)
    {
        var request = Received();
        var version = request.EditVersion;

        NoteRefused(request.AddNote(text, StaffId, Later), "Write a note first.");
        request.Notes.ShouldBeEmpty();
        request.EditVersion.ShouldBe(version);
    }

    [Fact]
    public void ANoteIsLimitedToOneThousandUtf16UnitsAfterTrimming()
    {
        var request = Received();

        request.AddNote($"  {new string('a', 1000)}  ", StaffId, Later).IsSuccess.ShouldBeTrue();
        NoteRefused(request.AddNote(new string('a', 1001), StaffId, Later), "Keep the note to 1,000 characters or fewer.");
        request.Notes.Count.ShouldBe(1);
    }

    [Fact]
    public void ANoteCanBeAddedInEveryStatus()
    {
        foreach (var status in Enum.GetValues<QuoteRequestStatus>().Where(status => status != QuoteRequestStatus.Converted))
        {
            At(status).AddNote("Still useful.", StaffId, Later).IsSuccess.ShouldBeTrue(status.ToString());
        }
    }

    [Fact]
    public void AMissingNoteIsAnException()
    {
        Should.Throw<ArgumentNullException>(() => Received().AddNote(null!, StaffId, Later));
    }

    [Theory]
    [MemberData(nameof(HandSetStatuses))]
    public void ConvertingSetsConvertedLinksTheOrderAndAddsAHistoryRowWithTheOrder(QuoteRequestStatus from)
    {
        var request = At(from);
        var version = request.EditVersion;
        var orderId = Guid.Parse("01a2b3c4-0000-7000-8000-000000000148");

        var result = request.MarkConverted(orderId, StaffId, Later);

        result.IsSuccess.ShouldBeTrue();
        request.Status.ShouldBe(QuoteRequestStatus.Converted);
        request.StatusChangedAtUtc.ShouldBe(Later);
        request.OrderId.ShouldBe(orderId);
        request.EditVersion.ShouldNotBe(version);
        var row = request.StatusChanges[^1];
        (row.FromStatus, row.ToStatus, row.ChangedById, row.ChangedAtUtc, row.OrderId).ShouldBe((from, QuoteRequestStatus.Converted, (Guid?)StaffId, Later, (Guid?)orderId));
    }

    [Fact]
    public void AConvertedRequestIsNeverConvertedAgainAndKeepsItsFirstOrder()
    {
        var request = Received();
        var first = Guid.Parse("01a2b3c4-0000-7000-8000-000000000148");
        request.MarkConverted(first, StaffId, Now.AddMinutes(1)).IsSuccess.ShouldBeTrue();
        var version = request.EditVersion;

        var result = request.MarkConverted(Guid.Parse("01a2b3c4-0000-7000-8000-000000000149"), StaffId, Later);

        result.IsFailure.ShouldBeTrue();
        result.Error.Kind.ShouldBe(ErrorKind.Conflict);
        result.Error.Code.ShouldBe("quote-requests.already-converted");
        result.Error.Message.ShouldBe("This quote request was already turned into an order.");
        request.OrderId.ShouldBe(first);
        request.EditVersion.ShouldBe(version);
        request.StatusChanges.Count.ShouldBe(1);
    }

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

    private static QuoteRequest Received() => QuoteRequest.Receive(LineId, Full(), Now).Value;

    // Declares the places, then fills the stored ones the way the upload's conditional update does in the database.
    private static QuoteRequest WithPhotos(params (string Name, string? PublicId)[] places)
    {
        var request = Received();
        request.DeclarePhotos([.. places.Select(place => place.Name)], new byte[QuoteRequestRules.UploadKeyHashLength], Now.AddHours(2)).IsSuccess.ShouldBeTrue();
        for (var slot = 0; slot < places.Length; slot++)
        {
            typeof(QuoteRequestPhoto).GetProperty(nameof(QuoteRequestPhoto.PublicId))!.SetValue(request.Photos[slot], places[slot].PublicId);
        }

        return request;
    }

    // A received request moved to the status by hand first, unless it is New.
    private static QuoteRequest At(QuoteRequestStatus status)
    {
        var request = Received();
        if (status != QuoteRequestStatus.New)
        {
            request.ChangeStatus(status, StaffId, Now.AddMinutes(5)).IsSuccess.ShouldBeTrue();
        }

        return request;
    }

    private static void StatusRefused<T>(Result<T> result, string code, string message)
    {
        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe(code);
        var fields = result.Error.FieldErrors.ShouldNotBeNull();
        fields.Keys.ShouldBe(["status"]);
        fields["status"].ShouldBe([message]);
    }

    private static void NoteRefused(Result<QuoteRequestNote> result, string message)
    {
        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe("quote-requests.validation");
        var fields = result.Error.FieldErrors.ShouldNotBeNull();
        fields.Keys.ShouldBe(["text"]);
        fields["text"].ShouldBe([message]);
    }

    private static void Refused(QuoteRequestInput input, string field, string message)
    {
        var result = QuoteRequest.Receive(LineId, input, Now);

        result.IsFailure.ShouldBeTrue();
        var fields = result.Error.FieldErrors.ShouldNotBeNull();
        fields.Keys.ShouldBe([field]);
        fields[field].ShouldBe([message]);
    }
}

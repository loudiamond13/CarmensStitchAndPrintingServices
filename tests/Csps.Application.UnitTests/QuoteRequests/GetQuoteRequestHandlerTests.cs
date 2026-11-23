using Csps.Application.Auth;
using Csps.Application.Images;
using Csps.Application.Ports;
using Csps.Application.QuoteRequests;
using Csps.Application.Users;
using Csps.Domain.QuoteRequests;
using NSubstitute;

namespace Csps.Application.UnitTests.QuoteRequests;

/// <summary>INQ-05, D-36: one request is mapped with server-made photo addresses, its missing names and a history that ends with the arrival.</summary>
public sealed class GetQuoteRequestHandlerTests
{
    private static readonly Guid Id = Guid.Parse("019aa1c2-7c40-7a11-8b3e-2f5d6c7e8a90");
    private static readonly Guid StaffId = Guid.Parse("6a1f2e3d-4c5b-4a69-8778-9e0d1c2b3a45");
    private static readonly DateTimeOffset Received = new(2026, 11, 21, 7, 42, 0, TimeSpan.Zero);

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    [Fact]
    public async Task StoredPhotosGetTheirAddressesMissingOnesGiveTheirNamesAndTheHistoryEndsWithTheArrival()
    {
        var staff = new ActorRef(StaffId, "Maria Santos", false);
        var view = View(
            [new QuoteRequestPhotoRow(0, "front.jpg", "quotes/a/front", 4000, 3000), new QuoteRequestPhotoRow(1, "sketch.heic", null, null, null)],
            [new QuoteRequestHistoryRow(QuoteRequestStatus.New, QuoteRequestStatus.Contacted, staff, Received.AddHours(1))]);
        var (handler, delivery) = Build(view);
        delivery.ForPhoto("quotes/a/front", 4000, 3000).Returns(new PhotoUrls(new ImageSource("t", "t 1x"), new ImageSource("v", "v 640w"), "full"));

        var result = await handler.HandleAsync(Id, Token);

        var body = result.Value;
        body.ContactNumber.ShouldBe("0917 123 4567");
        body.Product.ShouldNotBeNull().Choice.ShouldBe("custom");
        body.Quantity.ShouldBe("1-9");
        body.PhotoCount.ShouldBe(2);
        var photo = body.Photos.ShouldHaveSingleItem();
        (photo.Slot, photo.FileName, photo.Width, photo.Height, photo.Thumb.Src, photo.Viewer.SrcSet, photo.FullSize).ShouldBe((0, "front.jpg", 4000, 3000, "t", "v 640w", "full"));
        body.MissingPhotos.ShouldBe(["sketch.heic"]);
        body.History.Select(row => (row.From, row.To, row.ChangedBy, row.ChangedAt)).ShouldBe(
        [
            ("new", "contacted", staff, Received.AddHours(1)),
            (null, "new", null, Received),
        ]);
        body.LastChangedBy.ShouldBe(staff);
        body.Version.ShouldBe("AAAAAAAAB9E=");
    }

    [Fact]
    public async Task AnUnknownIdIs404()
    {
        var (handler, _) = Build(null);

        var result = await handler.HandleAsync(Id, Token);

        result.Error.Code.ShouldBe("quote-requests.not-found");
    }

    [Fact]
    public async Task NoUsableAccountIs401AndNothingIsRead()
    {
        var reader = Substitute.For<IQuoteRequestReader>();
        var context = Substitute.For<IRequestContext>();
        context.UserId.Returns((Guid?)null);
        var handler = new GetQuoteRequestHandler(reader, Substitute.For<IImageDelivery>(), context);

        var result = await handler.HandleAsync(Id, Token);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        await reader.DidNotReceive().GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ANumberThatIsNotAPhilippineMobileIsShownAsStored()
    {
        var (handler, _) = Build(View([], []) with { ContactNumberE164 = "+1555", ProductChoice = null, QuantityRange = null });

        var result = await handler.HandleAsync(Id, Token);

        result.Value.ContactNumber.ShouldBe("+1555");
        result.Value.Product.ShouldBeNull();
        result.Value.Quantity.ShouldBeNull();
    }

    private static (GetQuoteRequestHandler Handler, IImageDelivery Delivery) Build(QuoteRequestDetailView? view)
    {
        var reader = Substitute.For<IQuoteRequestReader>();
        reader.GetDetailAsync(Id, Arg.Any<CancellationToken>()).Returns(Task.FromResult(view));
        var delivery = Substitute.For<IImageDelivery>();
        var context = Substitute.For<IRequestContext>();
        context.UserId.Returns(StaffId);
        return (new GetQuoteRequestHandler(reader, delivery, context), delivery);
    }

    private static QuoteRequestDetailView View(IReadOnlyList<QuoteRequestPhotoRow> photos, IReadOnlyList<QuoteRequestHistoryRow> history) => new(
        Id,
        Received,
        "Juan Dela Cruz",
        null,
        "+639171234567",
        null,
        QuoteProductChoice.Custom,
        null,
        QuoteQuantityRange.OneToNine,
        null,
        QuoteRequestStatus.Contacted,
        Received.AddHours(1),
        photos,
        null,
        history,
        history.Count > 0 ? history[0].ChangedBy : null,
        history.Count > 0 ? history[0].ChangedAtUtc : null,
        [0, 0, 0, 0, 0, 0, 7, 209]);
}

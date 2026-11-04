using Csps.Domain.Common;
using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>ORD-04, IMG-03, D-08, D-11, D-12: an order holds at most 5 photos, takes none while closed, keeps a clean description, and keeps its places whole under any mix of moves and removes.</summary>
public sealed class OrderImageTests
{
    private static readonly DateTimeOffset Created = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Later = new(2026, 10, 29, 3, 0, 0, TimeSpan.Zero);
    private static readonly Guid JerseyType = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");

    [Fact]
    public void FivePhotosTakeSlotsZeroToFourAndPositionsZeroToFourAndLinkToTheOrder()
    {
        var order = OpenOrder();

        for (var index = 0; index < OrderImageRules.MaxImagesPerOrder; index++)
        {
            var editVersion = order.EditVersion;

            var added = order.AddImage(Photo($"csps/orders/x/id{index}"), Later.AddMinutes(index));

            added.IsSuccess.ShouldBeTrue();
            added.Value.Slot.ShouldBe(index);
            added.Value.Position.ShouldBe(index);
            added.Value.OrderId.ShouldBe(order.Id);
            added.Value.Order.ShouldBeSameAs(order);
            added.Value.PublicId.ShouldBe($"csps/orders/x/id{index}");
            added.Value.Width.ShouldBe(640);
            added.Value.Height.ShouldBe(480);
            added.Value.Bytes.ShouldBe(12345);
            added.Value.Format.ShouldBe("jpg");
            order.EditVersion.ShouldNotBe(editVersion);
        }

        order.Images.Count.ShouldBe(5);
        order.Images.Select(image => image.Slot).ShouldBe([0, 1, 2, 3, 4]);
    }

    [Fact]
    public void TheSixthPhotoIsRefusedWithTheLimitMessageAndNothingChanges()
    {
        var order = FullOrder();
        var editVersion = order.EditVersion;

        var refused = order.AddImage(Photo("csps/orders/x/sixth"), Later);

        refused.IsFailure.ShouldBeTrue();
        refused.Error.Kind.ShouldBe(ErrorKind.BusinessRule);
        refused.Error.Code.ShouldBe("orders.images-full");
        refused.Error.Message.ShouldBe("This order already has 5 photos.");
        order.Images.Count.ShouldBe(5);
        order.EditVersion.ShouldBe(editVersion);
        OrderImageRules.MaxImagesPerOrder.ShouldBe(5);
    }

    [Fact]
    public void CheckCanAddImageAllowsAnOpenOrderWithRoomAndRefusesAFullOne()
    {
        OpenOrder().CheckCanAddImage().ShouldBeNull();

        var full = FullOrder().CheckCanAddImage().ShouldNotBeNull();

        full.Code.ShouldBe(OrderImageRules.LimitCode);
        full.Message.ShouldBe(OrderImageRules.TooManyMessage);
    }

    [Fact]
    public void ACancelledOrderRefusesAPhotoAsLocked()
    {
        var order = OpenOrder();
        order.ChangeStatus(OrderStatus.Cancelled, Guid.NewGuid(), Later).IsSuccess.ShouldBeTrue();
        var editVersion = order.EditVersion;

        var refused = order.AddImage(Photo("csps/orders/x/locked"), Later.AddHours(1));

        refused.Error.Code.ShouldBe(OrderRules.LockedCode);
        refused.Error.Message.ShouldBe(OrderRules.Locked(OrderStatus.Cancelled));
        order.CheckCanAddImage().ShouldNotBeNull().Code.ShouldBe(OrderRules.LockedCode);
        order.Images.ShouldBeEmpty();
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void ACompletedOrderRefusesAPhotoAsLocked()
    {
        var order = FreeOrder();
        order.ChangeStatus(OrderStatus.Completed, Guid.NewGuid(), Later).IsSuccess.ShouldBeTrue();

        var refused = order.AddImage(Photo("csps/orders/x/locked"), Later.AddHours(1));

        refused.Error.Code.ShouldBe(OrderRules.LockedCode);
        refused.Error.Message.ShouldBe(OrderRules.Locked(OrderStatus.Completed));
        order.Images.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("Order ORD-2026-0148 photo 1")]
    [InlineData("  Order ORD-2026-0148 photo 1  ")]
    public void ADescriptionThatIsEmptyOrTheDefaultTextIsKeptAsNull(string? description)
    {
        var order = OpenOrder();

        var added = order.AddImage(Photo("csps/orders/x/a") with { Description = description }, Later);

        added.Value.Description.ShouldBeNull();
    }

    [Fact]
    public void TheDefaultTextFollowsThePositionOfThePhoto()
    {
        var order = OpenOrder();
        order.AddImage(Photo("csps/orders/x/a"), Later).IsSuccess.ShouldBeTrue();

        var second = order.AddImage(Photo("csps/orders/x/b") with { Description = "Order ORD-2026-0148 photo 1" }, Later);

        second.Value.Description.ShouldBe("Order ORD-2026-0148 photo 1");
        OrderImageRules.DefaultDescription("ORD-2026-0148", 1).ShouldBe("Order ORD-2026-0148 photo 2");
    }

    [Fact]
    public void ADescriptionIsTrimmedAndTwoHundredCharactersAreKept()
    {
        var order = OpenOrder();
        var text = new string('d', OrderImageRules.DescriptionMaxLength);

        var added = order.AddImage(Photo("csps/orders/x/a") with { Description = $"  {text}  " }, Later);

        added.Value.Description.ShouldBe(text);
    }

    [Fact]
    public void ADescriptionOverTwoHundredCharactersIsRefusedOnTheDescriptionField()
    {
        var order = OpenOrder();
        var editVersion = order.EditVersion;

        var refused = order.AddImage(Photo("csps/orders/x/a") with { Description = new string('d', 201) }, Later);

        refused.Error.Kind.ShouldBe(ErrorKind.Validation);
        refused.Error.Message.ShouldBe("Keep the description to 200 characters or fewer.");
        refused.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["description"]);
        OrderImageRules.CheckDescription(new string('d', 201)).ShouldNotBeNull();
        OrderImageRules.CheckDescription(new string('d', 200)).ShouldBeNull();
        order.Images.ShouldBeEmpty();
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void MovingTheSecondPhotoToTheFrontMakesItTheCoverAndShiftsTheOthersRight()
    {
        var order = OrderWithPhotos(3);
        var editVersion = order.EditVersion;
        var second = order.Images[1];

        var moved = order.MoveImage(second.Id, 0, Later.AddHours(1));

        moved.IsSuccess.ShouldBeTrue();
        moved.Value.ShouldBe(new OrderImageMove(1, 0, 1));
        PhotoIdsInOrder(order).ShouldBe(["id1", "id0", "id2"]);
        order.Images.Select(image => image.Position).Order().ShouldBe([0, 1, 2]);
        order.Images.Select(image => image.Slot).Order().ShouldBe([0, 1, 2]);
        order.EditVersion.ShouldNotBe(editVersion);
    }

    [Fact]
    public void MovingTheCoverAwayFromTheFrontChangesTheCoverToTheNextPhoto()
    {
        var order = OrderWithPhotos(3);

        var moved = order.MoveImage(order.Images[0].Id, 2, Later.AddHours(1));

        moved.Value.ShouldBe(new OrderImageMove(0, 2, 1));
        PhotoIdsInOrder(order).ShouldBe(["id1", "id2", "id0"]);
    }

    [Fact]
    public void MovingAPhotoBetweenTwoOthersLeavesTheCoverAlone()
    {
        var order = OrderWithPhotos(4);

        var moved = order.MoveImage(order.Images[1].Id, 2, Later.AddHours(1));

        moved.Value.ShouldBe(new OrderImageMove(1, 2, null));
        PhotoIdsInOrder(order).ShouldBe(["id0", "id2", "id1", "id3"]);
    }

    [Fact]
    public void EveryMoveOfEveryPhotoAmongOneToFivePhotosKeepsThePlacesWholeAndTheOthersInOrder()
    {
        for (var count = 1; count <= OrderImageRules.MaxImagesPerOrder; count++)
        {
            for (var from = 0; from < count; from++)
            {
                for (var to = 0; to < count; to++)
                {
                    var order = OrderWithPhotos(count);
                    var before = PhotoIdsInOrder(order);
                    var moving = order.Images.Single(image => image.Position == from);
                    var slots = order.Images.ToDictionary(image => image.Id, image => image.Slot);

                    var moved = order.MoveImage(moving.Id, to, Later.AddHours(1));

                    var label = $"{count} photos, {from} to {to}";
                    moved.IsSuccess.ShouldBeTrue(label);
                    order.Images.Select(image => image.Position).Order().ShouldBe(Enumerable.Range(0, count), false, label);
                    moving.Position.ShouldBe(to, label);
                    var expected = before.ToList();
                    expected.RemoveAt(from);
                    expected.Insert(to, before[from]);
                    PhotoIdsInOrder(order).ShouldBe(expected, false, label);
                    order.Images.ShouldAllBe(image => image.Slot == slots[image.Id], label);
                    (moved.Value is null).ShouldBe(from == to, label);
                }
            }
        }
    }

    [Fact]
    public void MovingAPhotoToThePlaceItHasChangesNothingAndKeepsTheEditVersion()
    {
        var order = OrderWithPhotos(3);
        var editVersion = order.EditVersion;

        var moved = order.MoveImage(order.Images[1].Id, 1, Later.AddHours(1));

        moved.IsSuccess.ShouldBeTrue();
        moved.Value.ShouldBeNull();
        order.EditVersion.ShouldBe(editVersion);
        PhotoIdsInOrder(order).ShouldBe(["id0", "id1", "id2"]);
    }

    [Fact]
    public void MakingTheCoverTheCoverChangesNothing()
    {
        var order = OrderWithPhotos(2);
        var editVersion = order.EditVersion;

        order.MoveImage(order.Images[0].Id, 0, Later.AddHours(1)).Value.ShouldBeNull();

        order.EditVersion.ShouldBe(editVersion);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(3)]
    [InlineData(5)]
    public void APlaceBelowZeroOrAtOrAboveThePhotoCountIsRefusedOnThePositionField(int place)
    {
        var order = OrderWithPhotos(3);
        var editVersion = order.EditVersion;

        var refused = order.MoveImage(order.Images[0].Id, place, Later.AddHours(1));

        refused.Error.Kind.ShouldBe(ErrorKind.Validation);
        refused.Error.Message.ShouldBe(OrderRules.InvalidMessage);
        refused.Error.FieldErrors.ShouldNotBeNull()["position"].ShouldBe([OrderImageRules.PositionOutOfRangeMessage]);
        PhotoIdsInOrder(order).ShouldBe(["id0", "id1", "id2"]);
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void APhotoThatIsNotOnTheOrderAnswersNotFoundWithThePlainMessage()
    {
        var order = OrderWithPhotos(2);
        var editVersion = order.EditVersion;

        var refused = order.MoveImage(Guid.NewGuid(), 0, Later.AddHours(1));

        refused.Error.Kind.ShouldBe(ErrorKind.NotFound);
        refused.Error.Code.ShouldBe("orders.image-not-found");
        refused.Error.Message.ShouldBe("This photo is no longer on this order.");
        order.EditVersion.ShouldBe(editVersion);
    }

    [Theory]
    [InlineData(OrderStatus.Completed)]
    [InlineData(OrderStatus.Cancelled)]
    public void AClosedOrderRefusesAMoveAsLockedAndNothingChanges(OrderStatus status)
    {
        var order = OrderWithPhotos(3, unitPrice: 0m);
        order.ChangeStatus(status, Guid.NewGuid(), Later.AddHours(1)).IsSuccess.ShouldBeTrue();
        var editVersion = order.EditVersion;

        var refused = order.MoveImage(order.Images[2].Id, 0, Later.AddHours(2));

        refused.Error.Code.ShouldBe(OrderRules.LockedCode);
        refused.Error.Message.ShouldBe(OrderRules.Locked(status));
        PhotoIdsInOrder(order).ShouldBe(["id0", "id1", "id2"]);
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void ADescriptionIsTrimmedStoredAndReportedAsAChange()
    {
        var order = OrderWithPhotos(2);
        var editVersion = order.EditVersion;

        var described = order.DescribeImage(order.Images[0].Id, "  Front mockup  ", Later.AddHours(1));

        described.IsSuccess.ShouldBeTrue();
        described.Value.ShouldBe(new OrderImageDescriptionChange(null, "Front mockup"));
        order.Images[0].Description.ShouldBe("Front mockup");
        order.EditVersion.ShouldNotBe(editVersion);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("Order ORD-2026-0148 photo 2")]
    [InlineData("  Order ORD-2026-0148 photo 2  ")]
    public void AnEmptyDescriptionOrTheDefaultTextOfThePhotoPlaceClearsTheStoredText(string text)
    {
        var order = OrderWithPhotos(2);
        order.DescribeImage(order.Images[1].Id, "Back print", Later.AddHours(1)).IsSuccess.ShouldBeTrue();

        var cleared = order.DescribeImage(order.Images[1].Id, text, Later.AddHours(2));

        cleared.Value.ShouldBe(new OrderImageDescriptionChange("Back print", null));
        order.Images[1].Description.ShouldBeNull();
    }

    [Fact]
    public void ADescriptionNotChangedReturnsNullAndKeepsTheEditVersion()
    {
        var order = OrderWithPhotos(2);
        order.DescribeImage(order.Images[0].Id, "Front mockup", Later.AddHours(1)).IsSuccess.ShouldBeTrue();
        var editVersion = order.EditVersion;

        order.DescribeImage(order.Images[0].Id, "Front mockup", Later.AddHours(2)).Value.ShouldBeNull();
        order.DescribeImage(order.Images[0].Id, " Front mockup ", Later.AddHours(2)).Value.ShouldBeNull();
        order.DescribeImage(order.Images[1].Id, null, Later.AddHours(2)).Value.ShouldBeNull();

        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void TheDefaultTextOfAnotherPlaceIsKeptAsTypedText()
    {
        var order = OrderWithPhotos(2);

        var described = order.DescribeImage(order.Images[0].Id, "Order ORD-2026-0148 photo 2", Later.AddHours(1));

        described.Value.ShouldBe(new OrderImageDescriptionChange(null, "Order ORD-2026-0148 photo 2"));
    }

    [Fact]
    public void AStoredNothingStillShowsTheDefaultOfTheNewPlaceAfterAMove()
    {
        var order = OrderWithPhotos(3);
        var last = order.Images[2];

        order.MoveImage(last.Id, 0, Later.AddHours(1)).IsSuccess.ShouldBeTrue();

        last.Description.ShouldBeNull();
        OrderImageRules.DefaultDescription(order.Number, last.Position).ShouldBe("Order ORD-2026-0148 photo 1");
    }

    [Fact]
    public void ADescriptionOfTwoHundredCharactersIsKeptAndOneOfTwoHundredAndOneIsRefused()
    {
        var order = OrderWithPhotos(1);
        var editVersion = order.EditVersion;

        order.DescribeImage(order.Images[0].Id, new string('d', 200), Later.AddHours(1)).IsSuccess.ShouldBeTrue();
        var versionAfterFit = order.EditVersion;
        var refused = order.DescribeImage(order.Images[0].Id, new string('e', 201), Later.AddHours(2));

        refused.Error.Kind.ShouldBe(ErrorKind.Validation);
        refused.Error.Code.ShouldBe("orders.image-description-too-long");
        refused.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["description"]);
        order.Images[0].Description.ShouldBe(new string('d', 200));
        order.EditVersion.ShouldBe(versionAfterFit);
        versionAfterFit.ShouldNotBe(editVersion);
    }

    [Fact]
    public void TheLimitCountsUtf16CodeUnitsLikeTheBrowser()
    {
        var order = OrderWithPhotos(1);
        var emoji = char.ConvertFromUtf32(0x1F600);

        order.DescribeImage(order.Images[0].Id, string.Concat(Enumerable.Repeat(emoji, 100)), Later.AddHours(1)).IsSuccess.ShouldBeTrue();
        order.DescribeImage(order.Images[0].Id, string.Concat(Enumerable.Repeat(emoji, 101)), Later.AddHours(2)).IsFailure.ShouldBeTrue();
    }

    [Fact]
    public void APhotoThatIsNotOnTheOrderCannotBeDescribed()
    {
        var order = OrderWithPhotos(1);

        var refused = order.DescribeImage(Guid.NewGuid(), "Front", Later.AddHours(1));

        refused.Error.Code.ShouldBe("orders.image-not-found");
        refused.Error.Kind.ShouldBe(ErrorKind.NotFound);
    }

    [Theory]
    [InlineData(OrderStatus.Completed)]
    [InlineData(OrderStatus.Cancelled)]
    public void AClosedOrderRefusesADescriptionAsLocked(OrderStatus status)
    {
        var order = OrderWithPhotos(1, unitPrice: 0m);
        order.ChangeStatus(status, Guid.NewGuid(), Later.AddHours(1)).IsSuccess.ShouldBeTrue();
        var editVersion = order.EditVersion;

        var refused = order.DescribeImage(order.Images[0].Id, "Front", Later.AddHours(2));

        refused.Error.Code.ShouldBe(OrderRules.LockedCode);
        order.Images[0].Description.ShouldBeNull();
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void RemovingAMiddlePhotoTakesItOffClosesTheGapAndMovesTheEditVersion()
    {
        var order = OrderWithPhotos(3);
        var editVersion = order.EditVersion;
        var middle = order.Images[1];

        var removed = order.RemoveImage(middle.Id, Later.AddHours(1));

        removed.IsSuccess.ShouldBeTrue();
        removed.Value.ShouldBeSameAs(middle);
        removed.Value.PublicId.ShouldBe("csps/orders/x/id1");
        removed.Value.Position.ShouldBe(1);
        PhotoIdsInOrder(order).ShouldBe(["id0", "id2"]);
        order.Images.Select(image => image.Position).Order().ShouldBe([0, 1]);
        order.EditVersion.ShouldNotBe(editVersion);
    }

    [Fact]
    public void RemovingTheCoverMakesTheNextPhotoTheCover()
    {
        var order = OrderWithPhotos(3);

        order.RemoveImage(order.Images[0].Id, Later.AddHours(1)).IsSuccess.ShouldBeTrue();

        PhotoIdsInOrder(order).ShouldBe(["id1", "id2"]);
        order.Images.Single(image => image.Position == 0).PublicId.ShouldBe("csps/orders/x/id1");
    }

    [Fact]
    public void RemovingTheOnlyPhotoLeavesTheOrderWithNone()
    {
        var order = OrderWithPhotos(1);

        order.RemoveImage(order.Images[0].Id, Later.AddHours(1)).IsSuccess.ShouldBeTrue();

        order.Images.ShouldBeEmpty();
    }

    [Fact]
    public void ARemovedPhotosSlotIsTheLowestFreeSlotForTheNextPhoto()
    {
        var order = OrderWithPhotos(3);
        order.RemoveImage(order.Images[1].Id, Later.AddHours(1)).IsSuccess.ShouldBeTrue();

        var added = order.AddImage(Photo("csps/orders/x/again"), Later.AddHours(2));

        added.Value.Slot.ShouldBe(1);
        added.Value.Position.ShouldBe(2);
    }

    [Fact]
    public void APhotoThatIsNotOnTheOrderCannotBeRemoved()
    {
        var order = OrderWithPhotos(2);
        var editVersion = order.EditVersion;

        var refused = order.RemoveImage(Guid.NewGuid(), Later.AddHours(1));

        refused.Error.Kind.ShouldBe(ErrorKind.NotFound);
        refused.Error.Code.ShouldBe("orders.image-not-found");
        PhotoIdsInOrder(order).ShouldBe(["id0", "id1"]);
        order.EditVersion.ShouldBe(editVersion);
    }

    [Theory]
    [InlineData(OrderStatus.Completed)]
    [InlineData(OrderStatus.Cancelled)]
    public void AClosedOrderRefusesARemoveAsLockedAndKeepsThePhoto(OrderStatus status)
    {
        var order = OrderWithPhotos(2, unitPrice: 0m);
        order.ChangeStatus(status, Guid.NewGuid(), Later.AddHours(1)).IsSuccess.ShouldBeTrue();
        var editVersion = order.EditVersion;

        var refused = order.RemoveImage(order.Images[0].Id, Later.AddHours(2));

        refused.Error.Code.ShouldBe(OrderRules.LockedCode);
        refused.Error.Message.ShouldBe(OrderRules.Locked(status));
        PhotoIdsInOrder(order).ShouldBe(["id0", "id1"]);
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void EverySequenceOfThreeMovesAndRemovesAmongOneToFivePhotosKeepsThePlacesWhole()
    {
        var sequences = 0;
        for (var count = 1; count <= OrderImageRules.MaxImagesPerOrder; count++)
        {
            sequences += CheckEverySequence(count, count, 3, []);
        }

        sequences.ShouldBeGreaterThan(1000);
    }

    [Fact]
    public void TwoHundredSeededSequencesOfTwentyMovesRemovesAndAddsKeepThePlacesWholeAndTheSlotsApart()
    {
        for (var seed = 0; seed < 200; seed++)
        {
            var random = new Seeded(20261031UL + (ulong)seed);
            var order = OrderWithPhotos(random.Next(1, OrderImageRules.MaxImagesPerOrder + 1));
            var model = PhotoIdsInOrder(order).ToList();
            var added = 0;

            for (var step = 0; step < 20; step++)
            {
                var label = $"seed {seed}, step {step}";
                var choices = new List<string>();
                if (model.Count > 0)
                {
                    choices.AddRange(["move", "remove"]);
                }

                if (model.Count < OrderImageRules.MaxImagesPerOrder)
                {
                    choices.Add("add");
                }

                switch (choices[random.Next(choices.Count)])
                {
                    case "move":
                        var from = random.Next(model.Count);
                        var to = random.Next(model.Count);
                        order.MoveImage(order.Images.Single(image => image.Position == from).Id, to, Later.AddHours(step + 1)).IsSuccess.ShouldBeTrue(label);
                        var moving = model[from];
                        model.RemoveAt(from);
                        model.Insert(to, moving);
                        break;
                    case "remove":
                        var gone = random.Next(model.Count);
                        order.RemoveImage(order.Images.Single(image => image.Position == gone).Id, Later.AddHours(step + 1)).IsSuccess.ShouldBeTrue(label);
                        model.RemoveAt(gone);
                        break;
                    default:
                        var name = $"new{added++}";
                        order.AddImage(Photo($"csps/orders/x/{name}"), Later.AddHours(step + 1)).IsSuccess.ShouldBeTrue(label);
                        model.Add(name);
                        break;
                }

                AssertPlacesWhole(order, model, label);
            }
        }
    }

    private static int CheckEverySequence(int photos, int remaining, int depth, List<Step> steps)
    {
        if (depth == 0 || remaining == 0)
        {
            Replay(photos, steps);
            return 1;
        }

        var total = 0;
        for (var from = 0; from < remaining; from++)
        {
            for (var to = 0; to < remaining; to++)
            {
                steps.Add(new Step(false, from, to));
                total += CheckEverySequence(photos, remaining, depth - 1, steps);
                steps.RemoveAt(steps.Count - 1);
            }

            steps.Add(new Step(true, from, from));
            total += CheckEverySequence(photos, remaining - 1, depth - 1, steps);
            steps.RemoveAt(steps.Count - 1);
        }

        return total;
    }

    private static void Replay(int photos, List<Step> steps)
    {
        var order = OrderWithPhotos(photos);
        var model = PhotoIdsInOrder(order).ToList();
        string Label() => $"{photos} photos, steps {string.Join(" then ", steps.Select(step => step.Remove ? $"remove {step.From}" : $"move {step.From} to {step.To}"))}";
        foreach (var step in steps)
        {
            var photo = order.Images.First(image => image.Position == step.From);
            var worked = step.Remove
                ? order.RemoveImage(photo.Id, Later.AddHours(1)).IsSuccess
                : order.MoveImage(photo.Id, step.To, Later.AddHours(1)).IsSuccess;
            if (!worked)
            {
                Assert.Fail($"A step was refused: {Label()}");
            }

            var id = model[step.From];
            model.RemoveAt(step.From);
            if (!step.Remove)
            {
                model.Insert(step.To, id);
            }

            AssertPlacesWhole(order, model, Label);
        }
    }

    private static void AssertPlacesWhole(Order order, List<string> model, string label) => AssertPlacesWhole(order, model, () => label);

    private static void AssertPlacesWhole(Order order, List<string> model, Func<string> label)
    {
        var positions = order.Images.Select(image => image.Position).Order().ToList();
        if (!positions.SequenceEqual(Enumerable.Range(0, model.Count)))
        {
            Assert.Fail($"Places are not 0 to n-1 ({string.Join(",", positions)}): {label()}");
        }

        if (!PhotoIdsInOrder(order).SequenceEqual(model))
        {
            Assert.Fail($"Photos are out of order ({string.Join(",", PhotoIdsInOrder(order))} instead of {string.Join(",", model)}): {label()}");
        }

        if (order.Images.Select(image => image.Slot).Distinct().Count() != model.Count || order.Images.Any(image => image.Slot < 0 || image.Slot >= OrderImageRules.MaxImagesPerOrder))
        {
            Assert.Fail($"Slots clash or are out of range: {label()}");
        }
    }

    private readonly record struct Step(bool Remove, int From, int To);

    /// <summary>A small repeatable number source (xorshift), so a failing seed can be replayed; it is not used for anything secret.</summary>
    private sealed class Seeded(ulong seed)
    {
        private ulong _state = seed * 0x9E3779B97F4A7C15UL + 1;

        public int Next(int minInclusive, int maxExclusive) => minInclusive + Next(maxExclusive - minInclusive);

        public int Next(int maxExclusive)
        {
            _state ^= _state << 13;
            _state ^= _state >> 7;
            _state ^= _state << 17;
            return (int)((_state >> 33) % (ulong)maxExclusive);
        }
    }

    private static string[] PhotoIdsInOrder(Order order) =>
        [.. order.Images.OrderBy(image => image.Position).Select(image => image.PublicId.Split('/')[^1])];

    private static Order OrderWithPhotos(int count, decimal unitPrice = 650.00m)
    {
        var order = OrderWith(unitPrice);
        for (var index = 0; index < count; index++)
        {
            order.AddImage(Photo($"csps/orders/x/id{index}"), Later.AddMinutes(index)).IsSuccess.ShouldBeTrue();
        }

        return order;
    }

    private static NewOrderImage Photo(string publicId) => new(publicId, 640, 480, 12345, "jpg", null);

    private static Order OpenOrder() => OrderWith(650.00m);

    private static Order FreeOrder() => OrderWith(0m);

    private static Order FullOrder()
    {
        var order = OpenOrder();
        for (var index = 0; index < OrderImageRules.MaxImagesPerOrder; index++)
        {
            order.AddImage(Photo($"csps/orders/x/id{index}"), Later).IsSuccess.ShouldBeTrue();
        }

        return order;
    }

    private static Order OrderWith(decimal unitPrice)
    {
        var details = new OrderDetails(
            "Juan Dela Cruz",
            "Brgy. San Roque Ballers",
            "0917 123 4567",
            "juan.dc@example.com",
            null,
            new DateOnly(2026, 10, 28),
            new DateOnly(2026, 11, 11),
            null);
        var order = Order.Create(new NewOrder(details, OrderStatus.Pending, [new NewOrderItem(JerseyType, "Jersey top", "S-XL", 15, unitPrice)]), Guid.NewGuid(), Created).Value;
        order.AssignNumber("ORD-2026-0148");
        return order;
    }
}

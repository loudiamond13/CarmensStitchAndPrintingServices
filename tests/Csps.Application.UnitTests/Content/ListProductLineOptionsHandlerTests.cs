using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Domain.Content;
using NSubstitute;

namespace Csps.Application.UnitTests.Content;

/// <summary>D-09, D-16: the order window is offered the active product lines, in display order, as id, title and short name and nothing else.</summary>
public sealed class ListProductLineOptionsHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task OnlyTheActiveLinesAreOfferedInTheOrderTheStoreGaveThem()
    {
        var basketball = ProductLine.FromSeed(ProductLineSeed.All[0], null, null, Now);
        var hidden = ProductLine.FromSeed(ProductLineSeed.All[1], null, null, Now);
        hidden.Hide().ShouldBeTrue();
        var polo = ProductLine.FromSeed(ProductLineSeed.All[4], null, null, Now);
        var lines = Substitute.For<IProductLines>();
        lines.ListAsync(Arg.Any<CancellationToken>()).Returns(
            Task.FromResult<IReadOnlyList<ProductLineListRow>>(
            [
                new ProductLineListRow(basketball, [], 0, 0),
                new ProductLineListRow(hidden, [], 0, 0),
                new ProductLineListRow(polo, [Guid.NewGuid()], 2, 3),
            ]));

        var result = await new ListProductLineOptionsHandler(lines).HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(
        [
            new ProductLineOptionDto(basketball.Id, basketball.Title, basketball.ShortName),
            new ProductLineOptionDto(polo.Id, polo.Title, polo.ShortName),
        ]);
    }

    [Fact]
    public async Task NoLinesGivesAnEmptyList()
    {
        var lines = Substitute.For<IProductLines>();
        lines.ListAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult<IReadOnlyList<ProductLineListRow>>([]));

        var result = await new ListProductLineOptionsHandler(lines).HandleAsync(TestContext.Current.CancellationToken);

        result.Value.ShouldBeEmpty();
    }
}

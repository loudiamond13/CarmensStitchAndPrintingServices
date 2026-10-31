using Csps.Application.Ports;
using Csps.Application.Staff;
using NSubstitute;

namespace Csps.Application.UnitTests.Staff;

/// <summary>CEXP-05: the staff lookup passes the directory's people through unchanged.</summary>
public sealed class ListStaffHandlerTests
{
    [Fact]
    public async Task ThePeopleComeBackInTheDirectoryOrder()
    {
        var people = new[] { new StaffMember(Guid.NewGuid(), "Abel Aquino"), new StaffMember(Guid.NewGuid(), "Mina Mercado") };
        var directory = Substitute.For<IStaffDirectory>();
        directory.ListActiveStaffAsync(TestContext.Current.CancellationToken).Returns(people);

        var result = await new ListStaffHandler(directory).HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(people);
    }
}

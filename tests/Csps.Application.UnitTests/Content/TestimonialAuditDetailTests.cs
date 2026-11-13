using Csps.Application.Content;
using Csps.Domain.Auditing;
using Csps.Domain.Content;

namespace Csps.Application.UnitTests.Content;

/// <summary>AUDIT-01, T-11-54: the testimonial audit details always fit the column, so an edit can never fail on a long encoded name.</summary>
public sealed class TestimonialAuditDetailTests
{
    [Fact]
    public void AChangedDetailWithTheLongestEncodedNamesStillFitsAndKeepsTheFieldsPair()
    {
        var longest = new string(';', 60);
        var change = new TestimonialChanges(["quote", "name", "teamOrRole", "stars"], longest, longest, 1, 5, null);

        var detail = TestimonialAuditDetail.Changed(change);

        detail.Length.ShouldBeLessThanOrEqualTo(AuditEntry.DetailMaxLength);
        detail.ShouldStartWith("fields=quote,name,teamOrRole,stars");
        detail.ShouldContain("stars=1>5");
    }

    [Fact]
    public void AChangedDetailThatFitsKeepsEveryPair()
    {
        var change = new TestimonialChanges(["name", "stars"], "Juan", "Juan D.", 4, 5, null);

        TestimonialAuditDetail.Changed(change).ShouldBe("fields=name,stars;name=Juan>Juan D.;stars=4>5");
    }
}

using Csps.Application.Content;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Auditing;
using NSubstitute;

namespace Csps.Application.UnitTests.Content;

/// <summary>D-11, CWE-532: the test goes to the saved address only, is audited without the address, and is refused without one.</summary>
public sealed class SendQuoteAlertTestHandlerTests
{
    private const string Saved = "quotes@example.com";

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    [Fact]
    public async Task TheTestGoesToTheTrimmedSavedAddressAndIsAuditedWithNoDetailInOneSave()
    {
        var harness = new Harness($"  {Saved} ");

        var result = await harness.Handler.HandleAsync(Token);

        result.IsSuccess.ShouldBeTrue();
        harness.Outbox.Emails.ShouldHaveSingleItem().ShouldBeOfType<QuoteAlertTestEmail>().To.ShouldBe(Saved);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        (entry.Action, entry.TargetType, entry.TargetId, entry.Detail).ShouldBe((AuditActions.QuoteAlertsTestSent, "SiteSettings", "1", null));
        harness.Unit.Saves.ShouldBe(1);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task NoSavedAddressAnswers409AndSendsNothing(string saved)
    {
        var harness = new Harness(saved);

        var result = await harness.Handler.HandleAsync(Token);

        result.Error.ShouldBe(SiteContentErrors.NoQuoteAlertsAddress);
        result.Error.Code.ShouldBe("site-settings.no-quote-alerts-address");
        harness.Outbox.Emails.ShouldBeEmpty();
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AnAddressThatCanNeverReceiveMailAnswers422AndIsNotAudited()
    {
        var harness = new Harness("quotes@example.invalid");
        harness.Outbox.FailWith = new UndeliverableRecipientException();

        var result = await harness.Handler.HandleAsync(Token);

        result.Error.ShouldBe(SiteContentErrors.QuoteAlertsAddressUndeliverable);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    private sealed class Harness
    {
        public Harness(string saved)
        {
            var store = Substitute.For<ISiteContentStore>();
            store.GetQuoteAlertsEmailAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult(saved));
            Handler = new SendQuoteAlertTestHandler(store, Outbox, Audit, Unit);
        }

        public RecordingOutbox Outbox { get; } = new();

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public SendQuoteAlertTestHandler Handler { get; }
    }
}

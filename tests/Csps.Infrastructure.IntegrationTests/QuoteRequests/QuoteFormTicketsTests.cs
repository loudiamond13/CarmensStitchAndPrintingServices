using System.Globalization;
using Csps.Application.Ports;
using Csps.Application.QuoteRequests;
using Csps.Infrastructure.QuoteRequests;
using Microsoft.AspNetCore.DataProtection;

namespace Csps.Infrastructure.IntegrationTests.QuoteRequests;

/// <summary>INQ-03, D-25: a form ticket is signed by the server, holds its issue time, and is refused when old, changed or not ours.</summary>
public sealed class QuoteFormTicketsTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 22, 10, 0, 0, TimeSpan.Zero);
    private readonly EphemeralDataProtectionProvider _provider = new();

    [Fact]
    public void ATicketReadsBackWithItsAge()
    {
        var tickets = Tickets();

        var reading = tickets.Read(tickets.Issue(Start), Start + TimeSpan.FromSeconds(7));

        reading.IsValid.ShouldBeTrue();
        reading.Age.ShouldBe(TimeSpan.FromSeconds(7));
    }

    [Fact]
    public void ATicketExactlyAsOldAsItsLifetimeIsGoodAndOneTickOlderIsNot()
    {
        var tickets = Tickets();
        var ticket = tickets.Issue(Start);

        tickets.Read(ticket, Start + TimeSpan.FromHours(24)).IsValid.ShouldBeTrue();
        tickets.Read(ticket, Start + TimeSpan.FromHours(24) + TimeSpan.FromTicks(1)).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void AClockThatMovedBackReadsAsAgeZero()
    {
        var tickets = Tickets();

        var reading = tickets.Read(tickets.Issue(Start), Start - TimeSpan.FromSeconds(30));

        reading.IsValid.ShouldBeTrue();
        reading.Age.ShouldBe(TimeSpan.Zero);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not-a-ticket")]
    public void AMissingOrNonsenseTicketIsExpired(string? ticket)
    {
        Tickets().Read(ticket, Start).ShouldBe(QuoteTicketReading.Expired);
    }

    [Fact]
    public void AChangedTicketIsExpired()
    {
        var tickets = Tickets();
        var ticket = tickets.Issue(Start);
        var changed = ticket[..^1] + (ticket[^1] == 'A' ? 'B' : 'A');

        tickets.Read(changed, Start).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void ATicketFromAnotherPurposeOrKeyRingIsExpired()
    {
        var tickets = Tickets();
        var otherPurpose = _provider.CreateProtector("some.other.purpose").ToTimeLimitedDataProtector().Protect("1", TimeSpan.FromHours(1));
        var otherRing = new QuoteFormTickets(new EphemeralDataProtectionProvider(), new QuoteRequestSettings()).Issue(Start);

        tickets.Read(otherPurpose, Start).IsValid.ShouldBeFalse();
        tickets.Read(otherRing, Start).IsValid.ShouldBeFalse();
    }

    [Theory]
    [InlineData("12 34")]
    [InlineData("-5")]
    [InlineData("99999999999999999999999")]
    [InlineData("3155378976000000000")]
    public void ASignedTicketWithoutAUsableTimeIsExpired(string payload)
    {
        var signed = _provider.CreateProtector("Csps.QuoteTicket.v1").ToTimeLimitedDataProtector().Protect(payload, TimeSpan.FromHours(1));

        Tickets().Read(signed, Start).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void ASignedTicketHoldingTheLastTickOfTimeCannotBreakTheRead()
    {
        var ticks = DateTimeOffset.MaxValue.UtcTicks.ToString(CultureInfo.InvariantCulture);
        var signed = _provider.CreateProtector("Csps.QuoteTicket.v1").ToTimeLimitedDataProtector().Protect(ticks, TimeSpan.FromHours(1));

        Tickets().Read(signed, Start).IsValid.ShouldBeTrue();
    }

    private QuoteFormTickets Tickets() => new(_provider, new QuoteRequestSettings());
}

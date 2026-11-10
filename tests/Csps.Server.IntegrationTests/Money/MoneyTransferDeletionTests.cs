using System.Globalization;
using System.Net;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Money;

/// <summary>
/// MONEY-06, D-23, D-33, D-35, D-52, SEC-07, OD-19: a Manager deletes a wrong transfer with its version, both balances move back at
/// once, the audit log says who did it, and an Admin is refused.
/// </summary>
public sealed class MoneyTransferDeletionTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const int Rounds = 3;
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AManagerDeletesATransferWithItsVersionAndBothBalancesMoveBackAtOnce()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);
        var (id, version) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 2000.00m, world.Today, "Cash for thread");
        (await MoneyFixtures.ReadBalanceAsync(world.Client, world.Paolo.AccessToken)).ShouldBe(0.00m);
        (await MoneyFixtures.ReadBalanceAsync(world.Client, world.Liza.AccessToken)).ShouldBe(2000.00m);

        using var response = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, id, version);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await MoneyFixtures.ReadBalanceAsync(world.Client, world.Paolo.AccessToken)).ShouldBe(2000.00m);
        (await MoneyFixtures.ReadBalanceAsync(world.Client, world.Liza.AccessToken)).ShouldBe(0.00m);
        var row = (await MoneyFixtures.ReadTransfersAsync(world.Database)).Single(transfer => transfer.Id == id);
        row.DeletedById.ShouldBe(world.Carmen.UserId);
        row.DeletedAtUtc.ShouldNotBeNull();
        row.Amount.ShouldBe(2000.00m);
    }

    [Fact]
    public async Task TheDeleteWritesOneAuditEntryWithTheManagerAsActorAndNoNoteText()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);
        var (id, version) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 2000.00m, world.Today, "Cash for thread");

        using var response = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, id, version);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var entry = (await MoneyFixtures.ReadAuditAsync(world.Database, AuditActions.MoneyTransferDeleted, world.Carmen.UserId)).ShouldHaveSingleItem();
        entry.ActorUserId.ShouldBe(world.Carmen.UserId);
        entry.TargetType.ShouldBe("MoneyTransfer");
        entry.TargetId.ShouldBe(id.ToString("D"));
        entry.Detail.ShouldBe(
            $"from={world.Paolo.UserId:D};to={world.Liza.UserId:D};amount=2000.00;date={world.Today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)};note=yes;recordedBy={world.Paolo.UserId:D}");
        entry.Detail.ShouldNotBeNull().ShouldNotContain("thread", Case.Insensitive);
    }

    [Fact]
    public async Task AnAdminGets403AndNothingChanges()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);
        var (id, version) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 500.00m, world.Today);

        using var response = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Paolo.AccessToken, id, version);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await MoneyFixtures.ReadTransfersAsync(world.Database)).Single(transfer => transfer.Id == id).IsDeleted.ShouldBeFalse();
        (await MoneyFixtures.ReadAuditAsync(world.Database, AuditActions.MoneyTransferDeleted, world.Paolo.UserId)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AnAnonymousDeleteGets401()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await MoneyFixtures.DeleteTransferAsync(client, null, Guid.NewGuid(), "AAAAAAAAB9E=");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AStaleVersionIs409WithTheStaleMessageAndChangesNothing()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);
        var (id, version) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 500.00m, world.Today);
        var older = Convert.FromBase64String(version);
        older[^1] ^= 0x01;

        using var response = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, id, Convert.ToBase64String(older));

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("edit.stale");
        problem.GetProperty("detail").GetString().ShouldBe("This was changed by someone else. Reload and try again.");
        (await MoneyFixtures.ReadTransfersAsync(world.Database)).Single(transfer => transfer.Id == id).IsDeleted.ShouldBeFalse();
        (await MoneyFixtures.ReadAuditAsync(world.Database, AuditActions.MoneyTransferDeleted, world.Carmen.UserId)).ShouldBeEmpty();
        (await MoneyFixtures.ReadBalanceAsync(world.Client, world.Liza.AccessToken)).ShouldBe(500.00m);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("abc")]
    [InlineData("AAAAAAAAB9E")]
    public async Task AMissingVersionOrAMalformedOneIs400UnderVersionBeforeAnyLookup(string? version)
    {
        await using var world = await StartWorldAsync(paoloMoney: 0m);

        using var response = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, Guid.NewGuid(), version);

        (await MoneyFixtures.ReadFieldErrorsAsync(response, "version")).ShouldBe(["Reload the form and try again."]);
    }

    [Fact]
    public async Task APlusSlashVersionSentUrlEncodedIsReadAndReachesTheLookup()
    {
        await using var world = await StartWorldAsync(paoloMoney: 0m);
        var version = Convert.ToBase64String([0xFB, 0xFF, 0xBF, 0xFB, 0xFF, 0xBF, 0xFB, 0xFF]);
        version.ShouldContain('+');
        version.ShouldContain('/');

        using var response = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, Guid.NewGuid(), version);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeletingTheSameTransferTwiceIs404AndWritesNoSecondAuditEntry()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);
        var (id, version) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 500.00m, world.Today);
        using (var first = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, id, version))
        {
            first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        using var second = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, id, version);

        second.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(second, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("money-transfers.not-found");
        problem.GetProperty("detail").GetString().ShouldBe("This transfer wasn't found.");
        (await MoneyFixtures.ReadAuditAsync(world.Database, AuditActions.MoneyTransferDeleted, world.Carmen.UserId)).Count.ShouldBe(1);
    }

    [Fact]
    public async Task AnUnknownIdIs404()
    {
        await using var world = await StartWorldAsync(paoloMoney: 0m);

        using var response = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, Guid.NewGuid(), "AAAAAAAAB9E=");

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await MoneyFixtures.ReadAuditAsync(world.Database, AuditActions.MoneyTransferDeleted, world.Carmen.UserId)).ShouldBeEmpty();
    }

    [Fact]
    public async Task ARaceBetweenTwoDeletesWithTheSameVersionGivesOneWinnerAndOneAuditEntry()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);

        for (var round = 1; round <= Rounds; round++)
        {
            var (id, version) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 100.00m, world.Today);

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, id, version),
                () => MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, id, version));
            using var firstResponse = first;
            using var secondResponse = second;

            var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
            statuses.Count(status => status == HttpStatusCode.NoContent).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            statuses.Single(status => status != HttpStatusCode.NoContent).ShouldBeOneOf([HttpStatusCode.NotFound, HttpStatusCode.Conflict], $"round {round}");
            var key = id.ToString("D");
            var entries = await MoneyFixtures.ReadAuditAsync(world.Database, AuditActions.MoneyTransferDeleted, world.Carmen.UserId);
            entries.Count(entry => entry.TargetId == key).ShouldBe(1, $"round {round}");
        }
    }

    [Fact]
    public async Task ADeleteThatLeavesTheRecipientBelowZeroIsAllowedAndTheirBalanceReadsNegative()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);
        var (id, version) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 1000.00m, world.Today);
        await MoneyFixtures.SeedCompanyExpenseAsync(world.Database, world.Liza.UserId, world.Liza.UserId, 500.00m, world.Today, Now);
        (await MoneyFixtures.ReadBalanceAsync(world.Client, world.Liza.AccessToken)).ShouldBe(500.00m);

        using var response = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, id, version);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await MoneyFixtures.ReadBalanceAsync(world.Client, world.Liza.AccessToken)).ShouldBe(-500.00m);
        (await MoneyFixtures.ReadBalanceAsync(world.Client, world.Paolo.AccessToken)).ShouldBe(2000.00m);
    }

    [Fact]
    public async Task AManagerMayDeleteATransferTheySentAndOneTheyReceived()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);
        await MoneyFixtures.SeedPaymentAsync(world.Database, world.Carmen.UserId, "ORD-2026-0002", 500.00m, world.Today, Now);
        var (sent, sentVersion) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Carmen.AccessToken, world.Liza.UserId, 300.00m, world.Today);
        var (received, receivedVersion) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Carmen.UserId, 400.00m, world.Today);
        (await MoneyFixtures.ReadBalanceAsync(world.Client, world.Carmen.AccessToken)).ShouldBe(600.00m);

        using var deleteSent = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, sent, sentVersion);
        using var deleteReceived = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, received, receivedVersion);

        deleteSent.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        deleteReceived.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await MoneyFixtures.ReadBalanceAsync(world.Client, world.Carmen.AccessToken)).ShouldBe(500.00m);
        (await MoneyFixtures.ReadAuditAsync(world.Database, AuditActions.MoneyTransferDeleted, world.Carmen.UserId)).Count.ShouldBe(2);
    }

    [Fact]
    public async Task NoEmailIsQueuedByATransferAHandoverOrADelete()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);
        var jomar = await MoneyFixtures.StartStaffAsync(world.Factory, world.Database, Roles.Admin, "Jomar", "Santos");
        await MoneyFixtures.SeedPaymentAsync(world.Database, jomar.UserId, "ORD-2026-0003", 700.00m, world.Today, Now);
        await MoneyFixtures.DeactivateAccountAsync(world.Database, jomar.UserId);
        var before = await CountEmailsAsync(world.Database);

        var (id, version) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 100.00m, world.Today);
        using var handover = await MoneyFixtures.PostHandoverAsync(world.Client, world.Carmen.AccessToken, jomar.UserId, world.Liza.UserId, 700.00m, world.Today);
        using var delete = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, id, version);

        handover.StatusCode.ShouldBe(HttpStatusCode.Created);
        delete.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await CountEmailsAsync(world.Database)).ShouldBe(before);
    }

    [Fact]
    public async Task AnAdminGetsTheSame403ForALiveADeletedAndAnUnknownTransferWithNoFigureOrName()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);
        var (live, liveVersion) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 321.00m, world.Today);
        var (gone, goneVersion) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 654.00m, world.Today);
        using (var deleted = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, gone, goneVersion))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var bodies = new List<string>();
        foreach (var (id, version) in new[] { (live, liveVersion), (gone, goneVersion), (Guid.NewGuid(), "AAAAAAAAB9E="), (Guid.NewGuid(), (string?)null) })
        {
            using var response = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Liza.AccessToken, id, version);
            response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
            bodies.Add(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        foreach (var body in bodies)
        {
            body.ShouldNotContain("321");
            body.ShouldNotContain("654");
            body.ShouldNotContain("Paolo");
            body.ShouldNotContain("Carmen");
            body.ShouldNotContain(world.Paolo.UserId.ToString("D"));
        }
    }

    [Fact]
    public async Task RemovingALiveTransferIs422DeleteTheTransferFirstAndNothingChanges()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);
        var (id, _) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 500.00m, world.Today);

        using var response = await MoneyFixtures.RemoveTransferAsync(world.Client, world.Carmen.AccessToken, id);

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("code").GetString().ShouldBe("money-transfers.not-deleted");
        problem.GetProperty("detail").GetString().ShouldBe("Delete the transfer first.");
        (await MoneyFixtures.ReadTransfersAsync(world.Database)).ShouldContain(transfer => transfer.Id == id);
        (await MoneyFixtures.ReadAuditAsync(world.Database, AuditActions.MoneyTransferPermanentlyDeleted, world.Carmen.UserId)).ShouldBeEmpty();
    }

    [Fact]
    public async Task ADeletedTransferIsRemovedForGoodBalancesStayAndOneAuditEntryKeepsTheFullRecord()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);
        var (id, version) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 2000.00m, world.Today, "Cash for thread");
        using (var deleted = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, id, version))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var deletedAt = (await MoneyFixtures.ReadTransfersAsync(world.Database)).Single(transfer => transfer.Id == id).DeletedAtUtc.ShouldNotBeNull();
        var paoloBefore = await MoneyFixtures.ReadBalanceAsync(world.Client, world.Paolo.AccessToken);
        var lizaBefore = await MoneyFixtures.ReadBalanceAsync(world.Client, world.Liza.AccessToken);

        using var response = await MoneyFixtures.RemoveTransferAsync(world.Client, world.Carmen.AccessToken, id);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        (await MoneyFixtures.ReadTransfersAsync(world.Database)).ShouldNotContain(transfer => transfer.Id == id);
        (await MoneyFixtures.ReadBalanceAsync(world.Client, world.Paolo.AccessToken)).ShouldBe(paoloBefore);
        (await MoneyFixtures.ReadBalanceAsync(world.Client, world.Liza.AccessToken)).ShouldBe(lizaBefore);
        var entry = (await MoneyFixtures.ReadAuditAsync(world.Database, AuditActions.MoneyTransferPermanentlyDeleted, world.Carmen.UserId)).ShouldHaveSingleItem();
        entry.TargetType.ShouldBe("MoneyTransfer");
        entry.TargetId.ShouldBe(id.ToString("D"));
        var day = world.Today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var at = deletedAt.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture);
        entry.Detail.ShouldBe(
            $"from={world.Paolo.UserId:D};to={world.Liza.UserId:D};amount=2000.00;date={day};note=yes;recordedBy={world.Paolo.UserId:D};handover=no;deletedBy={world.Carmen.UserId:D};deletedAt={at}");
        entry.Detail.ShouldNotBeNull().ShouldNotContain("thread", Case.Insensitive);
        entry.Detail.Length.ShouldBeLessThan(AuditEntry.DetailMaxLength);
    }

    [Fact]
    public async Task ASecondRemoveAndAnUnknownIdAre404AndWriteNoSecondAuditEntry()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);
        var (id, version) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 500.00m, world.Today);
        using (var deleted = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, id, version))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        using (var first = await MoneyFixtures.RemoveTransferAsync(world.Client, world.Carmen.AccessToken, id))
        {
            first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        using var second = await MoneyFixtures.RemoveTransferAsync(world.Client, world.Carmen.AccessToken, id);
        using var unknown = await MoneyFixtures.RemoveTransferAsync(world.Client, world.Carmen.AccessToken, Guid.NewGuid());

        second.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        unknown.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ProblemJson.ReadAsync(second, TestContext.Current.CancellationToken)).GetProperty("detail").GetString().ShouldBe("This transfer wasn't found.");
        (await MoneyFixtures.ReadAuditAsync(world.Database, AuditActions.MoneyTransferPermanentlyDeleted, world.Carmen.UserId)).Count.ShouldBe(1);
    }

    [Fact]
    public async Task ARaceBetweenTwoPermanentRemovesGivesOneWinnerOneRefusalAndOneAuditEntry()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);

        for (var round = 1; round <= Rounds; round++)
        {
            var (id, version) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 100.00m, world.Today);
            using (var deleted = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, id, version))
            {
                deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
            }

            var (first, second) = await ConcurrentRequests.SendTogetherAsync(
                () => MoneyFixtures.RemoveTransferAsync(world.Client, world.Carmen.AccessToken, id),
                () => MoneyFixtures.RemoveTransferAsync(world.Client, world.Carmen.AccessToken, id));
            using var firstResponse = first;
            using var secondResponse = second;

            var statuses = new[] { firstResponse.StatusCode, secondResponse.StatusCode };
            statuses.Count(status => status == HttpStatusCode.NoContent).ShouldBe(1, $"round {round}: {string.Join(", ", statuses)}");
            statuses.Single(status => status != HttpStatusCode.NoContent).ShouldBeOneOf([HttpStatusCode.NotFound, HttpStatusCode.Conflict], $"round {round}");
            (await MoneyFixtures.ReadTransfersAsync(world.Database)).ShouldNotContain(transfer => transfer.Id == id, $"round {round}");
            var key = id.ToString("D");
            var entries = await MoneyFixtures.ReadAuditAsync(world.Database, AuditActions.MoneyTransferPermanentlyDeleted, world.Carmen.UserId);
            entries.Count(entry => entry.TargetId == key).ShouldBe(1, $"round {round}");
        }
    }

    [Fact]
    public async Task RemoveBeforeDeleteIs422AndRemoveAfterDeleteIs204()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);
        var (id, version) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 500.00m, world.Today);

        using var early = await MoneyFixtures.RemoveTransferAsync(world.Client, world.Carmen.AccessToken, id);
        using var deleted = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, id, version);
        using var late = await MoneyFixtures.RemoveTransferAsync(world.Client, world.Carmen.AccessToken, id);

        early.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        late.StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task AnAdminGets403ForARemoveAndAnonymousGets401AndNothingIsRemoved()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);
        var (gone, goneVersion) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 654.00m, world.Today);
        using (var deleted = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, gone, goneVersion))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var bodies = new List<string>();
        foreach (var id in new[] { gone, Guid.NewGuid() })
        {
            using var response = await MoneyFixtures.RemoveTransferAsync(world.Client, world.Liza.AccessToken, id);
            response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
            bodies.Add(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        using var anonymous = await MoneyFixtures.RemoveTransferAsync(world.Client, null, gone);

        anonymous.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        bodies.ShouldAllBe(body => !body.Contains("654", StringComparison.Ordinal) && !body.Contains("Paolo", StringComparison.Ordinal));
        (await MoneyFixtures.ReadTransfersAsync(world.Database)).ShouldContain(transfer => transfer.Id == gone);
        (await MoneyFixtures.ReadAuditAsync(world.Database, AuditActions.MoneyTransferPermanentlyDeleted, world.Liza.UserId)).ShouldBeEmpty();
    }

    [Fact]
    public async Task NoEmailIsQueuedByARemove()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);
        var (id, version) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 100.00m, world.Today);
        using (var deleted = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, id, version))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        var before = await CountEmailsAsync(world.Database);

        using var response = await MoneyFixtures.RemoveTransferAsync(world.Client, world.Carmen.AccessToken, id);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await CountEmailsAsync(world.Database)).ShouldBe(before);
    }

    // D-53: only a transfer and a hand-over take the staff-money lock. The rowversion guards the delete, so a lock held by another
    // transaction must not hold a delete or a remove up.
    [Fact]
    public async Task ADeleteSucceedsWhileAnotherTransactionHoldsTheStaffMoneyLock()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);
        var (id, version) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 500.00m, world.Today);

        await using var held = await HoldStaffMoneyLockAsync(world.Database);
        using var response = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, id, version);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task ARemoveSucceedsWhileAnotherTransactionHoldsTheStaffMoneyLock()
    {
        await using var world = await StartWorldAsync(paoloMoney: 2000.00m);
        var (id, version) = await MoneyFixtures.RecordTransferAsync(world.Client, world.Paolo.AccessToken, world.Liza.UserId, 500.00m, world.Today);
        using (var deleted = await MoneyFixtures.DeleteTransferAsync(world.Client, world.Carmen.AccessToken, id, version))
        {
            deleted.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        await using var held = await HoldStaffMoneyLockAsync(world.Database);
        using var response = await MoneyFixtures.RemoveTransferAsync(world.Client, world.Carmen.AccessToken, id);

        response.StatusCode.ShouldBe(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    // Takes the staff-money lock row in an open transaction, as a transfer would, and keeps it until the returned handle is disposed.
    private static async Task<IAsyncDisposable> HoldStaffMoneyLockAsync(CspsDatabase database)
    {
        var context = database.CreateContext();
        var transaction = await context.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        var changed = await context.Set<DatabaseLock>().Where(row => row.Name == "staff-money")
            .ExecuteUpdateAsync(set => set.SetProperty(row => row.TakenAtUtc, TimeProvider.System.GetUtcNow()), TestContext.Current.CancellationToken);
        changed.ShouldBe(1);
        return new LockHold(context, transaction);
    }

    private sealed class LockHold(CspsDbContext context, Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            await transaction.RollbackAsync(CancellationToken.None);
            await transaction.DisposeAsync();
            await context.DisposeAsync();
        }
    }

    private static async Task<int> CountEmailsAsync(CspsDatabase database)
    {
        await using var context = database.CreateContext();
        return await context.EmailOutbox.CountAsync(TestContext.Current.CancellationToken);
    }

    private async Task<World> StartWorldAsync(decimal paoloMoney)
    {
        await database.ResetAsync();
        var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var client = factory.CreateClient();
        var carmen = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Manager, "Carmen", "Reyes");
        var paolo = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Paolo", "Garcia");
        var liza = await MoneyFixtures.StartStaffAsync(factory, database, Roles.Admin, "Liza", "Mercado");
        var today = await ExpenseFixtures.TodayAsync(factory);
        if (paoloMoney > 0m)
        {
            await MoneyFixtures.SeedPaymentAsync(database, paolo.UserId, "ORD-2026-0001", paoloMoney, today, Now);
        }

        return new World(factory, client, database, carmen, paolo, liza, today);
    }

    private sealed record World(
        CspsApiFactory Factory,
        HttpClient Client,
        CspsDatabase Database,
        StartedSession Carmen,
        StartedSession Paolo,
        StartedSession Liza,
        DateOnly Today) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await Factory.DisposeAsync();
        }
    }
}

using System.Data.Common;
using Csps.Domain.QuoteRequests;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.QuoteRequests;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Csps.Infrastructure.IntegrationTests.QuoteRequests;

/// <summary>
/// Review W7 IN-02, D-04, D-15: the quote request detail is read in several statements, so a status change that lands between them must
/// not leave the request and its version from before the move and the photos and history from after it. The row version is read again
/// after the lists, as the order reader does.
/// </summary>
public sealed class QuoteRequestReaderDetailSnapshotTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 22, 2, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task ASpamMoveBetweenTheRequestAndItsPhotosIsReadAgainSoTheAnswerIsOneSnapshot()
    {
        var (id, staffId) = await SeedAsync();
        var hook = new SpamDuringReadHook(database, id, staffId);
        await using var context = database.CreateContext(hook);

        var view = await new QuoteRequestReader(context).GetDetailAsync(id, TestContext.Current.CancellationToken);

        hook.Fired.ShouldBeTrue();
        var detail = view.ShouldNotBeNull();
        detail.Status.ShouldBe(QuoteRequestStatus.Spam);
        detail.Photos.ShouldBeEmpty();
        detail.PhotosRemovedAtUtc.ShouldNotBeNull();
        detail.History.ShouldHaveSingleItem().To.ShouldBe(QuoteRequestStatus.Spam);
        await using var fresh = database.CreateContext();
        var stored = await fresh.QuoteRequests.AsNoTracking().Where(row => row.Id == id).Select(row => row.RowVersion).SingleAsync(TestContext.Current.CancellationToken);
        detail.RowVersion.ShouldBe(stored);
    }

    [Fact]
    public async Task ARequestThatNobodyChangesIsReadOnceMoreOnlyToCheckItsVersion()
    {
        var (id, _) = await SeedAsync();
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);

        counter.Reset();
        var view = await new QuoteRequestReader(context).GetDetailAsync(id, TestContext.Current.CancellationToken);

        var detail = view.ShouldNotBeNull();
        detail.Status.ShouldBe(QuoteRequestStatus.New);
        detail.Photos.Count.ShouldBe(2);
        // The request, the photo places, the history, then the version check.
        counter.Count.ShouldBe(4, string.Join(Environment.NewLine, counter.Commands));
    }

    [Fact]
    public async Task AnUnknownRequestIsNullAfterOneCommand()
    {
        await database.ResetAsync();
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);

        counter.Reset();
        (await new QuoteRequestReader(context).GetDetailAsync(Guid.NewGuid(), TestContext.Current.CancellationToken)).ShouldBeNull();

        counter.Count.ShouldBe(1);
    }

    private async Task<(Guid Id, Guid StaffId)> SeedAsync()
    {
        await database.ResetAsync();
        var staffId = Guid.NewGuid();
        var email = $"staff.{staffId:N}@example.com";
        await using var context = database.CreateContext();
        context.Users.Add(new ApplicationUser
        {
            Id = staffId,
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            FirstName = "Mina",
            LastName = "Mercado",
            SecurityStamp = Guid.NewGuid().ToString("N"),
            CreatedAtUtc = Now,
        });
        var request = QuoteRequest.Receive(
            Guid.CreateVersion7(Now),
            new QuoteRequestInput("Juan Dela Cruz", null, "0917 123 4567", null, null, null, null, null, null),
            Now).Value;
        request.DeclarePhotos(["front.jpg", "back.jpg"], new byte[QuoteRequestRules.UploadKeyHashLength], Now.AddHours(2)).IsSuccess.ShouldBeTrue();
        context.QuoteRequests.Add(request);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var requestId = request.Id;
        await context.QuoteRequestPhotos
            .Where(photo => photo.QuoteRequestId == requestId)
            .ExecuteUpdateAsync(
                set => set.SetProperty(photo => photo.PublicId, photo => "quotes/test/" + photo.FileName).SetProperty(photo => photo.Width, 800).SetProperty(photo => photo.Height, 600),
                TestContext.Current.CancellationToken);
        return (request.Id, staffId);
    }

    // Moves the request to Spam on another connection just before the photo places are read, once.
    private sealed class SpamDuringReadHook(CspsDatabase database, Guid requestId, Guid staffId) : DbCommandInterceptor
    {
        public bool Fired { get; private set; }

        public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            if (!Fired && command.CommandText.Contains("FROM [QuoteRequestPhotos]", StringComparison.Ordinal))
            {
                Fired = true;
                await using var other = database.CreateContext();
                var request = await other.QuoteRequests.Include(row => row.Photos).SingleAsync(row => row.Id == requestId, cancellationToken);
                request.ChangeStatus(QuoteRequestStatus.Spam, staffId, Now.AddHours(1)).IsSuccess.ShouldBeTrue();
                await other.SaveChangesAsync(cancellationToken);
            }

            return result;
        }
    }
}

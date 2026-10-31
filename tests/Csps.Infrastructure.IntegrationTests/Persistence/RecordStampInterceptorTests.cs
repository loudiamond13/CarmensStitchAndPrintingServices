using Csps.Application.Ports;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>SEC-08: the stamping point sets who and when on create and staff edit, and never on Identity bookkeeping.</summary>
public sealed class RecordStampInterceptorTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 10, 17, 14, 30, 0, TimeSpan.Zero);

    [Fact]
    public async Task AddingAUserSetsCreatedAndLeavesUpdatedNull()
    {
        var actor = await NewUserAsync();
        var clock = new FakeTimeProvider(Now);

        var added = await AddUserAsync(actor, clock);

        var row = await ReadAsync(added);
        row.CreatedById.ShouldBe(actor);
        row.CreatedAtUtc.ShouldBe(Now);
        row.UpdatedById.ShouldBeNull();
        row.UpdatedAtUtc.ShouldBeNull();
    }

    [Fact]
    public async Task ValuesPresetByCodeOnANewUserAreOverwritten()
    {
        var actor = await NewUserAsync();
        var clock = new FakeTimeProvider(Now);
        await using var context = CreateContext(actor, clock);
        var user = NewUser();
        user.CreatedById = Guid.NewGuid();
        user.CreatedAtUtc = new DateTimeOffset(1999, 1, 1, 0, 0, 0, TimeSpan.Zero);
        context.Users.Add(user);

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var row = await ReadAsync(user.Id);
        row.CreatedById.ShouldBe(actor);
        row.CreatedAtUtc.ShouldBe(Now);
    }

    [Fact]
    public async Task AChangeThatRotatesTheEditVersionSetsUpdated()
    {
        var actor = await NewUserAsync();
        var target = await NewUserAsync();
        var clock = new FakeTimeProvider(Now);
        await using var context = CreateContext(actor, clock);
        var user = await context.Users.SingleAsync(u => u.Id == target, TestContext.Current.CancellationToken);

        user.FirstName = "Ana";
        user.EditVersion = Guid.NewGuid();
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var row = await ReadAsync(target);
        row.UpdatedById.ShouldBe(actor);
        row.UpdatedAtUtc.ShouldBe(Now);
    }

    [Fact]
    public async Task ABookkeepingChangeThatKeepsTheEditVersionSetsNothing()
    {
        var actor = await NewUserAsync();
        var target = await NewUserAsync();
        var clock = new FakeTimeProvider(Now);
        await using var context = CreateContext(actor, clock);
        var user = await context.Users.SingleAsync(u => u.Id == target, TestContext.Current.CancellationToken);

        // Identity's UserStore.UpdateAsync calls Update, which marks every property modified.
        context.Users.Update(user);
        user.AccessFailedCount += 1;
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var row = await ReadAsync(target);
        row.UpdatedById.ShouldBeNull();
        row.UpdatedAtUtc.ShouldBeNull();
    }

    [Fact]
    public async Task WithNoActorACreatedUserReadsAsSystem()
    {
        var clock = new FakeTimeProvider(Now);

        var added = await AddUserAsync(actor: null, clock);

        var row = await ReadAsync(added);
        row.CreatedById.ShouldBeNull();
        row.CreatedAtUtc.ShouldBe(Now);
    }

    [Fact]
    public async Task WithNoActorAnUpdatedByIdSetByCodeInTheSameSaveIsKeptAndTheTimeComesFromTheClock()
    {
        var setByCode = await NewUserAsync();
        var target = await NewUserAsync();
        var clock = new FakeTimeProvider(Now);
        await using var context = CreateContext(actor: null, clock);
        var user = await context.Users.SingleAsync(u => u.Id == target, TestContext.Current.CancellationToken);

        user.UpdatedById = setByCode;
        user.EditVersion = Guid.NewGuid();
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var row = await ReadAsync(target);
        row.UpdatedById.ShouldBe(setByCode);
        row.UpdatedAtUtc.ShouldBe(Now);
    }

    [Fact]
    public async Task WithNoActorAnEditWithNothingSetByCodeLeavesUpdatedByNull()
    {
        var target = await NewUserAsync();
        var clock = new FakeTimeProvider(Now);
        await using var context = CreateContext(actor: null, clock);
        var user = await context.Users.SingleAsync(u => u.Id == target, TestContext.Current.CancellationToken);

        user.EditVersion = Guid.NewGuid();
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var row = await ReadAsync(target);
        row.UpdatedById.ShouldBeNull();
        row.UpdatedAtUtc.ShouldBe(Now);
    }

    [Fact]
    public async Task StampedInstantsAreInUtcEvenWhenTheClockReportsAnotherOffset()
    {
        var actor = await NewUserAsync();
        var clock = new OffsetClock(new DateTimeOffset(2026, 10, 17, 22, 30, 0, TimeSpan.FromHours(8)));

        var added = await AddUserAsync(actor, clock);

        var row = await ReadAsync(added);
        row.CreatedAtUtc.Offset.ShouldBe(TimeSpan.Zero);
        row.CreatedAtUtc.ShouldBe(Now);
    }

    private async Task<Guid> NewUserAsync() => await AddUserAsync(actor: null, new FakeTimeProvider(Now));

    private async Task<Guid> AddUserAsync(Guid? actor, TimeProvider clock)
    {
        await using var context = CreateContext(actor, clock);
        var user = NewUser();
        context.Users.Add(user);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return user.Id;
    }

    private static ApplicationUser NewUser()
    {
        var email = $"stamp.{Guid.NewGuid():N}@example.com";
        return new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            FirstName = "Paolo",
            LastName = "Reyes",
        };
    }

    private CspsDbContext CreateContext(Guid? actor, TimeProvider clock)
    {
        var builder = new DbContextOptionsBuilder<CspsDbContext>();
        CspsDbContextOptions.Configure(builder, database.ConnectionString)
            .AddInterceptors(new RecordStampInterceptor(actor is { } id ? new FixedActor(id) : new NoCurrentActor(), clock));
        return new CspsDbContext(builder.Options);
    }

    private async Task<Row> ReadAsync(Guid id)
    {
        await using var context = database.CreateContext();
        return await context.Users.AsNoTracking()
            .Where(user => user.Id == id)
            .Select(user => new Row(user.CreatedById, user.CreatedAtUtc, user.UpdatedById, user.UpdatedAtUtc))
            .SingleAsync(TestContext.Current.CancellationToken);
    }

    private sealed record Row(Guid? CreatedById, DateTimeOffset CreatedAtUtc, Guid? UpdatedById, DateTimeOffset? UpdatedAtUtc);

    private sealed class FixedActor(Guid id) : ICurrentActor
    {
        public Guid? UserId => id;
    }

    // Reports its instant with a non-zero offset, as a clock configured with a local zone could.
    private sealed class OffsetClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}

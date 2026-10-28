using Csps.Application.Ports;
using Csps.Domain.Expenses;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.OrderLists;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.OrderLists;

/// <summary>
/// D-19, Pitfall 7, T-07-50, T-07-51: the database is the backstop for the order list races. A row that appears after a delete was
/// decided makes the foreign key refuse the delete, a row saved against an entry that was just deleted makes it refuse the insert,
/// and two entries with one normalized name make the unique index refuse the second. Each becomes a typed exception and the failed
/// row leaves the context; any other failure passes through untouched.
/// </summary>
public sealed class OrderListStoreTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 28);
    private static int _orderNumber = 1000;

    public static TheoryData<OrderListKind> Kinds => [OrderListKind.ProductType, OrderListKind.PaymentMethod, OrderListKind.OrderExpenseCategory];

    [Theory]
    [MemberData(nameof(Kinds))]
    public async Task ASecondEntryWithTheSameNormalizedNameThrowsNameTakenAndDetachesTheRow(OrderListKind kind)
    {
        var name = $"Twin {Guid.NewGuid():N}"[..20];
        await SaveEntryAsync(kind, name);
        await using var context = database.CreateContext();
        var store = new OrderListStore(context);
        store.Add(Build(kind, name.ToUpperInvariant()));

        await Should.ThrowAsync<OrderListNameTakenException>(() => new CspsUnitOfWork(context).SaveChangesAsync(TestContext.Current.CancellationToken));

        context.ChangeTracker.Entries().ShouldBeEmpty();
    }

    [Theory]
    [MemberData(nameof(Kinds))]
    public async Task ARenameOntoAnotherEntrysNameThrowsNameTaken(OrderListKind kind)
    {
        var first = $"First {Guid.NewGuid():N}"[..20];
        var other = await SaveEntryAsync(kind, $"Second {Guid.NewGuid():N}"[..20]);
        await SaveEntryAsync(kind, first);
        await using var context = database.CreateContext();
        var store = new OrderListStore(context);
        var loaded = (await store.FindAsync(kind, other.Id, TestContext.Current.CancellationToken)).ShouldNotBeNull();
        loaded.Rename(first.ToLowerInvariant()).IsSuccess.ShouldBeTrue();

        await Should.ThrowAsync<OrderListNameTakenException>(() => new CspsUnitOfWork(context).SaveChangesAsync(TestContext.Current.CancellationToken));
    }

    [Theory]
    [MemberData(nameof(Kinds))]
    public async Task ARowAddedAfterTheEntryWasLoadedMakesTheDeleteThrowInUseAndDetachesTheRow(OrderListKind kind)
    {
        var entry = await SaveEntryAsync(kind, $"Race {Guid.NewGuid():N}"[..20]);
        await using var context = database.CreateContext();
        var store = new OrderListStore(context);
        var loaded = (await store.FindAsync(kind, entry.Id, TestContext.Current.CancellationToken)).ShouldNotBeNull();
        (await store.CountUsesAsync(kind, entry.Id, TestContext.Current.CancellationToken)).ShouldBe(0);
        await UseAsync(kind, entry.Id, deleted: false);

        store.Remove(loaded);
        await Should.ThrowAsync<OrderListEntryInUseException>(() => new CspsUnitOfWork(context).SaveChangesAsync(TestContext.Current.CancellationToken));

        context.ChangeTracker.Entries().ShouldBeEmpty();
        await using var check = database.CreateContext();
        (await new OrderListStore(check).FindAsync(kind, entry.Id, TestContext.Current.CancellationToken)).ShouldNotBeNull();
    }

    [Theory]
    [MemberData(nameof(Kinds))]
    public async Task ARowOnASoftDeletedOrderStillCountsAndStillBlocksTheDelete(OrderListKind kind)
    {
        var entry = await SaveEntryAsync(kind, $"Soft {Guid.NewGuid():N}"[..20]);
        await UseAsync(kind, entry.Id, deleted: true);
        await using var context = database.CreateContext();
        var store = new OrderListStore(context);

        (await store.CountUsesAsync(kind, entry.Id, TestContext.Current.CancellationToken)).ShouldBe(1);
        var listed = (await store.ListAsync(kind, TestContext.Current.CancellationToken)).Single(item => item.Id == entry.Id);
        listed.UseCount.ShouldBe(1);
        store.Remove((await store.FindAsync(kind, entry.Id, TestContext.Current.CancellationToken)).ShouldNotBeNull());

        await Should.ThrowAsync<OrderListEntryInUseException>(() => new CspsUnitOfWork(context).SaveChangesAsync(TestContext.Current.CancellationToken));
    }

    [Theory]
    [MemberData(nameof(Kinds))]
    public async Task AnOrderSavedAgainstAnEntryThatWasJustDeletedThrowsDeletedWithTheListAndDetachesTheRows(OrderListKind kind)
    {
        var entry = await SaveEntryAsync(kind, $"Gone {Guid.NewGuid():N}"[..20]);
        await DeleteEntryAsync(kind, entry.Id);
        var staffId = await NewUserAsync();
        await using var context = database.CreateContext();
        context.Orders.Add(NewOrder(kind, entry.Id, staffId));

        var thrown = await Should.ThrowAsync<OrderListEntryDeletedException>(() => new CspsUnitOfWork(context).SaveChangesAsync(TestContext.Current.CancellationToken));

        thrown.Kind.ShouldBe(kind);
        context.ChangeTracker.Entries().ShouldBeEmpty();
    }

    [Fact]
    public async Task AnEntryNoRowUsesIsRemoved()
    {
        var entry = await SaveEntryAsync(OrderListKind.PaymentMethod, $"Free {Guid.NewGuid():N}"[..20]);
        await using var context = database.CreateContext();
        var store = new OrderListStore(context);
        store.Remove((await store.FindAsync(OrderListKind.PaymentMethod, entry.Id, TestContext.Current.CancellationToken)).ShouldNotBeNull());

        var saved = await new CspsUnitOfWork(context).SaveChangesAsync(TestContext.Current.CancellationToken);

        saved.ShouldBe(1);
        await using var check = database.CreateContext();
        (await check.PaymentMethods.CountAsync(row => row.Id == entry.Id, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Theory]
    [MemberData(nameof(Kinds))]
    public async Task TheNameLookupIgnoresLetterCaseCountsRetiredEntriesAndCanLeaveOneOut(OrderListKind kind)
    {
        var name = $"Look {Guid.NewGuid():N}"[..20];
        var entry = await SaveEntryAsync(kind, name, retired: true);
        await using var context = database.CreateContext();
        var store = new OrderListStore(context);
        var normalized = OrderListEntry.Normalize(name.ToLowerInvariant());

        (await store.NameTakenAsync(kind, normalized, null, TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await store.NameTakenAsync(kind, normalized, entry.Id, TestContext.Current.CancellationToken)).ShouldBeFalse();
        (await store.NameTakenAsync(kind, "NO SUCH ENTRY", null, TestContext.Current.CancellationToken)).ShouldBeFalse();
    }

    [Fact]
    public async Task AnEntryOfAnotherListIsNotFoundAndTheDetailCarriesTheUseCountAndTheRecorder()
    {
        var entry = await SaveEntryAsync(OrderListKind.ProductType, $"Other {Guid.NewGuid():N}"[..20]);
        await using var context = database.CreateContext();
        var store = new OrderListStore(context);

        (await store.FindAsync(OrderListKind.PaymentMethod, entry.Id, TestContext.Current.CancellationToken)).ShouldBeNull();
        (await store.GetDetailAsync(OrderListKind.PaymentMethod, entry.Id, TestContext.Current.CancellationToken)).ShouldBeNull();
        var detail = (await store.GetDetailAsync(OrderListKind.ProductType, entry.Id, TestContext.Current.CancellationToken)).ShouldNotBeNull();
        detail.UseCount.ShouldBe(0);
        detail.IsOthers.ShouldBeFalse();
        detail.RowVersion.Length.ShouldBe(8);
        var others = (await store.GetDetailAsync(OrderListKind.OrderExpenseCategory, OrderExpenseCategory.OthersId, TestContext.Current.CancellationToken)).ShouldNotBeNull();
        others.IsOthers.ShouldBeTrue();
        others.RecordedBy.ShouldBeNull();
    }

    [Fact]
    public async Task AFailureThatIsNotAListConstraintPassesThroughUntouched()
    {
        var lonely = new DbUpdateException("Not a SQL failure.", new InvalidOperationException("plain"));
        OrderListStore.TranslateSaveFailure(lonely).ShouldBeNull();
        await using var context = database.CreateContext();
        var entry = ProductType.Create($"Orphan {Guid.NewGuid():N}"[..20], "info", Now).Value;
        context.ProductTypes.Add(entry);
        context.Entry(entry).Property(row => row.CreatedById).CurrentValue = Guid.NewGuid();

        var thrown = await Should.ThrowAsync<DbUpdateException>(() => new CspsUnitOfWork(context).SaveChangesAsync(TestContext.Current.CancellationToken));

        thrown.ShouldNotBeOfType<DbUpdateConcurrencyException>();
        OrderListStore.TranslateSaveFailure(thrown).ShouldBeNull();
    }

    private static OrderListEntry Build(OrderListKind kind, string name) => kind switch
    {
        OrderListKind.ProductType => ProductType.Create(name, CategoryTones.Info, Now).Value,
        OrderListKind.PaymentMethod => PaymentMethod.Create(name, CategoryTones.Info, Now).Value,
        _ => OrderExpenseCategory.Create(name, CategoryTones.Info, Now).Value,
    };

    // A new order with one row on the entry; the other list references use the first seeded entry.
    private static Order NewOrder(OrderListKind kind, Guid entryId, Guid staffId)
    {
        var productTypeId = kind == OrderListKind.ProductType ? entryId : OrderListSeed.ProductTypes[0].Id;
        var payments = kind == OrderListKind.PaymentMethod
            ? new[] { new NewOrderPayment(Today, 100.00m, entryId, null, null, staffId) }
            : [];
        var expenses = kind == OrderListKind.OrderExpenseCategory
            ? new[] { new NewOrderExpense(Today, 50.00m, entryId, null, staffId) }
            : [];
        var order = Order.Create(
            new NewOrder(
                new OrderDetails("Juan Dela Cruz", null, "0917 123 4567", null, null, Today, Today.AddDays(14), null),
                OrderStatus.Pending,
                [new NewOrderItem(productTypeId, "Jersey top", null, 2, 650.00m)])
            {
                Payments = payments,
                Expenses = expenses,
            },
            staffId,
            Now,
            Today).Value;
        order.AssignNumber($"ORD-2026-{Interlocked.Increment(ref _orderNumber):D4}");
        return order;
    }

    private async Task<OrderListEntry> SaveEntryAsync(OrderListKind kind, string name, bool retired = false)
    {
        var entry = Build(kind, name);
        if (retired)
        {
            entry.Retire(Now);
        }

        await using var context = database.CreateContext();
        context.Add((object)entry);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return entry;
    }

    private async Task DeleteEntryAsync(OrderListKind kind, Guid id)
    {
        await using var context = database.CreateContext();
        var store = new OrderListStore(context);
        store.Remove((await store.FindAsync(kind, id, TestContext.Current.CancellationToken)).ShouldNotBeNull());
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    // Saves an order that uses the entry; deleted makes it a soft-deleted order.
    private async Task UseAsync(OrderListKind kind, Guid entryId, bool deleted)
    {
        var staffId = await NewUserAsync();
        var order = NewOrder(kind, entryId, staffId);
        if (deleted)
        {
            order.SoftDelete(staffId, Now.AddMinutes(1));
        }

        await using var context = database.CreateContext();
        context.Orders.Add(order);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<Guid> NewUserAsync()
    {
        await using var context = database.CreateContext();
        var email = $"orderlist.{Guid.NewGuid():N}@example.com";
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            FirstName = "Paolo",
            LastName = "Reyes",
            SecurityStamp = Guid.NewGuid().ToString("N"),
            CreatedAtUtc = Now,
        };
        context.Users.Add(user);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return user.Id;
    }
}

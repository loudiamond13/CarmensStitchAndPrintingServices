using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Expenses;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Users;

/// <summary>
/// Two creates of the same address can deadlock inside Identity's own reads and saves, which the unit of work never sees. The
/// victim must surface as a lost race, so the handler checks the email again and answers the field error, not a 500.
/// </summary>
public sealed class CreateUserDeadlockTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 10, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task ADeadlockDuringTheCreateIsALostRaceWithTheDeadlockAsItsCause()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var categoryId = await SaveCategoryAsync($"Cu {Guid.NewGuid():N}"[..24]);
        var email = $"deadlock.{Guid.NewGuid():N}@example.com";
        await using var victimScope = factory.Services.CreateAsyncScope();
        await using var holderScope = factory.Services.CreateAsyncScope();
        var victim = victimScope.ServiceProvider.GetRequiredService<CspsDbContext>();
        var holder = holderScope.ServiceProvider.GetRequiredService<CspsDbContext>();
        var victimAccounts = victimScope.ServiceProvider.GetRequiredService<IUserAccounts>();
        var holderAccounts = holderScope.ServiceProvider.GetRequiredService<IUserAccounts>();
        var token = TestContext.Current.CancellationToken;

        var victimTransaction = await victim.Database.BeginTransactionAsync(token);
        var holderTransaction = await holder.Database.BeginTransactionAsync(token);
        await using (victimTransaction)
        await using (holderTransaction)
        {
            // The victim holds the category row and gives way in a deadlock; the holder holds the new address.
            await victim.Database.ExecuteSqlRawAsync("SET DEADLOCK_PRIORITY LOW", token);
            (await victim.ExpenseCategories.SingleAsync(row => row.Id == categoryId, token)).Rename($"Cu A {Guid.NewGuid():N}"[..24]).IsSuccess.ShouldBeTrue();
            await victim.SaveChangesAsync(token);
            await holderAccounts.CreateAsync(new NewUserAccount(email, "Hold", "Er", Roles.Admin, null), token);

            var create = CaptureAsync(() => victimAccounts.CreateAsync(new NewUserAccount(email, "Vic", "Tim", Roles.Admin, null), token));
            await Task.Delay(TimeSpan.FromSeconds(1), token);
            var reach = CaptureAsync(async () =>
            {
                (await holder.ExpenseCategories.SingleAsync(row => row.Id == categoryId, token)).Rename($"Cu B {Guid.NewGuid():N}"[..24]).IsSuccess.ShouldBeTrue();
                await holder.SaveChangesAsync(token);
            });
            var outcomes = await Task.WhenAll(create, reach);

            var lost = outcomes[0].ShouldBeOfType<ConcurrencyConflictException>(outcomes[0]?.ToString());
            IsDeadlockVictim(lost).ShouldBeTrue("the deadlock must travel as the cause");
            outcomes[1].ShouldBeNull(outcomes[1]?.ToString());
        }
    }

    private static bool IsDeadlockVictim(Exception? error)
    {
        for (; error is not null; error = error.InnerException)
        {
            if (error is SqlException { Number: 1205 })
            {
                return true;
            }
        }

        return false;
    }

    private static async Task<Exception?> CaptureAsync(Func<Task> work)
    {
        try
        {
            await work();
            return null;
        }
        catch (Exception error)
        {
            return error;
        }
    }

    private async Task<Guid> SaveCategoryAsync(string name)
    {
        var category = ExpenseCategory.Create(name, CategoryTones.Info, Now).Value;
        await using var context = database.CreateContext();
        context.ExpenseCategories.Add(category);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return category.Id;
    }
}

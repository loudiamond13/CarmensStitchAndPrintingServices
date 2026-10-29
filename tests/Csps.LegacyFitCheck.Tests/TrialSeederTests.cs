using Csps.Application.Ports;
using Csps.Domain.Identity;
using Csps.Infrastructure;
using Csps.Infrastructure.Expenses;
using Csps.Infrastructure.Identity;
using Csps.LegacyFitCheck.Mapping;
using Csps.LegacyFitCheck.Trial;
using Csps.Testing;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.LegacyFitCheck.Tests;

public sealed class TrialSeederTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 29, 0, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task SeededTrialStaffPassTheCspsPayerRuleAndWriteNoAuditRow()
    {
        var token = TestContext.Current.CancellationToken;
        var database = await CspsDatabase.CreateAsync();
        await using (database.ConfigureAwait(true))
        {
            var staff = new[]
            {
                new TrialStaff(Guid.NewGuid(), "Legacy staff 1", "legacy-staff-1@example.invalid"),
                new TrialStaff(Guid.NewGuid(), "Legacy staff 2", "legacy-staff-2@example.invalid"),
            };
            var context = database.CreateContext();
            await using (context.ConfigureAwait(true))
            {
                await TrialSeeder.SeedStaffAsync(context, staff, Now, token);
            }

            var provider = BuildProvider(database);
            await using (provider.ConfigureAwait(true))
            {
                var scope = provider.CreateAsyncScope();
                await using (scope.ConfigureAwait(true))
                {
                    var directory = scope.ServiceProvider.GetRequiredService<IStaffDirectory>();
                    foreach (var member in staff)
                    {
                        var state = await directory.GetStaffStateAsync(member.Id, token);
                        state.ShouldNotBeNull().CanPay.ShouldBeTrue();
                        state.Name.ShouldBe(member.Pseudonym);
                    }

                    (await directory.GetStaffStateAsync(LegacyHolder.Id, token)).ShouldNotBeNull().CanPay.ShouldBeFalse();
                }
            }

            var check = database.CreateContext();
            await using (check.ConfigureAwait(true))
            {
                (await check.AuditLog.CountAsync(token)).ShouldBe(0);
                (await check.Users.CountAsync(token)).ShouldBe(3);
            }
        }
    }

    [Fact]
    public async Task ATrialStaffPasswordPlaceholderCannotBeVerified()
    {
        var token = TestContext.Current.CancellationToken;
        var database = await CspsDatabase.CreateAsync();
        await using (database.ConfigureAwait(true))
        {
            var member = new TrialStaff(Guid.NewGuid(), "Legacy staff 1", "legacy-staff-1@example.invalid");
            var context = database.CreateContext();
            await using (context.ConfigureAwait(true))
            {
                await TrialSeeder.SeedStaffAsync(context, [member], Now, token);
                var user = await context.Users.SingleAsync(row => row.Id == member.Id, token);

                var result = new PasswordHasher<ApplicationUser>().VerifyHashedPassword(user, user.PasswordHash!, "any password");

                result.ShouldBe(PasswordVerificationResult.Failed);
                user.UserName.ShouldBe(member.Email);
                user.NormalizedUserName.ShouldBe(member.Email.ToUpperInvariant());
                user.FirstName.ShouldBe("Legacy");
                user.LastName.ShouldBe("staff 1");
            }
        }
    }

    [Fact]
    public async Task SeedingNoStaffChangesNothing()
    {
        var token = TestContext.Current.CancellationToken;
        var database = await CspsDatabase.CreateAsync();
        await using (database.ConfigureAwait(true))
        {
            var context = database.CreateContext();
            await using (context.ConfigureAwait(true))
            {
                await TrialSeeder.SeedStaffAsync(context, [], Now, token);

                (await context.Users.CountAsync(token)).ShouldBe(1);
            }
        }
    }

    private static ServiceProvider BuildProvider(CspsDatabase database)
    {
        var services = new ServiceCollection();
        services.AddSingleton(TimeProvider.System);
        services.AddCspsPersistence(database.ConnectionString);
        services.AddCspsExpenses();
        return services.BuildServiceProvider(validateScopes: true);
    }
}

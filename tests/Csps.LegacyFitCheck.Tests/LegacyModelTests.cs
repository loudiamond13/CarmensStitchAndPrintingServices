using Csps.LegacyFitCheck.Mapping;
using Csps.LegacyFitCheck.Source;
using Csps.LegacyFitCheck.Tests.Fakes;
using Microsoft.EntityFrameworkCore;

namespace Csps.LegacyFitCheck.Tests;

public sealed class LegacyModelTests
{
    private static readonly string[] BannedColumns =
    [
        "CreatedBy", "UpdatedBy", "DeletedBy", "CreatedDate", "UpdatedDate", "UpdateDate", "DiscountDate",
        "FirstName", "LastName", "PhoneNumber", "PasswordHash", "LoginVerificationCode", "CodeSentAt",
    ];

    [Fact]
    public async Task MoneyAndDatesReadBackExactly()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            var orderDate = new DateTime(2025, 3, 4, 23, 15, 30, DateTimeKind.Unspecified);
            var paymentDate = new DateTime(2025, 3, 5, 14, 5, 9, DateTimeKind.Unspecified);
            var spentDate = new DateTime(2025, 3, 6, 1, 2, 3, DateTimeKind.Unspecified);
            await fake.AddOrderRowAsync(
                new LegacyOrderRow
                {
                    OrderId = 10,
                    OrderName = "Fixture order",
                    OrderDate = orderDate,
                    TotalAmount = 12345.6700m,
                    PaidAmount = 0.0100m,
                    TotalDiscount = 0.0001m,
                    TotalBalance = 12345.6600m,
                    TotalExpenses = 99999.9999m,
                    IsDeleted = false,
                    OrderTypeId = 1,
                    StatusId = 1,
                },
                token);
            await fake.AddItemAsync(new LegacyOrderItemRow { OrderItemId = 10, OrderId = 10, Description = "Fixture item", Quantity = 3, Price = 1234.5678m, IsDone = true }, token);
            await fake.AddPaymentAsync(new LegacyPaymentRow { PaymentId = 10, OrderId = 10, PaymentDate = paymentDate, Amount = 0.0100m, PaidTo = "staff-1@example.invalid", PaidBy = "Fixture payer", IsDeleted = true }, token);
            await fake.AddDiscountAsync(new LegacyDiscountRow { OrderDiscountId = 10, OrderId = 10, Description = "Fixture discount", Amount = 0.0001m, DiscountedBy = "staff-1@example.invalid" }, token);
            await fake.AddExpenseAsync(new LegacyExpenseRow { ExpenseId = 10, OrderId = null, Description = "Fixture expense", SpentDate = spentDate, IsCompanyExpenses = true, Amount = 7.0050m, PaidBy = "staff-1@example.invalid" }, token);
            await fake.AddExpenseAsync(new LegacyExpenseRow { ExpenseId = 11, OrderId = 10, Description = "Fixture expense 2", SpentDate = null, IsCompanyExpenses = false, Amount = 1m, PaidBy = "staff-1@example.invalid" }, token);
            await fake.AddUserAsync(new LegacyUserRow { Id = "user-1", UserName = "staff-1@example.invalid", Email = "staff-1@example.invalid" }, token);
            await fake.AddRoleAsync(new LegacyRoleRow { Id = "role-1", Name = "Admin" }, token);
            await fake.AddUserRoleAsync(new LegacyUserRoleRow { UserId = "user-1", RoleId = "role-1" }, token);

            var context = LegacyDbContext.Open(fake.ConnectionString);
            await using (context.ConfigureAwait(true))
            {
                var order = await context.Orders.SingleAsync(row => row.OrderId == 10, token);
                order.TotalAmount.ShouldBe(12345.6700m);
                order.PaidAmount.ShouldBe(0.0100m);
                order.TotalDiscount.ShouldBe(0.0001m);
                order.TotalBalance.ShouldBe(12345.6600m);
                order.TotalExpenses.ShouldBe(99999.9999m);
                order.OrderDate.ShouldBe(orderDate);

                var item = await context.OrderItems.SingleAsync(row => row.OrderItemId == 10, token);
                item.Price.ShouldBe(1234.5678m);
                item.IsDone.ShouldBe(true);

                var payment = await context.Payments.SingleAsync(token);
                payment.Amount.ShouldBe(0.0100m);
                payment.PaymentDate.ShouldBe(paymentDate);
                payment.PaidTo.ShouldBe("staff-1@example.invalid");
                payment.PaidBy.ShouldBe("Fixture payer");
                payment.IsDeleted.ShouldBe(true);

                var discount = await context.Discounts.SingleAsync(token);
                discount.Amount.ShouldBe(0.0001m);
                discount.DiscountedBy.ShouldBe("staff-1@example.invalid");

                var company = await context.Expenses.SingleAsync(row => row.ExpenseId == 10, token);
                company.Amount.ShouldBe(7.0050m);
                company.SpentDate.ShouldBe(spentDate);
                company.IsCompanyExpenses.ShouldBeTrue();
                company.OrderId.ShouldBeNull();

                var orderExpense = await context.Expenses.SingleAsync(row => row.ExpenseId == 11, token);
                orderExpense.SpentDate.ShouldBeNull();
                orderExpense.IsCompanyExpenses.ShouldBeFalse();
                orderExpense.OrderId.ShouldBe(10);

                (await context.Users.SingleAsync(token)).Email.ShouldBe("staff-1@example.invalid");
                (await context.Roles.SingleAsync(token)).Name.ShouldBe("Admin");
                (await context.UserRoles.SingleAsync(token)).RoleId.ShouldBe("role-1");
            }
        }
    }

    [Fact]
    public async Task TheModelReadsNoCreatorStampOrPersonNameColumn()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            var context = LegacyDbContext.Open(fake.ConnectionString);
            await using (context.ConfigureAwait(true))
            {
                var columns = LegacyColumns(context);

                columns.Where(column => BannedColumns.Contains(column.Column, StringComparer.OrdinalIgnoreCase)).ShouldBeEmpty();
                columns.Where(column => column.Table == "AspNetUsers").Select(column => column.Column).Order().ShouldBe(["Email", "Id", "UserName"]);
                columns.Where(column => column.Table == "AspNetRoles").Select(column => column.Column).Order().ShouldBe(["Id", "Name"]);
                columns.Where(column => column.Table == "AspNetUserRoles").Select(column => column.Column).Order().ShouldBe(["RoleId", "UserId"]);
            }
        }
    }

    [Fact]
    public async Task EveryColumnTheModelReadsIsInTheDraftMapAndEveryMappedColumnIsRead()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            var context = LegacyDbContext.Open(fake.ConnectionString);
            await using (context.ConfigureAwait(true))
            {
                var read = LegacyColumns(context).Where(column => DraftColumnMap.Tables.Contains(column.Table)).Select(column => $"{column.Table}.{column.Column}").ToHashSet(StringComparer.OrdinalIgnoreCase);
                var known = DraftColumnMap.Entries.Select(static entry => entry.Path).ToHashSet(StringComparer.OrdinalIgnoreCase);
                var mapped = DraftColumnMap.Entries.Where(static entry => entry.IsMapped).Select(static entry => entry.Path).ToHashSet(StringComparer.OrdinalIgnoreCase);

                read.Except(known, StringComparer.OrdinalIgnoreCase).ShouldBeEmpty();
                mapped.Except(read, StringComparer.OrdinalIgnoreCase).ShouldBeEmpty();
            }
        }
    }

    private static List<(string Table, string Column)> LegacyColumns(LegacyDbContext context) =>
    [
        .. context.Model.GetEntityTypes()
            .Where(static type => type.GetSchema() is null && type.FindPrimaryKey() is not null)
            .SelectMany(static type => type.GetProperties().Select(property => (Table: type.GetTableName()!, Column: property.GetColumnName()))),
    ];
}

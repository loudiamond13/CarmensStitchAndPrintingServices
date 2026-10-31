using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderListIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Orders_Balance",
                table: "Orders",
                columns: new[] { "Balance", "Id" },
                descending: new[] { true, false },
                filter: "[DeletedAtUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_CreatedAtUtc",
                table: "Orders",
                column: "CreatedAtUtc",
                descending: new bool[0],
                filter: "[DeletedAtUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_List_Due",
                table: "Orders",
                columns: new[] { "DueDate", "Id" },
                filter: "[DeletedAtUtc] IS NULL")
                .Annotation("SqlServer:Include", new[] { "Number", "CustomerName", "TeamName", "OrderDate", "Status", "StatusChangedAtUtc", "Subtotal", "DiscountTotal", "Total", "PaidTotal", "RefundedTotal", "Balance", "CustomerCredit", "FullyPaid" });

            migrationBuilder.CreateIndex(
                name: "IX_Orders_OrderDate",
                table: "Orders",
                columns: new[] { "OrderDate", "CreatedAtUtc", "Id" },
                descending: new[] { true, true, false },
                filter: "[DeletedAtUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_Status_StatusChangedAtUtc",
                table: "Orders",
                columns: new[] { "Status", "StatusChangedAtUtc" },
                filter: "[DeletedAtUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_Total",
                table: "Orders",
                columns: new[] { "Total", "Id" },
                descending: new[] { true, false },
                filter: "[DeletedAtUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_OrderItems_ProductTypeId_OrderId",
                table: "OrderItems",
                columns: new[] { "ProductTypeId", "OrderId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Orders_Balance",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_Orders_CreatedAtUtc",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_Orders_List_Due",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_Orders_OrderDate",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_Orders_Status_StatusChangedAtUtc",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_Orders_Total",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_OrderItems_ProductTypeId_OrderId",
                table: "OrderItems");
        }
    }
}

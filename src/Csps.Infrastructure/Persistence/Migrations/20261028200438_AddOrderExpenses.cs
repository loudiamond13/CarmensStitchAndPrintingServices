using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderExpenses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OrderExpenses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ExpenseDate = table.Column<DateOnly>(type: "date", nullable: false),
                    OrderExpenseCategoryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    PaidByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Position = table.Column<int>(type: "int", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderExpenses", x => x.Id);
                    table.CheckConstraint("CK_OrderExpenses_Amount_Positive", "[Amount] > 0");
                    table.ForeignKey(
                        name: "FK_OrderExpenses_AspNetUsers_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_OrderExpenses_AspNetUsers_PaidByUserId",
                        column: x => x.PaidByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_OrderExpenses_AspNetUsers_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_OrderExpenses_OrderExpenseCategories_OrderExpenseCategoryId",
                        column: x => x.OrderExpenseCategoryId,
                        principalTable: "OrderExpenseCategories",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_OrderExpenses_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrderExpenses_CreatedById",
                table: "OrderExpenses",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_OrderExpenses_OrderExpenseCategoryId",
                table: "OrderExpenses",
                column: "OrderExpenseCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderExpenses_OrderId",
                table: "OrderExpenses",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderExpenses_PaidByUserId",
                table: "OrderExpenses",
                column: "PaidByUserId")
                .Annotation("SqlServer:Include", new[] { "Amount", "ExpenseDate" });

            migrationBuilder.CreateIndex(
                name: "IX_OrderExpenses_UpdatedById",
                table: "OrderExpenses",
                column: "UpdatedById");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrderExpenses");
        }
    }
}

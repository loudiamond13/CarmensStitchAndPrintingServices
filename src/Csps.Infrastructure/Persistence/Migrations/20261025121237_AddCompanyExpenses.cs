using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCompanyExpenses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CompanyExpenses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ExpenseDate = table.Column<DateOnly>(type: "date", nullable: false),
                    CategoryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    PaidByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    DeletedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    DeletedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CompanyExpenses", x => x.Id);
                    table.CheckConstraint("CK_CompanyExpenses_Amount_Positive", "[Amount] > 0");
                    table.ForeignKey(
                        name: "FK_CompanyExpenses_AspNetUsers_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CompanyExpenses_AspNetUsers_DeletedById",
                        column: x => x.DeletedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CompanyExpenses_AspNetUsers_PaidByUserId",
                        column: x => x.PaidByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CompanyExpenses_AspNetUsers_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CompanyExpenses_ExpenseCategories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "ExpenseCategories",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_CompanyExpenses_CategoryId_ExpenseDate",
                table: "CompanyExpenses",
                columns: new[] { "CategoryId", "ExpenseDate" });

            migrationBuilder.CreateIndex(
                name: "IX_CompanyExpenses_CreatedById",
                table: "CompanyExpenses",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_CompanyExpenses_Deleted",
                table: "CompanyExpenses",
                column: "DeletedAtUtc",
                descending: new bool[0],
                filter: "[DeletedAtUtc] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_CompanyExpenses_DeletedById",
                table: "CompanyExpenses",
                column: "DeletedById");

            migrationBuilder.CreateIndex(
                name: "IX_CompanyExpenses_List",
                table: "CompanyExpenses",
                columns: new[] { "ExpenseDate", "CreatedAtUtc", "Id" },
                descending: new bool[0],
                filter: "[DeletedAtUtc] IS NULL")
                .Annotation("SqlServer:Include", new[] { "Amount", "CategoryId", "PaidByUserId", "CreatedById" });

            migrationBuilder.CreateIndex(
                name: "IX_CompanyExpenses_PaidByUserId",
                table: "CompanyExpenses",
                column: "PaidByUserId")
                .Annotation("SqlServer:Include", new[] { "Amount" });

            migrationBuilder.CreateIndex(
                name: "IX_CompanyExpenses_UpdatedById",
                table: "CompanyExpenses",
                column: "UpdatedById");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CompanyExpenses");
        }
    }
}

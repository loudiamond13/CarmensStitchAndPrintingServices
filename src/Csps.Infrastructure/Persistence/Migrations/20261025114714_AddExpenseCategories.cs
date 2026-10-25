using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExpenseCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ExpenseCategories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    NormalizedName = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Tone = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    RetiredAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExpenseCategories", x => x.Id);
                    table.CheckConstraint("CK_ExpenseCategories_Tone", "[Tone] IN (N'neutral', N'accent', N'info', N'mockup', N'warning', N'success')");
                    table.ForeignKey(
                        name: "FK_ExpenseCategories_AspNetUsers_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ExpenseCategories_AspNetUsers_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.InsertData(
                table: "ExpenseCategories",
                columns: new[] { "Id", "CreatedAtUtc", "CreatedById", "Name", "NormalizedName", "RetiredAtUtc", "Tone", "UpdatedAtUtc", "UpdatedById" },
                values: new object[,]
                {
                    { new Guid("447ad32e-1433-4b70-8786-72e3dc3f9937"), new DateTimeOffset(new DateTime(2026, 10, 25, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Supplies", "SUPPLIES", null, "warning", null, null },
                    { new Guid("51702a8f-81e4-4a20-8e39-2d4b270793de"), new DateTimeOffset(new DateTime(2026, 10, 25, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Utilities", "UTILITIES", null, "info", null, null },
                    { new Guid("6869715c-a01f-4053-87d8-8fd39feebebc"), new DateTimeOffset(new DateTime(2026, 10, 25, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Rent", "RENT", null, "accent", null, null },
                    { new Guid("b27a1f8a-5262-48c8-bca4-41e04583e015"), new DateTimeOffset(new DateTime(2026, 10, 25, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Government contributions", "GOVERNMENT CONTRIBUTIONS", null, "info", null, null },
                    { new Guid("b74d786b-8092-4e67-a0ba-a419e9d1ba75"), new DateTimeOffset(new DateTime(2026, 10, 25, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Maintenance", "MAINTENANCE", null, "neutral", null, null },
                    { new Guid("b9c92751-7040-4edd-bd44-de110104cb01"), new DateTimeOffset(new DateTime(2026, 10, 25, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Equipment", "EQUIPMENT", null, "success", null, null },
                    { new Guid("c8392b0c-ee0e-4a71-ba47-b137fdd1d8c0"), new DateTimeOffset(new DateTime(2026, 10, 25, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Taxes and permits", "TAXES AND PERMITS", null, "mockup", null, null },
                    { new Guid("d2aa53b4-7ebd-445e-b318-94ce1d21cbf2"), new DateTimeOffset(new DateTime(2026, 10, 25, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Salaries", "SALARIES", null, "mockup", null, null },
                    { new Guid("eb48e6a0-08a8-4509-9f5e-7b81167071de"), new DateTimeOffset(new DateTime(2026, 10, 25, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Transport and fuel", "TRANSPORT AND FUEL", null, "warning", null, null },
                    { new Guid("f85e6b1c-b46f-4a00-8c4e-5148eb3b9704"), new DateTimeOffset(new DateTime(2026, 10, 25, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Others", "OTHERS", null, "neutral", null, null }
                });

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseCategories_CreatedById",
                table: "ExpenseCategories",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseCategories_NormalizedName",
                table: "ExpenseCategories",
                column: "NormalizedName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ExpenseCategories_UpdatedById",
                table: "ExpenseCategories",
                column: "UpdatedById");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExpenseCategories");
        }
    }
}

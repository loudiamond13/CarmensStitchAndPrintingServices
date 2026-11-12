using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddShopClosures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ShopClosures",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FirstDay = table.Column<DateOnly>(type: "date", nullable: false),
                    LastDay = table.Column<DateOnly>(type: "date", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    CreatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShopClosures", x => x.Id);
                    table.CheckConstraint("CK_ShopClosures_LastOnOrAfterFirst", "[LastDay] >= [FirstDay]");
                    table.CheckConstraint("CK_ShopClosures_Span", "DATEDIFF(day, [FirstDay], [LastDay]) < 31");
                });

            migrationBuilder.InsertData(
                table: "DatabaseLocks",
                columns: new[] { "Name", "ExpiresAtUtc", "HolderId", "TakenAtUtc" },
                values: new object[] { "site-content", null, null, null });

            migrationBuilder.CreateIndex(
                name: "IX_ShopClosures_LastDay",
                table: "ShopClosures",
                column: "LastDay");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Forward only. Undoing this migration would drop the table and with it the closures the Manager has entered.
            // A drop is a one-way door: it needs the owner's approval and its own reviewed migration.
            throw new NotSupportedException(
                "AddShopClosures is forward-only. Undoing it would delete the closures that were entered.");
        }
    }
}

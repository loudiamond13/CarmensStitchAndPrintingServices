using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddQuoteRequestsLock : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "DatabaseLocks",
                columns: new[] { "Name", "ExpiresAtUtc", "HolderId", "TakenAtUtc" },
                values: new object[] { "quote-requests", null, null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "DatabaseLocks",
                keyColumn: "Name",
                keyValue: "quote-requests");
        }
    }
}

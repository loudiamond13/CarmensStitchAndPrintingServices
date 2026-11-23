using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddQuoteAlertsEmail : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "QuoteAlertsEmail",
                table: "SiteSettings",
                type: "nvarchar(254)",
                maxLength: 254,
                nullable: false,
                defaultValue: "");

            migrationBuilder.UpdateData(
                table: "SiteSettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "QuoteAlertsEmail",
                value: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "QuoteAlertsEmail",
                table: "SiteSettings");
        }
    }
}

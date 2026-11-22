using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDailyPageCounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DailyPageCounts",
                columns: table => new
                {
                    BusinessDay = table.Column<DateOnly>(type: "date", nullable: false),
                    PageKey = table.Column<string>(type: "varchar(32)", unicode: false, maxLength: 32, nullable: false),
                    Views = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DailyPageCounts", x => new { x.BusinessDay, x.PageKey });
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DailyPageCounts");
        }
    }
}

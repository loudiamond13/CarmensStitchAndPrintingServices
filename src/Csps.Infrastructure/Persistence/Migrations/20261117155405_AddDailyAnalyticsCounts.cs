using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDailyAnalyticsCounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DailyDeviceCounts",
                columns: table => new
                {
                    BusinessDay = table.Column<DateOnly>(type: "date", nullable: false),
                    Dimension = table.Column<byte>(type: "tinyint", nullable: false),
                    Name = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false),
                    Visits = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DailyDeviceCounts", x => new { x.BusinessDay, x.Dimension, x.Name });
                });

            migrationBuilder.CreateTable(
                name: "DailyReferrerCounts",
                columns: table => new
                {
                    BusinessDay = table.Column<DateOnly>(type: "date", nullable: false),
                    Referrer = table.Column<string>(type: "varchar(253)", unicode: false, maxLength: 253, nullable: false),
                    Visits = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DailyReferrerCounts", x => new { x.BusinessDay, x.Referrer });
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DailyDeviceCounts");

            migrationBuilder.DropTable(
                name: "DailyReferrerCounts");
        }
    }
}

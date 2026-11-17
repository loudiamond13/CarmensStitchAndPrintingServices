using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAnalyticsVisits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AnalyticsSalts",
                columns: table => new
                {
                    BusinessDay = table.Column<DateOnly>(type: "date", nullable: false),
                    Salt = table.Column<byte[]>(type: "binary(32)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AnalyticsSalts", x => x.BusinessDay);
                });

            migrationBuilder.CreateTable(
                name: "AnalyticsVisits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VisitorHash = table.Column<byte[]>(type: "binary(32)", nullable: false),
                    BusinessDay = table.Column<DateOnly>(type: "date", nullable: false),
                    StartedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastSeenAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Referrer = table.Column<string>(type: "varchar(253)", unicode: false, maxLength: 253, nullable: false),
                    Device = table.Column<byte>(type: "tinyint", nullable: false),
                    Browser = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false),
                    Os = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false),
                    IpHash = table.Column<byte[]>(type: "binary(32)", nullable: true),
                    PageViews = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AnalyticsVisits", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AnalyticsPageViews",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VisitId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BusinessDay = table.Column<DateOnly>(type: "date", nullable: false),
                    OccurredAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    PageKey = table.Column<string>(type: "varchar(32)", unicode: false, maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AnalyticsPageViews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AnalyticsPageViews_AnalyticsVisits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "AnalyticsVisits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AnalyticsVitalSamples",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VisitId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BusinessDay = table.Column<DateOnly>(type: "date", nullable: false),
                    Metric = table.Column<byte>(type: "tinyint", nullable: false),
                    Value = table.Column<decimal>(type: "decimal(9,3)", precision: 9, scale: 3, nullable: false),
                    PageKey = table.Column<string>(type: "varchar(32)", unicode: false, maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AnalyticsVitalSamples", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AnalyticsVitalSamples_AnalyticsVisits_VisitId",
                        column: x => x.VisitId,
                        principalTable: "AnalyticsVisits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AnalyticsPageViews_BusinessDay",
                table: "AnalyticsPageViews",
                column: "BusinessDay");

            migrationBuilder.CreateIndex(
                name: "IX_AnalyticsPageViews_VisitId",
                table: "AnalyticsPageViews",
                column: "VisitId");

            migrationBuilder.CreateIndex(
                name: "IX_AnalyticsVisits_BusinessDay",
                table: "AnalyticsVisits",
                column: "BusinessDay")
                .Annotation("SqlServer:Include", new[] { "VisitorHash", "Referrer", "Device", "Browser" });

            migrationBuilder.CreateIndex(
                name: "IX_AnalyticsVisits_VisitorHash_LastSeenAtUtc",
                table: "AnalyticsVisits",
                columns: new[] { "VisitorHash", "LastSeenAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_AnalyticsVitalSamples_BusinessDay_Metric_Value",
                table: "AnalyticsVitalSamples",
                columns: new[] { "BusinessDay", "Metric", "Value" });

            migrationBuilder.CreateIndex(
                name: "IX_AnalyticsVitalSamples_VisitId",
                table: "AnalyticsVitalSamples",
                column: "VisitId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AnalyticsPageViews");

            migrationBuilder.DropTable(
                name: "AnalyticsSalts");

            migrationBuilder.DropTable(
                name: "AnalyticsVitalSamples");

            migrationBuilder.DropTable(
                name: "AnalyticsVisits");
        }
    }
}

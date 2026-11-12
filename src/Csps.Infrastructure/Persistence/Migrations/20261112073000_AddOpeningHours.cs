using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOpeningHours : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OpeningHours",
                columns: table => new
                {
                    DayOfWeek = table.Column<int>(type: "int", nullable: false),
                    OpensAt = table.Column<TimeOnly>(type: "time(0)", nullable: true),
                    ClosesAt = table.Column<TimeOnly>(type: "time(0)", nullable: true),
                    CreatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OpeningHours", x => x.DayOfWeek);
                    table.CheckConstraint("CK_OpeningHours_BothOrNone", "([OpensAt] IS NULL AND [ClosesAt] IS NULL) OR ([OpensAt] IS NOT NULL AND [ClosesAt] IS NOT NULL)");
                    table.CheckConstraint("CK_OpeningHours_ClosesAfterOpens", "[OpensAt] IS NULL OR [ClosesAt] > [OpensAt]");
                    table.CheckConstraint("CK_OpeningHours_Day", "[DayOfWeek] BETWEEN 1 AND 7");
                });

            // Seven rows, Monday (1) to Sunday (7), every day closed: no hours are invented, and nothing seeds at startup (D-21).
            // The Manager sets the real hours in the admin. Written by hand, never HasData in the model.
            var createdAtUtc = new DateTimeOffset(2026, 11, 12, 0, 0, 0, TimeSpan.Zero);
            migrationBuilder.InsertData(
                table: "OpeningHours",
                columns: new[] { "DayOfWeek", "CreatedAtUtc" },
                values: new object[,]
                {
                    { 1, createdAtUtc },
                    { 2, createdAtUtc },
                    { 3, createdAtUtc },
                    { 4, createdAtUtc },
                    { 5, createdAtUtc },
                    { 6, createdAtUtc },
                    { 7, createdAtUtc },
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Forward only. Undoing this migration would drop the table and with it the opening hours the Manager has entered.
            // A drop is a one-way door: it needs the owner's approval and its own reviewed migration.
            throw new NotSupportedException(
                "AddOpeningHours is forward-only. Undoing it would delete the opening hours that were entered.");
        }
    }
}

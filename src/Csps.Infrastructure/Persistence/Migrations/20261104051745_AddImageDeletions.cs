using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddImageDeletions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ImageDeletions",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PublicId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    DeliveryType = table.Column<string>(type: "varchar(16)", unicode: false, maxLength: 16, nullable: false),
                    Reason = table.Column<byte>(type: "tinyint", nullable: false),
                    EnqueuedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    NextAttemptAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LeaseUntilUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LeaseHolder = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    LastFailureCode = table.Column<string>(type: "varchar(50)", unicode: false, maxLength: 50, nullable: true),
                    LastFailedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImageDeletions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ImageDeletions_NextAttemptAtUtc",
                table: "ImageDeletions",
                column: "NextAttemptAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_ImageDeletions_PublicId",
                table: "ImageDeletions",
                column: "PublicId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ImageDeletions");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddQuoteRequestPhotos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UploadKeyExpiresAtUtc",
                table: "QuoteRequests",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "UploadKeyHash",
                table: "QuoteRequests",
                type: "varbinary(32)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "QuoteRequestPhotos",
                columns: table => new
                {
                    QuoteRequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Slot = table.Column<byte>(type: "tinyint", nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    PublicId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Width = table.Column<int>(type: "int", nullable: true),
                    Height = table.Column<int>(type: "int", nullable: true),
                    Bytes = table.Column<int>(type: "int", nullable: true),
                    Kind = table.Column<string>(type: "varchar(8)", unicode: false, maxLength: 8, nullable: true),
                    StoredAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuoteRequestPhotos", x => new { x.QuoteRequestId, x.Slot });
                    table.CheckConstraint("CK_QuoteRequestPhotos_Slot", "[Slot] BETWEEN 0 AND 4");
                    table.ForeignKey(
                        name: "FK_QuoteRequestPhotos_QuoteRequests_QuoteRequestId",
                        column: x => x.QuoteRequestId,
                        principalTable: "QuoteRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_QuoteRequestPhotos_PublicId",
                table: "QuoteRequestPhotos",
                column: "PublicId",
                unique: true,
                filter: "[PublicId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuoteRequestPhotos");

            migrationBuilder.DropColumn(
                name: "UploadKeyExpiresAtUtc",
                table: "QuoteRequests");

            migrationBuilder.DropColumn(
                name: "UploadKeyHash",
                table: "QuoteRequests");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderPublicSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "PublicConsentAtUtc",
                table: "Orders",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PublicConsentById",
                table: "Orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PublicName",
                table: "Orders",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PublicProductLineId",
                table: "Orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ShownOnWebsiteSinceUtc",
                table: "Orders",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "GalleryEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Kind = table.Column<string>(type: "varchar(10)", unicode: false, maxLength: 10, nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Position = table.Column<int>(type: "int", nullable: false),
                    PublicId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Width = table.Column<int>(type: "int", nullable: true),
                    Height = table.Column<int>(type: "int", nullable: true),
                    Bytes = table.Column<int>(type: "int", nullable: true),
                    Format = table.Column<string>(type: "varchar(8)", unicode: false, maxLength: 8, nullable: true),
                    TeamName = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    ProductLineId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Pieces = table.Column<int>(type: "int", nullable: true),
                    Note = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    IsShown = table.Column<bool>(type: "bit", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GalleryEntries", x => x.Id);
                    table.CheckConstraint("CK_GalleryEntries_Kind", "([Kind] = 'Order' AND [OrderId] IS NOT NULL) OR ([Kind] = 'Upload' AND [OrderId] IS NULL AND [PublicId] IS NOT NULL AND [TeamName] IS NOT NULL AND [ProductLineId] IS NOT NULL)");
                    table.CheckConstraint("CK_GalleryEntries_Pieces", "[Pieces] IS NULL OR [Pieces] BETWEEN 1 AND 9999");
                    table.ForeignKey(
                        name: "FK_GalleryEntries_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GalleryEntries_ProductLines_ProductLineId",
                        column: x => x.ProductLineId,
                        principalTable: "ProductLines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Orders_PublicConsentById",
                table: "Orders",
                column: "PublicConsentById");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_PublicProductLineId",
                table: "Orders",
                column: "PublicProductLineId");

            migrationBuilder.CreateIndex(
                name: "IX_GalleryEntries_Position",
                table: "GalleryEntries",
                columns: new[] { "Position", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_GalleryEntries_ProductLineId",
                table: "GalleryEntries",
                column: "ProductLineId");

            migrationBuilder.CreateIndex(
                name: "UX_GalleryEntries_OrderId",
                table: "GalleryEntries",
                column: "OrderId",
                unique: true,
                filter: "[OrderId] IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_Orders_AspNetUsers_PublicConsentById",
                table: "Orders",
                column: "PublicConsentById",
                principalTable: "AspNetUsers",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Orders_ProductLines_PublicProductLineId",
                table: "Orders",
                column: "PublicProductLineId",
                principalTable: "ProductLines",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Forward only. Undoing this migration would drop the customer consent record and the gallery entries.
            // A drop is a one-way door: it needs the owner's approval and its own reviewed migration.
            throw new NotSupportedException(
                "AddOrderPublicSettings is forward-only. Undoing it would delete the customer consent record and the gallery entries.");
        }
    }
}

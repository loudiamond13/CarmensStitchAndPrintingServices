using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderLists : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProductTypes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    NormalizedName = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Tone = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    RetiredAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductTypes", x => x.Id);
                    table.CheckConstraint("CK_ProductTypes_Tone", "[Tone] IN (N'neutral', N'accent', N'info', N'mockup', N'warning', N'success')");
                    table.ForeignKey(
                        name: "FK_ProductTypes_AspNetUsers_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ProductTypes_AspNetUsers_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.InsertData(
                table: "ProductTypes",
                columns: new[] { "Id", "CreatedAtUtc", "CreatedById", "Name", "NormalizedName", "RetiredAtUtc", "Tone", "UpdatedAtUtc", "UpdatedById" },
                values: new object[,]
                {
                    { new Guid("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6"), new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Basketball Jersey", "BASKETBALL JERSEY", null, "accent", null, null },
                    { new Guid("01a17fce-7801-7e45-b875-357767854eda"), new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Volleyball Jersey", "VOLLEYBALL JERSEY", null, "info", null, null },
                    { new Guid("01a17fce-7802-7097-a1d7-d09eec3abeff"), new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Moto Riding Jersey", "MOTO RIDING JERSEY", null, "warning", null, null },
                    { new Guid("01a17fce-7803-7e5c-a7ef-616e966d8a4c"), new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Long Sleeves", "LONG SLEEVES", null, "mockup", null, null },
                    { new Guid("01a17fce-7804-7ac7-a63c-7c6a1ec5bad4"), new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Polo Shirt", "POLO SHIRT", null, "success", null, null },
                    { new Guid("01a17fce-7805-7744-aa72-f1641ce2b2bd"), new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Custom Design", "CUSTOM DESIGN", null, "neutral", null, null }
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductTypes_CreatedById",
                table: "ProductTypes",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_ProductTypes_NormalizedName",
                table: "ProductTypes",
                column: "NormalizedName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductTypes_UpdatedById",
                table: "ProductTypes",
                column: "UpdatedById");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProductTypes");
        }
    }
}

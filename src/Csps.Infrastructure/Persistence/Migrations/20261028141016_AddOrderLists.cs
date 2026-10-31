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
                name: "OrderExpenseCategories",
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
                    table.PrimaryKey("PK_OrderExpenseCategories", x => x.Id);
                    table.CheckConstraint("CK_OrderExpenseCategories_Tone", "[Tone] IN (N'neutral', N'accent', N'info', N'mockup', N'warning', N'success')");
                    table.ForeignKey(
                        name: "FK_OrderExpenseCategories_AspNetUsers_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_OrderExpenseCategories_AspNetUsers_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "PaymentMethods",
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
                    table.PrimaryKey("PK_PaymentMethods", x => x.Id);
                    table.CheckConstraint("CK_PaymentMethods_Tone", "[Tone] IN (N'neutral', N'accent', N'info', N'mockup', N'warning', N'success')");
                    table.ForeignKey(
                        name: "FK_PaymentMethods_AspNetUsers_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_PaymentMethods_AspNetUsers_UpdatedById",
                        column: x => x.UpdatedById,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id");
                });

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
                table: "OrderExpenseCategories",
                columns: new[] { "Id", "CreatedAtUtc", "CreatedById", "Name", "NormalizedName", "RetiredAtUtc", "Tone", "UpdatedAtUtc", "UpdatedById" },
                values: new object[,]
                {
                    { new Guid("01a17fce-780b-75d1-89e0-5b3b9b185a2c"), new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Fabric", "FABRIC", null, "info", null, null },
                    { new Guid("01a17fce-780c-73e0-b847-33f866e42d3d"), new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Ink & paper", "INK & PAPER", null, "accent", null, null },
                    { new Guid("01a17fce-780d-75c8-b20b-2b2cc64dddfa"), new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Outsourcing", "OUTSOURCING", null, "mockup", null, null },
                    { new Guid("01a17fce-780e-700c-90b2-d45ecdc6df9d"), new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Labor", "LABOR", null, "warning", null, null },
                    { new Guid("01a17fce-780f-79e1-b611-1952e5eb8893"), new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Delivery", "DELIVERY", null, "success", null, null },
                    { new Guid("01a17fce-7810-7507-bf1d-5a04ac95175a"), new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Others", "OTHERS", null, "neutral", null, null }
                });

            migrationBuilder.InsertData(
                table: "PaymentMethods",
                columns: new[] { "Id", "CreatedAtUtc", "CreatedById", "Name", "NormalizedName", "RetiredAtUtc", "Tone", "UpdatedAtUtc", "UpdatedById" },
                values: new object[,]
                {
                    { new Guid("01a17fce-7806-77e1-91b7-d3b852f2fd1d"), new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Cash", "CASH", null, "neutral", null, null },
                    { new Guid("01a17fce-7807-751a-bb7b-3719f2840928"), new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "GCash", "GCASH", null, "info", null, null },
                    { new Guid("01a17fce-7808-7b8c-b615-89ae2b4062c3"), new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Maya", "MAYA", null, "success", null, null },
                    { new Guid("01a17fce-7809-72b7-8803-599045f879c9"), new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Bank Transfer", "BANK TRANSFER", null, "mockup", null, null },
                    { new Guid("01a17fce-780a-7fca-bf36-c6229c6ddd4a"), new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null, "Cheque", "CHEQUE", null, "warning", null, null }
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
                name: "IX_OrderExpenseCategories_CreatedById",
                table: "OrderExpenseCategories",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_OrderExpenseCategories_NormalizedName",
                table: "OrderExpenseCategories",
                column: "NormalizedName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrderExpenseCategories_UpdatedById",
                table: "OrderExpenseCategories",
                column: "UpdatedById");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentMethods_CreatedById",
                table: "PaymentMethods",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentMethods_NormalizedName",
                table: "PaymentMethods",
                column: "NormalizedName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PaymentMethods_UpdatedById",
                table: "PaymentMethods",
                column: "UpdatedById");

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
                name: "OrderExpenseCategories");

            migrationBuilder.DropTable(
                name: "PaymentMethods");

            migrationBuilder.DropTable(
                name: "ProductTypes");
        }
    }
}

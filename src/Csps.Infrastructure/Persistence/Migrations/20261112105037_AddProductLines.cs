using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Csps.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProductLines : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ProductLineId",
                table: "ProductTypes",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProductLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    ShortName = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Number = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    CardText = table.Column<string>(type: "nvarchar(140)", maxLength: 140, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    FabricText = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    CollarText = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    CutText = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    NamesText = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    LogosText = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    StartsAtPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    MinimumQuantity = table.Column<int>(type: "int", nullable: true),
                    Position = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    PlaceholderArt = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false),
                    CreatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductLines", x => x.Id);
                    table.CheckConstraint("CK_ProductLines_Minimum", "[MinimumQuantity] BETWEEN 1 AND 9999");
                    table.CheckConstraint("CK_ProductLines_Price", "[StartsAtPrice] > 0 AND [StartsAtPrice] <= 999999.99");
                });

            migrationBuilder.InsertData(
                table: "ProductLines",
                columns: new[] { "Id", "Key", "Title", "ShortName", "Number", "CardText", "Description", "FabricText", "CollarText", "CutText", "NamesText", "LogosText", "Position", "IsActive", "PlaceholderArt", "CreatedAtUtc" },
                values: new object[,]
                {
                    { new Guid("3a48a1d6-c812-4481-a6be-d7d7412484a0"), "basketball", "Basketball Jerseys", "Basketball", "23", "Full sublimation tops and shorts, any colorway, names and numbers included.", "Game-ready tops and shorts, printed edge to edge in any colorway. Built for full-court runs and summer liga heat.", "Dri-fit mesh, aircool or spandex blend", "V-neck, round or layered", "Standard, slim, women's fit and kids", "Any font: front, back and shorts", "Team crest, sponsors and barangay seal in full color", 1, true, "Basketball", new DateTimeOffset(new DateTime(2026, 11, 11, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)) },
                    { new Guid("1416d96d-04dc-474e-98a5-2266ac382f74"), "volleyball", "Volleyball Jerseys", "Volleyball", "11", "Lightweight, stretch-fit cuts for indoor and beach teams.", "Light, stretchy and quick-drying for every dig and spike, indoor or beach.", "Aircool micro-eyelet or spandex", "Round, V-neck or mandarin", "Sleeveless, cap sleeve or short sleeve", "Libero colorway option included", "Club crest and sponsors, front and back", 2, true, "Volleyball", new DateTimeOffset(new DateTime(2026, 11, 11, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)) },
                    { new Guid("6ff58459-2a70-4876-ad50-9fb1ff1ba6c0"), "moto", "Moto Riding Jerseys", "Moto", "07", "Breathable long-sleeve riding tops with club crests and sponsor logos.", "Long-sleeve riding tops that breathe on long hauls and keep your club's colors loud on the road.", "Breathable mesh or UV-protect knit", "Crew, zip-neck or mandarin", "Racing fit or relaxed, thumb loops optional", "Rider name, club rank, plate number on sleeve", "Club crest, chapter name and sponsor patches", 3, true, "Moto", new DateTimeOffset(new DateTime(2026, 11, 11, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)) },
                    { new Guid("87f4ec3b-8120-457e-92df-204a4cdf7de1"), "longsleeves", "Long Sleeves", "Long Sleeves", "14", "Warm-ups, shooting shirts and dri-fit long sleeves for training days.", "Warm-ups, shooting shirts and everyday dri-fit long sleeves for training days and team events.", "Dri-fit, cotton-spandex or UV-protect", "Crew, hooded or quarter-zip", "Regular, athletic or raglan", "Names on back or sleeve", "Printed or embroidered logos", 4, true, "LongSleeves", new DateTimeOffset(new DateTime(2026, 11, 11, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)) },
                    { new Guid("8557a14d-153f-4e6e-bb21-5d993f82426b"), "polo", "Polo Shirts", "Polo", "03", "Sublimated or plain polos for coaches, staff, events and offices.", "Clean polos for coaches, staff, reunions and company events, sublimated or plain.", "Honeycomb piqué, dri-fit piqué or cotton", "Classic, mandarin or tipped", "Men's, women's and unisex", "Embroidered or printed name on chest", "Embroidered or sublimated logos", 5, true, "Polo", new DateTimeOffset(new DateTime(2026, 11, 11, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)) },
                    { new Guid("ca2ee9a1-6098-492a-b753-dabf5805a7bb"), "custom", "Custom Designs", "Custom", "00", "Bring a sketch or just an idea. Our artists build the full design.", "Have only an idea or a phone photo? Our artists build the full design from scratch and send you a mockup.", "Any of our fabrics", "Any collar we offer", "Our patterns, or match a sample you send", "Full roster from a spreadsheet", "We redraw and vectorize logos from a photo", 6, true, "Custom", new DateTimeOffset(new DateTime(2026, 11, 11, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)) }
                });

            migrationBuilder.CreateTable(
                name: "ProductLinePhotos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LineId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Slot = table.Column<byte>(type: "tinyint", nullable: false),
                    PublicId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Width = table.Column<int>(type: "int", nullable: false),
                    Height = table.Column<int>(type: "int", nullable: false),
                    Bytes = table.Column<int>(type: "int", nullable: false),
                    Format = table.Column<string>(type: "varchar(8)", unicode: false, maxLength: 8, nullable: false),
                    CreatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductLinePhotos", x => x.Id);
                    table.CheckConstraint("CK_ProductLinePhotos_Slot", "[Slot] BETWEEN 0 AND 2");
                    table.ForeignKey(
                        name: "FK_ProductLinePhotos_ProductLines_LineId",
                        column: x => x.LineId,
                        principalTable: "ProductLines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductTypes_ProductLineId",
                table: "ProductTypes",
                column: "ProductLineId");

            migrationBuilder.CreateIndex(
                name: "UX_ProductLinePhotos_LineSlot",
                table: "ProductLinePhotos",
                columns: new[] { "LineId", "Slot" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductLines_Position",
                table: "ProductLines",
                columns: new[] { "Position", "Id" });

            migrationBuilder.CreateIndex(
                name: "UX_ProductLines_Key",
                table: "ProductLines",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_ProductLines_ShortName",
                table: "ProductLines",
                column: "ShortName",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductTypes_ProductLines_ProductLineId",
                table: "ProductTypes",
                column: "ProductLineId",
                principalTable: "ProductLines",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Forward only. Undoing this migration would drop the product lines and the photos a Manager has entered.
            // A drop is a one-way door: it needs the owner's approval and its own reviewed migration.
            throw new NotSupportedException(
                "AddProductLines is forward-only. Undoing it would delete the product lines and photos that were entered.");
        }
    }
}

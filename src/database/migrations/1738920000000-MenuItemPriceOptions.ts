import { MigrationInterface, QueryRunner } from 'typeorm';

export class MenuItemPriceOptions1738920000000 implements MigrationInterface {
  name = 'MenuItemPriceOptions1738920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "menu_item_price_options" (
        "id" varchar(36) NOT NULL,
        "itemId" varchar(36) NOT NULL,
        "name" varchar(80) NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "priceInr" double precision NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_menu_item_price_options" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_menu_item_price_options_itemId"
      ON "menu_item_price_options" ("itemId")
    `);
    await queryRunner.query(`
      ALTER TABLE "menu_item_price_options"
      ADD CONSTRAINT "FK_menu_item_price_options_item"
      FOREIGN KEY ("itemId") REFERENCES "menu_items"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // Move category-column variants into per-product options for QuickCommerce locations.
    await queryRunner.query(`
      INSERT INTO "menu_item_price_options" ("id", "itemId", "name", "sortOrder", "priceInr")
      SELECT
        gen_random_uuid()::text,
        ivp."itemId",
        cpv."name",
        cpv."sortOrder",
        ivp."priceInr"
      FROM "menu_item_variant_prices" ivp
      INNER JOIN "menu_category_price_variants" cpv ON cpv."id" = ivp."variantId"
      INNER JOIN "menu_items" mi ON mi."id" = ivp."itemId"
      INNER JOIN "locations" l ON l."id" = mi."locationId"
      WHERE NOT (
        COALESCE(
          l."businessCategory",
          CASE WHEN l."menuMode" = 'food' THEN 'restaurant' ELSE 'retail' END
        ) IN ('restaurant', 'bakery')
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "menu_item_price_options" DROP CONSTRAINT "FK_menu_item_price_options_item"`,
    );
    await queryRunner.query(`DROP TABLE "menu_item_price_options"`);
  }
}

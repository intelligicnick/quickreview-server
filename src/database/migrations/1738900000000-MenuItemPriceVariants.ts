import { MigrationInterface, QueryRunner } from 'typeorm';

export class MenuItemPriceVariants1738900000000 implements MigrationInterface {
  name = 'MenuItemPriceVariants1738900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "menu_category_price_variants" (
        "id" varchar(36) NOT NULL,
        "categoryId" varchar(36) NOT NULL,
        "name" varchar(80) NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_menu_category_price_variants" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_menu_category_price_variants_categoryId"
      ON "menu_category_price_variants" ("categoryId")
    `);
    await queryRunner.query(`
      ALTER TABLE "menu_category_price_variants"
      ADD CONSTRAINT "FK_menu_category_price_variants_category"
      FOREIGN KEY ("categoryId") REFERENCES "menu_categories"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "menu_item_variant_prices" (
        "id" varchar(36) NOT NULL,
        "itemId" varchar(36) NOT NULL,
        "variantId" varchar(36) NOT NULL,
        "priceInr" double precision NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_menu_item_variant_prices" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_menu_item_variant_prices_item_variant" UNIQUE ("itemId", "variantId")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_menu_item_variant_prices_itemId"
      ON "menu_item_variant_prices" ("itemId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_menu_item_variant_prices_variantId"
      ON "menu_item_variant_prices" ("variantId")
    `);
    await queryRunner.query(`
      ALTER TABLE "menu_item_variant_prices"
      ADD CONSTRAINT "FK_menu_item_variant_prices_item"
      FOREIGN KEY ("itemId") REFERENCES "menu_items"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "menu_item_variant_prices"
      ADD CONSTRAINT "FK_menu_item_variant_prices_variant"
      FOREIGN KEY ("variantId") REFERENCES "menu_category_price_variants"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "menu_item_variant_prices" DROP CONSTRAINT "FK_menu_item_variant_prices_variant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_item_variant_prices" DROP CONSTRAINT "FK_menu_item_variant_prices_item"`,
    );
    await queryRunner.query(`DROP TABLE "menu_item_variant_prices"`);
    await queryRunner.query(
      `ALTER TABLE "menu_category_price_variants" DROP CONSTRAINT "FK_menu_category_price_variants_category"`,
    );
    await queryRunner.query(`DROP TABLE "menu_category_price_variants"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class MarketplaceCategoriesAndPhotos1738800000000 implements MigrationInterface {
  name = 'MarketplaceCategoriesAndPhotos1738800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "marketplace_categories" (
        "id" varchar(36) NOT NULL,
        "name" varchar(120) NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_marketplace_categories" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "qr_products" ADD "categoryId" varchar(36)`);
    await queryRunner.query(`ALTER TABLE "qr_products" ADD "imageUrl" varchar(2048)`);
    await queryRunner.query(`
      ALTER TABLE "qr_products"
      ADD CONSTRAINT "FK_qr_products_category"
      FOREIGN KEY ("categoryId") REFERENCES "marketplace_categories"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "qr_products" DROP CONSTRAINT "FK_qr_products_category"`);
    await queryRunner.query(`ALTER TABLE "qr_products" DROP COLUMN "imageUrl"`);
    await queryRunner.query(`ALTER TABLE "qr_products" DROP COLUMN "categoryId"`);
    await queryRunner.query(`DROP TABLE "marketplace_categories"`);
  }
}

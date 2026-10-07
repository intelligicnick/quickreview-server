import { MigrationInterface, QueryRunner } from 'typeorm';

export class MenuItemImageUrls1738910000000 implements MigrationInterface {
  name = 'MenuItemImageUrls1738910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "menu_items"
      ADD COLUMN "imageUrls" jsonb NOT NULL DEFAULT '[]'
    `);
    await queryRunner.query(`
      UPDATE "menu_items"
      SET "imageUrls" = jsonb_build_array("imageUrl")
      WHERE "imageUrl" IS NOT NULL AND trim("imageUrl") <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "menu_items" DROP COLUMN "imageUrls"`);
  }
}

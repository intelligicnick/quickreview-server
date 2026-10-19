import { MigrationInterface, QueryRunner } from 'typeorm';

export class MenuItemFeatured1740400000000 implements MigrationInterface {
  name = 'MenuItemFeatured1740400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('menu_items', 'isFeatured')) return;
    await queryRunner.query(
      `ALTER TABLE \`menu_items\` ADD \`isFeatured\` tinyint NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`menu_items\` DROP COLUMN \`isFeatured\``);
  }
}

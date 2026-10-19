import { MigrationInterface, QueryRunner } from 'typeorm';

export class LocationCatalogBanner1740500000000 implements MigrationInterface {
  name = 'LocationCatalogBanner1740500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('locations', 'catalogBannerUrl')) return;
    await queryRunner.query(
      `ALTER TABLE \`locations\` ADD \`catalogBannerUrl\` varchar(1000) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`locations\` DROP COLUMN \`catalogBannerUrl\``);
  }
}

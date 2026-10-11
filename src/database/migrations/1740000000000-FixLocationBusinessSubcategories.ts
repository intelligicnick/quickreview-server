import { MigrationInterface, QueryRunner } from 'typeorm';

/** Empty/invalid JSON in `businessSubcategories` breaks mysql2 JSON parsing on read. */
export class FixLocationBusinessSubcategories1740000000000 implements MigrationInterface {
  name = 'FixLocationBusinessSubcategories1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE locations
      SET businessSubcategories = '[]'
      WHERE businessSubcategories IS NULL
         OR TRIM(CAST(businessSubcategories AS CHAR(10000))) = ''
         OR JSON_VALID(CAST(businessSubcategories AS CHAR(10000))) = 0
    `);
    await queryRunner.query(`
      ALTER TABLE locations
      MODIFY businessSubcategories TEXT NOT NULL
    `);
  }

  public async down(): Promise<void> {
    // forward-only
  }
}

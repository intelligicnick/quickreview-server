import { MigrationInterface, QueryRunner } from 'typeorm';

/** Empty/invalid JSON in review settings breaks mysql2 JSON parsing on read. */
export class FixLocationReviewSettingsJson1740100000000 implements MigrationInterface {
  name = 'FixLocationReviewSettingsJson1740100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE location_review_settings
      SET keywords = '[]'
      WHERE keywords IS NULL
         OR TRIM(CAST(keywords AS CHAR(10000))) = ''
         OR JSON_VALID(CAST(keywords AS CHAR(10000))) = 0
    `);
    await queryRunner.query(`
      UPDATE location_review_settings
      SET reviewQuestions = NULL
      WHERE reviewQuestions IS NOT NULL
        AND (
          TRIM(CAST(reviewQuestions AS CHAR(10000))) = ''
          OR JSON_VALID(CAST(reviewQuestions AS CHAR(10000))) = 0
        )
    `);
    await queryRunner.query(`
      ALTER TABLE location_review_settings
      MODIFY keywords TEXT NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE location_review_settings
      MODIFY reviewQuestions TEXT NULL
    `);
  }

  public async down(): Promise<void> {
    // forward-only
  }
}

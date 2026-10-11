import { MigrationInterface, QueryRunner } from 'typeorm';

export class LocationReviewQuestions1739900000000 implements MigrationInterface {
  name = 'LocationReviewQuestions1739900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `location_review_settings` ADD `reviewQuestions` json NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `location_review_settings` DROP COLUMN `reviewQuestions`',
    );
  }
}

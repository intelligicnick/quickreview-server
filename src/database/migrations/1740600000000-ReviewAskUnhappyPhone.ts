import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReviewAskUnhappyPhone1740600000000 implements MigrationInterface {
  name = 'ReviewAskUnhappyPhone1740600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`location_review_settings\` ADD \`askUnhappyPhone\` tinyint NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE \`review_events\` ADD \`guestPhone\` varchar(32) NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`review_events\` DROP COLUMN \`guestPhone\``);
    await queryRunner.query(
      `ALTER TABLE \`location_review_settings\` DROP COLUMN \`askUnhappyPhone\``,
    );
  }
}

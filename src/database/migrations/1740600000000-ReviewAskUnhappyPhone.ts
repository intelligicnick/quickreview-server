import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReviewAskUnhappyPhone1740600000000 implements MigrationInterface {
  name = 'ReviewAskUnhappyPhone1740600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const hasAskUnhappyPhone = await queryRunner.hasColumn(
      'location_review_settings',
      'askUnhappyPhone',
    );
    if (!hasAskUnhappyPhone) {
      await queryRunner.query(
        `ALTER TABLE \`location_review_settings\` ADD \`askUnhappyPhone\` tinyint NOT NULL DEFAULT 1`,
      );
    }

    const hasGuestPhone = await queryRunner.hasColumn('review_events', 'guestPhone');
    if (!hasGuestPhone) {
      await queryRunner.query(
        `ALTER TABLE \`review_events\` ADD \`guestPhone\` varchar(32) NULL`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('review_events', 'guestPhone')) {
      await queryRunner.query(`ALTER TABLE \`review_events\` DROP COLUMN \`guestPhone\``);
    }
    if (await queryRunner.hasColumn('location_review_settings', 'askUnhappyPhone')) {
      await queryRunner.query(
        `ALTER TABLE \`location_review_settings\` DROP COLUMN \`askUnhappyPhone\``,
      );
    }
  }
}

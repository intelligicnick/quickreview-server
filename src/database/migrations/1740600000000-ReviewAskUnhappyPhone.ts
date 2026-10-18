import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReviewAskUnhappyPhone1740600000000 implements MigrationInterface {
  name = 'ReviewAskUnhappyPhone1740600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "location_review_settings" ADD COLUMN "askUnhappyPhone" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "review_events" ADD COLUMN "guestPhone" varchar(32)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "review_events" DROP COLUMN "guestPhone"`);
    await queryRunner.query(`ALTER TABLE "location_review_settings" DROP COLUMN "askUnhappyPhone"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class SubscriptionCheckoutPayment1740700000000 implements MigrationInterface {
  name = 'SubscriptionCheckoutPayment1740700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const hasCol = await queryRunner.hasColumn('subscriptions', 'checkoutPaymentId');
    if (!hasCol) {
      await queryRunner.query(
        `ALTER TABLE \`subscriptions\` ADD \`checkoutPaymentId\` varchar(36) NULL`,
      );
      await queryRunner.query(
        `CREATE INDEX \`IDX_subscriptions_checkoutPaymentId\` ON \`subscriptions\` (\`checkoutPaymentId\`)`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('subscriptions', 'checkoutPaymentId')) {
      await queryRunner.query(`DROP INDEX \`IDX_subscriptions_checkoutPaymentId\` ON \`subscriptions\``);
      await queryRunner.query(`ALTER TABLE \`subscriptions\` DROP COLUMN \`checkoutPaymentId\``);
    }
  }
}

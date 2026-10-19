import { MigrationInterface, QueryRunner } from 'typeorm';

export class CounterSale1740300000000 implements MigrationInterface {
  name = 'CounterSale1740300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('counter_sale_agents'))) {
    await queryRunner.query(`
      CREATE TABLE \`counter_sale_agents\` (
        \`id\` varchar(36) NOT NULL,
        \`username\` varchar(32) NOT NULL,
        \`pinHash\` varchar(255) NOT NULL,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`createdByUserId\` varchar(36) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`UQ_counter_sale_agents_username\` (\`username\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
    }
    if (!(await queryRunner.hasTable('counter_sale_provisions'))) {
    await queryRunner.query(`
      CREATE TABLE \`counter_sale_provisions\` (
        \`id\` varchar(36) NOT NULL,
        \`businessId\` varchar(36) NOT NULL,
        \`locationId\` varchar(36) NOT NULL,
        \`qrCode\` varchar(12) NOT NULL,
        \`service\` varchar(16) NOT NULL,
        \`provisionedByAgentId\` varchar(36) NULL,
        \`provisionedByUserId\` varchar(36) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`UQ_counter_sale_provisions_business\` (\`businessId\`),
        UNIQUE INDEX \`UQ_counter_sale_provisions_location\` (\`locationId\`),
        UNIQUE INDEX \`UQ_counter_sale_provisions_qr\` (\`qrCode\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `counter_sale_provisions`');
    await queryRunner.query('DROP TABLE `counter_sale_agents`');
  }
}

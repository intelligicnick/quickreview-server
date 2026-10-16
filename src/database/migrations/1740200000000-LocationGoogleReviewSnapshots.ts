import { MigrationInterface, QueryRunner } from 'typeorm';

export class LocationGoogleReviewSnapshots1740200000000 implements MigrationInterface {
  name = 'LocationGoogleReviewSnapshots1740200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`location_google_review_snapshots\` (
        \`id\` varchar(36) NOT NULL,
        \`locationId\` varchar(36) NOT NULL,
        \`snapshotDate\` varchar(10) NOT NULL,
        \`reviewCount\` int NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_location_google_review_snapshots_locationId\` (\`locationId\`),
        UNIQUE INDEX \`UQ_location_google_review_snapshots_day\` (\`locationId\`, \`snapshotDate\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `location_google_review_snapshots`');
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/** Fresh DB baseline: applies current entity metadata as MySQL DDL. */
export class InitialSchema1739080000000 implements MigrationInterface {
  name = 'InitialSchema1739080000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.connection.driver.createSchemaBuilder().build();
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const { downQueries } = await queryRunner.connection.driver.createSchemaBuilder().log();
    for (const q of [...downQueries].reverse()) {
      await queryRunner.query(q.query, q.parameters);
    }
  }
}

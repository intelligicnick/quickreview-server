import { MigrationInterface, QueryRunner } from 'typeorm';

/** Applies entity drift (new tables/columns) on DBs that only ran the initial baseline. */
export class SchemaSync1739900100000 implements MigrationInterface {
  name = 'SchemaSync1739900100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const { upQueries } = await queryRunner.connection.driver.createSchemaBuilder().log();
    for (const q of upQueries) {
      await queryRunner.query(q.query, q.parameters);
    }
  }

  public async down(): Promise<void> {
    // Auto-sync forward-only; down would require manual DDL.
  }
}

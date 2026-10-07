import { config } from 'dotenv';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { ENTITIES } from './database.module';

config({ path: join(__dirname, '../../.env') });
config({ path: join(__dirname, '../../../.env') });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is required for migrations');
}

export default new DataSource({
  type: 'postgres',
  url,
  entities: ENTITIES,
  migrations: [join(__dirname, 'migrations/*.{ts,js}')],
  synchronize: false,
});

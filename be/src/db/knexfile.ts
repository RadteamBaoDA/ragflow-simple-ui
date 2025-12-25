// Knex configuration used by CLI and knex-based tooling.
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from '@/config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Default Postgres connection with migrations in db/migrations
const dbConfig = {
  client: 'postgresql',
  connection: {
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name,
  },
  migrations: {
    directory: join(__dirname, 'migrations'),
    extension: 'ts',
  },
};

export default dbConfig;

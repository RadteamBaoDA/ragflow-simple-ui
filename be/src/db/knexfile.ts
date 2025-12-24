
import { config } from '../config/index.js';

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
    directory: '../../migrations',
    extension: 'ts',
  },
};

export default dbConfig;

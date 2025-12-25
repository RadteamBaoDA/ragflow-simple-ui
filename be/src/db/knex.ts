
// Lightweight Knex singleton for migrations/tests that rely on Knex API.
import knex from 'knex';
import dbConfig from '@/db/knexfile.js';

class KnexSingleton {
  private static instance: knex.Knex;

  private constructor() { }

  // Lazily create/reuse the Knex instance pointing at current dbConfig
  public static getInstance(): knex.Knex {
    if (!KnexSingleton.instance) {
      KnexSingleton.instance = knex(dbConfig);
    }
    return KnexSingleton.instance;
  }
}

export const db = KnexSingleton.getInstance();

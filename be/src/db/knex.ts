
import knex from 'knex';
import dbConfig from './knexfile.js';

class KnexSingleton {
  private static instance: knex.Knex;

  private constructor() {}

  public static getInstance(): knex.Knex {
    if (!KnexSingleton.instance) {
      KnexSingleton.instance = knex(dbConfig);
    }
    return KnexSingleton.instance;
  }
}

export const db = KnexSingleton.getInstance();

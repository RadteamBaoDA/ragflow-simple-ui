
/**
 * Thin CRUD wrapper around Knex; concrete models supply table name and shared knex instance.
 */
import { Knex } from 'knex';

export interface FindAllOptions {
    orderBy?: { [key: string]: 'asc' | 'desc' } | string;
    limit?: number;
    offset?: number;
}

export interface IBaseModel<T> {
  create(data: Partial<T>): Promise<T>;
  findById(id: string | number): Promise<T | undefined>;
  findAll(filter?: any, options?: FindAllOptions): Promise<T[]>;
  update(id: string | number | Partial<T>, data: Partial<T>): Promise<T | undefined>;
  delete(id: string | number | Partial<T>): Promise<void>;
}

export abstract class BaseModel<T> implements IBaseModel<T> {
  protected abstract tableName: string;
  protected abstract knex: Knex;

  async create(data: Partial<T>): Promise<T> {
    const [result] = await this.knex(this.tableName).insert(data).returning('*');
    return result;
  }

  async findById(id: string | number): Promise<T | undefined> {
    return this.knex(this.tableName).where({ id }).first();
  }

  async findAll(filter?: any, options?: FindAllOptions): Promise<T[]> {
    const query = this.knex(this.tableName);

    if (filter) {
      query.where(filter);
    }

    if (options) {
        if (options.orderBy) {
            if (typeof options.orderBy === 'string') {
                query.orderBy(options.orderBy);
            } else {
                for (const [column, order] of Object.entries(options.orderBy)) {
                    query.orderBy(column, order);
                }
            }
        }
        if (options.limit) {
            query.limit(options.limit);
        }
        if (options.offset) {
            query.offset(options.offset);
        }
    }

    return query;
  }

  async update(id: string | number | Partial<T>, data: Partial<T>): Promise<T | undefined> {
    const query = this.knex(this.tableName);
    if (typeof id === 'object') {
        query.where(id);
    } else {
        query.where({ id });
    }
    const [result] = await query.update(data).returning('*');
    return result;
  }

  async delete(id: string | number | Partial<T>): Promise<void> {
    const query = this.knex(this.tableName);
    if (typeof id === 'object') {
        query.where(id);
    } else {
        query.where({ id });
    }
    await query.delete();
  }

  // Expose underlying knex instance for custom queries
  getKnex(): Knex.QueryBuilder {
    return this.knex(this.tableName);
  }
}

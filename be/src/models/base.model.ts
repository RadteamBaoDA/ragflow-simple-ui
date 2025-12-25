
/**
 * Thin CRUD wrapper around Knex; concrete models supply table name and shared knex instance.
 */
import { Knex } from 'knex';

/**
 * FindAllOptions interface for query customization.
 * Allows specifying sorting, pagination, and limiting query results.
 */
export interface FindAllOptions {
  /** Column(s) to order by - either string or object with column:direction pairs */
  orderBy?: { [key: string]: 'asc' | 'desc' } | string;
  /** Maximum number of records to return */
  limit?: number;
  /** Number of records to skip for pagination */
  offset?: number;
}

/**
 * IBaseModel interface defining standard CRUD operations.
 * All model classes should implement this interface.
 */
export interface IBaseModel<T> {
  /** Create a new record */
  create(data: Partial<T>): Promise<T>;
  /** Find a single record by ID */
  findById(id: string | number): Promise<T | undefined>;
  /** Find all records matching optional filter with query options */
  findAll(filter?: any, options?: FindAllOptions): Promise<T[]>;
  /** Update a record by ID or filter, returns updated record */
  update(id: string | number | Partial<T>, data: Partial<T>): Promise<T | undefined>;
  /** Delete a record by ID or filter */
  delete(id: string | number | Partial<T>): Promise<void>;
}

/**
 * BaseModel abstract class providing thin CRUD wrapper around Knex.
 * Concrete models extend this class and supply table name and knex instance.
 * Implements the Factory Pattern for consistent data access layer.
 * @template T - The entity type this model manages
 */
export abstract class BaseModel<T> implements IBaseModel<T> {
  /** Database table name - must be set by concrete implementations */
  protected abstract tableName: string;
  /** Knex instance for database operations - shared across models */
  protected abstract knex: Knex;

  /**
   * Create a new record in the database.
   * @param data - Partial entity data to insert
   * @returns The created entity with all fields populated
   */
  async create(data: Partial<T>): Promise<T> {
    // Insert data and return the created record with all columns
    const [result] = await this.knex(this.tableName).insert(data).returning('*');
    return result;
  }

  /**
   * Find a single record by its primary key ID.
   * @param id - Record ID to look up
   * @returns The entity if found, undefined otherwise
   */
  async findById(id: string | number): Promise<T | undefined> {
    // Query by ID and return first (should be only) result
    return this.knex(this.tableName).where({ id }).first();
  }

  /**
   * Find all records matching optional filter with query options.
   * Supports sorting, pagination via limit/offset.
   * @param filter - Optional WHERE clause conditions
   * @param options - Optional query options (orderBy, limit, offset)
   * @returns Array of matching entities
   */
  async findAll(filter?: any, options?: FindAllOptions): Promise<T[]> {
    // Build base query for the table
    const query = this.knex(this.tableName);

    // Apply WHERE filter if provided
    if (filter) {
      query.where(filter);
    }

    // Apply query options (ordering, pagination)
    if (options) {
      // Handle orderBy - can be string or object with column:direction pairs
      if (options.orderBy) {
        if (typeof options.orderBy === 'string') {
          // Simple string ordering (e.g., 'created_at')
          query.orderBy(options.orderBy);
        } else {
          // Object ordering (e.g., { created_at: 'desc', name: 'asc' })
          for (const [column, order] of Object.entries(options.orderBy)) {
            query.orderBy(column, order);
          }
        }
      }
      // Apply LIMIT clause for pagination
      if (options.limit) {
        query.limit(options.limit);
      }
      // Apply OFFSET clause for pagination
      if (options.offset) {
        query.offset(options.offset);
      }
    }

    // Execute query and return results
    return query;
  }

  /**
   * Update a record by ID or filter conditions.
   * Supports both primary key lookup and object-based WHERE clause.
   * @param id - Record ID or object with filter conditions
   * @param data - Partial entity data to update
   * @returns Updated entity if found, undefined otherwise
   */
  async update(id: string | number | Partial<T>, data: Partial<T>): Promise<T | undefined> {
    // Build base query for the table
    const query = this.knex(this.tableName);

    // Handle both ID-based and object-based WHERE clauses
    if (typeof id === 'object') {
      // Object filter - use as WHERE conditions
      query.where(id);
    } else {
      // Primitive ID - look up by primary key
      query.where({ id });
    }

    // Apply updates and return the updated record
    const [result] = await query.update(data).returning('*');
    return result;
  }

  /**
   * Delete a record by ID or filter conditions.
   * Supports both primary key lookup and object-based WHERE clause.
   * @param id - Record ID or object with filter conditions
   */
  async delete(id: string | number | Partial<T>): Promise<void> {
    // Build base query for the table
    const query = this.knex(this.tableName);

    // Handle both ID-based and object-based WHERE clauses
    if (typeof id === 'object') {
      // Object filter - use as WHERE conditions
      query.where(id);
    } else {
      // Primitive ID - look up by primary key
      query.where({ id });
    }

    // Execute deletion
    await query.delete();
  }

  /**
   * Expose underlying Knex query builder for custom queries.
   * Use sparingly - prefer defined methods for standard operations.
   * @returns Knex QueryBuilder instance scoped to this table
   */
  getKnex(): Knex.QueryBuilder {
    return this.knex(this.tableName);
  }
}

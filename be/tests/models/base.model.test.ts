/**
 * @fileoverview Comprehensive unit tests for BaseModel class.
 * Tests CRUD operations, filtering, pagination, ordering, and Knex integration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseModel, FindAllOptions } from '../../src/models/base.model.js';
import { Knex } from 'knex';

// Test model implementation
interface TestEntity {
  id: number;
  name: string;
  email: string;
  created_at: Date;
}

class TestModel extends BaseModel<TestEntity> {
  protected tableName = 'test_table';
  protected knex: Knex;

  constructor(knex: Knex) {
    super();
    this.knex = knex;
  }
}

describe('BaseModel', () => {
  let testModel: TestModel;
  let mockKnex: any;
  let mockQuery: any;

  // Helper to create fresh mock query builder with proper chaining
  const createMockQuery = () => {
    const query: any = {
      insert: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(undefined),
      returning: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockResolvedValue(undefined),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      then: vi.fn((cb: any) => Promise.resolve([]).then(cb)),
    };
    return query;
  };

  beforeEach(() => {
    mockQuery = createMockQuery();
    mockKnex = vi.fn(() => mockQuery) as any;
    testModel = new TestModel(mockKnex);
  });

  describe('create', () => {
    it('should insert new record and return it', async () => {
      const newData = { name: 'John Doe', email: 'john@example.com' };
      const insertedRecord = { id: 1, ...newData, created_at: new Date() };

      mockQuery.returning.mockResolvedValue([insertedRecord]);

      const result = await testModel.create(newData);

      expect(mockKnex).toHaveBeenCalledWith('test_table');
      expect(mockQuery.insert).toHaveBeenCalledWith(newData);
      expect(mockQuery.returning).toHaveBeenCalledWith('*');
      expect(result).toEqual(insertedRecord);
    });

    it('should handle partial data creation', async () => {
      const partialData = { name: 'Jane' };
      const insertedRecord = { id: 2, name: 'Jane', email: null as any, created_at: new Date() };

      mockQuery.returning.mockResolvedValue([insertedRecord]);

      const result = await testModel.create(partialData);

      expect(mockQuery.insert).toHaveBeenCalledWith(partialData);
      expect(result).toEqual(insertedRecord);
    });

    it('should handle empty object creation', async () => {
      const emptyData = {};
      const insertedRecord = { id: 3, created_at: new Date() };

      mockQuery.returning.mockResolvedValue([insertedRecord]);

      const result = await testModel.create(emptyData);

      expect(mockQuery.insert).toHaveBeenCalledWith(emptyData);
      expect(result).toEqual(insertedRecord);
    });
  });

  describe('findById', () => {
    it('should find record by numeric id', async () => {
      const expectedRecord = { id: 1, name: 'John', email: 'john@example.com', created_at: new Date() };

      mockQuery.first.mockResolvedValue(expectedRecord);

      const result = await testModel.findById(1);

      expect(mockKnex).toHaveBeenCalledWith('test_table');
      expect(mockQuery.where).toHaveBeenCalledWith({ id: 1 });
      expect(mockQuery.first).toHaveBeenCalled();
      expect(result).toEqual(expectedRecord);
    });

    it('should find record by string id', async () => {
      const expectedRecord = { id: 'abc-123', name: 'Jane', email: 'jane@example.com', created_at: new Date() };

      mockQuery.first.mockResolvedValue(expectedRecord);

      const result = await testModel.findById('abc-123');

      expect(mockQuery.where).toHaveBeenCalledWith({ id: 'abc-123' });
      expect(result).toEqual(expectedRecord);
    });

    it('should return undefined when record not found', async () => {
      mockQuery.first.mockResolvedValue(undefined);

      const result = await testModel.findById(999);

      expect(result).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('should return all records without filter', async () => {
      const records = [
        { id: 1, name: 'John', email: 'john@example.com', created_at: new Date() },
        { id: 2, name: 'Jane', email: 'jane@example.com', created_at: new Date() }
      ];

      mockQuery.then.mockImplementation((cb: any) => Promise.resolve(records).then(cb));

      const result = await testModel.findAll();

      expect(mockKnex).toHaveBeenCalledWith('test_table');
      expect(result).toEqual(records);
    });

    it('should apply filters when provided', async () => {
      const filter = { email: 'john@example.com' };
      const records = [{ id: 1, name: 'John', email: 'john@example.com', created_at: new Date() }];

      mockQuery.then.mockImplementation((cb: any) => Promise.resolve(records).then(cb));

      const result = await testModel.findAll(filter);

      expect(mockQuery.where).toHaveBeenCalledWith(filter);
      expect(result).toEqual(records);
    });

    it('should apply string orderBy option', async () => {
      const options: FindAllOptions = { orderBy: 'name' };
      
      mockQuery.then.mockImplementation((cb: any) => Promise.resolve([]).then(cb));

      await testModel.findAll({}, options);

      expect(mockQuery.orderBy).toHaveBeenCalledWith('name');
    });

    it('should apply object orderBy option with single field', async () => {
      const options: FindAllOptions = { orderBy: { name: 'asc' } };
      
      mockQuery.then.mockImplementation((cb: any) => Promise.resolve([]).then(cb));

      await testModel.findAll({}, options);

      expect(mockQuery.orderBy).toHaveBeenCalledWith('name', 'asc');
    });

    it('should apply object orderBy option with multiple fields', async () => {
      const options: FindAllOptions = { orderBy: { name: 'asc', created_at: 'desc' } };
      
      mockQuery.then.mockImplementation((cb: any) => Promise.resolve([]).then(cb));

      await testModel.findAll({}, options);

      expect(mockQuery.orderBy).toHaveBeenCalledWith('name', 'asc');
      expect(mockQuery.orderBy).toHaveBeenCalledWith('created_at', 'desc');
    });

    it('should apply limit option', async () => {
      const options: FindAllOptions = { limit: 10 };
      
      mockQuery.then.mockImplementation((cb: any) => Promise.resolve([]).then(cb));

      await testModel.findAll({}, options);

      expect(mockQuery.limit).toHaveBeenCalledWith(10);
    });

    it('should apply offset option', async () => {
      const options: FindAllOptions = { offset: 20 };
      
      mockQuery.then.mockImplementation((cb: any) => Promise.resolve([]).then(cb));

      await testModel.findAll({}, options);

      expect(mockQuery.offset).toHaveBeenCalledWith(20);
    });

    it('should apply combined filter and options', async () => {
      const filter = { email: 'test@example.com' };
      const options: FindAllOptions = {
        orderBy: { created_at: 'desc' },
        limit: 5,
        offset: 10
      };
      
      mockQuery.then.mockImplementation((cb: any) => Promise.resolve([]).then(cb));

      await testModel.findAll(filter, options);

      expect(mockQuery.where).toHaveBeenCalledWith(filter);
      expect(mockQuery.orderBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(mockQuery.limit).toHaveBeenCalledWith(5);
      expect(mockQuery.offset).toHaveBeenCalledWith(10);
    });

    it('should handle empty result set', async () => {
      mockQuery.then.mockImplementation((cb: any) => Promise.resolve([]).then(cb));

      const result = await testModel.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update record by numeric id', async () => {
      const updateData = { name: 'Updated Name' };
      const updatedRecord = { id: 1, name: 'Updated Name', email: 'john@example.com', created_at: new Date() };

      mockQuery.returning.mockResolvedValue([updatedRecord]);

      const result = await testModel.update(1, updateData);

      expect(mockKnex).toHaveBeenCalledWith('test_table');
      expect(mockQuery.where).toHaveBeenCalledWith({ id: 1 });
      expect(mockQuery.update).toHaveBeenCalledWith(updateData);
      expect(mockQuery.returning).toHaveBeenCalledWith('*');
      expect(result).toEqual(updatedRecord);
    });

    it('should update record by string id', async () => {
      const updateData = { email: 'newemail@example.com' };
      const updatedRecord = { id: 'abc-123', name: 'Jane', email: 'newemail@example.com', created_at: new Date() };

      mockQuery.returning.mockResolvedValue([updatedRecord]);

      const result = await testModel.update('abc-123', updateData);

      expect(mockQuery.where).toHaveBeenCalledWith({ id: 'abc-123' });
      expect(result).toEqual(updatedRecord);
    });

    it('should update record by filter object', async () => {
      const filter = { email: 'old@example.com' };
      const updateData = { email: 'new@example.com' };
      const updatedRecord = { id: 1, name: 'John', email: 'new@example.com', created_at: new Date() };

      mockQuery.returning.mockResolvedValue([updatedRecord]);

      const result = await testModel.update(filter, updateData);

      expect(mockQuery.where).toHaveBeenCalledWith(filter);
      expect(mockQuery.update).toHaveBeenCalledWith(updateData);
      expect(result).toEqual(updatedRecord);
    });

    it('should return undefined when no record updated', async () => {
      const updateData = { name: 'Updated' };

      mockQuery.returning.mockResolvedValue([]);

      const result = await testModel.update(999, updateData);

      expect(result).toBeUndefined();
    });

    it('should handle partial updates', async () => {
      const updateData = { name: 'Partial Update' };
      const updatedRecord = { id: 1, name: 'Partial Update', email: 'original@example.com', created_at: new Date() };

      mockQuery.returning.mockResolvedValue([updatedRecord]);

      const result = await testModel.update(1, updateData);

      expect(mockQuery.update).toHaveBeenCalledWith(updateData);
      expect(result).toEqual(updatedRecord);
    });
  });

  describe('delete', () => {
    it('should delete record by numeric id', async () => {
      await testModel.delete(1);

      expect(mockKnex).toHaveBeenCalledWith('test_table');
      expect(mockQuery.where).toHaveBeenCalledWith({ id: 1 });
      expect(mockQuery.delete).toHaveBeenCalled();
    });

    it('should delete record by string id', async () => {
      await testModel.delete('abc-123');

      expect(mockQuery.where).toHaveBeenCalledWith({ id: 'abc-123' });
      expect(mockQuery.delete).toHaveBeenCalled();
    });

    it('should delete record by filter object', async () => {
      const filter = { email: 'delete@example.com' };

      await testModel.delete(filter);

      expect(mockQuery.where).toHaveBeenCalledWith(filter);
      expect(mockQuery.delete).toHaveBeenCalled();
    });

    it('should not throw error when deleting non-existent record', async () => {
      mockQuery.delete.mockResolvedValue(undefined);

      await expect(testModel.delete(999)).resolves.not.toThrow();
    });

    it('should handle complex filter for deletion', async () => {
      const complexFilter = { email: 'test@example.com', created_at: new Date() };

      await testModel.delete(complexFilter);

      expect(mockQuery.where).toHaveBeenCalledWith(complexFilter);
      expect(mockQuery.delete).toHaveBeenCalled();
    });
  });

  describe('tableName', () => {
    it('should use correct table name for queries', async () => {
      mockQuery.first.mockResolvedValue(undefined);

      await testModel.findById(1);

      expect(mockKnex).toHaveBeenCalledWith('test_table');
    });
  });
});

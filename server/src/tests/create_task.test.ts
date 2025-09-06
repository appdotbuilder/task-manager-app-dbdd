import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { tasksTable, usersTable } from '../db/schema';
import { type CreateTaskInput } from '../schema';
import { createTask } from '../handlers/create_task';
import { eq } from 'drizzle-orm';

// Helper to create test users
const createTestUser = async (role: 'admin' | 'user' = 'admin') => {
  const result = await db.insert(usersTable)
    .values({
      username: role === 'admin' ? 'admin_user' : 'regular_user',
      email: role === 'admin' ? 'admin@test.com' : 'user@test.com',
      password_hash: 'hashed_password',
      role: role
    })
    .returning()
    .execute();
  
  return result[0];
};

// Simple test input
const testInput: CreateTaskInput = {
  title: 'Test Task',
  description: 'A task for testing',
  due_date: new Date('2024-12-31'),
  status: 'pending',
  assigned_user_id: undefined
};

describe('createTask', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a task when admin creates it', async () => {
    const adminUser = await createTestUser('admin');
    
    const result = await createTask(testInput, adminUser.id, 'admin');

    // Basic field validation
    expect(result.title).toEqual('Test Task');
    expect(result.description).toEqual(testInput.description);
    expect(result.due_date).toEqual(testInput.due_date);
    expect(result.status).toEqual('pending');
    expect(result.assigned_user_id).toBeNull();
    expect(result.created_by).toEqual(adminUser.id);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save task to database', async () => {
    const adminUser = await createTestUser('admin');
    
    const result = await createTask(testInput, adminUser.id, 'admin');

    // Query using proper drizzle syntax
    const tasks = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, result.id))
      .execute();

    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toEqual('Test Task');
    expect(tasks[0].description).toEqual(testInput.description);
    expect(tasks[0].due_date).toEqual(testInput.due_date);
    expect(tasks[0].status).toEqual('pending');
    expect(tasks[0].assigned_user_id).toBeNull();
    expect(tasks[0].created_by).toEqual(adminUser.id);
    expect(tasks[0].created_at).toBeInstanceOf(Date);
    expect(tasks[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create task with assigned user', async () => {
    const adminUser = await createTestUser('admin');
    const regularUser = await createTestUser('user');
    
    const inputWithAssignment: CreateTaskInput = {
      ...testInput,
      assigned_user_id: regularUser.id
    };

    const result = await createTask(inputWithAssignment, adminUser.id, 'admin');

    expect(result.assigned_user_id).toEqual(regularUser.id);
    expect(result.created_by).toEqual(adminUser.id);
    
    // Verify in database
    const tasks = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, result.id))
      .execute();

    expect(tasks[0].assigned_user_id).toEqual(regularUser.id);
  });

  it('should use default status when not provided', async () => {
    const adminUser = await createTestUser('admin');
    
    // Test that our handler logic applies the default correctly
    const inputWithUndefinedStatus = {
      ...testInput,
      status: undefined as any
    };

    const result = await createTask(inputWithUndefinedStatus, adminUser.id, 'admin');

    expect(result.status).toEqual('pending');
  });

  it('should respect provided status', async () => {
    const adminUser = await createTestUser('admin');
    
    const inputWithStatus: CreateTaskInput = {
      ...testInput,
      status: 'in-progress'
    };

    const result = await createTask(inputWithStatus, adminUser.id, 'admin');

    expect(result.status).toEqual('in-progress');
  });

  it('should reject task creation by non-admin users', async () => {
    const regularUser = await createTestUser('user');

    await expect(
      createTask(testInput, regularUser.id, 'user')
    ).rejects.toThrow(/only admins can create tasks/i);
  });

  it('should reject task creation with non-existent assigned user', async () => {
    const adminUser = await createTestUser('admin');
    
    const inputWithInvalidAssignment: CreateTaskInput = {
      ...testInput,
      assigned_user_id: 999 // Non-existent user ID
    };

    await expect(
      createTask(inputWithInvalidAssignment, adminUser.id, 'admin')
    ).rejects.toThrow(/assigned user does not exist/i);
  });

  it('should reject task creation with non-existent creator', async () => {
    await expect(
      createTask(testInput, 999, 'admin') // Non-existent creator ID
    ).rejects.toThrow(/creator user does not exist/i);
  });

  it('should handle different task statuses correctly', async () => {
    const adminUser = await createTestUser('admin');
    
    const statuses: Array<'pending' | 'in-progress' | 'completed'> = ['pending', 'in-progress', 'completed'];
    
    for (const status of statuses) {
      const inputWithStatus: CreateTaskInput = {
        ...testInput,
        title: `Test Task - ${status}`,
        status: status
      };

      const result = await createTask(inputWithStatus, adminUser.id, 'admin');
      expect(result.status).toEqual(status);
      
      // Verify in database
      const tasks = await db.select()
        .from(tasksTable)
        .where(eq(tasksTable.id, result.id))
        .execute();

      expect(tasks[0].status).toEqual(status);
    }
  });
});
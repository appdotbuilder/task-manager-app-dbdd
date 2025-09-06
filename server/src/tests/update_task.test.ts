import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { tasksTable, usersTable } from '../db/schema';
import { type UpdateTaskInput, type CreateUserInput } from '../schema';
import { updateTask } from '../handlers/update_task';
import { eq } from 'drizzle-orm';

// Test user data
const adminUser: CreateUserInput = {
  username: 'admin_user',
  email: 'admin@example.com',
  password: 'password123',
  role: 'admin'
};

const regularUser: CreateUserInput = {
  username: 'regular_user',
  email: 'user@example.com',
  password: 'password123',
  role: 'user'
};

// Test task data
const testTask = {
  title: 'Original Task',
  description: 'Original description',
  due_date: new Date('2024-12-31'),
  status: 'pending' as const,
  assigned_user_id: null,
  created_by: 1
};

describe('updateTask', () => {
  let adminUserId: number;
  let regularUserId: number;
  let taskId: number;

  beforeEach(async () => {
    await createDB();

    // Create test users
    const adminResult = await db.insert(usersTable)
      .values({
        username: adminUser.username,
        email: adminUser.email,
        password_hash: 'hashed_password',
        role: adminUser.role
      })
      .returning()
      .execute();
    adminUserId = adminResult[0].id;

    const userResult = await db.insert(usersTable)
      .values({
        username: regularUser.username,
        email: regularUser.email,
        password_hash: 'hashed_password',
        role: regularUser.role
      })
      .returning()
      .execute();
    regularUserId = userResult[0].id;

    // Create test task
    const taskResult = await db.insert(tasksTable)
      .values({
        ...testTask,
        created_by: adminUserId
      })
      .returning()
      .execute();
    taskId = taskResult[0].id;
  });

  afterEach(resetDB);

  it('should update task when admin user', async () => {
    const updateInput: UpdateTaskInput = {
      id: taskId,
      title: 'Updated Task Title',
      description: 'Updated description',
      status: 'in-progress'
    };

    const result = await updateTask(updateInput, adminUserId, 'admin');

    expect(result.id).toEqual(taskId);
    expect(result.title).toEqual('Updated Task Title');
    expect(result.description).toEqual('Updated description');
    expect(result.status).toEqual('in-progress');
    expect(result.due_date).toEqual(testTask.due_date);
    expect(result.assigned_user_id).toBeNull();
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > result.created_at).toBe(true);
  });

  it('should update only provided fields', async () => {
    const updateInput: UpdateTaskInput = {
      id: taskId,
      title: 'Only Title Updated'
    };

    const result = await updateTask(updateInput, adminUserId, 'admin');

    expect(result.title).toEqual('Only Title Updated');
    expect(result.description).toEqual('Original description');
    expect(result.status).toEqual('pending');
    expect(result.due_date).toEqual(testTask.due_date);
  });

  it('should update assigned_user_id', async () => {
    const updateInput: UpdateTaskInput = {
      id: taskId,
      assigned_user_id: regularUserId
    };

    const result = await updateTask(updateInput, adminUserId, 'admin');

    expect(result.assigned_user_id).toEqual(regularUserId);
    expect(result.title).toEqual('Original Task');
  });

  it('should set assigned_user_id to null', async () => {
    // First assign the task to someone
    await db.update(tasksTable)
      .set({ assigned_user_id: regularUserId })
      .where(eq(tasksTable.id, taskId))
      .execute();

    const updateInput: UpdateTaskInput = {
      id: taskId,
      assigned_user_id: null
    };

    const result = await updateTask(updateInput, adminUserId, 'admin');

    expect(result.assigned_user_id).toBeNull();
  });

  it('should save updated task to database', async () => {
    const updateInput: UpdateTaskInput = {
      id: taskId,
      title: 'Database Update Test',
      status: 'completed'
    };

    await updateTask(updateInput, adminUserId, 'admin');

    const tasks = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .execute();

    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toEqual('Database Update Test');
    expect(tasks[0].status).toEqual('completed');
    expect(tasks[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error when non-admin user tries to update', async () => {
    const updateInput: UpdateTaskInput = {
      id: taskId,
      title: 'Should Not Work'
    };

    await expect(updateTask(updateInput, regularUserId, 'user')).rejects.toThrow(/only admins can update tasks/i);
  });

  it('should throw error when task does not exist', async () => {
    const updateInput: UpdateTaskInput = {
      id: 99999,
      title: 'Non-existent Task'
    };

    await expect(updateTask(updateInput, adminUserId, 'admin')).rejects.toThrow(/task not found/i);
  });

  it('should update due_date correctly', async () => {
    const newDueDate = new Date('2025-06-15');
    const updateInput: UpdateTaskInput = {
      id: taskId,
      due_date: newDueDate
    };

    const result = await updateTask(updateInput, adminUserId, 'admin');

    expect(result.due_date).toEqual(newDueDate);
    expect(result.title).toEqual('Original Task');
  });

  it('should update all fields at once', async () => {
    const newDueDate = new Date('2025-01-15');
    const updateInput: UpdateTaskInput = {
      id: taskId,
      title: 'Completely Updated Task',
      description: 'New description for testing',
      due_date: newDueDate,
      status: 'completed',
      assigned_user_id: regularUserId
    };

    const result = await updateTask(updateInput, adminUserId, 'admin');

    expect(result.title).toEqual('Completely Updated Task');
    expect(result.description).toEqual('New description for testing');
    expect(result.due_date).toEqual(newDueDate);
    expect(result.status).toEqual('completed');
    expect(result.assigned_user_id).toEqual(regularUserId);
    expect(result.updated_at).toBeInstanceOf(Date);
  });
});
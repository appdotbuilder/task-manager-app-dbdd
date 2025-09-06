import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, tasksTable } from '../db/schema';
import { type CompleteTaskInput } from '../schema';
import { completeTask } from '../handlers/complete_task';
import { eq } from 'drizzle-orm';

describe('completeTask', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create a test user
  const createTestUser = async (role: 'admin' | 'user' = 'user') => {
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 1000);
    const result = await db.insert(usersTable)
      .values({
        username: `${role}_user_${timestamp}_${randomNum}`,
        email: `${role}_${timestamp}_${randomNum}@test.com`,
        password_hash: 'hashed_password',
        role: role
      })
      .returning()
      .execute();
    return result[0];
  };

  // Helper function to create a test task
  const createTestTask = async (createdBy: number, assignedUserId?: number) => {
    const result = await db.insert(tasksTable)
      .values({
        title: 'Test Task',
        description: 'A task for testing',
        due_date: new Date('2024-12-31'),
        status: 'in-progress',
        assigned_user_id: assignedUserId || null,
        created_by: createdBy
      })
      .returning()
      .execute();
    return result[0];
  };

  it('should complete a task assigned to the user', async () => {
    // Create test user and task
    const user = await createTestUser('user');
    const task = await createTestTask(user.id, user.id);

    const input: CompleteTaskInput = {
      id: task.id
    };

    const result = await completeTask(input, user.id);

    // Verify the task is marked as completed
    expect(result.id).toBe(task.id);
    expect(result.status).toBe('completed');
    expect(result.title).toBe('Test Task');
    expect(result.description).toBe('A task for testing');
    expect(result.assigned_user_id).toBe(user.id);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > task.updated_at).toBe(true);
  });

  it('should update task in database when completed', async () => {
    // Create test user and task
    const user = await createTestUser('user');
    const task = await createTestTask(user.id, user.id);

    const input: CompleteTaskInput = {
      id: task.id
    };

    await completeTask(input, user.id);

    // Verify the task is updated in the database
    const updatedTasks = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, task.id))
      .execute();

    expect(updatedTasks).toHaveLength(1);
    expect(updatedTasks[0].status).toBe('completed');
    expect(updatedTasks[0].updated_at).toBeInstanceOf(Date);
    expect(updatedTasks[0].updated_at > task.updated_at).toBe(true);
  });

  it('should allow admin to complete any task', async () => {
    // Create admin and regular user
    const admin = await createTestUser('admin');
    const regularUser = await createTestUser('user');
    
    // Create task assigned to regular user
    const task = await createTestTask(admin.id, regularUser.id);

    const input: CompleteTaskInput = {
      id: task.id
    };

    const result = await completeTask(input, admin.id);

    // Admin should be able to complete the task even though it's assigned to someone else
    expect(result.status).toBe('completed');
    expect(result.assigned_user_id).toBe(regularUser.id); // Task still assigned to original user
  });

  it('should allow admin to complete unassigned task', async () => {
    // Create admin
    const admin = await createTestUser('admin');
    
    // Create unassigned task
    const task = await createTestTask(admin.id);

    const input: CompleteTaskInput = {
      id: task.id
    };

    const result = await completeTask(input, admin.id);

    expect(result.status).toBe('completed');
    expect(result.assigned_user_id).toBeNull();
  });

  it('should reject user trying to complete task not assigned to them', async () => {
    // Create two users
    const user1 = await createTestUser('user');
    const user2 = await createTestUser('user');
    
    // Create task assigned to user1
    const task = await createTestTask(user1.id, user1.id);

    const input: CompleteTaskInput = {
      id: task.id
    };

    // user2 tries to complete user1's task
    await expect(completeTask(input, user2.id))
      .rejects.toThrow(/permission denied.*you can only complete tasks assigned to you/i);
  });

  it('should reject user trying to complete unassigned task', async () => {
    // Create user and admin
    const user = await createTestUser('user');
    const admin = await createTestUser('admin');
    
    // Create unassigned task
    const task = await createTestTask(admin.id);

    const input: CompleteTaskInput = {
      id: task.id
    };

    // Regular user tries to complete unassigned task
    await expect(completeTask(input, user.id))
      .rejects.toThrow(/permission denied.*you can only complete tasks assigned to you/i);
  });

  it('should reject completion of non-existent task', async () => {
    const user = await createTestUser('user');

    const input: CompleteTaskInput = {
      id: 99999 // Non-existent task ID
    };

    await expect(completeTask(input, user.id))
      .rejects.toThrow(/task not found/i);
  });

  it('should reject completion by non-existent user', async () => {
    const user = await createTestUser('user');
    const task = await createTestTask(user.id, user.id);

    const input: CompleteTaskInput = {
      id: task.id
    };

    // Use non-existent user ID
    await expect(completeTask(input, 99999))
      .rejects.toThrow(/user not found/i);
  });

  it('should preserve all task fields when completing', async () => {
    const user = await createTestUser('user');
    const originalDueDate = new Date('2024-12-25');
    
    // Create task with specific details
    const task = await db.insert(tasksTable)
      .values({
        title: 'Important Task',
        description: 'This is a very important task with detailed description',
        due_date: originalDueDate,
        status: 'pending',
        assigned_user_id: user.id,
        created_by: user.id
      })
      .returning()
      .execute();

    const input: CompleteTaskInput = {
      id: task[0].id
    };

    const result = await completeTask(input, user.id);

    // Verify all fields are preserved except status and updated_at
    expect(result.title).toBe('Important Task');
    expect(result.description).toBe('This is a very important task with detailed description');
    expect(result.due_date).toEqual(originalDueDate);
    expect(result.assigned_user_id).toBe(user.id);
    expect(result.created_by).toBe(user.id);
    expect(result.created_at).toEqual(task[0].created_at);
    expect(result.status).toBe('completed'); // Changed
    expect(result.updated_at > task[0].updated_at).toBe(true); // Updated
  });
});
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, tasksTable } from '../db/schema';
import { deleteTask } from '../handlers/delete_task';
import { eq } from 'drizzle-orm';

// Test data
const testAdmin = {
  username: 'admin_user',
  email: 'admin@example.com',
  password_hash: 'hashed_password',
  role: 'admin' as const
};

const testUser = {
  username: 'regular_user',
  email: 'user@example.com',
  password_hash: 'hashed_password',
  role: 'user' as const
};

describe('deleteTask', () => {
  let adminId: number;
  let userId: number;
  let taskId: number;

  beforeEach(async () => {
    await createDB();

    // Create test users
    const adminResult = await db.insert(usersTable)
      .values(testAdmin)
      .returning()
      .execute();
    adminId = adminResult[0].id;

    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create a test task
    const taskResult = await db.insert(tasksTable)
      .values({
        title: 'Test Task',
        description: 'A task to be deleted',
        due_date: new Date('2024-12-31'),
        status: 'pending',
        assigned_user_id: userId,
        created_by: adminId
      })
      .returning()
      .execute();
    taskId = taskResult[0].id;
  });

  afterEach(resetDB);

  it('should successfully delete a task when admin role', async () => {
    const result = await deleteTask(taskId, adminId, 'admin');

    expect(result.success).toBe(true);

    // Verify task is actually deleted from database
    const deletedTask = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .execute();

    expect(deletedTask).toHaveLength(0);
  });

  it('should throw error when non-admin tries to delete task', async () => {
    await expect(deleteTask(taskId, userId, 'user')).rejects.toThrow(/Only admins can delete tasks/i);

    // Verify task still exists in database
    const existingTask = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .execute();

    expect(existingTask).toHaveLength(1);
    expect(existingTask[0].id).toBe(taskId);
  });

  it('should throw error when task does not exist', async () => {
    const nonExistentTaskId = 99999;

    await expect(deleteTask(nonExistentTaskId, adminId, 'admin')).rejects.toThrow(/Task not found/i);
  });

  it('should handle multiple task deletions correctly', async () => {
    // Create another test task
    const secondTaskResult = await db.insert(tasksTable)
      .values({
        title: 'Second Test Task',
        description: 'Another task to be deleted',
        due_date: new Date('2024-12-31'),
        status: 'in-progress',
        assigned_user_id: null, // Unassigned task
        created_by: adminId
      })
      .returning()
      .execute();
    const secondTaskId = secondTaskResult[0].id;

    // Delete first task
    const result1 = await deleteTask(taskId, adminId, 'admin');
    expect(result1.success).toBe(true);

    // Delete second task
    const result2 = await deleteTask(secondTaskId, adminId, 'admin');
    expect(result2.success).toBe(true);

    // Verify both tasks are deleted
    const remainingTasks = await db.select()
      .from(tasksTable)
      .execute();

    expect(remainingTasks).toHaveLength(0);
  });

  it('should validate task ownership does not matter for admin deletion', async () => {
    // Create a task created by the regular user
    const userCreatedTaskResult = await db.insert(tasksTable)
      .values({
        title: 'User Created Task',
        description: 'Task created by regular user',
        due_date: new Date('2024-12-31'),
        status: 'pending',
        assigned_user_id: adminId, // Admin assigned to user's task
        created_by: userId // Created by regular user
      })
      .returning()
      .execute();
    const userCreatedTaskId = userCreatedTaskResult[0].id;

    // Admin should still be able to delete it
    const result = await deleteTask(userCreatedTaskId, adminId, 'admin');

    expect(result.success).toBe(true);

    // Verify task is deleted
    const deletedTask = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, userCreatedTaskId))
      .execute();

    expect(deletedTask).toHaveLength(0);
  });
});
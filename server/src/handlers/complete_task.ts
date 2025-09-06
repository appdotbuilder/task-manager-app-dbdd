import { db } from '../db';
import { tasksTable, usersTable } from '../db/schema';
import { type CompleteTaskInput, type Task } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function completeTask(input: CompleteTaskInput, userId: number): Promise<Task> {
  try {
    // First, verify the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Get the task to validate existence and permissions
    const existingTask = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, input.id))
      .limit(1)
      .execute();

    if (existingTask.length === 0) {
      throw new Error('Task not found');
    }

    const task = existingTask[0];

    // Check permissions: regular users can only complete their own assigned tasks
    // Admins can complete any task
    if (user[0].role === 'user' && task.assigned_user_id !== userId) {
      throw new Error('Permission denied: You can only complete tasks assigned to you');
    }

    // Update the task status to completed and update the timestamp
    const result = await db.update(tasksTable)
      .set({
        status: 'completed',
        updated_at: new Date()
      })
      .where(eq(tasksTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Task completion failed:', error);
    throw error;
  }
}
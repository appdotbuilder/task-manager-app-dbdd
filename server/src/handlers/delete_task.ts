import { db } from '../db';
import { tasksTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export const deleteTask = async (taskId: number, userId: number, userRole: string): Promise<{ success: boolean }> => {
  try {
    // Validate that only admins can delete tasks
    if (userRole !== 'admin') {
      throw new Error('Only admins can delete tasks');
    }

    // First check if the task exists
    const existingTask = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .execute();

    if (existingTask.length === 0) {
      throw new Error('Task not found');
    }

    // Delete the task
    const result = await db.delete(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Task deletion failed:', error);
    throw error;
  }
};
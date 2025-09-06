import { db } from '../db';
import { tasksTable } from '../db/schema';
import { type UpdateTaskInput, type Task } from '../schema';
import { eq } from 'drizzle-orm';

export async function updateTask(input: UpdateTaskInput, userId: number, userRole: string): Promise<Task> {
  try {
    // Only admins can update tasks
    if (userRole !== 'admin') {
      throw new Error('Only admins can update tasks');
    }

    // Check if task exists
    const existingTask = await db.select()
      .from(tasksTable)
      .where(eq(tasksTable.id, input.id))
      .execute();

    if (existingTask.length === 0) {
      throw new Error('Task not found');
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.title !== undefined) {
      updateData.title = input.title;
    }

    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    if (input.due_date !== undefined) {
      updateData.due_date = input.due_date;
    }

    if (input.status !== undefined) {
      updateData.status = input.status;
    }

    if (input.assigned_user_id !== undefined) {
      updateData.assigned_user_id = input.assigned_user_id;
    }

    // Update the task
    const result = await db.update(tasksTable)
      .set(updateData)
      .where(eq(tasksTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Task update failed:', error);
    throw error;
  }
}
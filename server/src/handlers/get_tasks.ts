import { db } from '../db';
import { tasksTable } from '../db/schema';
import { type TaskView } from '../schema';
import { eq } from 'drizzle-orm';

export async function getTasks(userId: number, userRole: string): Promise<TaskView[]> {
  try {
    // Regular users can only see tasks assigned to them
    const results = userRole === 'admin'
      ? await db.select().from(tasksTable).execute()
      : await db.select().from(tasksTable).where(eq(tasksTable.assigned_user_id, userId)).execute();

    // Convert results to TaskView format
    return results.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      due_date: task.due_date,
      status: task.status,
      assigned_user_id: task.assigned_user_id,
      created_at: task.created_at,
      updated_at: task.updated_at
    }));
  } catch (error) {
    console.error('Failed to get tasks:', error);
    throw error;
  }
}
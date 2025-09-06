import { db } from '../db';
import { tasksTable, usersTable } from '../db/schema';
import { type CreateTaskInput, type Task } from '../schema';
import { eq } from 'drizzle-orm';

export async function createTask(input: CreateTaskInput, creatorId: number, creatorRole: string): Promise<Task> {
  try {
    // Only admins can create tasks
    if (creatorRole !== 'admin') {
      throw new Error('Only admins can create tasks');
    }

    // Validate that assigned user exists if provided
    if (input.assigned_user_id) {
      const assignedUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, input.assigned_user_id))
        .execute();
      
      if (assignedUser.length === 0) {
        throw new Error('Assigned user does not exist');
      }
    }

    // Validate that creator exists
    const creator = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, creatorId))
      .execute();
    
    if (creator.length === 0) {
      throw new Error('Creator user does not exist');
    }

    // Insert task record
    const result = await db.insert(tasksTable)
      .values({
        title: input.title,
        description: input.description,
        due_date: input.due_date,
        status: input.status ?? 'pending',
        assigned_user_id: input.assigned_user_id ?? null,
        created_by: creatorId
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Task creation failed:', error);
    throw error;
  }
}
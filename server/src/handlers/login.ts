import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput, type AuthContext } from '../schema';
import { eq } from 'drizzle-orm';

export const login = async (input: LoginInput): Promise<AuthContext> => {
  try {
    // Find user by username
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.username, input.username))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = users[0];

    // In a real application, you would hash the input password and compare
    // For this implementation, we'll do a simple string comparison
    // Note: In production, use bcrypt or similar for password hashing
    if (user.password_hash !== input.password) {
      throw new Error('Invalid credentials');
    }

    // Return authentication context
    return {
      userId: user.id,
      role: user.role
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
};
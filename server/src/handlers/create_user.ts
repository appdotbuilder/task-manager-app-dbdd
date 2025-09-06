import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type User } from '../schema';

export async function createUser(input: CreateUserInput, creatorRole: string): Promise<User> {
  // Validate that only admins can create users
  if (creatorRole !== 'admin') {
    throw new Error('Only admins can create users');
  }

  try {
    // Hash the password using Bun's built-in password hashing
    const passwordHash = await Bun.password.hash(input.password);

    // Insert the new user into the database
    const result = await db.insert(usersTable)
      .values({
        username: input.username,
        email: input.email,
        password_hash: passwordHash,
        role: input.role
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
}
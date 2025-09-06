import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

const testInput: CreateUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'testpassword123',
  role: 'user'
};

const adminInput: CreateUserInput = {
  username: 'adminuser',
  email: 'admin@example.com',
  password: 'adminpassword123',
  role: 'admin'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user when creator is admin', async () => {
    const result = await createUser(testInput, 'admin');

    // Verify the returned user object
    expect(result.username).toEqual('testuser');
    expect(result.email).toEqual('test@example.com');
    expect(result.role).toEqual('user');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual('testpassword123'); // Should be hashed
  });

  it('should save user to database with hashed password', async () => {
    const result = await createUser(testInput, 'admin');

    // Query the database to verify the user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    const savedUser = users[0];
    
    expect(savedUser.username).toEqual('testuser');
    expect(savedUser.email).toEqual('test@example.com');
    expect(savedUser.role).toEqual('user');
    expect(savedUser.created_at).toBeInstanceOf(Date);
    
    // Verify password was hashed and can be verified
    expect(savedUser.password_hash).toBeDefined();
    expect(savedUser.password_hash).not.toEqual('testpassword123');
    
    const passwordVerified = await Bun.password.verify('testpassword123', savedUser.password_hash);
    expect(passwordVerified).toBe(true);
  });

  it('should create admin user when creator is admin', async () => {
    const result = await createUser(adminInput, 'admin');

    expect(result.username).toEqual('adminuser');
    expect(result.email).toEqual('admin@example.com');
    expect(result.role).toEqual('admin');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should throw error when creator is not admin', async () => {
    await expect(createUser(testInput, 'user')).rejects.toThrow(/only admins can create users/i);
  });

  it('should handle duplicate username error', async () => {
    // Create first user
    await createUser(testInput, 'admin');

    // Try to create another user with same username
    const duplicateInput: CreateUserInput = {
      username: 'testuser', // Same username
      email: 'different@example.com',
      password: 'password123',
      role: 'user'
    };

    await expect(createUser(duplicateInput, 'admin')).rejects.toThrow();
  });

  it('should handle duplicate email error', async () => {
    // Create first user
    await createUser(testInput, 'admin');

    // Try to create another user with same email
    const duplicateInput: CreateUserInput = {
      username: 'differentuser',
      email: 'test@example.com', // Same email
      password: 'password123',
      role: 'user'
    };

    await expect(createUser(duplicateInput, 'admin')).rejects.toThrow();
  });

  it('should handle various role values correctly', async () => {
    const userResult = await createUser({
      ...testInput,
      username: 'regular_user',
      email: 'regular@example.com',
      role: 'user'
    }, 'admin');

    const adminResult = await createUser({
      ...testInput,
      username: 'admin_user',
      email: 'admin_user@example.com',
      role: 'admin'
    }, 'admin');

    expect(userResult.role).toEqual('user');
    expect(adminResult.role).toEqual('admin');
  });
});
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { login } from '../handlers/login';

// Test user data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password_hash: 'testpassword123', // In production, this would be a hashed password
  role: 'user' as const
};

const adminUser = {
  username: 'admin',
  email: 'admin@example.com',
  password_hash: 'adminpassword456',
  role: 'admin' as const
};

describe('login', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should authenticate valid user credentials', async () => {
    // Create test user
    const insertResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const loginInput: LoginInput = {
      username: 'testuser',
      password: 'testpassword123'
    };

    const result = await login(loginInput);

    expect(result.userId).toEqual(insertResult[0].id);
    expect(result.role).toEqual('user');
  });

  it('should authenticate admin user credentials', async () => {
    // Create admin user
    const insertResult = await db.insert(usersTable)
      .values(adminUser)
      .returning()
      .execute();

    const loginInput: LoginInput = {
      username: 'admin',
      password: 'adminpassword456'
    };

    const result = await login(loginInput);

    expect(result.userId).toEqual(insertResult[0].id);
    expect(result.role).toEqual('admin');
  });

  it('should reject invalid username', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const loginInput: LoginInput = {
      username: 'nonexistentuser',
      password: 'testpassword123'
    };

    await expect(login(loginInput)).rejects.toThrow(/invalid credentials/i);
  });

  it('should reject invalid password', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const loginInput: LoginInput = {
      username: 'testuser',
      password: 'wrongpassword'
    };

    await expect(login(loginInput)).rejects.toThrow(/invalid credentials/i);
  });

  it('should reject empty username', async () => {
    const loginInput: LoginInput = {
      username: '',
      password: 'testpassword123'
    };

    await expect(login(loginInput)).rejects.toThrow(/invalid credentials/i);
  });

  it('should handle case-sensitive usernames', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const loginInput: LoginInput = {
      username: 'TESTUSER', // Different case
      password: 'testpassword123'
    };

    await expect(login(loginInput)).rejects.toThrow(/invalid credentials/i);
  });

  it('should return correct user data for multiple users', async () => {
    // Create multiple test users
    const user1Result = await db.insert(usersTable)
      .values({
        username: 'user1',
        email: 'user1@example.com',
        password_hash: 'password1',
        role: 'user' as const
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        username: 'user2',
        email: 'user2@example.com',
        password_hash: 'password2',
        role: 'admin' as const
      })
      .returning()
      .execute();

    // Test first user login
    const login1: LoginInput = {
      username: 'user1',
      password: 'password1'
    };

    const result1 = await login(login1);
    expect(result1.userId).toEqual(user1Result[0].id);
    expect(result1.role).toEqual('user');

    // Test second user login
    const login2: LoginInput = {
      username: 'user2',
      password: 'password2'
    };

    const result2 = await login(login2);
    expect(result2.userId).toEqual(user2Result[0].id);
    expect(result2.role).toEqual('admin');
  });
});
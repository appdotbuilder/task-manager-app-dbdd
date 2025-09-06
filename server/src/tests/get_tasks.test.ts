import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, tasksTable } from '../db/schema';
import { getTasks } from '../handlers/get_tasks';

// Test data for users
const adminUser = {
  username: 'admin_user',
  email: 'admin@test.com',
  password_hash: 'hashedpassword123',
  role: 'admin' as const
};

const regularUser = {
  username: 'regular_user',
  email: 'user@test.com',
  password_hash: 'hashedpassword456',
  role: 'user' as const
};

const anotherUser = {
  username: 'another_user',
  email: 'another@test.com',
  password_hash: 'hashedpassword789',
  role: 'user' as const
};

describe('getTasks', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no tasks exist', async () => {
    // Create users first
    const [admin] = await db.insert(usersTable)
      .values(adminUser)
      .returning()
      .execute();

    const result = await getTasks(admin.id, 'admin');

    expect(result).toEqual([]);
  });

  it('should return all tasks for admin users', async () => {
    // Create users
    const [admin, user1, user2] = await db.insert(usersTable)
      .values([adminUser, regularUser, anotherUser])
      .returning()
      .execute();

    // Create test tasks
    const testTasks = [
      {
        title: 'Admin Task 1',
        description: 'First admin task',
        due_date: new Date('2024-12-31'),
        status: 'pending' as const,
        assigned_user_id: user1.id,
        created_by: admin.id
      },
      {
        title: 'Admin Task 2',
        description: 'Second admin task',
        due_date: new Date('2024-11-30'),
        status: 'in-progress' as const,
        assigned_user_id: user2.id,
        created_by: admin.id
      },
      {
        title: 'Unassigned Task',
        description: 'Task with no assignee',
        due_date: new Date('2024-10-15'),
        status: 'completed' as const,
        assigned_user_id: null,
        created_by: user1.id
      }
    ];

    await db.insert(tasksTable)
      .values(testTasks)
      .execute();

    const result = await getTasks(admin.id, 'admin');

    expect(result).toHaveLength(3);
    expect(result[0].title).toEqual('Admin Task 1');
    expect(result[0].status).toEqual('pending');
    expect(result[0].assigned_user_id).toEqual(user1.id);
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);

    expect(result[1].title).toEqual('Admin Task 2');
    expect(result[1].status).toEqual('in-progress');
    expect(result[1].assigned_user_id).toEqual(user2.id);

    expect(result[2].title).toEqual('Unassigned Task');
    expect(result[2].status).toEqual('completed');
    expect(result[2].assigned_user_id).toBeNull();
  });

  it('should return only assigned tasks for regular users', async () => {
    // Create users
    const [admin, user1, user2] = await db.insert(usersTable)
      .values([adminUser, regularUser, anotherUser])
      .returning()
      .execute();

    // Create test tasks
    const testTasks = [
      {
        title: 'User1 Task 1',
        description: 'First task for user1',
        due_date: new Date('2024-12-31'),
        status: 'pending' as const,
        assigned_user_id: user1.id,
        created_by: admin.id
      },
      {
        title: 'User1 Task 2',
        description: 'Second task for user1',
        due_date: new Date('2024-11-30'),
        status: 'in-progress' as const,
        assigned_user_id: user1.id,
        created_by: admin.id
      },
      {
        title: 'User2 Task',
        description: 'Task for user2',
        due_date: new Date('2024-10-15'),
        status: 'completed' as const,
        assigned_user_id: user2.id,
        created_by: admin.id
      },
      {
        title: 'Unassigned Task',
        description: 'Task with no assignee',
        due_date: new Date('2024-09-20'),
        status: 'pending' as const,
        assigned_user_id: null,
        created_by: admin.id
      }
    ];

    await db.insert(tasksTable)
      .values(testTasks)
      .execute();

    // Test regular user - should only see their assigned tasks
    const result = await getTasks(user1.id, 'user');

    expect(result).toHaveLength(2);
    expect(result[0].title).toEqual('User1 Task 1');
    expect(result[0].assigned_user_id).toEqual(user1.id);
    expect(result[1].title).toEqual('User1 Task 2');
    expect(result[1].assigned_user_id).toEqual(user1.id);
  });

  it('should return empty array for regular user with no assigned tasks', async () => {
    // Create users
    const [admin, user1, user2] = await db.insert(usersTable)
      .values([adminUser, regularUser, anotherUser])
      .returning()
      .execute();

    // Create tasks assigned to other users
    const testTasks = [
      {
        title: 'User2 Task',
        description: 'Task for user2',
        due_date: new Date('2024-12-31'),
        status: 'pending' as const,
        assigned_user_id: user2.id,
        created_by: admin.id
      },
      {
        title: 'Unassigned Task',
        description: 'Task with no assignee',
        due_date: new Date('2024-11-30'),
        status: 'pending' as const,
        assigned_user_id: null,
        created_by: admin.id
      }
    ];

    await db.insert(tasksTable)
      .values(testTasks)
      .execute();

    const result = await getTasks(user1.id, 'user');

    expect(result).toEqual([]);
  });

  it('should handle different task statuses correctly', async () => {
    // Create users
    const [admin, user1] = await db.insert(usersTable)
      .values([adminUser, regularUser])
      .returning()
      .execute();

    // Create tasks with different statuses
    const testTasks = [
      {
        title: 'Pending Task',
        description: 'Task in pending status',
        due_date: new Date('2024-12-31'),
        status: 'pending' as const,
        assigned_user_id: user1.id,
        created_by: admin.id
      },
      {
        title: 'In Progress Task',
        description: 'Task in progress',
        due_date: new Date('2024-11-30'),
        status: 'in-progress' as const,
        assigned_user_id: user1.id,
        created_by: admin.id
      },
      {
        title: 'Completed Task',
        description: 'Task completed',
        due_date: new Date('2024-10-15'),
        status: 'completed' as const,
        assigned_user_id: user1.id,
        created_by: admin.id
      }
    ];

    await db.insert(tasksTable)
      .values(testTasks)
      .execute();

    const result = await getTasks(user1.id, 'user');

    expect(result).toHaveLength(3);
    
    const statuses = result.map(task => task.status);
    expect(statuses).toContain('pending');
    expect(statuses).toContain('in-progress');
    expect(statuses).toContain('completed');
  });

  it('should preserve all TaskView fields in response', async () => {
    // Create users
    const [admin, user1] = await db.insert(usersTable)
      .values([adminUser, regularUser])
      .returning()
      .execute();

    // Create a task
    const testTask = {
      title: 'Complete Task Data',
      description: 'Task to verify all fields are returned',
      due_date: new Date('2024-12-31T10:00:00Z'),
      status: 'in-progress' as const,
      assigned_user_id: user1.id,
      created_by: admin.id
    };

    await db.insert(tasksTable)
      .values(testTask)
      .execute();

    const result = await getTasks(user1.id, 'user');

    expect(result).toHaveLength(1);
    
    const task = result[0];
    expect(task.id).toBeDefined();
    expect(typeof task.id).toBe('number');
    expect(task.title).toEqual('Complete Task Data');
    expect(task.description).toEqual('Task to verify all fields are returned');
    expect(task.due_date).toBeInstanceOf(Date);
    expect(task.status).toEqual('in-progress');
    expect(task.assigned_user_id).toEqual(user1.id);
    expect(task.created_at).toBeInstanceOf(Date);
    expect(task.updated_at).toBeInstanceOf(Date);
  });
});
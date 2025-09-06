import { serial, text, pgTable, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'user']);
export const taskStatusEnum = pgEnum('task_status', ['pending', 'in-progress', 'completed']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Tasks table
export const tasksTable = pgTable('tasks', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  due_date: timestamp('due_date').notNull(),
  status: taskStatusEnum('status').notNull().default('pending'),
  assigned_user_id: integer('assigned_user_id'), // Nullable - tasks can be unassigned
  created_by: integer('created_by').notNull(), // References users.id - who created the task
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  assignedTasks: many(tasksTable, { relationName: 'assigned_tasks' }),
  createdTasks: many(tasksTable, { relationName: 'created_tasks' }),
}));

export const tasksRelations = relations(tasksTable, ({ one }) => ({
  assignedUser: one(usersTable, {
    fields: [tasksTable.assigned_user_id],
    references: [usersTable.id],
    relationName: 'assigned_tasks'
  }),
  createdBy: one(usersTable, {
    fields: [tasksTable.created_by],
    references: [usersTable.id],
    relationName: 'created_tasks'
  }),
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type Task = typeof tasksTable.$inferSelect;
export type NewTask = typeof tasksTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = { 
  users: usersTable, 
  tasks: tasksTable 
};

export const relations_export = {
  usersRelations,
  tasksRelations
};
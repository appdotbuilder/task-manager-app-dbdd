import { z } from 'zod';

// User role enum
export const userRoleSchema = z.enum(['admin', 'user']);
export type UserRole = z.infer<typeof userRoleSchema>;

// Task status enum
export const taskStatusSchema = z.enum(['pending', 'in-progress', 'completed']);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  password_hash: z.string(),
  role: userRoleSchema,
  created_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Task schema
export const taskSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  due_date: z.coerce.date(),
  status: taskStatusSchema,
  assigned_user_id: z.number().nullable(),
  created_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Task = z.infer<typeof taskSchema>;

// Input schema for user authentication
export const loginInputSchema = z.object({
  username: z.string(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Input schema for creating users (admin only)
export const createUserInputSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  role: userRoleSchema
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

// Input schema for creating tasks
export const createTaskInputSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string(),
  due_date: z.coerce.date(),
  status: taskStatusSchema.default('pending'),
  assigned_user_id: z.number().nullable().optional()
});

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

// Input schema for updating tasks
export const updateTaskInputSchema = z.object({
  id: z.number(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  due_date: z.coerce.date().optional(),
  status: taskStatusSchema.optional(),
  assigned_user_id: z.number().nullable().optional()
});

export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

// Input schema for marking task as complete (user action)
export const completeTaskInputSchema = z.object({
  id: z.number()
});

export type CompleteTaskInput = z.infer<typeof completeTaskInputSchema>;

// Auth context schema
export const authContextSchema = z.object({
  userId: z.number(),
  role: userRoleSchema
});

export type AuthContext = z.infer<typeof authContextSchema>;

// Task view schema (what users see when viewing tasks)
export const taskViewSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  due_date: z.coerce.date(),
  status: taskStatusSchema,
  assigned_user_id: z.number().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type TaskView = z.infer<typeof taskViewSchema>;
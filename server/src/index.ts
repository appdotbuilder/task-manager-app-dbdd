import { initTRPC, TRPCError } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import { 
  loginInputSchema,
  createUserInputSchema,
  createTaskInputSchema,
  updateTaskInputSchema,
  completeTaskInputSchema,
  type AuthContext
} from './schema';

// Import handlers
import { login } from './handlers/login';
import { createUser } from './handlers/create_user';
import { createTask } from './handlers/create_task';
import { getTasks } from './handlers/get_tasks';
import { updateTask } from './handlers/update_task';
import { deleteTask } from './handlers/delete_task';
import { completeTask } from './handlers/complete_task';

// Create context type
interface Context {
  auth?: AuthContext;
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

// Protected procedure that requires authentication
const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
  }
  return next({
    ctx: {
      ...ctx,
      auth: ctx.auth,
    },
  });
});

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.auth.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin privileges required'
    });
  }
  return next();
});

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication
  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => login(input)),

  // User management (admin only)
  createUser: adminProcedure
    .input(createUserInputSchema)
    .mutation(({ input, ctx }) => createUser(input, ctx.auth.role)),

  // Task management
  createTask: adminProcedure
    .input(createTaskInputSchema)
    .mutation(({ input, ctx }) => createTask(input, ctx.auth.userId, ctx.auth.role)),

  getTasks: protectedProcedure
    .query(({ ctx }) => getTasks(ctx.auth.userId, ctx.auth.role)),

  updateTask: adminProcedure
    .input(updateTaskInputSchema)
    .mutation(({ input, ctx }) => updateTask(input, ctx.auth.userId, ctx.auth.role)),

  deleteTask: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input, ctx }) => deleteTask(input.id, ctx.auth.userId, ctx.auth.role)),

  // Task completion (available to all authenticated users)
  completeTask: protectedProcedure
    .input(completeTaskInputSchema)
    .mutation(({ input, ctx }) => completeTask(input, ctx.auth.userId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext({ req }): Context {
      // In a real implementation, you would extract auth info from headers/cookies/JWT
      // For now, returning empty context - auth would be set after login
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();
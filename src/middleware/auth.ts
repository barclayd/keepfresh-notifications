import { createMiddleware } from 'hono/factory';
import type { HonoEnvironment } from '@/types/hono';

export const authMiddleware = createMiddleware<HonoEnvironment>(
  async (_c, next) => {
    // const authStartTime = performance.now();
    // const requestId = crypto.randomUUID();

    await next();
  },
);

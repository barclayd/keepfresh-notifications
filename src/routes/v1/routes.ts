import { createRoute } from '@hono/zod-openapi';
import * as z from 'zod';
import { supabaseMiddleware } from '@/middleware/db';

export const routes = {
  notifications: {
    post: createRoute({
      method: 'get',
      path: '/inventory',
      middleware: [supabaseMiddleware],
      responses: {
        204: {
          description: 'Successfully updated inventory item',
        },
        400: {
          content: {
            'application/json': {
              schema: z.object({
                error: z.string(),
              }),
            },
          },
          description: 'Error occurred when processing payload',
        },
        401: {
          content: {
            'application/json': {
              schema: z.object({
                error: z.string(),
              }),
            },
          },
          description: 'Authorization error response from Notifications API',
        },
      },
      security: [
        {
          Bearer: [],
        },
      ],
    }),
  },
};

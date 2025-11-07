import { createRoute } from '@hono/zod-openapi';
import * as z from 'zod';
import { authMiddleware } from '@/middleware/auth';
import { supabaseMiddleware } from '@/middleware/db';

export const routes = {
  devices: {
    post: createRoute({
      method: 'post',
      path: '/devices',
      request: {
        body: {
          content: {
            'application/json': {
              schema: z.object({
                deviceToken: z.string(),
                platform: z.enum(['ios']),
                environment: z.enum(['development', 'production']),
                appVersion: z.string(),
              }),
            },
          },
        },
      },
      middleware: [supabaseMiddleware, authMiddleware],
      responses: {
        204: {
          description: 'Successfully updated devices for user',
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
  notifications: {
    post: createRoute({
      method: 'post',
      path: '/notifications',
      middleware: [supabaseMiddleware, authMiddleware],
      responses: {
        204: {
          description: 'Successfully updated devices for user',
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

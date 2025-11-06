import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { routes } from '@/routes/v1/routes';

import type { HonoEnvironment } from '@/types/hono';

export const createV1Routes = () => {
  const app = new OpenAPIHono<HonoEnvironment>();

  app.openapi(routes.devices.post, async (c) => {
    const { deviceToken, platform, appVersion } = c.req.valid('json');

    const userId = c.get('userId');

    const { error } = await c.get('supabase').from('device_tokens').upsert(
      {
        user_id: userId,
        token: deviceToken,
        platform,
        app_version: appVersion,
        last_used_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,token',
      },
    );

    if (error) {
      return c.json(
        {
          error: `Error occurred registering device for user. Error=${JSON.stringify(error)}`,
        },
        400,
      );
    }

    return c.body(null, 204);
  });

  app.openAPIRegistry.registerComponent('securitySchemes', 'Bearer', {
    type: 'http',
    scheme: 'bearer',
    description: `"Authorization": "Bearer token"`,
  });

  app.doc31('/doc', {
    openapi: '3.1.0',
    info: {
      version: '1.0.0',
      title: 'KeepFresh API',
      description: 'KeepFresh API',
    },
    servers: [
      {
        url: '/v1',
        description: 'Version 1 API',
      },
      {
        url: 'https://api.keepfre.sh/v1',
        description: 'Production V1 API',
      },
      {
        url: 'https://api.keepfre.sh/v1',
        description: 'Staging V1 API',
      },
    ],
  });

  app.get(
    '/scalar',
    Scalar({
      url: 'doc',
      theme: 'bluePlanet',
      favicon: 'https://keepfre.sh/favicon.ico',
      pageTitle: 'KeepFresh API',
    }),
  );

  return app;
};

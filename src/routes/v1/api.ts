import { ApnsClient, Notification } from '@fivesheepco/cloudflare-apns2';
import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { env } from '@/config/env';
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

  app.openapi(routes.notifications.post, async (c) => {
    const userId = c.get('userId');

    const { data, error } = await c
      .get('supabase')
      .from('device_tokens')
      .select('token')
      .eq('user_id', userId);

    if (error) {
      return c.json(
        {
          error: `Error occurred registering device for user. Error=${JSON.stringify(error)}`,
        },
        400,
      );
    }

    const tokens = data?.map(({ token }) => token);

    const deviceToken = tokens[0];

    if (!data || !deviceToken) {
      return c.json(
        {
          error: `No device tokens found for user`,
        },
        400,
      );
    }

    const apnsClient = new ApnsClient({
      team: env.APNS_TEAM_ID,
      keyId: env.APNS_KEY_ID,
      signingKey: env.APNS_SIGNING_KEY,
      defaultTopic: env.APNS_BUNDLE_ID,
      host: 'api.sandbox.push.apple.com',
    });

    const title = 'Test';
    const body = 'Notification';

    const items = [{ id: 1 }];

    const notification = new Notification(deviceToken, {
      alert: {
        title,
        body,
      },
      badge: items.length,
      sound: 'default',
      mutableContent: true,
      data: {
        type: 'expiringFood',
        inventoryItemId: 190,
        genmojiId: 'milk',
      },
    });

    await apnsClient.send(notification);

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

import type {
  ExecutionContext,
  ScheduledEvent,
} from '@cloudflare/workers-types';
import { ApnsClient, Notification } from '@fivesheepco/cloudflare-apns2';
import { type Env, Hono } from 'hono';
import { env } from '@/config/env';
import { createV1Routes } from '@/routes/v1/api';
import type { HonoEnvironment } from '@/types/hono';

const app = new Hono<HonoEnvironment>();

const v1App = createV1Routes();

const sendNotification = async () => {
  const apnsClient = new ApnsClient({
    team: env.APNS_TEAM_ID,
    keyId: env.APNS_KEY_ID,
    signingKey: env.APNS_SIGNING_KEY,
    defaultTopic: env.APNS_BUNDLE_ID,
    host: 'api.sandbox.push.apple.com',
  });

  // get userDevice token

  const deviceToken = '';
  const title = '';
  const body = '';

  const items = [{ id: 1 }];

  const notification = new Notification(deviceToken, {
    alert: {
      title,
      body,
    },
    badge: items.length,
    sound: 'default',
    data: {
      type: 'expiring_food',
      foodIds: items.map((item) => item.id),
    },
  });

  await apnsClient.send(notification);
};

app.route('/v1', v1App);

app.get('/health', (c) =>
  c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    versions: ['v1', 'v2'],
  }),
);

export default {
  fetch: app.fetch,
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    console.log('🔔 Running scheduled notification job');
  },
};

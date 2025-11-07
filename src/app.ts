import type {
  ExecutionContext,
  ScheduledEvent,
} from '@cloudflare/workers-types';
import { ApnsClient, Notification } from '@fivesheepco/cloudflare-apns2';
import { createClient } from '@supabase/supabase-js';
import { type Env, Hono } from 'hono';
import { env } from '@/config/env';
import { createV1Routes } from '@/routes/v1/api';
import type { Database } from '@/types/database';
import type { HonoEnvironment } from '@/types/hono';
import { buildNotificationBody, groupItemsByUser } from '@/utils/notification';
import { sendWithRetry } from '@/utils/retry';

const app = new Hono<HonoEnvironment>();

const v1App = createV1Routes();

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
    _event: ScheduledEvent,
    _env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    const supabase = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE,
    );

    const twoDaysFromNow = new Date();

    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    const targetDate = twoDaysFromNow.toISOString().split('T')[0];

    if (!targetDate) {
      return;
    }

    const { data, error } = await supabase
      .from('inventory_items')
      .select(`
    id,
    storage_location,
    status,
    expiry_type,
    product:products!inner (
      name,
      brand,
      amount,
      unit,
      category:categories!inner (
        icon
      )
    ),
    user:users!inner (
      id,
      device_tokens!inner (
        token,
        environment
      )
    )
  `)
      .eq('expiry_date', targetDate)
      .eq('user.device_tokens.environment', env.APNS_ENVIRONMENT);

    if (error) {
      console.error(
        `Error retrieving inventory items. Error: ${JSON.stringify(error)}`,
      );
      return;
    }

    if (!data) {
      console.log('No inventory items not found matching expiry date');
      return;
    }

    const inventoryItemsWithUser = data?.map((item) => ({
      id: item.id,
      storageLocation: item.storage_location,
      expiryType: item.expiry_type,
      status: item.status,
      product: {
        name: item.product.name,
        brand: item.product.brand,
        amount: item.product.amount,
        unit: item.product.unit,
        category: {
          icon: item.product.category.icon,
        },
      },
      userId: item.user.id,
      deviceTokens: item.user.device_tokens.map(({ token }) => token),
    }));

    if (!inventoryItemsWithUser || inventoryItemsWithUser.length === 0) {
      console.log('No items to notify about');
      return;
    }

    const userNotificationGroups = groupItemsByUser(inventoryItemsWithUser);

    const apnsHost =
      env.APNS_ENVIRONMENT === 'production'
        ? 'api.push.apple.com'
        : 'api.sandbox.push.apple.com';

    const apnsClient = new ApnsClient({
      team: env.APNS_TEAM_ID,
      keyId: env.APNS_KEY_ID,
      signingKey: env.APNS_SIGNING_KEY,
      defaultTopic: env.APNS_BUNDLE_ID,
      host: apnsHost,
    });

    const allNotifications = userNotificationGroups.flatMap((userGroup) => {
      const body = buildNotificationBody(userGroup.items, 2);

      if (!body) {
        return [];
      }

      const title =
        userGroup.items.length === 1
          ? `⚠️ 1 product expiring in 2 days`
          : `⚠️ ${userGroup.items.length} products expiring in 2 days`;

      const firstItem = inventoryItemsWithUser.find(
        (item) => item.id === userGroup.items[0]?.id,
      );

      console.log('firstItemId: ', firstItem?.id);
      console.log(
        'itemIds: ',
        userGroup.items.map((item) => item.id).join(', '),
      );

      return userGroup.deviceTokens.map((deviceToken) =>
        sendWithRetry(async () => {
          await apnsClient.send(
            new Notification(deviceToken, {
              alert: { title, body },
              badge: userGroup.items.length,
              sound: 'default',
              mutableContent: true,
              data: {
                type: 'expiringFood',
                inventoryItemId: firstItem?.id,
                genmojiId: firstItem?.product.category.icon,
                itemCount: userGroup.items.length,
              },
            }),
          );
        }),
      );
    });

    const results = await Promise.allSettled(allNotifications);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    console.log(`Sent ${successes.length} notifications`);

    if (failures.length > 0) {
      console.error(`Failed ${failures.length} notifications after retries`);
      failures.forEach((failure, i) => {
        if (failure.status === 'rejected') {
          console.error(`Failed notification ${i}:`, failure.reason);
        }
      });
    }
  },
};

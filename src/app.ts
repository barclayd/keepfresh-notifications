import type {
  ExecutionContext,
  ScheduledEvent,
} from '@cloudflare/workers-types';
import { ApnsClient, Notification } from '@fivesheepco/cloudflare-apns2';
import { createClient } from '@supabase/supabase-js';
import { type Env, Hono } from 'hono';
import { env } from '@/config/env';
import { createV1Routes } from '@/routes/v1/api';
import { InventoryItemNotificationsSchema } from '@/schemas/inventory-item';
import type { Database } from '@/types/database';
import type { HonoEnvironment } from '@/types/hono';
import { getRelativeExpiry } from '@/utils/date';
import { truncate } from '@/utils/product';
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
      device_tokens!inner (
        token
      )
    )
  `)
      .eq('expiry_date', targetDate);

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

    const inventoryItemNotifications = InventoryItemNotificationsSchema.parse(
      data?.map((item) => ({
        id: item.id,
        storageLocation: item.storage_location,
        expiryType: item.expiry_type,
        status: item.status,
        product: {
          ...item.product,
          category: {
            ...item.product.category,
          },
        },
        deviceTokens: item.user.device_tokens.map(({ token }) => token),
      })),
    );

    const apnsClient = new ApnsClient({
      team: env.APNS_TEAM_ID,
      keyId: env.APNS_KEY_ID,
      signingKey: env.APNS_SIGNING_KEY,
      defaultTopic: env.APNS_BUNDLE_ID,
      host: 'api.sandbox.push.apple.com',
    });

    const allNotifications = inventoryItemNotifications.flatMap(
      (inventoryItemNotification) => {
        const title = `⚠️ Products expiring in 2 days`;
        const body = `${truncate(inventoryItemNotification.product.name)} (${inventoryItemNotification.product.brand}), located in your ${inventoryItemNotification.storageLocation.toLowerCase()} expires ${getRelativeExpiry(2)}`;

        return inventoryItemNotification.deviceTokens.map((deviceToken) =>
          sendWithRetry(async () => {
            await apnsClient.send(
              new Notification(deviceToken, {
                alert: { title, body },
                badge: 1,
                sound: 'default',
                mutableContent: true,
                data: {
                  type: 'expiringFood',
                  inventoryItemId: inventoryItemNotification.id,
                  genmojiId: inventoryItemNotification.product.category.icon,
                },
              }),
            );
          }),
        );
      },
    );

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

import type {
  ExecutionContext,
  ScheduledEvent,
} from '@cloudflare/workers-types';
import { ApnsClient, Notification } from '@fivesheepco/cloudflare-apns2';
import { createClient } from '@supabase/supabase-js';
import { type Env, Hono } from 'hono';
import { env } from '@/config/env';
import { createV1Routes } from '@/routes/v1/api';
import {
  type ActiveInventoryItemStatus,
  ActiveInventoryItemStatuses,
} from '@/types/category';
import type { Database } from '@/types/database';
import type { HonoEnvironment } from '@/types/hono';
import type { StorageLocationDb } from '@/utils/category';
import { getOpenedExpiryDate } from '@/utils/date';
import { getSuggestions } from '@/utils/inventory-item';
import { buildNotificationBody, groupItemsByUser } from '@/utils/notification';
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

const sendExpiryNotifications = async (
  daysOffset: number,
  titleEmoji: string,
  titleText: string,
): Promise<void> => {
  const supabase = createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE,
  );

  const targetDate = new Date();

  targetDate.setDate(targetDate.getDate() + daysOffset);

  const targetDateString = targetDate.toISOString().split('T')[0];

  if (!targetDateString) {
    return;
  }

  const { data, error } = await supabase
    .from('inventory_items')
    .select(`
    id,
    storage_location,
    status,
    expiry_type,
    expiry_date,
    product:products!inner (
      name,
      brand,
      amount,
      unit,
      category:categories!inner (
        icon,
        shelf_life_in_pantry_in_days_unopened,
        shelf_life_in_pantry_in_days_opened,
        shelf_life_in_fridge_in_days_unopened,
        shelf_life_in_fridge_in_days_opened,
        shelf_life_in_freezer_in_days_unopened,
        shelf_life_in_freezer_in_days_opened
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
    .eq('expiry_date', targetDateString)
    .eq('user.device_tokens.environment', env.APNS_ENVIRONMENT)
    .in('status', ActiveInventoryItemStatuses);

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

  const inventoryItemsWithUser = data?.map((item) => {
    const shelfLifeMap: Record<
      ActiveInventoryItemStatus,
      Record<StorageLocationDb, number | null>
    > = {
      opened: {
        pantry: item.product.category.shelf_life_in_pantry_in_days_opened,
        fridge: item.product.category.shelf_life_in_fridge_in_days_opened,
        freezer: item.product.category.shelf_life_in_freezer_in_days_opened,
      },
      unopened: {
        pantry: item.product.category.shelf_life_in_pantry_in_days_unopened,
        fridge: item.product.category.shelf_life_in_fridge_in_days_unopened,
        freezer: item.product.category.shelf_life_in_freezer_in_days_unopened,
      },
    };

    const openedExpiryDate =
      item.expiry_date && item.status === 'unopened'
        ? getOpenedExpiryDate({
            expiryDate: new Date(item.expiry_date),
            shelfLifeInDaysOpened: shelfLifeMap.opened[item.storage_location],
            shelfLifeInDaysUnopened:
              shelfLifeMap.unopened[item.storage_location],
          })
        : undefined;

    return {
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
      ...(openedExpiryDate && { openedExpiryDate }),
      suggestions: getSuggestions({
        currentStorageLocation: item.storage_location,
        status: item.status as ActiveInventoryItemStatus,
        shelfLifeMap,
      }),
      deviceTokens: item.user.device_tokens.map(({ token }) => token),
    };
  });

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

  const currentDate = new Date().toISOString().split('T')[0];
  const threadId = `expiring-in-${daysOffset}-days-${currentDate}`;

  const allNotifications = userNotificationGroups.flatMap((userGroup) => {
    return userGroup.items.flatMap((item) => {
      const body = buildNotificationBody([item], daysOffset);

      if (!body) {
        return [];
      }

      const fullItem = inventoryItemsWithUser.find((i) => i.id === item.id);

      const title = `${titleEmoji} ${truncate(fullItem?.product.name ?? '', 12)} ${titleText}`;

      console.log(`openedExpiryDate: ${fullItem?.openedExpiryDate}`);
      console.log(`suggestions: ${fullItem?.suggestions.join(', ')}`);

      return userGroup.deviceTokens.map((deviceToken) =>
        sendWithRetry(async () => {
          await apnsClient.send(
            new Notification(deviceToken, {
              alert: { title, body },
              badge: 1,
              sound: 'default',
              mutableContent: true,
              category: 'INVENTORY_ITEM_EXPIRING',
              threadId,
              data: {
                inventoryItemId: fullItem?.id,
                genmojiId: fullItem?.product.category.icon,
                status: fullItem?.status,
                openedExpiryDate: fullItem?.openedExpiryDate,
                suggestions: fullItem?.suggestions ?? [],
              },
            }),
          );
        }),
      );
    });
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
};

export default {
  fetch: app.fetch,
  async scheduled(
    event: ScheduledEvent,
    _env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    switch (event.cron) {
      case '0 7 * * *':
        await sendExpiryNotifications(0, '🚨', 'expires today');
        break;
      case '6 0 * * *':
        await sendExpiryNotifications(2, '⚠️', 'expires in 2 days');
        break;
      default:
        console.error('Unknown cron trigger:', event.cron);
    }
  },
};

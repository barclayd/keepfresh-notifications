import { getRelativeExpiry } from '@/utils/date';
import { truncate } from './product';

export type InventoryItemForNotification = {
  id: number;
  storageLocation: string;
  product: {
    name: string;
    brand: string;
  };
};

export type UserNotificationGroup = {
  userId: string;
  deviceTokens: string[];
  items: InventoryItemForNotification[];
};

export const groupItemsByUser = (
  items: Array<{
    id: number;
    storageLocation: string;
    product: {
      name: string;
      brand: string;
    };
    userId: string;
    deviceTokens: string[];
  }>,
): UserNotificationGroup[] => {
  const userMap = new Map<string, UserNotificationGroup>();

  for (const item of items) {
    if (!userMap.has(item.userId)) {
      userMap.set(item.userId, {
        userId: item.userId,
        deviceTokens: [],
        items: [],
      });
    }

    const userGroup = userMap.get(item.userId);

    if (!userGroup) {
      continue;
    }

    userGroup.items.push({
      id: item.id,
      storageLocation: item.storageLocation,
      product: {
        name: item.product.name,
        brand: item.product.brand,
      },
    });

    for (const token of item.deviceTokens) {
      if (!userGroup.deviceTokens.includes(token)) {
        userGroup.deviceTokens.push(token);
      }
    }
  }

  return Array.from(userMap.values());
};

const getLocationSummary = (items: InventoryItemForNotification[]): string => {
  const locationCounts = new Map<string, number>();

  for (const item of items) {
    const location = item.storageLocation.toLowerCase();
    locationCounts.set(location, (locationCounts.get(location) || 0) + 1);
  }

  const locationParts = Array.from(locationCounts.entries()).map(
    ([location, count]) => `${count} in your ${location}`,
  );

  if (locationParts.length === 1 && typeof locationParts[0] === 'string') {
    return locationParts[0];
  }

  if (locationParts.length === 2) {
    return `${locationParts[0]} and ${locationParts[1]}`;
  }

  const lastPart = locationParts.pop();
  return `${locationParts.join(', ')}, and ${lastPart}`;
};

export const buildNotificationBody = (
  items: InventoryItemForNotification[],
  daysUntilExpiry: number,
): string | undefined => {
  const totalCount = items.length;

  if (totalCount === 0) {
    return;
  }

  const firstItem = items[0];

  if (!firstItem) {
    return;
  }

  if (totalCount === 1) {
    return `${firstItem.product.name} (${firstItem.product.brand}), in your ${firstItem.storageLocation.toLowerCase()}, expires ${getRelativeExpiry(daysUntilExpiry)}`;
  }

  const remainingCount = totalCount - 1;
  const itemText = remainingCount === 1 ? 'item' : 'items';
  const locationSummary = getLocationSummary(items);

  return `${truncate(firstItem.product.name)} and ${remainingCount} other ${itemText} (${locationSummary}) expire ${getRelativeExpiry(daysUntilExpiry)}`;
};

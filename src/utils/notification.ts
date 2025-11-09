import { getRelativeExpiry } from '@/utils/date';

export type InventoryItemForNotification = {
  id: number;
  storageLocation: string;
  expiryType: string | null;
  status: string;
  product: {
    name: string;
    brand: string;
    amount: number | null;
    unit: string | null;
    category: {
      icon: string | null;
    };
  };
  openedExpiryDate?: Date;
  suggestions: string[];
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
    expiryType: string | null;
    status: string;
    product: {
      name: string;
      brand: string;
      amount: number | null;
      unit: string | null;
      category: {
        icon: string | null;
      };
    };
    openedExpiryDate?: Date;
    suggestions: string[];
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
      expiryType: item.expiryType,
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
      openedExpiryDate: item.openedExpiryDate,
      suggestions: item.suggestions,
    });

    for (const token of item.deviceTokens) {
      if (!userGroup.deviceTokens.includes(token)) {
        userGroup.deviceTokens.push(token);
      }
    }
  }

  return Array.from(userMap.values());
};

export const buildNotificationBody = (
  item: InventoryItemForNotification,
  daysUntilExpiry: number,
): string => {
  return `${item.product.name} (${item.product.brand}), in your ${item.storageLocation.toLowerCase()}, expires ${getRelativeExpiry(daysUntilExpiry)}`;
};

import * as z from 'zod';
import { InventoryItemStatus } from '@/types/category';
import { Units } from '@/types/inventory-item';
import {
  expiryTypeFieldMapper,
  storageLocationFieldMapper,
} from '@/utils/field-mapper';

export const InventoryItemNotificationSchema = z.object({
  id: z.number(),
  storageLocation: storageLocationFieldMapper.outputSchema,
  expiryType: expiryTypeFieldMapper.outputSchema,
  status: z.enum(InventoryItemStatus),
  product: z.object({
    name: z.string(),
    brand: z.string(),
    amount: z.float32().nullable(),
    unit: z.enum(Units).nullable(),
    category: z.object({
      icon: z.string(),
    }),
  }),
  deviceTokens: z.array(z.coerce.string()),
});

export const InventoryItemNotificationsSchema = z.array(
  InventoryItemNotificationSchema,
);

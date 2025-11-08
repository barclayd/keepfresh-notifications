import type { Database } from '@/types/database';

export type InventoryItemStatus =
  Database['public']['Enums']['grocery_item_status'];

export const ActiveInventoryItemStatuses = [
  'unopened',
  'opened',
] as const satisfies Array<
  Exclude<InventoryItemStatus, 'consumed' | 'discarded'>
>;

export type ActiveInventoryItemStatus =
  (typeof ActiveInventoryItemStatuses)[number];

import type { Database } from '@/types/database';

export type InventoryItemStatus =
  Database['public']['Enums']['grocery_item_status'];

export const InventoryItemStatus: Array<InventoryItemStatus> = [
  'opened',
  'unopened',
  'consumed',
  'discarded',
] as const;

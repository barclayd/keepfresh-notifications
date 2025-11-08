import type { ActiveInventoryItemStatus } from '@/types/category';
import type { StorageLocationDb } from '@/utils/category';

export const getSuggestions = ({
  currentStorageLocation,
  status,
  shelfLifeMap,
}: {
  currentStorageLocation: StorageLocationDb;
  status: ActiveInventoryItemStatus;
  shelfLifeMap: Record<
    ActiveInventoryItemStatus,
    Record<StorageLocationDb, number | null>
  >;
}): Array<StorageLocationDb> => {
  return (Object.keys(shelfLifeMap[status]) as Array<StorageLocationDb>).filter(
    (storageLocation) =>
      shelfLifeMap[status][storageLocation] !== null &&
      storageLocation !== currentStorageLocation,
  );
};

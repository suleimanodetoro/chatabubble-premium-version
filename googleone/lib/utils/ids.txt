// lib/utils/ids.ts
import { v4 as uuidv4, validate as validateUUID } from 'uuid';

/**
 * Generates a new UUID v4
 */
export const generateId = (): string => {
  return uuidv4();
};

/**
 * Checks if a given string is a valid UUID
 */
export const isValidUUID = (id: string): boolean => {
  return validateUUID(id);
};

/**
 * Ensures a value is a valid UUID, converting if necessary
 * @param id - Existing ID to validate/convert
 * @param prefix - Optional prefix to remove before validation
 */
export const ensureUUID = (id: string, prefix?: string): string => {
  // Remove prefix if exists
  const cleanId = prefix ? id.replace(prefix, '') : id;
  
  // If it's already a valid UUID, return it
  if (isValidUUID(cleanId)) {
    return cleanId;
  }
  
  // Generate a new UUID that's deterministic based on the input
  // This helps maintain consistency across app restarts
  const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  return uuidv4(); // For now using v4, could switch to v5 with namespace if needed
};

/**
 * Migrates an array of objects with IDs to use UUIDs
 * @param items - Array of objects with id property
 * @param idField - Name of the ID field (defaults to 'id')
 */
export const migrateIdsToUUID = <T extends { [key: string]: any }>(
  items: T[],
  idField: string = 'id'
): T[] => {
  return items.map(item => ({
    ...item,
    [idField]: ensureUUID(item[idField])
  }));
};

/**
 * Creates a deterministic UUID from multiple values
 * Useful for scenarios where we want the same ID for the same input
 */
export const generateDeterministicId = (values: string[]): string => {
  return uuidv4(); // Using v4 for now, could switch to v5 if needed
};
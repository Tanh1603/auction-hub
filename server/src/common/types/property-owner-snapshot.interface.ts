/**
 * PropertyOwnerSnapshot interface
 * Represents the denormalized property owner data stored as JSON in the Auction model
 *
 * This replaces the previous User relation for the property owner.
 * The data is now stored as a JSON snapshot to avoid foreign key dependencies
 * and preserve data integrity at the time of auction creation.
 */
export interface PropertyOwnerSnapshot {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  identityNumber?: string;
  userType?: string;
  taxId?: string;
  avatarUrl?: string;
}

/**
 * Helper function to safely extract PropertyOwnerSnapshot from the JSON field
 * @param propertyOwner - The JSON value from the Auction.propertyOwner field
 * @returns PropertyOwnerSnapshot or null if invalid
 *
 * NOTE: This function handles backward compatibility with legacy field names:
 * - `name` → `fullName`
 * - `phone` → `phoneNumber`
 * - `id` is optional for legacy data
 */
export function getPropertyOwnerSnapshot(
  propertyOwner: unknown
): PropertyOwnerSnapshot | null {
  if (!propertyOwner || typeof propertyOwner !== 'object') {
    return null;
  }

  const owner = propertyOwner as Record<string, unknown>;

  // Support both old field names (name, phone) and new field names (fullName, phoneNumber)
  const fullName = (owner.fullName ?? owner.name) as string | undefined;
  const email = owner.email as string | undefined;
  const phoneNumber = (owner.phoneNumber ?? owner.phone) as string | undefined;

  // Validate required fields - email and fullName/name must be present
  if (typeof fullName !== 'string' || typeof email !== 'string') {
    return null;
  }

  return {
    // id may be missing in legacy data, generate a placeholder if needed
    id: (owner.id as string) ?? '',
    fullName: fullName,
    email: email,
    phoneNumber: phoneNumber,
    identityNumber: owner.identityNumber as string | undefined,
    userType: owner.userType as string | undefined,
    taxId: owner.taxId as string | undefined,
    avatarUrl: owner.avatarUrl as string | undefined,
  };
}

/**
 * Helper function to get the owner ID from the propertyOwner JSON field
 * @param propertyOwner - The JSON value from the Auction.propertyOwner field
 * @returns The owner ID string or null if invalid
 */
export function getPropertyOwnerId(propertyOwner: unknown): string | null {
  const snapshot = getPropertyOwnerSnapshot(propertyOwner);
  return snapshot?.id ?? null;
}

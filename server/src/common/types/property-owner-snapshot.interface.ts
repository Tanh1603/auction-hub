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
 */
export function getPropertyOwnerSnapshot(
  propertyOwner: unknown
): PropertyOwnerSnapshot | null {
  if (!propertyOwner || typeof propertyOwner !== 'object') {
    return null;
  }

  const owner = propertyOwner as Record<string, unknown>;

  // Validate required fields
  if (
    typeof owner.id !== 'string' ||
    typeof owner.fullName !== 'string' ||
    typeof owner.email !== 'string'
  ) {
    return null;
  }

  return {
    id: owner.id,
    fullName: owner.fullName,
    email: owner.email,
    phoneNumber: owner.phoneNumber as string | undefined,
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

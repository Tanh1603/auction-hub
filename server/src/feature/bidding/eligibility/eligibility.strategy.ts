
import { User } from '@prisma/client';
import { Item } from '@prisma/client';

export interface EligibilityStrategy {
  isEligible(user: User, item: Item): Promise<boolean> | boolean;
}

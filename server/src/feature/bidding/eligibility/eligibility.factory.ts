import { Item } from '@prisma/client';
import { EligibilityStrategy } from './eligibility.strategy';

export class EligibilityStrategyFactory {
  static create(item: Item): EligibilityStrategy {
    switch (item.type) {
      // case 'VEHICLE':
      //   return new VehicleEligibilityStrategy();
      // case 'ARTWORK':
      //   return new ArtworkEligibilityStrategy();
      default:
        // By default, if no specific strategy is found, we can have a default strategy
        // that allows bidding. Or you could throw an error.
        return {
          isEligible: () => true,
        };
    }
  }
}

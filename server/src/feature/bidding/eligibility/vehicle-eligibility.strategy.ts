// server/src/feature/bidding/manual-bid/eligibility/vehicle-eligibility.strategy.ts

import {EligibilityStrategy} from './eligibility.strategy';

export class VehicleEligibilityStrategy implements EligibilityStrategy {
  isPlateEligible(user, bidItem): {
    return user.hasVerifiedLicense && bidItem.requiresLisence;
  }
}

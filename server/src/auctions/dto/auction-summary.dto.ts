import { Decimal } from "../../../generated/runtime/library";

export class AucitonSummaryDto {
  id: string;
  name: string;
  startingPrice: Decimal;
  depositAmountRequired: Decimal;
  auctionStartAt: Date;
}

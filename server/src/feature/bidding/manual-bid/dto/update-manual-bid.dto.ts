import { PartialType } from '@nestjs/mapped-types';
import { CreateManualBidDto } from './create-manual-bid.dto';

export class UpdateManualBidDto extends PartialType(CreateManualBidDto) {}

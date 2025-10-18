
import { IsArray, IsString, IsNotEmpty } from 'class-validator';

export class CreateRegisterToBidDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsArray()
  @IsString({ each: true })
  documents: string[];
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class ResourceDto {
  @ApiProperty({
    type: String,
    required: true,
  })
  @IsNotEmpty()
  publicId: string;

  @ApiProperty({
    type: String,
    required: true,
  })
  @IsNotEmpty()
  url: string;
}

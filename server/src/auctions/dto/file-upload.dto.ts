/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApiProperty } from "@nestjs/swagger";

export class FileUploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    required: false,
    isArray: true,
  })
  images?: any[];

  @ApiProperty({
    type: 'string',
    format: 'binary',
    required: false,
    isArray: true,
  })
  attachments?: any[];
}

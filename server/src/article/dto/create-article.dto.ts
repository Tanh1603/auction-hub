import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsString, ValidateNested } from 'class-validator';
import { ArticleType, Prisma } from '../../../generated';
import { ResourceDto } from './resource.dto';

export class CreateArticleDto implements Prisma.ArticleCreateInput {
  @IsString()
  @ApiProperty({
    type: String,
    required: true,
  })
  title: string;

  @IsString()
  @ApiProperty({
    type: String,
    required: true,
  })
  author: string;

  @IsString()
  @ApiProperty({
    type: String,
    required: true,
  })
  content: string;

  @ValidateNested()
  @Type(() => ResourceDto)
  @ApiProperty({
    type: ResourceDto,
    required: true,
  })
  image: Prisma.InputJsonValue;

  @IsEnum(ArticleType)
  @ApiProperty({
    enum: ArticleType,
    required: true,
  })
  type: ArticleType;
}

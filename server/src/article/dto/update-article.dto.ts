import { PartialType } from '@nestjs/mapped-types';
import { CreateArticleDto } from './create-article.dto';
import { Prisma } from '../../../generated';
import { IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateArticleDto
  extends PartialType(CreateArticleDto)
  implements Prisma.ArticleUpdateInput {}

export class UpdateArticleRelationsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ApiProperty({
    type: [String],
    required: true,
  })
  relatedIds: string[];
}
